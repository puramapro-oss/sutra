import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import pty
import select
import stat
import tempfile
import termios
import time
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("setup", Path(__file__).with_name("secure_setup.py"))
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)
VALUES = {"SALAD_API_KEY": "fixture-not-a-real-api-key", "SALAD_ORGANIZATION": "fixture-org", "SALAD_PROJECT": "fixture-project"}
PROOF = {"status": "PASS_READ_ONLY", "requests": 2,
         "organization": {"status": "PASS", "http": 200, "authentication": "ORGANIZATION_READ_CONFIRMED"},
         "project": {"status": "PASS", "http": 200, "authentication": "PROJECT_READ_CONFIRMED"}}


class SecureSetupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "master"
        self.original = b'# unrelated bytes preserved\r\nOTHER="fixture"\r\nSALAD_API_KEY="bad fixture"\r\nEND=last\r\n'
        self.path.write_bytes(self.original); self.path.chmod(0o600)

    def configure(self, verify=lambda values: PROOF, report=lambda value: None):
        replies = iter(VALUES.values())
        setup.configure(self.path, ask=lambda prompt: next(replies), verify=verify, report=report)

    def test_two_reads_then_atomic_write_only_three_names(self):
        def verify(values):
            self.assertEqual(values, VALUES)
            self.assertEqual(self.path.read_bytes(), self.original)
            return PROOF
        receipts = []
        self.configure(verify, receipts.append)
        result = self.path.read_bytes()
        self.assertEqual(setup.selected(result), VALUES)
        self.assertTrue(result.startswith(b'# unrelated bytes preserved\r\nOTHER="fixture"\r\n'))
        self.assertIn(b'END=last\r\n', result)
        self.assertEqual(stat.S_IMODE(self.path.stat().st_mode), 0o600)
        for value in VALUES.values(): self.assertNotIn(value, json.dumps(receipts))
        self.assertEqual(receipts[-1]["status"], "PASS_READ_ONLY")

    def test_http_refusal_never_changes_master(self):
        for http in [401, 403, 404, 429, 500]:
            with self.subTest(http=http), self.assertRaisesRegex(setup.SetupBlocked, "ACCESS_UNPROVEN"):
                self.configure(lambda values: {"status": "BLOQUE", "organization": {"http": http}})
            self.assertEqual(self.path.read_bytes(), self.original)

    def test_unproven_project_rejects_even_top_level_pass(self):
        with self.assertRaisesRegex(setup.SetupBlocked, "ACCESS_UNPROVEN"):
            self.configure(lambda values: {"status": "PASS_READ_ONLY", "organization": PROOF["organization"]})
        self.assertEqual(self.path.read_bytes(), self.original)

    def test_invalid_literals_fail_before_network(self):
        for bad in ['"fixture-valid-looking-key"', 'Bearer fixture-valid-looking-key', 'fixture-key with-space', 'SALAD_API_KEY=fixture-valid-looking-key', 'fixture-key$(command)', 'fixture-key\\suffix', '', 'fixture-key\nnext']:
            with self.subTest(kind=bad[:5]), self.assertRaisesRegex(setup.SetupBlocked, "INVALID_LITERAL"):
                setup.configure(self.path, ask=lambda prompt: bad,
                                verify=lambda values: self.fail("must not call remote"))
        self.assertEqual(self.path.read_bytes(), self.original)

    def test_timeout_preserves_master(self):
        with self.assertRaises(TimeoutError):
            self.configure(lambda values: (_ for _ in ()).throw(TimeoutError()))
        self.assertEqual(self.path.read_bytes(), self.original)

    def test_cancel_preserves_master(self):
        with self.assertRaises(KeyboardInterrupt):
            setup.configure(self.path, ask=lambda prompt: (_ for _ in ()).throw(KeyboardInterrupt()))
        self.assertEqual(self.path.read_bytes(), self.original)

    def test_duplicate_target_is_not_overwritten(self):
        self.path.write_bytes(self.original + b'SALAD_API_KEY=second-fixture\n')
        with self.assertRaisesRegex(setup.SetupBlocked, "DUPLICATE"):
            self.configure()

    def test_concurrent_content_change_aborts(self):
        def verify(values):
            self.path.write_bytes(self.original + b'FOREIGN=new\n'); return PROOF
        with self.assertRaisesRegex(setup.SetupBlocked, "MASTER_CHANGED"):
            self.configure(verify)
        self.assertTrue(self.path.read_bytes().endswith(b'FOREIGN=new\n'))

    def test_concurrent_inode_change_aborts_even_same_bytes(self):
        def verify(values):
            alternate = self.path.with_name('alternate')
            alternate.write_bytes(self.original); alternate.chmod(0o600)
            os.replace(alternate, self.path); return PROOF
        with self.assertRaisesRegex(setup.SetupBlocked, "MASTER_CHANGED"):
            self.configure(verify)

    def test_symlink_master_rejected(self):
        linked = self.path.with_name('linked'); linked.symlink_to(self.path)
        with self.assertRaises(OSError): setup.read_private(linked)

    def test_hardlink_master_rejected(self):
        os.link(self.path, self.path.with_name('linked'))
        with self.assertRaisesRegex(setup.SetupBlocked, "PRIVATE_REGULAR"): setup.read_private(self.path)

    def test_unsafe_permissions_rejected(self):
        self.path.chmod(0o644)
        with self.assertRaisesRegex(setup.SetupBlocked, "PRIVATE_REGULAR"): setup.read_private(self.path)

    def test_existing_lock_refuses_another_writer(self):
        fd = os.open(str(self.path) + '.salad.lock', os.O_CREAT | os.O_RDWR, 0o600)
        try:
            setup.fcntl.flock(fd, setup.fcntl.LOCK_EX)
            with self.assertRaisesRegex(setup.SetupBlocked, "ANOTHER_SETUP"):
                self.configure()
        finally: os.close(fd)

    def test_symlink_lock_rejected(self):
        Path(str(self.path) + '.salad.lock').symlink_to(self.path)
        with self.assertRaises(OSError): self.configure()
        self.assertEqual(self.path.read_bytes(), self.original)

    def test_failed_replace_removes_temporary_preserves_original(self):
        with patch.object(setup.os, 'replace', side_effect=OSError()), self.assertRaises(OSError):
            self.configure()
        self.assertEqual(self.path.read_bytes(), self.original)
        self.assertEqual(list(self.path.parent.glob('.salad-write-*')), [])

    def test_hidden_refuses_non_tty(self):
        with patch.object(setup.sys.stdin, 'isatty', return_value=False), self.assertRaisesRegex(setup.SetupBlocked, "SECURE_TTY"):
            setup.hidden('Prompt: ')

    def test_getpass_warning_cannot_fall_back_to_echo(self):
        def unsafe(prompt):
            setup.warnings.warn("no echo unavailable", setup.getpass.GetPassWarning)
            self.fail("must stop before fallback input")
        with patch.object(setup.sys.stdin, 'isatty', return_value=True), patch.object(setup.sys.stderr, 'isatty', return_value=True), patch.object(setup.getpass, 'getpass', unsafe), self.assertRaises(setup.getpass.GetPassWarning):
            setup.hidden('Prompt: ')

    def test_real_getpass_tty_disables_echo(self):
        pid, fd = pty.fork()
        if pid == 0:
            try:
                answer = setup.hidden('MASKED_INPUT: ')
                os.write(1, b'INPUT_OK\n' if answer == VALUES['SALAD_API_KEY'] else b'INPUT_BAD\n')
                os._exit(0)
            except BaseException: os._exit(1)
        transcript = b''; sent = False; deadline = time.monotonic() + 5
        try:
            while time.monotonic() < deadline:
                if not select.select([fd], [], [], 0.1)[0]: continue
                try: chunk = os.read(fd, 4096)
                except OSError: break
                if not chunk: break
                transcript += chunk
                if b'MASKED_INPUT:' in transcript and not sent:
                    self.assertFalse(termios.tcgetattr(fd)[3] & termios.ECHO)
                    os.write(fd, VALUES['SALAD_API_KEY'].encode() + b'\n'); sent = True
                if b'INPUT_OK' in transcript: break
            self.assertIn(b'INPUT_OK', transcript)
            self.assertNotIn(VALUES['SALAD_API_KEY'].encode(), transcript)
        finally:
            os.close(fd)
            os.waitpid(pid, 0)

    def test_wrapper_keeps_secret_out_of_argv_and_environment(self):
        def run(argv, **kwargs):
            self.assertNotIn(VALUES['SALAD_API_KEY'], repr(argv))
            self.assertNotIn(VALUES['SALAD_API_KEY'], repr(kwargs['env']))
            self.assertEqual(json.loads(kwargs['input']), VALUES)
            self.assertEqual(kwargs['timeout'], 40)
            return setup.subprocess.CompletedProcess(argv, 0, json.dumps(PROOF), '')
        with patch.object(setup.subprocess, 'run', run), patch.object(setup.shutil, 'which', return_value='/fixture/node'):
            self.assertEqual(setup.validate_remote(VALUES), PROOF)

    def test_multiline_target_never_leaves_orphan_secret_lines(self):
        for original in [b'SALAD_API_KEY="bad\ncontinued"\nOTHER=fixture\n',
                         b"SALAD_API_KEY='bad\ncontinued'\nOTHER=fixture\n",
                         b'SALAD_API_KEY=bad\\\ncontinued\nOTHER=fixture\n']:
            with self.subTest(), self.assertRaisesRegex(setup.SetupBlocked, 'MULTILINE_TARGET'):
                setup.replace_selected(original, VALUES)

    def test_final_failure_receipt_keeps_redacted_http_evidence(self):
        proof = {'status': 'BLOQUE', 'requests': 1,
                 'organization': {'http': 403, 'authentication': 'UNPROVEN'}}
        def refuse(path, report):
            report({'status': 'READS_COMPLETED', 'proof': proof})
            raise setup.SetupBlocked('ACCESS_UNPROVEN_MASTER_UNCHANGED')
        with patch.object(setup, 'HERE', Path(self.temp.name)), patch.object(setup, 'configure', refuse), patch.object(setup.sys, 'argv', ['setup', '--interactive']), patch.object(setup.sys.stdin, 'isatty', return_value=False), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(setup.main(), 1)
        receipt = json.loads((Path(self.temp.name) / 'live-status.json').read_text())
        self.assertEqual(receipt['status'], 'BLOQUE')
        self.assertEqual(receipt['proof'], proof)


if __name__ == '__main__': unittest.main()
