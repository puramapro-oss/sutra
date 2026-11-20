"""Local simulations of the additive history wrapper; no SSH or database."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('social_history_transition', HERE / 'social-history-transition.py')
history = importlib.util.module_from_spec(spec)
with patch('subprocess.run', side_effect=AssertionError('IMPORT_MUST_BE_INERT')):
    spec.loader.exec_module(history)
ENGINE_SOURCE = (history.ROOT / history.ENGINE).read_text()
MIGRATION = (history.ROOT / history.MIGRATION).read_text()
ROLLBACK = (history.ROOT / history.ROLLBACK).read_text()
BASELINE = json.loads((HERE / 'social-history-baseline-metadata.json').read_text())
APPLIED = json.loads((HERE / 'social-history-metadata.json').read_text())
REVERTED = json.loads((HERE / 'social-history-rollback-metadata.json').read_text())


def backup_fixture(directory):
    names = ['sutra.dump', 'public-social.dump', 'public-social-dependencies.sql',
        'sutra-assets.tar.gz', 'storage-metadata.json', 'referenced-auth-ids.json']
    return {'database': 'sutra_restore_t01_fixture', 'directory': str(directory),
        'artifacts': {name: {'sha256': hashlib.sha256(b'fixture').hexdigest()} for name in names},
        'restoredSchema': {name: True for name in ['jobs', 'quota', 'journals', 'mediaOwnership']},
        'rowCountsMatch': True, 'productionDdl': False, 'restoredTables': 141, 'migrations': [],
        'observedAt': history.datetime.datetime.now(history.datetime.timezone.utc).isoformat()}


def proof_fixture(protected):
    return {'status': 'PASS', 'productionChanged': False, 'dataUnchanged': True,
        'replaySafe': True, 'rollbackPreservesHistory': True,
        'beforeStateSha256': history.digest(BASELINE), 'afterStateSha256': history.digest(APPLIED),
        'rollbackStateSha256': history.digest(REVERTED),
        'migrationSha256': hashlib.sha256(MIGRATION.encode()).hexdigest(),
        'rollbackSha256': hashlib.sha256(ROLLBACK.encode()).hexdigest(),
        'protectedRollback': str(protected)}


class HistoryTransitionTests(unittest.TestCase):
    def test_embedded_metadata_matches_canonical_and_absence_is_supported(self):
        self.assertEqual(history.STATE_SQL, (history.ROOT / history.METADATA).read_text())
        with patch.object(history, 'query', return_value=json.dumps(BASELINE)) as query:
            self.assertEqual(history.state('fixture'), BASELINE)
            query.assert_called_once_with('fixture', history.STATE_SQL)

    def test_guard_locks_scoped_tables_and_catalogs_before_cas(self):
        guarded = history.guarded_sql(BASELINE, MIGRATION)
        self.assertLess(guarded.index('LOCK TABLE public.social_accounts'), guarded.index('IF ('))
        self.assertIn('FOR UPDATE OF p', guarded)
        self.assertIn('SUTRA_SOCIAL_HISTORY_STATE_DRIFT', guarded)
        self.assertEqual(guarded.count('COMMIT;'), 1)
        with self.assertRaises(AssertionError):
            history.guarded_sql({'untrusted_definition': '$history_guard$'}, MIGRATION)

    def test_rollback_shape_rejects_weakened_acl_or_missing_history(self):
        history.rollback_shape(APPLIED, REVERTED)
        for key, value in [('table', None), ('policies', []), ('columns', [])]:
            bad = copy.deepcopy(REVERTED)
            bad[key] = value
            with self.assertRaises(AssertionError):
                history.rollback_shape(APPLIED, bad)

    def rehearse(self, failure=None):
        with tempfile.TemporaryDirectory(prefix='sutra-history-wrapper-') as directory:
            root = Path(directory)
            folder = root / 'backup'
            folder.mkdir()
            backup = backup_fixture('/opt/purama/apps/sutra/backup')
            for name in backup['artifacts']:
                (folder / name).write_text('fixture')
            states = {'copy': BASELINE}
            calls = []

            def query(database, sql):
                self.assertEqual(database, backup['database'])
                calls.append('migration' if sql.endswith(MIGRATION[MIGRATION.index('COMMIT;'):])
                    and 'CREATE TABLE IF NOT EXISTS' in sql else 'rollback')
                if failure == 'uncertain':
                    raise subprocess.TimeoutExpired('fixture', 90)
                states['copy'] = APPLIED if calls[-1] == 'migration' else REVERTED

            def state(database):
                return BASELINE if database == 'postgres' else states['copy']

            def local_path(value):
                return Path(str(value).replace('/opt/purama/apps/sutra', str(root)))

            def data(database):
                self.assertNotEqual(database, 'postgres')
                return 'changed' if failure == 'data' and calls else 'same-facts'

            with patch.object(history, 'Path', side_effect=local_path), \
                patch.object(history, 'state', side_effect=state), \
                patch.object(history, 'query', side_effect=query), \
                patch.object(history, 'data_digest', side_effect=data):
                if failure:
                    with self.assertRaises((AssertionError, subprocess.TimeoutExpired)):
                        history.verify_copy(backup, MIGRATION, ROLLBACK, ENGINE_SOURCE)
                    self.assertEqual(calls, ['migration'])
                    return
                receipt = history.verify_copy(backup, MIGRATION, ROLLBACK, ENGINE_SOURCE)
            self.assertEqual(calls, ['migration', 'migration', 'rollback', 'migration', 'rollback'])
            self.assertEqual(receipt['status'], 'PASS')
            self.assertNotEqual(receipt['beforeStateSha256'], receipt['rollbackStateSha256'])
            self.assertTrue(receipt['rollbackPreservesHistory'])
            self.assertTrue(receipt['dataUnchanged'])
            self.assertFalse(receipt['productionChanged'])
            protected = Path(receipt['protectedRollback'])
            self.assertEqual(protected.stat().st_mode & 0o777, 0o700)
            for file in protected.iterdir():
                self.assertEqual(file.stat().st_mode & 0o777, 0o600)

    def test_rehearsal_apply_replay_retaining_rollback_reapply_and_second_rollback(self):
        self.rehearse()

    def test_copy_data_change_fails_before_replay_or_rollback(self):
        self.rehearse('data')

    def test_copy_timeout_never_compensates_or_resubmits(self):
        self.rehearse('uncertain')

    def invoke_adapter(self, mode='apply', failure=None):
        with tempfile.TemporaryDirectory(prefix='sutra-history-adapter-') as directory:
            folder = Path(directory)
            protected = folder / 'protected'
            protected.mkdir(mode=0o700)
            rollback = protected / 'rollback.sql'
            rollback.write_text(ROLLBACK)
            rollback.chmod(0o600)
            proof = proof_fixture(protected)
            current = {'state': BASELINE if mode == 'apply' else APPLIED}
            calls = []
            engine = history.load_engine(ENGINE_SOURCE)

            class Port:
                def __init__(self, config):
                    self.config, self.proof = config, config['proof']

                def preflight(self, current_mode):
                    calls.append('preflight')
                    if failure == 'gate':
                        raise AssertionError('private-fixture-value')

                def snapshot(self, expected):
                    calls.append('snapshot')
                    if failure == 'drift':
                        current['state'] = {'foreign': True}

                def execute(self, sql):
                    if sql == history.STATE_SQL:
                        return json.dumps(current['state'])
                    calls.append('sql')
                    if failure == 'timeout':
                        raise subprocess.TimeoutExpired('fixture', 60)
                    if failure == 'transport':
                        raise engine['UnconfirmedSqlExecution']()
                    if failure == 'drift':
                        raise RuntimeError('private-fixture-value')
                    current['state'] = APPLIED if mode == 'apply' else REVERTED
                    return ''

            engine['RemotePort'] = Port
            config = {'sha': 'a' * 40, 'proof': proof, 'mode': mode, 'backup': {'directory': str(folder)}}
            with patch.object(history, 'load_engine', return_value=engine):
                receipt = history.remote_apply(config, MIGRATION, ENGINE_SOURCE)
            self.assertNotIn('private-fixture-value', str(receipt))
            return receipt, calls

    def test_apply_receipt_uses_verified_applied_state(self):
        receipt, calls = self.invoke_adapter()
        self.assertEqual(receipt['status'], 'PASS')
        self.assertTrue(receipt['stateVerified'])
        self.assertEqual(receipt['stateSha256'], history.digest(APPLIED))
        self.assertEqual(calls, ['preflight', 'snapshot', 'sql'])

    def test_rollback_receipt_uses_retained_history_state(self):
        receipt, calls = self.invoke_adapter('rollback')
        self.assertEqual(receipt['status'], 'PASS')
        self.assertEqual(receipt['stateSha256'], history.digest(REVERTED))
        self.assertEqual(calls.count('sql'), 1)

    def test_preflight_failure_never_submits(self):
        receipt, calls = self.invoke_adapter(failure='gate')
        self.assertEqual(receipt['status'], 'FAIL')
        self.assertEqual(calls, ['preflight'])

    def test_timeout_transport_and_drift_cannot_claim_verified_state(self):
        for failure in ['timeout', 'transport', 'drift']:
            with self.subTest(failure=failure):
                receipt, calls = self.invoke_adapter(failure=failure)
                self.assertEqual(receipt['status'], 'UNKNOWN')
                self.assertFalse(receipt['stateVerified'])
                self.assertNotIn('stateSha256', receipt)
                self.assertEqual(calls.count('sql'), 1)

    def invoke_cli(self, failure=None):
        with tempfile.TemporaryDirectory(prefix='sutra-history-cli-') as directory:
            root = Path(directory)
            here = root / 'qa/t01-final-20261015'
            here.mkdir(parents=True)
            for relative in (history.MIGRATION, history.ENGINE, history.METADATA, history.ROLLBACK,
                'qa/t01-final-20261015/social-history-transition.py'):
                target = root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text((history.ROOT / relative).read_text())
            backup = backup_fixture('/opt/purama/apps/sutra/fixture')
            if failure == 'stale':
                backup['observedAt'] = '2020-01-01T00:00:00+00:00'
            (here / 'backup-restore.json').write_text(json.dumps(backup))
            proof = proof_fixture('/opt/purama/apps/sutra/fixture/protected')
            if failure == 'proof':
                proof['rollbackPreservesHistory'] = False
            (here / 'social-history-restore.json').write_text(json.dumps(proof))
            candidate = {'source': 'a' * 40, 'status': 'PASS', 'network': 'none'}
            if failure == 'candidate':
                candidate['source'] = 'b' * 40
            (here / 'candidate.json').write_text(json.dumps(candidate))
            if failure == 'existing':
                (here / 'social-history-apply.json').write_text('{}')
            calls = []

            def read_command(command, **kwargs):
                calls.append(command[0])
                if command[0] == 'git':
                    return 'foreign' if failure == 'commit' else (root / command[2].split(':', 1)[1]).read_text()
                self.assertEqual(command[:3], ['gh', 'run', 'view'])
                return json.dumps({'headSha': 'a' * 40, 'status': 'completed',
                    'conclusion': 'failure' if failure == 'ci' else 'success',
                    'jobs': [{'conclusion': 'success'}] * 3})

            def remote(command, **kwargs):
                self.assertEqual(command[0], 'ssh')
                calls.append('ssh')
                compile(kwargs['input'], '<generated-remote-fixture>', 'exec')
                receipt = {'status': 'PASS', 'stateVerified': True, 'stateSha256': history.digest(APPLIED)}
                return subprocess.CompletedProcess(command, 0, json.dumps(receipt), '')

            with patch.object(history, 'HERE', here), patch.object(history, 'ROOT', root), \
                patch.object(history, '__file__', str(here / 'social-history-transition.py')), \
                patch.object(history.subprocess, 'check_output', side_effect=read_command), \
                patch.object(history.subprocess, 'run', side_effect=remote), \
                patch.object(sys, 'argv', ['fixture', 'apply', '--source-ref', 'a' * 40, '--ci-run', '123']), \
                patch('builtins.print'):
                if failure:
                    with self.assertRaises(AssertionError):
                        history.main()
                    self.assertNotIn('ssh', calls)
                else:
                    with self.assertRaises(SystemExit) as exited:
                        history.main()
                    self.assertEqual(exited.exception.code, 0)
                    receipt = json.loads((here / 'social-history-apply.json').read_text())
                    self.assertEqual(receipt['source'], 'a' * 40)
                    self.assertEqual(receipt['mode'], 'apply')
                    self.assertTrue(receipt['stateVerified'])
                    self.assertIn('observedAt', receipt)
                    self.assertEqual(calls.count('ssh'), 1)

    def test_cli_commit_ci_candidate_backup_and_receipt_are_bound(self):
        self.invoke_cli()

    def test_cli_failed_gate_never_contacts_remote(self):
        for failure in ['commit', 'ci', 'candidate', 'stale', 'proof', 'existing']:
            with self.subTest(failure=failure):
                self.invoke_cli(failure)


if __name__ == '__main__':
    unittest.main(verbosity=2)
