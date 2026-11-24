"""Free fixtures only: guard credentials, read-only paths and response redaction."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('provider_audit', Path(__file__).with_name('audit.py'))
audit = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(audit)


class ProviderAuditSafety(unittest.TestCase):
    def test_generation_and_untrusted_origins_never_reach_transport(self):
        with patch.object(audit.urllib.request, 'build_opener') as transport:
            for url in ('https://api.runpod.ai/v2/fake/run', 'https://api.shotstack.io/edit/stage/render',
                        'https://zernio.com/api/v1/connect/youtube', 'https://evil.invalid/accounts',
                        'http://zernio.com/api/v1/accounts', 'https://user@zernio.com/api/v1/accounts'):
                self.assertEqual(audit.get(url, 'fixture-secret')[0]['result'], 'BLOCKED_ALLOWLIST')
            transport.assert_not_called()

    def test_newline_header_never_reaches_transport(self):
        with patch.object(audit.urllib.request, 'build_opener') as transport:
            self.assertEqual(audit.get('https://rest.runpod.io/v1/endpoints', 'fixture\n')[0]['result'], 'INVALID_HEADER_CONTROL_CHARACTER')
            transport.assert_not_called()

    def test_suno_key_is_never_sent(self):
        with patch.object(audit.urllib.request, 'build_opener') as transport:
            self.assertEqual(audit.get('https://api.suno.ai/v1', 'fixture-secret')[0]['result'], 'BLOCKED_ALLOWLIST')
            transport.assert_not_called()

    def test_redirect_never_copies_authorization(self):
        self.assertIsNone(audit.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://evil.invalid'))

    def test_raw_errors_and_tokens_are_not_in_receipt(self):
        class Response:
            status = 403
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def read(self, limit):
                self.assert_limit = limit
                return b'{"message":"Invalid or disabled API key fixture-secret","token":"fixture-secret"}'
        with patch.object(audit.urllib.request, 'build_opener') as opener:
            opener.return_value.open.return_value = Response()
            info, _ = audit.get('https://api.shotstack.io/edit/stage/templates', 'fixture-secret', 'x-api-key')
            self.assertEqual(info['http_status'], 403)
            self.assertEqual(info['recognized_error'], 'INVALID_OR_DISABLED')
            self.assertNotIn('fixture-secret', json.dumps(info))
            request = opener.return_value.open.call_args.args[0]
            self.assertEqual(request.get_method(), 'GET')
            self.assertEqual(opener.return_value.open.call_args.kwargs['timeout'], 18)
            self.assertEqual(opener.return_value.open.call_count, 1)

    def test_master_double_quoted_newline_is_parsed_without_silent_cleanup(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'fixture'
            path.write_text('RUNPOD_API_KEY="fixture-secret\\n"\nZERNIO_API_KEY=fixture-zernio\n')
            values, _ = audit.read_config(path)
            self.assertEqual(values['RUNPOD_API_KEY'], 'fixture-secret\n')
            path.write_text('ZERNIO_API_KEY=one\nZERNIO_API_KEY=two\n')
            with self.assertRaisesRegex(ValueError, 'DUPLICATE_SELECTED_VARIABLE'):
                audit.read_config(path)

    def test_remote_source_compiles_without_running_local_main(self):
        source = Path(audit.__file__).read_text().rsplit("if __name__ == '__main__':", 1)[0]
        compile(source + '\nprint(json.dumps(remote_audit({})))', 'remote_audit', 'exec')


if __name__ == '__main__':
    unittest.main()
