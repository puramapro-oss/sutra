"""Deployment planning checks only. No SSH, Docker, credentials or remote writes."""
import contextlib
import hashlib
import importlib.util
import io
from pathlib import Path
import re
import shlex
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import ovh


SHA = 'a' * 40


class DeploymentContract(unittest.TestCase):
    def setUp(self):
        self.vendor = Mock(return_value=[])
        self.helper = SimpleNamespace(ssh=Mock(), main=Mock(), vendor_locked_git_dependencies=self.vendor,
                                      BUILD_ONLY_LOCAL_DEPENDENCIES={})
        self.helper.ssh.return_value = SimpleNamespace(stdout='healthy\n')
        self.loader = Mock()
        self.loader.exec_module.side_effect = lambda module: None
        self.spec = SimpleNamespace(loader=self.loader)
        self.stack = contextlib.ExitStack()
        self.addCleanup(self.stack.close)
        self.run = self.stack.enter_context(patch.object(ovh.subprocess, 'run'))
        self.show = self.stack.enter_context(patch.object(ovh.subprocess, 'check_output', return_value=b'FROM node:24\n'))
        self.stack.enter_context(patch.object(Path, 'read_bytes', return_value=b'pinned helper'))
        self.stack.enter_context(patch.object(ovh, 'HELPER_SHA256', hashlib.sha256(b'pinned helper').hexdigest()))
        self.stack.enter_context(patch.object(importlib.util, 'spec_from_file_location', return_value=self.spec))
        self.stack.enter_context(patch.object(importlib.util, 'module_from_spec', return_value=self.helper))
        self.sleep = self.stack.enter_context(patch.object(ovh.time, 'sleep'))

    def invoke(self, *args):
        with patch.object(ovh.sys, 'argv', ['ovh.py', *args]), contextlib.redirect_stderr(io.StringIO()), contextlib.redirect_stdout(io.StringIO()):
            ovh.main()

    def test_deploy_requires_schema_confirmation_before_any_io(self):
        with self.assertRaises(SystemExit):
            self.invoke('deploy', '--source-ref', SHA)
        self.run.assert_not_called()
        self.helper.ssh.assert_not_called()

    def test_immutable_ref_and_shell_injection_rejected(self):
        for ref in ['main', 'abc123', SHA + ';echo invalid', 'A' * 40]:
            with self.subTest(ref=ref), self.assertRaises(SystemExit):
                self.invoke('rollback', '--source-ref', ref)
        self.run.assert_not_called()
        self.helper.ssh.assert_not_called()

    def test_helper_drift_fails_before_ssh(self):
        with patch.object(ovh, 'HELPER_SHA256', '0' * 64), self.assertRaisesRegex(RuntimeError, 'helper changed'):
            self.invoke('deploy', '--source-ref', SHA, '--schema-ready')
        self.helper.ssh.assert_not_called()

    def test_missing_commit_fails_before_ssh(self):
        self.run.side_effect = ovh.subprocess.CalledProcessError(1, 'git')
        with self.assertRaises(ovh.subprocess.CalledProcessError):
            self.invoke('rollback', '--source-ref', SHA)
        self.helper.ssh.assert_not_called()

    def test_deploy_pins_recipe_commit_and_takes_complete_private_snapshot(self):
        def deploy():
            self.assertEqual(ovh.sys.argv[1:], ['sutra', '--source-ref', SHA, '--node-major', '24', '--replace-existing'])
            self.assertEqual(self.helper.DOCKERFILE.read_text(), 'FROM node:24\n')
        self.helper.main.side_effect = deploy
        self.invoke('deploy', '--source-ref', SHA, '--schema-ready')
        self.show.assert_called_once_with(['git', 'show', SHA + ':deploy/ovh.Dockerfile'], cwd=ovh.ROOT)
        command = self.helper.ssh.call_args_list[0].args[0]
        self.assertIn('umask 077 && mkdir ', command)
        self.assertIn('runtime/.env ', command)
        self.assertIn('/runtime.env && touch ', command)
        self.assertTrue(command.endswith('/complete'))
        self.assertNotIn('cat ', command)

    def test_existing_or_failed_backup_prevents_deploy(self):
        self.helper.ssh.side_effect = RuntimeError('snapshot exists')
        with self.assertRaisesRegex(RuntimeError, 'snapshot exists'):
            self.invoke('deploy', '--source-ref', SHA, '--schema-ready')
        self.helper.main.assert_not_called()

    def test_local_build_dependency_comes_from_exact_archived_app(self):
        app = Path('/temporary/exact-commit-archive')
        package = {'devDependencies': {'@purama/eslint-config': 'file:tooling/eslint-config-purama'}}
        def deploy():
            self.helper.vendor_locked_git_dependencies(app, package)
            self.assertEqual(self.helper.BUILD_ONLY_LOCAL_DEPENDENCIES['@purama/eslint-config'],
                             (app / 'tooling/eslint-config-purama', 'eslint-config-purama'))
        self.helper.main.side_effect = deploy
        self.invoke('deploy', '--source-ref', SHA, '--schema-ready')
        self.vendor.assert_called_once_with(app, package)

    def test_rollback_restores_compose_and_runtime_then_waits_for_health(self):
        self.helper.ssh.side_effect = [None, SimpleNamespace(stdout='starting'), SimpleNamespace(stdout='healthy')]
        self.invoke('rollback', '--source-ref', SHA)
        commands = [call.args[0] for call in self.helper.ssh.call_args_list]
        self.assertIn('/complete && test -s ', commands[0])
        self.assertIn(f'/rollback-{SHA}/runtime.env /opt/purama/apps/sutra/runtime/.env', commands[0])
        self.assertIn('up -d --no-deps sutra', commands[0])
        self.assertEqual(len(commands), 3)
        self.sleep.assert_called_once_with(5)
        self.helper.main.assert_not_called()
        self.show.assert_not_called()

    def test_rollback_never_reports_success_without_health(self):
        for state, expected_calls in [('unhealthy', 2), ('none', 2), ('starting', 19)]:
            self.helper.ssh.reset_mock()
            self.helper.ssh.side_effect = None
            self.helper.ssh.return_value = SimpleNamespace(stdout=state)
            with self.subTest(state=state), self.assertRaisesRegex(RuntimeError, 'rollback health'):
                self.invoke('rollback', '--source-ref', SHA)
            self.assertEqual(self.helper.ssh.call_count, expected_calls)

    def test_helper_failure_after_snapshot_restores_previous_release(self):
        self.helper.main.side_effect = RuntimeError('late receipt failed')
        with self.assertRaisesRegex(RuntimeError, 'late receipt failed'):
            self.invoke('deploy', '--source-ref', SHA, '--schema-ready')
        commands = [call.args[0] for call in self.helper.ssh.call_args_list]
        self.assertIn('mkdir ', commands[0])
        self.assertIn('up -d --no-deps sutra', commands[1])
        self.assertIn('docker inspect', commands[2])

    def test_application_smoke_failure_rolls_back_even_after_helper_success(self):
        def remote(command, **kwargs):
            if 'docker exec purama-sutra node' in command:
                raise ovh.subprocess.CalledProcessError(1, 'smoke')
            return SimpleNamespace(stdout='healthy')
        self.helper.ssh.side_effect = remote
        with self.assertRaises(ovh.subprocess.CalledProcessError):
            self.invoke('deploy', '--source-ref', SHA, '--schema-ready')
        self.helper.main.assert_called_once()
        commands = [call.args[0] for call in self.helper.ssh.call_args_list]
        self.assertIn('http://127.0.0.1:3000', commands[1])
        self.assertNotIn('/api/health', commands[1])
        self.assertIn('up -d --no-deps sutra', commands[2])
        self.assertIn('docker inspect', commands[3])

    def test_public_smoke_requires_snapshot_and_rolls_back_on_failure(self):
        self.helper.ssh.side_effect = [None, RuntimeError('TLS failed'), None, SimpleNamespace(stdout='healthy')]
        with self.assertRaisesRegex(RuntimeError, 'TLS failed'):
            self.invoke('smoke', '--source-ref', SHA, '--public')
        commands = [call.args[0] for call in self.helper.ssh.call_args_list]
        self.assertIn(f'rollback-{SHA}/complete', commands[0])
        self.assertIn('https://sutra.purama.dev', commands[1])
        self.assertNotIn('NODE_TLS_REJECT_UNAUTHORIZED', commands[1])
        self.assertIn('up -d --no-deps sutra', commands[2])
        self.helper.main.assert_not_called()

    def test_public_smoke_success_never_restarts_application(self):
        self.invoke('smoke', '--source-ref', SHA, '--public')
        commands = [call.args[0] for call in self.helper.ssh.call_args_list]
        self.assertEqual(len(commands), 2)
        self.assertIn('https://sutra.purama.dev', commands[1])
        self.assertNotIn('up -d', ''.join(commands))
        self.helper.main.assert_not_called()
        self.show.assert_not_called()

    def test_missing_snapshot_prevents_smoke_and_rollback(self):
        self.helper.ssh.side_effect = RuntimeError('snapshot missing')
        with self.assertRaisesRegex(RuntimeError, 'snapshot missing'):
            self.invoke('smoke', '--source-ref', SHA, '--public')
        self.assertEqual(self.helper.ssh.call_count, 1)

    def test_failed_automatic_rollback_is_reported_as_failure(self):
        self.helper.main.side_effect = RuntimeError('deployment failed')
        self.helper.ssh.return_value = SimpleNamespace(stdout='unhealthy')
        with self.assertRaisesRegex(RuntimeError, 'rollback health'):
            self.invoke('deploy', '--source-ref', SHA, '--schema-ready')

    def test_public_flag_cannot_change_deployment_sequence(self):
        with self.assertRaises(SystemExit):
            self.invoke('deploy', '--source-ref', SHA, '--schema-ready', '--public')
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
