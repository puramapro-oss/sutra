import io
import json
import unittest
import urllib.error
from unittest.mock import patch

import social_dispatch


ENV = {'SUTRA_SOCIAL_WORKER_URL': 'http://127.0.0.1:3000/api/cron/social-worker',
       'CRON_SECRET': 'fixture-not-a-real-secret'}


class Response(io.BytesIO):
    status = 200


class Opener:
    def __init__(self, body):
        self.body = body
        self.request = None

    def open(self, request, timeout):
        self.request = request
        assert timeout == 290
        return Response(self.body)


class SocialDispatcherTests(unittest.TestCase):
    def test_only_accepted_social_route_and_post(self):
        opener = Opener(b'{"confirmed":true,"processed":1,"receipts":[{"batchId":"private"}]}')
        self.assertEqual(social_dispatch.dispatch(ENV, opener), {'status': 'PASS', 'processed': 1})
        self.assertEqual(opener.request.method, 'POST')
        self.assertEqual(opener.request.full_url, ENV['SUTRA_SOCIAL_WORKER_URL'])
        self.assertEqual(opener.request.get_header('Authorization'), 'Bearer fixture-not-a-real-secret')

    def test_rejects_remote_redirect_credentials_and_other_routes(self):
        for url in ['https://example.com/api/cron/social-worker',
                    'http://localhost:3000/api/cron/social-worker',
                    'http://user:pass@127.0.0.1:3000/api/cron/social-worker',
                    'http://127.0.0.1:3000/api/cron/video-worker',
                    'http://127.0.0.1:3000/api/cron/social-worker?token=x',
                    'http://127.0.0.1/api/cron/social-worker',
                    'http://127.0.0.1:3000/api/cron/social-worker#fragment']:
            with self.subTest(url=url), self.assertRaises(ValueError):
                social_dispatch.request_for({**ENV, 'SUTRA_SOCIAL_WORKER_URL': url})
        self.assertIsNone(social_dispatch.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://other.invalid'))

    def test_missing_or_header_injected_auth_is_refused(self):
        for secret in ['', '  ', 'dev', 'null', 'undefined', 'secret\nInjected: value']:
            with self.subTest(secret=secret), self.assertRaises(ValueError):
                social_dispatch.request_for({**ENV, 'CRON_SECRET': secret})

    def test_malformed_or_unconfirmed_receipt_never_passes(self):
        for body in [b'{}', b'[]', b'invalid', b'x' * 65537,
                     b'{"confirmed":false,"processed":1,"receipts":[{}]}',
                     b'{"confirmed":true,"processed":true,"receipts":[{}]}',
                     b'{"confirmed":true,"processed":5,"receipts":[]}',
                     b'{"confirmed":true,"processed":1,"receipts":[]}']:
            with self.subTest(body=body[:100]), self.assertRaises(Exception):
                social_dispatch.dispatch(ENV, Opener(body))

    def test_log_is_redacted_when_transport_fails(self):
        stream = io.StringIO()
        with patch('social_dispatch.dispatch', side_effect=Exception('credential-sensitive-content')):
            with patch('sys.stdout', stream):
                self.assertEqual(social_dispatch.main(), 1)
        self.assertEqual(json.loads(stream.getvalue()), {'status': 'UNAVAILABLE'})


if __name__ == '__main__':
    unittest.main()
