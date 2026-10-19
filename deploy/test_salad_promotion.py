"""Exercise the real Salad promotion scripts with local process/host fixtures only.

No SSH, Docker, Node, GitHub, provider or credential access. The real embedded
remote Python also runs, against temporary files and a simulated Docker port.
"""
import contextlib
import datetime
import shutil
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import Mock, patch


SOURCE = Path(__file__).resolve().parents[1] / 'qa/t01-consolidation-20261014'
SHA = 'a' * 40
PREVIOUS = 'b' * 40
OLD_IMAGE = 'sha256:' + 'c' * 64
NEW_IMAGE = 'sha256:' + 'd' * 64
IMAGE_TAG = 'sutra-test:' + SHA
SECRET_CANARY = 'synthetic-private-value-never-export'


def module(name, **attributes):
    result = ModuleType(name)
    result.__dict__.update(attributes)
    return result


class LocalScriptCase(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='sutra-promotion-test-')
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name).resolve()
        self.proof = self.root / 'qa/t01-consolidation-20261014'
        self.proof.mkdir(parents=True)
        self.output = io.StringIO()
        for path in ['deploy/promotion_guards.py', 'deploy/ovh.py',
                'qa/t01-consolidation-20261014/promote.py',
                'qa/t01-consolidation-20261014/checkpoint-transition.py',
                'qa/t01-consolidation-20261014/run-authenticated.py',
                'qa/t01-final-20261015/client-permissions.py',
                'qa/t01-final-20261015/social-history-transition.py',
                'migrations/20261015_final_durable_integrity.sql',
                'migrations/20261015_client_write_permissions.sql',
                'migrations/20261015_social_authorization_history.sql',
                'migrations/20261019_partner_scan_atomic.sql',
                'migrations/20261020_t03_auto_scheduler.sql']:
            dest = self.root / path
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(Path(__file__).resolve().parents[1] / path, dest)


    def execute(self, filename, modules):
        # The source and all gates are unchanged; only __file__ and imported
        # process/host ports point at this test's isolated fixtures.
        source = (SOURCE / filename).read_text()
        with patch.dict(sys.modules, modules), patch.object(sys, 'path', list(sys.path)), \
                contextlib.redirect_stdout(self.output):
            exec(compile(source, str(SOURCE / filename), 'exec'), {
                '__name__': '__main__', '__file__': str(self.proof / filename),
            })

    def receipt(self, name):
        return json.loads((self.proof / (name + '.json')).read_text())


class AuthenticatedSmokeProcessTests(LocalScriptCase):
    def invoke(self, *, node_exit=0, ssh_exit=0, node_pass=True, ssh_payload=None):
        calls = []

        def docker_run(argv, **kwargs):
            self.assertEqual(argv, ['docker', 'exec', '-i', 'purama-sutra', 'node', '--input-type=module'])
            calls.append('node')
            return subprocess.CompletedProcess(argv, node_exit,
                stdout=json.dumps({'pass': node_pass, 'checks': []}), stderr=SECRET_CANARY)

        def local_run(argv, **kwargs):
            if argv[0] == 'node':
                calls.append('bundle')
                return subprocess.CompletedProcess(argv, 0, stdout='/* fixture bundle */', stderr='')
            self.assertEqual(argv[0], 'ssh')
            calls.append('ssh')
            remote_output = io.StringIO()
            # Run the exact generated remote wrapper, including its exit and
            # boolean checks. The nested subprocess is a Docker/Node stub.
            with patch.dict(sys.modules, {'subprocess': module('subprocess', run=docker_run)}), \
                    contextlib.redirect_stdout(remote_output):
                exec(compile(kwargs['input'], '<real-authenticated-remote>', 'exec'), {})
            stdout = remote_output.getvalue() if ssh_payload is None else json.dumps(ssh_payload)
            return subprocess.CompletedProcess(argv, ssh_exit, stdout=stdout, stderr=SECRET_CANARY)

        with self.assertRaises(SystemExit) as exit_result:
            self.execute('run-authenticated.py', {'subprocess': module('subprocess', run=local_run)})
        self.assertEqual(calls, ['bundle', 'ssh', 'node'])
        self.assertNotIn(SECRET_CANARY, self.output.getvalue())
        return exit_result.exception.code

    def test_node_nonzero_rejects_even_valid_pass_json(self):
        self.assertEqual(self.invoke(node_exit=42), 1)
        receipt = self.receipt('authenticated-smoke')
        self.assertIs(receipt['pass'], False)
        self.assertEqual(receipt['exit'], 42)
        self.assertEqual(receipt['gate'], 'SAFE_REMOTE_EXECUTION_FAILED')
        self.assertNotIn(SECRET_CANARY, json.dumps(receipt))

    def test_ssh_nonzero_rejects_even_valid_pass_json(self):
        self.assertEqual(self.invoke(ssh_exit=42), 'SAFE_SSH_RESULT_UNAVAILABLE')
        self.assertFalse((self.proof / 'authenticated-smoke.json').exists())

    def test_node_truthy_nonboolean_cannot_pass(self):
        self.assertEqual(self.invoke(node_pass=1), 1)
        self.assertIs(self.receipt('authenticated-smoke')['pass'], False)

    def test_ssh_truthy_nonboolean_cannot_pass(self):
        self.assertEqual(self.invoke(ssh_payload={'pass': 'true'}), 1)

    def test_zero_exits_and_boolean_success_pass(self):
        self.assertEqual(self.invoke(), 0)
        self.assertIs(self.receipt('authenticated-smoke')['pass'], True)


class PromotionInterruptionTests(LocalScriptCase):
    def setUp(self):
        super().setUp()
        self.live = self.root / 'live-sutra'
        (self.live / 'runtime').mkdir(parents=True)
        self.runtime = ('SALAD_ENABLED=false\nSYNTHETIC_TEST_VALUE=' + SECRET_CANARY + '\n').encode()
        (self.live / 'runtime/.env').write_bytes(self.runtime)
        (self.live / 'runtime/.env').chmod(0o600)
        self.compose = ('services:\n  sutra:\n    image: sutra-test:previous\n'
            '    labels:\n      traefik.http.routers.sutra.tls.certresolver: mytlschallenge\n')
        (self.live / 'compose.yml').write_text(self.compose)
        backup = self.live / 'backup-fixture'
        backup.mkdir()
        (backup / 'sutra.dump').write_bytes(b'synthetic backup')
        self.fixtures = {
            'candidate': {'source': SHA, 'status': 'PASS', 'network': 'none',
                          'image': IMAGE_TAG, 'imageId': NEW_IMAGE},
            'backup-restore': {'directory': '/opt/purama/apps/sutra/backup-fixture', 'rowCountsMatch': True,
                'observedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'restoredTables': 141,
                'restoredSchema': {'jobs': True, 'quota': True, 'journals': True, 'mediaOwnership': True},
                'productionDdl': False, 'migrations': [], 'artifacts': {'sutra.dump': {
                    'sha256': hashlib.sha256(b'synthetic backup').hexdigest()}}},
            'ovh-preflight': {'source': PREVIOUS, 'imageId': OLD_IMAGE, 'health': 'healthy',
                'saladEnabled': False, 'otherContainers': [
                    {'name': 'supabase-db', 'id': 'unchanged-database', 'startedAt': 'unchanged-start'}]},
        }
        for name in ('public-social.dump', 'public-social-dependencies.sql', 'sutra-assets.tar.gz',
                     'storage-metadata.json', 'referenced-auth-ids.json'):
            (backup / name).write_bytes(b'synthetic backup')
            self.fixtures['backup-restore']['artifacts'][name] = {'sha256': hashlib.sha256(b'synthetic backup').hexdigest()}
        self.definitions = [{'definition': 'synthetic exact function'}]
        migration_hash = hashlib.sha256((self.root / 'migrations/20261015_final_durable_integrity.sql').read_bytes()).hexdigest()
        self.fixtures['checkpoint-restore'] = {'status': 'PASS', 'definitionsRestoredExactly': True,
            'aclAndOwnershipUnchanged': True, 'migrationSha256': migration_hash,
            'beforeDefinitionsSha256': 'c' * 64,
            'afterDefinitionsSha256': hashlib.sha256(json.dumps(self.definitions, sort_keys=True).encode()).hexdigest()}
        self.fixtures['checkpoint-apply'] = {'status': 'PASS', 'mode': 'apply', 'definitionsVerified': True,
            'source': SHA, 'migrationSha256': migration_hash,
            'observedAt': datetime.datetime.now(datetime.timezone.utc).isoformat()}
        self.permission_state = [{'name': 'synthetic exact permissions', 'grants': []}]
        permission_hash = hashlib.sha256((self.root / 'migrations/20261015_client_write_permissions.sql').read_bytes()).hexdigest()
        state_hash = hashlib.sha256(json.dumps(self.permission_state, sort_keys=True).encode()).hexdigest()
        self.fixtures['client-permissions-restore'] = {'status': 'PASS', 'stateRestoredExactly': True,
            'dataUnchanged': True, 'replaySafe': True, 'beforeStateSha256': 'e' * 64,
            'afterStateSha256': state_hash, 'migrationSha256': permission_hash, 'rollbackSha256': 'f' * 64,
            'protectedRollback': '/opt/purama/apps/sutra/backup-fixture/permissions-fixture'}
        self.fixtures['client-permissions-apply'] = {'status': 'PASS', 'mode': 'apply', 'source': SHA,
            'migrationSha256': permission_hash, 'stateVerified': True, 'stateSha256': state_hash,
            'observedAt': datetime.datetime.now(datetime.timezone.utc).isoformat()}
        self.social_state = {'table': 'synthetic history', 'captureActive': True}
        social_hash = hashlib.sha256((self.root / 'migrations/20261015_social_authorization_history.sql').read_bytes()).hexdigest()
        social_state_hash = hashlib.sha256(json.dumps(self.social_state, sort_keys=True).encode()).hexdigest()
        self.fixtures['social-history-restore'] = {'status': 'PASS', 'dataUnchanged': True,
            'replaySafe': True, 'rollbackPreservesHistory': True, 'productionChanged': False,
            'beforeStateSha256': 'a' * 64, 'afterStateSha256': social_state_hash,
            'rollbackStateSha256': 'b' * 64, 'migrationSha256': social_hash, 'rollbackSha256': 'c' * 64,
            'protectedRollback': '/opt/purama/apps/sutra/backup-fixture/social-fixture'}
        self.fixtures['social-history-apply'] = {'status': 'PASS', 'mode': 'apply', 'source': SHA,
            'migrationSha256': social_hash, 'stateVerified': True, 'stateSha256': social_state_hash,
            'observedAt': datetime.datetime.now(datetime.timezone.utc).isoformat()}
        import promotion_guards as guards
        self.additional_state = {'version': 'sutra-additional-migrations-v1',
            'functions': [{'name': name, 'anon': False, 'authenticated': False, 'service': True}
                for name in ('record_partner_scan', 'schedule_auto_video_jobs', 't03_reset_auto_cursor')],
            'tables': [{'name': 'partners'}, {'name': 'partner_scans',
                'indexes': [{'name': 'idx_partner_scans_window', 'valid': True}]},
                {'name': 'sutra_auto_config', 'columns': [{'name': 'scheduler_cursor',
                    'type': 'timestamp with time zone', 'notNull': True}],
                 'triggers': [{'name': 't03_auto_cursor', 'enabled': 'O'}]}]}
        self.fixtures['additional-migrations'] = {'source': SHA, 'status': 'PASS',
            'backupDirectory': self.fixtures['backup-restore']['directory'],
            'backupArtifacts': self.fixtures['backup-restore']['artifacts'],
            'migrations': {path: guards.sha256((self.root / path).read_bytes()) for path in guards.ADDITIONAL_MIGRATIONS},
            'dataPreserved': True, 'replaySafe': True, 'rollbackPreservesData': True,
            'restoredStateVerified': True, 'productionChangedByRehearsal': False,
            'rehearsedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'appliedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'protectedRollback': '/opt/purama/apps/sutra/backup-fixture/additional-fixture',
            'beforeStateSha256': '1' * 64, 'rollbackStateSha256': '2' * 64,
            'afterStateSha256': guards.sha256(json.dumps(self.additional_state, sort_keys=True).encode()),
            'stateQuerySha256': guards.sha256(guards.ADDITIONAL_SCHEMA_SQL.encode()),
            'afterState': self.additional_state}
        for name, value in self.fixtures.items():
            (self.proof / (name + '.json')).write_text(json.dumps(value))
        helper_path = self.root / 'helper.py'
        helper_path.write_bytes(b'synthetic pinned helper')
        self.ovh = module('ovh', HELPER=helper_path,
            HELPER_SHA256=hashlib.sha256(helper_path.read_bytes()).hexdigest(), REMOTE_ROOT=str(self.live))
        self.current_image = OLD_IMAGE
        self.replacements = []
        self.interrupt_after_replace = False
        self.helper_commands = []
        self.auth_exit = 0
        self.ssh_fault = None
        self.drift_after_promote = None

    def docker_inspect(self, name):
        if name == 'supabase-db':
            return {'Id': 'unchanged-database', 'State': {'StartedAt': 'unchanged-start'}}
        self.assertEqual(name, 'purama-sutra')
        return {'Image': self.current_image, 'RestartCount': 0,
            'State': {'Health': {'Status': 'healthy'}, 'StartedAt': 'test-start'},
            'Config': {'Labels': {'dev.purama.commit': SHA if self.current_image == NEW_IMAGE else PREVIOUS,
                'com.docker.compose.project.config_files': str(self.live / 'compose.yml')}}}

    def remote_check_output(self, argv, **kwargs):
        if argv[:2] == ['docker', 'inspect']:
            return json.dumps([self.docker_inspect(argv[2])]).encode()
        self.assertEqual(argv[:3], ['docker', 'image', 'inspect'])
        self.assertEqual(argv[-1], IMAGE_TAG)
        if argv[3] == '--format={{.Id}}':
            return NEW_IMAGE + '\n'
        self.assertEqual(argv[3], '--format={{index .Config.Labels "dev.purama.commit"}}')
        return SHA + '\n'

    def remote_run(self, argv, **kwargs):
        if argv[:4] == ['docker', 'exec', '-i', 'supabase-db']:
            sql = kwargs['input']
            if 'sutra-additional-migrations-v1' in sql:
                data = self.additional_state
            elif 'social_authorization_history' in sql:
                data = self.social_state
            else:
                data = self.permission_state if 'AS grants' in sql else self.definitions
            return subprocess.CompletedProcess(argv, 0, stdout=json.dumps(data), stderr='')
        if argv[:2] == ['docker', 'logs']:
            return subprocess.CompletedProcess(argv, 0, stdout='Ready in 1ms\n', stderr='')
        self.assertEqual(argv[:2], ['docker', 'compose'])
        if 'up' in argv:
            self.assertEqual(argv[-6:], ['up', '-d', '--no-deps', '--pull', 'never', 'sutra'])
            self.current_image = NEW_IMAGE if IMAGE_TAG in (self.live / 'compose.yml').read_text() else OLD_IMAGE
            self.replacements.append(self.current_image)
            if self.interrupt_after_replace and self.current_image == NEW_IMAGE:
                self.interrupt_after_replace = False
                raise KeyboardInterrupt('synthetic interruption after container replacement')
        else:
            self.assertEqual(argv[-2:], ['config', '-q'])
        return subprocess.CompletedProcess(argv, 0, stdout=b'', stderr=b'')

    def execute_remote(self, source):
        # Keep the real snapshot, replace, rollback, hashing and permission
        # checks. Only the absolute production root is mapped into a fixture.
        def local_path(value):
            value = str(value)
            return self.live / value.removeprefix('/opt/purama/apps/sutra/').removeprefix('/opt/purama/apps/sutra') if value.startswith('/opt/purama/apps/sutra') else Path(value)

        output = io.StringIO()
        with patch.dict(sys.modules, {
            'pathlib': module('pathlib', Path=local_path),
            'os': os,
            'subprocess': module('subprocess', run=self.remote_run, check_output=self.remote_check_output),
        }), contextlib.redirect_stdout(output):
            namespace = {}
            try:
                exec(compile(source, '<real-promotion-remote>', 'exec'), namespace)
            finally:
                if 'lock' in namespace:
                    namespace['lock'].close()
        return output.getvalue()

    def helper_ssh(self, command, capture=False):
        self.assertTrue(capture)
        self.helper_commands.append(command)
        if command.startswith('docker run '):
            self.assertIn('--network none', command)
            self.assertIn(OLD_IMAGE, command)
            stdout = ''
        elif command.startswith('docker stop '):
            stdout = ''
        elif command.startswith('docker inspect '):
            stdout = 'healthy\n'
        else:
            self.assertTrue(command.startswith('docker exec '))
            stdout = json.dumps([{'path': '/', 'status': 200}])
        return subprocess.CompletedProcess(command, 0, stdout=stdout, stderr='')

    def local_run(self, argv, **kwargs):
        if argv[0] == 'ssh':
            self.assertEqual(argv[-1], 'python3 -')
            try:
                stdout = self.execute_remote(kwargs['input'])
            except BaseException:
                return subprocess.CompletedProcess(argv, 1, stdout='', stderr=SECRET_CANARY)
            if "replace_compose(root,snapshot,'promote'" in kwargs['input'] and self.ssh_fault:
                if self.ssh_fault == 'nonzero':
                    return subprocess.CompletedProcess(argv, 255, stdout=stdout, stderr=SECRET_CANARY)
                raise self.ssh_fault
            return subprocess.CompletedProcess(argv, 0, stdout=stdout, stderr='')
        self.assertEqual(argv[:2], [sys.executable, '-c'])
        if self.drift_after_promote:
            self.drift_after_promote()
        return subprocess.CompletedProcess(argv, self.auth_exit, stdout=b'', stderr=b'')

    def local_check_output(self, argv, **kwargs):
        if argv[0] == 'gh':
            self.assertEqual(argv[3], '123')
            return json.dumps({'headSha': SHA, 'status': 'completed', 'conclusion': 'success',
                'jobs': [{'conclusion': 'success'} for _ in range(3)]}).encode()
        self.assertEqual(argv[:2], ['git', 'show'])
        self.assertTrue(argv[2].startswith(SHA + ':'))
        data = b'synthetic tested source'
        if argv[2].endswith('tested-source-manifest.json'):
            expected = getattr(self, 'expected_manifest', 'qa/t01-consolidation-20261014/tested-source-manifest.json')
            self.assertEqual(argv[2], SHA + ':' + expected)
            return json.dumps({'files': [{'path': 'src/test-source',
                'sha256': hashlib.sha256(data).hexdigest()}]}).encode()
        if argv[2] == SHA + ':src/test-source':
            return data
        return (self.root / argv[2].split(':', 1)[1]).read_bytes()

    def invoke(self, *, proof_dir=None):
        helper = SimpleNamespace(SSH_KEY=self.root / 'unused-key', REMOTE='fixture.invalid', ssh=self.helper_ssh)
        spec = SimpleNamespace(loader=SimpleNamespace(exec_module=lambda target: None))
        process = module('subprocess', run=self.local_run, check_output=self.local_check_output,
                         CalledProcessError=subprocess.CalledProcessError, TimeoutExpired=subprocess.TimeoutExpired)
        import promotion_guards
        argv = ['promote.py', '--source-ref', SHA, '--ci-run', '123']
        if proof_dir is not None:
            argv += ['--proof-dir', str(proof_dir)]
        with patch.object(promotion_guards.subprocess, 'run', side_effect=self.local_run), patch.object(sys, 'argv', argv), \
                patch.object(importlib.util, 'spec_from_file_location', return_value=spec), \
                patch.object(importlib.util, 'module_from_spec', return_value=helper):
            self.execute('promote.py', {'ovh': self.ovh, 'subprocess': process, 'time': module('time', sleep=Mock())})

    def test_interruption_after_container_replacement_never_races_rollback(self):
        self.interrupt_after_replace = True
        with self.assertRaisesRegex(RuntimeError, 'PROMOTION_UNKNOWN_NO_CONCURRENT_ROLLBACK'):
            self.invoke()
        self.assertEqual(self.replacements, [NEW_IMAGE])
        self.assertEqual(self.current_image, NEW_IMAGE)
        self.assertFalse((self.proof / 'automatic-rollback.json').exists())
        self.assertEqual(self.receipt('deployment')['status'], 'UNKNOWN')
        self.assertEqual(json.loads((self.live / '.deployment-operation.json').read_text())['phase'], 'running')
        self.assertNotIn(SECRET_CANARY, self.output.getvalue())

    def test_confirmed_promotion_then_failed_smoke_restores_previous_image(self):
        self.auth_exit = 1
        with self.assertRaisesRegex(RuntimeError, 'PROMOTION_FAILED_REVIEW_REDACTED_RECEIPTS'):
            self.invoke()
        self.assertEqual(self.replacements, [NEW_IMAGE, OLD_IMAGE])
        self.assertEqual(self.current_image, OLD_IMAGE)
        self.assertEqual((self.live / 'compose.yml').read_text(), self.compose)
        self.assertEqual((self.live / 'runtime/.env').read_bytes(), self.runtime)
        self.assertFalse((self.proof / 'deployment.json').exists())
        receipt = self.receipt('automatic-rollback')
        self.assertEqual(receipt['status'], 'RESTORED')
        self.assertEqual(receipt['health'], 'healthy')
        self.assertEqual(receipt['image'], OLD_IMAGE)
        self.assertNotIn(SECRET_CANARY, self.output.getvalue())

    def test_success_promotes_only_sutra_and_keeps_runtime(self):
        self.invoke()
        self.assertEqual(self.replacements, [NEW_IMAGE])
        self.assertEqual(self.current_image, NEW_IMAGE)
        self.assertEqual((self.live / 'runtime/.env').read_bytes(), self.runtime)
        self.assertFalse((self.proof / 'automatic-rollback.json').exists())
        receipt = self.receipt('deployment')
        self.assertEqual(receipt['source'], SHA)
        self.assertEqual(receipt['imageId'], NEW_IMAGE)
        self.assertIs(receipt['saladEnabled'], False)
        self.assertIs(receipt['databaseChanged'], False)
        self.assertIs(receipt['otherContainersUnchanged'], True)
        self.assertNotIn(SECRET_CANARY, json.dumps(receipt) + self.output.getvalue())


if __name__ == '__main__':
    unittest.main()
