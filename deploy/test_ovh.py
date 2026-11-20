"""CLI contract simulations only: no SSH, Docker, credentials or remote writes."""
import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import re
import shlex
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import ovh

SHA = 'a' * 40


class DeploymentContract(unittest.TestCase):
    def setUp(self):
        self.helper = SimpleNamespace(ssh=Mock(), main=Mock())
        self.helper.ssh.return_value = SimpleNamespace(returncode=0,
            stdout=json.dumps({'status': 'RESTORED', 'health': 'healthy'}))
        self.spec = SimpleNamespace(loader=SimpleNamespace(exec_module=lambda module: None))
        self.stack = contextlib.ExitStack()
        self.addCleanup(self.stack.close)
        self.run = self.stack.enter_context(patch.object(ovh.subprocess, 'run'))
        self.stack.enter_context(patch.object(Path, 'read_bytes', return_value=b'pinned helper'))
        self.stack.enter_context(patch.object(ovh, 'HELPER_SHA256', hashlib.sha256(b'pinned helper').hexdigest()))
        self.stack.enter_context(patch.object(importlib.util, 'spec_from_file_location', return_value=self.spec))
        self.stack.enter_context(patch.object(importlib.util, 'module_from_spec', return_value=self.helper))

    def invoke(self, *args):
        with patch.object(ovh.sys, 'argv', ['ovh.py', *args]), contextlib.redirect_stderr(io.StringIO()), contextlib.redirect_stdout(io.StringIO()):
            ovh.main()

    def test_deploy_requires_schema_and_ci_before_any_io(self):
        for flags in [[], ['--schema-ready'], ['--ci-run', '123'], ['--schema-ready', '--ci-run', 'main']]:
            with self.subTest(flags=flags), self.assertRaises(SystemExit):
                self.invoke('deploy', '--source-ref', SHA, *flags)
        self.run.assert_not_called()
        self.helper.ssh.assert_not_called()

    def test_immutable_ref_and_shell_injection_rejected(self):
        for ref in ['main', 'abc123', SHA + ';echo invalid', 'A' * 40]:
            with self.subTest(ref=ref), self.assertRaises(SystemExit):
                self.invoke('rollback', '--source-ref', ref)
        self.run.assert_not_called()
        self.helper.ssh.assert_not_called()

    def test_deploy_delegates_only_to_canonical_gates(self):
        self.invoke('deploy', '--source-ref', SHA, '--schema-ready', '--ci-run', '123', '--proof-dir', 'qa/t01-final-20261015')
        self.run.assert_called_once_with([sys.executable, str(ovh.ROOT / 'qa/t01-consolidation-20261014/promote.py'),
            '--source-ref', SHA, '--ci-run', '123', '--proof-dir', 'qa/t01-final-20261015'], cwd=ovh.ROOT, check=True)
        self.helper.main.assert_not_called()
        self.helper.ssh.assert_not_called()

    def test_failed_gates_do_not_start_legacy_helper(self):
        self.run.side_effect = ovh.subprocess.CalledProcessError(1, 'promotion')
        with self.assertRaises(ovh.subprocess.CalledProcessError):
            self.invoke('deploy', '--source-ref', SHA, '--schema-ready', '--ci-run', '123')
        self.helper.main.assert_not_called()
        self.helper.ssh.assert_not_called()

    def test_helper_drift_fails_before_ssh(self):
        with patch.object(ovh, 'HELPER_SHA256', '0' * 64), self.assertRaisesRegex(RuntimeError, 'helper changed'):
            self.invoke('rollback', '--source-ref', SHA)
        self.helper.ssh.assert_not_called()

    def test_missing_commit_fails_before_ssh(self):
        self.run.side_effect = ovh.subprocess.CalledProcessError(1, 'git')
        with self.assertRaises(ovh.subprocess.CalledProcessError):
            self.invoke('rollback', '--source-ref', SHA)
        self.helper.ssh.assert_not_called()

    def test_rollback_uses_common_cas_lock_and_exact_image_health(self):
        self.invoke('rollback', '--source-ref', SHA)
        command = self.helper.ssh.call_args.args[0]
        script = shlex.split(command)[-1]
        self.assertIn('lock=acquire_lock(root)', script)
        self.assertIn("replace_compose(root,snapshot,'rollback'", script)
        self.assertIn("live['Image']==contract['oldImage']", script)
        self.assertIn("==contract['previous']", script)
        self.assertIn('pass_fds=(lock.fileno(),)', script)
        self.assertNotIn('cp -a', command)
        self.helper.main.assert_not_called()

    def test_unknown_or_nonzero_rollback_fails_without_retry(self):
        for result in [SimpleNamespace(returncode=255, stdout='{}'), SimpleNamespace(returncode=0, stdout='{}'),
                       KeyboardInterrupt(), ovh.subprocess.TimeoutExpired('ssh', 10)]:
            self.helper.ssh.reset_mock()
            self.helper.ssh.side_effect = result if isinstance(result, BaseException) else None
            self.helper.ssh.return_value = result
            with self.subTest(kind=type(result).__name__), self.assertRaisesRegex(RuntimeError, 'ROLLBACK_UNCONFIRMED'):
                self.invoke('rollback', '--source-ref', SHA)
            self.assertEqual(self.helper.ssh.call_count, 1)

    def test_smoke_failure_attempts_only_guarded_rollback(self):
        self.helper.ssh.side_effect = [SimpleNamespace(returncode=0), RuntimeError('smoke failed'),
            SimpleNamespace(returncode=0, stdout=json.dumps({'status': 'RESTORED', 'health': 'healthy'}))]
        with self.assertRaisesRegex(RuntimeError, 'smoke failed'):
            self.invoke('smoke', '--source-ref', SHA, '--public')
        commands = [call.args[0] for call in self.helper.ssh.call_args_list]
        self.assertIn('https://sutra.purama.dev', commands[1])
        self.assertIn('acquire_lock', commands[2])
        self.assertNotIn('NODE_TLS_REJECT_UNAUTHORIZED', commands[1])

    def test_public_smoke_success_never_restarts_application(self):
        self.invoke('smoke', '--source-ref', SHA, '--public')
        commands = [call.args[0] for call in self.helper.ssh.call_args_list]
        self.assertEqual(len(commands), 2)
        self.assertIn('https://sutra.purama.dev', commands[1])
        self.assertNotIn('up -d', ''.join(commands))

    def test_public_flag_cannot_change_deployment_sequence(self):
        with self.assertRaises(SystemExit):
            self.invoke('deploy', '--source-ref', SHA, '--schema-ready', '--ci-run', '123', '--public')
        self.run.assert_not_called()
        self.helper.ssh.assert_not_called()

    def test_smoke_api_paths_resolve_to_real_app_routes(self):
        self.invoke('smoke', '--source-ref', SHA)
        probe = shlex.split(self.helper.ssh.call_args.args[0])[-1]
        paths = re.findall(r"['\"](/api/[^'\"]+)['\"]", probe)
        self.assertEqual(len(paths), 3)
        for path in paths:
            directory = ovh.ROOT / 'src/app'
            for segment in path.strip('/').split('/'):
                literal = directory / segment
                if literal.is_dir():
                    directory = literal
                else:
                    dynamic = [p for p in directory.iterdir() if p.is_dir() and p.name.startswith('[')]
                    self.assertEqual(len(dynamic), 1, path)
                    directory = dynamic[0]
            self.assertTrue((directory / 'route.ts').is_file(), path)


if __name__ == '__main__':
    unittest.main()
