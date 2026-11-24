"""No network/secrets: preservation, profile ownership and rollback fixtures."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('activation', HERE / 'remote.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
UID = '00000000-0000-4000-8000-000000000001'
PID = 'a' * 24
OWNER = 'b' * 24


class Response:
    status = 200

    def __init__(self, value):
        self.value = value

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self, limit):
        return json.dumps(self.value).encode()


class ConfigTests(unittest.TestCase):
    def test_preserves_unselected_bytes_and_newlines(self):
        before = b'# fixture\nORIGIN=https://sutra.purama.dev\nKEEP="priority"\nRUNPOD_API_KEY=old\n'
        after = m.patch_bytes(before, {'RUNPOD_API_KEY': 'new-fixture'})
        self.assertEqual(after, before.replace(b'RUNPOD_API_KEY=old', b"RUNPOD_API_KEY='new-fixture'"))

    def test_append_and_json(self):
        self.assertEqual(m.patch_bytes(b'KEEP=x', {'ZERNIO_PROFILE_BINDINGS': '{}'}), b"KEEP=x\nZERNIO_PROFILE_BINDINGS='{}'\n")

    def test_duplicate_assignment_rejected(self):
        with self.assertRaises(AssertionError):
            m.patch_bytes(b'KEY=one\nexport KEY=two\n', {'KEY': 'fixture'})

    def test_injection_rejected(self):
        for value in ['a\nb', 'a\rb', "a'b", 'a\x00b']:
            with self.subTest(value=repr(value)), self.assertRaises(AssertionError):
                m.patch_bytes(b'', {'KEY': value})

    def test_atomic_private_mode(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / 'runtime'
            m.atomic_write(path, b'fixture')
            self.assertEqual(path.read_bytes(), b'fixture')
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)

    def test_exclusive_candidate_preserves_existing(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / 'runtime'
            path.write_bytes(b'original')
            path.with_name(path.name + '.t01-candidate').write_bytes(b'foreign')
            with self.assertRaises(FileExistsError):
                m.atomic_write(path, b'candidate')
            self.assertEqual(path.read_bytes(), b'original')


class BindingTests(unittest.TestCase):
    def setUp(self):
        self.profiles = [{'name': 'Default', '_id': PID, 'userId': OWNER}]
        self.team = {'currentUserId': OWNER, 'users': [{'_id': OWNER, 'role': 'owner'}]}
        self.user = {'id': UID, 'confirmed': True, 'sutraProfileExists': True, 'profileEmailMatches': True, 'plan': 'enterprise'}
        self.values = {'ZERNIO_API_KEY': 'fixture-only'}

    def call(self):
        with patch.object(m.urllib.request, 'build_opener') as opener, patch.object(m, 'sql', return_value={'users': [self.user]}):
            opener.return_value.open.side_effect = [Response({'profiles': self.profiles}), Response(self.team)]
            return m.discover_binding(self.values, {'ZERNIO_API_KEY': 'fixture-only'})

    def test_confirmed_default_profile_owner(self):
        value, report = self.call()
        self.assertEqual(json.loads(value), {UID: PID})
        self.assertTrue(report['currentOwnerOwnsProfile'])

    def test_multiple_profiles_rejected(self):
        self.profiles.append(dict(self.profiles[0]))
        with self.assertRaises(AssertionError):
            self.call()

    def test_foreign_owner_rejected(self):
        self.profiles[0]['userId'] = 'c' * 24
        with self.assertRaises(AssertionError):
            self.call()

    def test_nonowner_rejected(self):
        self.team['users'][0]['role'] = 'member'
        with self.assertRaises(AssertionError):
            self.call()

    def test_unconfirmed_server_identity_rejected(self):
        self.user['confirmed'] = False
        with self.assertRaises(AssertionError):
            self.call()

    def test_conflicting_binding_rejected(self):
        self.values['ZERNIO_PROFILE_BINDINGS'] = json.dumps({UID: 'd' * 24})
        with self.assertRaises(AssertionError):
            self.call()

    def test_profile_bound_to_other_identity_rejected(self):
        self.values['ZERNIO_PROFILE_BINDINGS'] = json.dumps({'00000000-0000-4000-8000-000000000002': PID})
        with self.assertRaises(AssertionError):
            self.call()

    def test_idempotent_existing_binding(self):
        self.values['ZERNIO_PROFILE_BINDINGS'] = json.dumps({UID: PID})
        self.assertEqual(json.loads(self.call()[0]), {UID: PID})

    def test_credential_mismatch_rejected(self):
        self.values['ZERNIO_API_KEY'] = 'other-fixture'
        with self.assertRaises(AssertionError):
            self.call()


class RollbackTests(unittest.TestCase):
    def exercise(self, passing):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / 'runtime').mkdir()
            runtime = root / 'runtime/.env'
            original = b'KEEP=priority\n'
            runtime.write_bytes(original)
            os.chmod(runtime, 0o600)
            (root / 'compose.yml').write_bytes(b'fixture compose')
            values = {k: 'old-fixture' for k in m.KEYS}
            values.update({'NEXT_PUBLIC_APP_URL': 'https://sutra.purama.dev', 'NEXT_PUBLIC_SITE_URL': 'https://sutra.purama.dev', 'KEEP': 'priority'})
            master = {k: 'new-fixture' for k in m.KEYS}
            current = {'Image': m.IMAGE, 'Id': 'old-container', 'State': {'Health': {'Status': 'healthy'}, 'StartedAt': 'fixture'}, 'Config': {'Labels': {'com.docker.compose.project.config_files': str(root / 'compose.yml'), 'dev.purama.commit': 'fixture'}, 'Env': [k + '=' + v for k, v in values.items()]}, 'RestartCount': 0}
            updated_values = dict(values, **master, ZERNIO_PROFILE_BINDINGS='{}')
            updated = dict(current, Config=dict(current['Config'], Env=[k + '=' + v for k, v in updated_values.items()]))
            recreates = []

            def command(args, data=None):
                if '--force-recreate' in args:
                    recreates.append(True)
                if data == 'smoke':
                    return '[]'
                if data == 'probe':
                    return json.dumps({'pass': passing})
                return ''

            with patch.object(m, 'ROOT', root), patch.object(m, 'inspect', return_value=current), patch.object(m, 'discover_binding', return_value=('{}', {})), patch.object(m, 'other_containers', return_value=['unrelated fixed-id']), patch.object(m, 'command', side_effect=command), patch.object(m, 'health', return_value=updated), patch.object(m.subprocess, 'run') as run:
                run.return_value.stdout = ''
                run.return_value.stderr = ''
                if passing:
                    result = m.main({'master': master, 'action': 'activate', 'stamp': 'fixture', 'smoke': 'smoke', 'probe': 'probe'})
                    self.assertTrue(result['report']['otherRuntimeValuesPreserved'])
                    self.assertEqual(len(recreates), 1)
                    self.assertNotEqual(runtime.read_bytes(), original)
                else:
                    with self.assertRaisesRegex(RuntimeError, '^ACTIVATION_FAILED_ROLLBACK_VERIFIED$'):
                        m.main({'master': master, 'action': 'activate', 'stamp': 'fixture', 'smoke': 'smoke', 'probe': 'probe'})
                    self.assertEqual(runtime.read_bytes(), original)
                    self.assertEqual(len(recreates), 2)
                snapshot = root / 'rollback-provider-config-fixture'
                self.assertEqual((snapshot / 'runtime.env').read_bytes(), original)
                self.assertEqual(snapshot.stat().st_mode & 0o777, 0o700)
                self.assertEqual((snapshot / 'runtime.env').stat().st_mode & 0o777, 0o600)

    def test_success_preserves_unrelated_configuration(self):
        self.exercise(True)

    def test_failed_provider_gate_restores_exact_configuration(self):
        self.exercise(False)


if __name__ == '__main__':
    unittest.main()
