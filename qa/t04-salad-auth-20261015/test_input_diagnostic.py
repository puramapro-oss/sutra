"""Reproduce the user's redacted INPUT_INVALID receipt with synthetic values only."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).parents[1] / 't04-salad-access-20261015/secure_setup.py'
spec = importlib.util.spec_from_file_location('setup_diagnostic', SOURCE)
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)
VALUES = ['fixture-api-key-not-real', 'fixture-org', 'fixture-project']


class InputDiagnosticTests(unittest.TestCase):
    def test_each_invalid_field_is_identified_without_disclosing_input(self):
        for index, name in enumerate(setup.NAMES):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / 'master'
                original = b'OTHER=fixture\n'
                path.write_bytes(original); path.chmod(0o600)
                replies = iter(VALUES[:index] + ['invalid fixture private input'])
                reports = []
                with self.assertRaisesRegex(setup.SetupBlocked, 'INVALID_LITERAL_INPUT'):
                    setup.configure(path, ask=lambda _: next(replies),
                                    verify=lambda _: self.fail('network forbidden'), report=reports.append)
                self.assertEqual(reports[-1].get('invalidName'), name)
                self.assertEqual(path.read_bytes(), original)
                self.assertNotIn('invalid fixture private input', json.dumps(reports))

    def test_terminal_reports_field_name_and_keeps_input_private(self):
        def reject(path, report):
            report({'status': 'BLOQUE', 'invalidName': 'SALAD_PROJECT'})
            raise setup.SetupBlocked('INVALID_LITERAL_INPUT')
        with tempfile.TemporaryDirectory() as directory, patch.object(setup, 'HERE', Path(directory)), patch.object(setup, 'configure', reject), patch.object(setup.sys, 'argv', ['setup', '--interactive']), patch.object(setup.sys.stdin, 'isatty', return_value=False), contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(setup.main(), 1)
            receipt = json.loads((Path(directory) / 'live-status.json').read_text())
        self.assertEqual(receipt['invalidName'], 'SALAD_PROJECT')
        self.assertIn('Champ refuse : SALAD_PROJECT', output.getvalue())
        self.assertIn('INVALID_LITERAL_INPUT', output.getvalue())

    def test_terminal_reports_http_refusal_without_raw_body(self):
        def reject(path, report):
            report({'proof': {'organization': {'http': 403}}})
            raise setup.SetupBlocked('ACCESS_UNPROVEN_MASTER_UNCHANGED')
        with tempfile.TemporaryDirectory() as directory, patch.object(setup, 'HERE', Path(directory)), patch.object(setup, 'configure', reject), patch.object(setup.sys, 'argv', ['setup', '--interactive']), patch.object(setup.sys.stdin, 'isatty', return_value=False), contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(setup.main(), 1)
        self.assertIn('organization : HTTP 403', output.getvalue())


if __name__ == '__main__':
    unittest.main()
