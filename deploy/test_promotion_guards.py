"""Negative release gates and real local lock processes, never a network call."""
import datetime
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import promotion_guards as guards
import test_salad_promotion as harness


class PromotionGates(harness.PromotionInterruptionTests):
    def write_fixture(self, name):
        (self.proof / (name + '.json')).write_text(json.dumps(self.fixtures[name]))

    def rejects_before_remote(self):
        with self.assertRaises((AssertionError, KeyError)):
            self.invoke()
        self.assertEqual(self.replacements, [])
        self.assertEqual(self.helper_commands, [])
        self.assertFalse((self.live / ('rollback-' + harness.SHA)).exists())

    def test_selected_proof_directory_controls_manifest_and_receipts(self):
        selected = self.root / 'qa/t01-final-20261015'
        selected.mkdir(exist_ok=True)
        for name, value in self.fixtures.items():
            (selected / (name + '.json')).write_text(json.dumps(value))
        self.expected_manifest = 'qa/t01-final-20261015/tested-source-manifest.json'
        self.invoke(proof_dir=selected)
        self.assertEqual(json.loads((selected / 'deployment.json').read_text())['status'], 'PASS')
        self.assertFalse((self.proof / 'deployment.json').exists())
        self.assertFalse((self.proof / 'ci-final.json').exists())

    def test_missing_selected_manifest_never_falls_back_to_historical_proof(self):
        selected = self.root / 'qa/t01-final-20261015'
        selected.mkdir(exist_ok=True)
        original = self.local_check_output
        requests = []
        def missing_manifest(argv, **kwargs):
            if argv[0] == 'git' and argv[2].endswith('tested-source-manifest.json'):
                requests.append(argv[2])
                raise subprocess.CalledProcessError(128, argv)
            return original(argv, **kwargs)
        with patch.object(self, 'local_check_output', side_effect=missing_manifest), self.assertRaises(subprocess.CalledProcessError):
            self.invoke(proof_dir=selected)
        self.assertEqual(requests, [harness.SHA + ':qa/t01-final-20261015/tested-source-manifest.json'])
        self.assertEqual(self.replacements, [])
        self.assertEqual(self.helper_commands, [])

    def test_empty_backup_cannot_pass_vacuous_all(self):
        self.fixtures['backup-restore']['artifacts'] = {}
        self.write_fixture('backup-restore')
        self.rejects_before_remote()

    def test_missing_schema_and_tables_cannot_pass(self):
        self.fixtures['backup-restore']['restoredSchema'] = {}
        self.write_fixture('backup-restore')
        self.rejects_before_remote()

    def test_stale_backup_refused(self):
        self.fixtures['backup-restore']['observedAt'] = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=5)).isoformat()
        self.write_fixture('backup-restore')
        self.rejects_before_remote()

    def test_future_backup_refused(self):
        self.fixtures['backup-restore']['observedAt'] = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)).isoformat()
        self.write_fixture('backup-restore')
        self.rejects_before_remote()

    def test_sql_apply_for_other_source_refused(self):
        self.fixtures['checkpoint-apply']['source'] = 'e' * 40
        self.write_fixture('checkpoint-apply')
        self.rejects_before_remote()

    def test_sql_apply_unknown_refused(self):
        self.fixtures['checkpoint-apply']['status'] = 'UNKNOWN'
        self.write_fixture('checkpoint-apply')
        self.rejects_before_remote()

    def test_sql_migration_hash_mismatch_refused(self):
        self.fixtures['checkpoint-restore']['migrationSha256'] = 'e' * 64
        self.write_fixture('checkpoint-restore')
        self.rejects_before_remote()

    def test_live_sql_drift_refused_before_snapshot(self):
        self.definitions = [{'definition': 'foreign drift'}]
        with self.assertRaises(guards.RemoteOutcomeUnknown):
            self.invoke()
        self.assertEqual(self.replacements, [])
        self.assertFalse((self.live / ('rollback-' + harness.SHA)).exists())

    def test_ssh_nonzero_after_replace_never_rolls_back(self):
        self.ssh_fault = 'nonzero'
        with self.assertRaisesRegex(RuntimeError, 'PROMOTION_UNKNOWN'):
            self.invoke()
        self.assertEqual(self.replacements, [harness.NEW_IMAGE])
        self.assertEqual(self.receipt('deployment')['status'], 'UNKNOWN')
        self.assertFalse((self.proof / 'automatic-rollback.json').exists())

    def test_ssh_timeout_after_replace_never_rolls_back(self):
        self.ssh_fault = subprocess.TimeoutExpired('ssh', 120)
        with self.assertRaisesRegex(RuntimeError, 'PROMOTION_UNKNOWN'):
            self.invoke()
        self.assertEqual(self.replacements, [harness.NEW_IMAGE])
        self.assertFalse((self.proof / 'automatic-rollback.json').exists())

    def test_local_keyboard_interrupt_after_replace_never_rolls_back(self):
        self.ssh_fault = KeyboardInterrupt()
        with self.assertRaisesRegex(RuntimeError, 'PROMOTION_UNKNOWN'):
            self.invoke()
        self.assertEqual(self.replacements, [harness.NEW_IMAGE])
        self.assertFalse((self.proof / 'automatic-rollback.json').exists())

    def test_rollback_preserves_foreign_compose(self):
        self.auth_exit = 1
        foreign = b'foreign compose mutation\n'
        self.drift_after_promote = lambda: (self.live / 'compose.yml').write_bytes(foreign)
        with self.assertRaisesRegex(RuntimeError, 'ROLLBACK_UNCONFIRMED'):
            self.invoke()
        self.assertEqual((self.live / 'compose.yml').read_bytes(), foreign)
        self.assertEqual(self.replacements, [harness.NEW_IMAGE])

    def test_rollback_preserves_foreign_runtime(self):
        self.auth_exit = 1
        foreign = b'foreign runtime mutation\n'
        self.drift_after_promote = lambda: (self.live / 'runtime/.env').write_bytes(foreign)
        with self.assertRaisesRegex(RuntimeError, 'ROLLBACK_UNCONFIRMED'):
            self.invoke()
        self.assertEqual((self.live / 'runtime/.env').read_bytes(), foreign)
        self.assertEqual(self.replacements, [harness.NEW_IMAGE])

    def test_rollback_preserves_foreign_image(self):
        self.auth_exit = 1
        self.drift_after_promote = lambda: setattr(self, 'current_image', 'sha256:' + 'f' * 64)
        with self.assertRaisesRegex(RuntimeError, 'ROLLBACK_UNCONFIRMED'):
            self.invoke()
        self.assertEqual(self.replacements, [harness.NEW_IMAGE])

    def test_existing_unknown_operation_fences_new_snapshot(self):
        guards.begin_operation(self.live, self.live / 'prior', 'promote')
        with self.assertRaises(guards.RemoteOutcomeUnknown):
            self.invoke()
        self.assertEqual(self.replacements, [])
        self.assertFalse((self.live / ('rollback-' + harness.SHA)).exists())

    def test_permissions_missing_apply_refused_before_remote(self):
        (self.proof / 'client-permissions-apply.json').unlink()
        with self.assertRaises(FileNotFoundError):
            self.invoke()
        self.assertEqual(self.replacements, [])
        self.assertEqual(self.helper_commands, [])

    def test_permissions_restore_truthy_flags_refused(self):
        self.fixtures['client-permissions-restore']['stateRestoredExactly'] = 1
        self.write_fixture('client-permissions-restore')
        self.rejects_before_remote()

    def test_permissions_wrong_migration_refused(self):
        self.fixtures['client-permissions-restore']['migrationSha256'] = 'e' * 64
        self.write_fixture('client-permissions-restore')
        self.rejects_before_remote()

    def test_permissions_wrong_source_refused(self):
        self.fixtures['client-permissions-apply']['source'] = 'e' * 40
        self.write_fixture('client-permissions-apply')
        self.rejects_before_remote()

    def test_permissions_unverified_state_refused(self):
        self.fixtures['client-permissions-apply']['stateVerified'] = 1
        self.write_fixture('client-permissions-apply')
        self.rejects_before_remote()

    def test_permissions_wrong_state_refused(self):
        self.fixtures['client-permissions-apply']['stateSha256'] = 'e' * 64
        self.write_fixture('client-permissions-apply')
        self.rejects_before_remote()

    def test_permissions_apply_before_backup_refused(self):
        self.fixtures['client-permissions-apply']['observedAt'] = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=5)).isoformat()
        self.write_fixture('client-permissions-apply')
        self.rejects_before_remote()

    def test_live_permissions_drift_refused_before_snapshot(self):
        self.permission_state = [{'name': 'foreign permission drift'}]
        with self.assertRaises(guards.RemoteOutcomeUnknown):
            self.invoke()
        self.assertEqual(self.replacements, [])
        self.assertFalse((self.live / ('rollback-' + harness.SHA)).exists())

    def test_live_permissions_rechecked_before_replacement(self):
        original = self.helper_ssh
        def alter_after_rollback_probe(command, **kwargs):
            result = original(command, **kwargs)
            if command.startswith('docker stop '):
                self.permission_state = [{'name': 'foreign permission drift'}]
            return result
        with patch.object(self, 'helper_ssh', side_effect=alter_after_rollback_probe), self.assertRaisesRegex(RuntimeError, 'PROMOTION_UNKNOWN'):
            self.invoke()
        self.assertEqual(self.replacements, [])

    def test_live_permissions_rechecked_before_success_receipt(self):
        self.drift_after_promote = lambda: setattr(self, 'permission_state', [{'name': 'foreign permission drift'}])
        with self.assertRaisesRegex(RuntimeError, 'PROMOTION_UNKNOWN'):
            self.invoke()
        self.assertEqual(self.replacements, [harness.NEW_IMAGE])
        self.assertEqual(self.receipt('deployment')['status'], 'UNKNOWN')
        self.assertFalse((self.proof / 'automatic-rollback.json').exists())


    def test_social_apply_missing_refused(self):
        (self.proof / 'social-history-apply.json').unlink()
        with self.assertRaises(FileNotFoundError):
            self.invoke()
        self.assertEqual(self.replacements, [])
        self.assertEqual(self.helper_commands, [])

    def test_social_restore_truthy_flags_refused(self):
        self.fixtures['social-history-restore']['rollbackPreservesHistory'] = 1
        self.write_fixture('social-history-restore')
        self.rejects_before_remote()

    def test_social_restore_changed_production_refused(self):
        self.fixtures['social-history-restore']['productionChanged'] = True
        self.write_fixture('social-history-restore')
        self.rejects_before_remote()

    def test_social_restore_requires_distinct_preserved_history_state(self):
        self.fixtures['social-history-restore']['rollbackStateSha256'] = self.fixtures['social-history-restore']['beforeStateSha256']
        self.write_fixture('social-history-restore')
        self.rejects_before_remote()

    def test_social_wrong_migration_refused(self):
        self.fixtures['social-history-restore']['migrationSha256'] = 'e' * 64
        self.write_fixture('social-history-restore')
        self.rejects_before_remote()

    def test_social_wrong_source_refused(self):
        self.fixtures['social-history-apply']['source'] = 'e' * 40
        self.write_fixture('social-history-apply')
        self.rejects_before_remote()

    def test_social_apply_unknown_refused(self):
        self.fixtures['social-history-apply']['status'] = 'UNKNOWN'
        self.write_fixture('social-history-apply')
        self.rejects_before_remote()

    def test_social_unverified_state_refused(self):
        self.fixtures['social-history-apply']['stateVerified'] = 1
        self.write_fixture('social-history-apply')
        self.rejects_before_remote()

    def test_social_wrong_state_refused(self):
        self.fixtures['social-history-apply']['stateSha256'] = 'e' * 64
        self.write_fixture('social-history-apply')
        self.rejects_before_remote()

    def test_social_apply_before_backup_refused(self):
        self.fixtures['social-history-apply']['observedAt'] = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=5)).isoformat()
        self.write_fixture('social-history-apply')
        self.rejects_before_remote()

    def test_live_social_drift_refused_before_snapshot(self):
        self.social_state = {'table': 'foreign history state'}
        with self.assertRaises(guards.RemoteOutcomeUnknown):
            self.invoke()
        self.assertEqual(self.replacements, [])
        self.assertFalse((self.live / ('rollback-' + harness.SHA)).exists())

    def test_live_social_rechecked_before_replacement(self):
        original = self.helper_ssh
        def alter_after_rollback_probe(command, **kwargs):
            result = original(command, **kwargs)
            if command.startswith('docker stop '):
                self.social_state = {'table': 'foreign history state'}
            return result
        with patch.object(self, 'helper_ssh', side_effect=alter_after_rollback_probe), self.assertRaisesRegex(RuntimeError, 'PROMOTION_UNKNOWN'):
            self.invoke()
        self.assertEqual(self.replacements, [])

    def test_live_social_rechecked_before_success_receipt(self):
        self.drift_after_promote = lambda: setattr(self, 'social_state', {'table': 'foreign history state'})
        with self.assertRaisesRegex(RuntimeError, 'PROMOTION_UNKNOWN'):
            self.invoke()
        self.assertEqual(self.replacements, [harness.NEW_IMAGE])
        self.assertEqual(self.receipt('deployment')['status'], 'UNKNOWN')
        self.assertFalse((self.proof / 'automatic-rollback.json').exists())


class LocalLockAndSnapshotTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='sutra-lock-test-')
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

    def test_old_snapshot_without_cas_is_explicitly_rejected(self):
        snapshot = self.root / ('rollback-' + 'a' * 40)
        snapshot.mkdir(mode=0o700)
        (snapshot / 'complete').touch(mode=0o600)
        with self.assertRaisesRegex(AssertionError, 'UNCERTIFIED_SNAPSHOT'):
            guards.snapshot_contract(self.root, snapshot)

    def test_nonblocking_lock_is_shared_across_processes(self):
        code = 'import sys;from pathlib import Path;from promotion_guards import acquire_lock;lock=acquire_lock(Path(sys.argv[1]));print("ready",flush=True);sys.stdin.readline()'
        child = subprocess.Popen([sys.executable, '-c', code, str(self.root)], cwd=Path(guards.__file__).parent,
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            self.assertEqual(child.stdout.readline().strip(), 'ready')
            with self.assertRaisesRegex(RuntimeError, 'DEPLOYMENT_BUSY'):
                guards.acquire_lock(self.root)
        finally:
            child.communicate('\n', timeout=5)
        self.assertEqual(child.returncode, 0)
        with guards.acquire_lock(self.root):
            pass

    def test_child_inherits_lock_after_parent_descriptor_closes(self):
        lock = guards.acquire_lock(self.root)
        child = subprocess.Popen([sys.executable, '-c', 'import sys;print("ready",flush=True);sys.stdin.readline()'],
            pass_fds=(lock.fileno(),), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            self.assertEqual(child.stdout.readline().strip(), 'ready')
            lock.close()
            with self.assertRaisesRegex(RuntimeError, 'DEPLOYMENT_BUSY'):
                guards.acquire_lock(self.root)
        finally:
            lock.close()
            child.communicate('\n', timeout=5)
        self.assertEqual(child.returncode, 0)
        with guards.acquire_lock(self.root):
            pass


class ConcurrencyProducerTests(unittest.TestCase):
    def test_pause_and_control_are_before_any_ddl(self):
        root = Path(__file__).resolve().parents[1] / 'qa/t01-consolidation-20261014'
        modules = []
        for name in ('checkpoint-transition', 'verify-checkpoint-concurrency'):
            spec = importlib.util.spec_from_file_location(name, root / (name + '.py'))
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            modules.append(module)
        checkpoint, producer = modules
        sql = checkpoint.guarded_sql([], 'BEGIN; CREATE OR REPLACE FUNCTION example(); COMMIT;')
        locked = producer.pause_before_ddl(sql)
        unlocked = producer.pause_before_ddl(sql, locking=False)
        self.assertLess(locked.index('FOR UPDATE'), locked.index('pg_sleep'))
        self.assertLess(locked.index('pg_sleep'), locked.index('DO $sutra_transition_guard$'))
        self.assertLess(locked.index('pg_sleep'), locked.index('CREATE OR REPLACE'))
        self.assertNotIn('FOR UPDATE', unlocked)
        self.assertEqual(locked.replace(' FOR UPDATE OF p;', ';'), unlocked)
        compile(producer.build_source((root / 'checkpoint-transition.py').read_text(), {}, {}, ''), '<generated-proof>', 'exec')


if __name__ == '__main__':
    unittest.main()
