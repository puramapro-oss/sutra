"""New observer boundaries; no live commands or configuration are read."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('scheduler_observer', Path(__file__).with_name('scheduler_observer.py'))
observer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(observer)
SHA = 'a' * 40


class ObserverTests(unittest.TestCase):
    def fixture(self, **counts):
        calls = []

        def run(argv, data=None):
            calls.append((argv, data))
            if argv == observer.INSPECT:
                return json.dumps({'Running': True, 'Health': {'Status': 'healthy'}, 'untrusted': 'SECRET_SENTINEL'}) + '|' + SHA
            self.assertEqual(argv, observer.QUERY)
            return json.dumps(dict.fromkeys(observer.COUNTS, 0) | counts)
        return calls, run

    def test_healthy_has_only_fixed_read_only_commands(self):
        calls, run = self.fixture()
        receipt = observer.observe(SHA, run)
        self.assertEqual(receipt['status'], 'PASS')
        self.assertFalse(receipt['dispatchEnabled'])
        self.assertEqual(len(calls), 2)
        self.assertTrue(calls[1][1].startswith('BEGIN READ ONLY;'))
        self.assertTrue(calls[1][1].rstrip().endswith('ROLLBACK;'))
        self.assertIn("statement_timeout='5000ms'", calls[1][1])
        for forbidden in ('claim_video', '/api/', 'curl', 'wget', 'INSERT', 'UPDATE', 'DELETE', 'COMMIT'):
            self.assertNotIn(forbidden, repr(calls))
        self.assertNotIn('SECRET_SENTINEL', json.dumps(receipt))

    def test_pending_or_risky_work_warns_without_dispatch(self):
        for key in ('queued', 'expired', 'uncertain', 'autoActive', 'autoPublication'):
            with self.subTest(key=key):
                calls, run = self.fixture(**{key: 1})
                result = observer.observe(SHA, run)
                self.assertEqual(result['status'], 'ATTENTION')
                self.assertEqual(len(calls), 2)
                self.assertEqual(result['generationCalls'], 0)
                self.assertEqual(result['publicationCalls'], 0)

    def test_source_drift_stops_before_database(self):
        calls, run = self.fixture()
        with self.assertRaisesRegex(RuntimeError, 'SOURCE_MISMATCH'):
            observer.observe('b' * 40, run)
        self.assertEqual(len(calls), 1)

    def test_invalid_source_stops_before_commands(self):
        calls, run = self.fixture()
        with self.assertRaises(ValueError):
            observer.observe('main; unexpected', run)
        self.assertEqual(calls, [])

    def test_malformed_untrusted_database_fails_closed(self):
        for value in ({}, {'queued': 'SECRET_SENTINEL'}, dict.fromkeys(observer.COUNTS, True)):
            _, base = self.fixture()
            with self.subTest(value=value), self.assertRaises(RuntimeError):
                observer.observe(SHA, lambda argv, data=None: base(argv) if data is None else json.dumps(value))

    def test_unhealthy_application_is_attention(self):
        _, base = self.fixture()
        result = observer.observe(SHA, lambda argv, data=None: base(argv, data) if data else json.dumps({'Running': False}) + '|' + SHA)
        self.assertEqual(result['status'], 'ATTENTION')

    def test_exception_output_is_redacted(self):
        output = io.StringIO()
        with patch.object(observer, 'observe', side_effect=RuntimeError('SECRET_SENTINEL')), contextlib.redirect_stdout(output):
            self.assertEqual(observer.main(['--expected-source', SHA]), 1)
        self.assertNotIn('SECRET_SENTINEL', output.getvalue())
        self.assertEqual(json.loads(output.getvalue())['status'], 'UNAVAILABLE')

    def test_dispatch_argument_is_not_accepted(self):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as error:
            observer.main(['--expected-source', SHA, '--dispatch'])
        self.assertEqual(error.exception.code, 2)

    def test_subprocess_is_bounded_and_no_shell(self):
        with patch.object(observer.subprocess, 'run') as run:
            run.return_value.returncode = 1
            run.return_value.stderr = 'SECRET_SENTINEL'
            with self.assertRaisesRegex(RuntimeError, '^CHECK_UNAVAILABLE$'):
                observer.execute(observer.QUERY, observer.SQL)
            self.assertEqual(run.call_args.kwargs['timeout'], 15)
            self.assertNotIn('shell', run.call_args.kwargs)

    def test_timer_is_pinned_to_observation_and_private_network(self):
        service = Path(__file__).with_name('scheduler-observer.service').read_text()
        self.assertIn('PrivateNetwork=yes', service)
        self.assertIn('RestrictAddressFamilies=AF_UNIX', service)
        self.assertIn('scheduler_observer.py --expected-source 86d04c85', service)
        self.assertNotIn('CRON_SECRET', service)


if __name__ == '__main__':
    unittest.main()
