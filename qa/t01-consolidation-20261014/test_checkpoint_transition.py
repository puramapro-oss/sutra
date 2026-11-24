"""Free simulations of the exact migration state machine; no SSH or database."""
import hashlib
import importlib.util
import json
import subprocess
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('checkpoint_transition', Path(__file__).with_name('checkpoint-transition.py'))
transition = importlib.util.module_from_spec(spec)
spec.loader.exec_module(transition)


class Port:
    def __init__(self, failure=None):
        self.failure = failure
        self.state = 'old'
        self.calls = []

    def preflight(self, mode):
        self.calls.append('preflight')
        if self.failure == 'gate':
            raise RuntimeError('synthetic-private-value')

    def definitions(self):
        if self.failure == 'unreadable' and self.calls.count('apply'):
            raise RuntimeError('synthetic-private-value')
        return {'state': self.state}

    def rollback(self):
        return 'rollback'

    def snapshot(self, expected):
        self.calls.append('snapshot')
        if self.failure == 'pre-submit-drift':
            self.state = 'foreign'

    def execute_guarded(self, expected, sql):
        if self.definitions() != expected:
            raise RuntimeError('DEFINITION_DRIFT')
        self.calls.append(sql)
        if self.failure == 'timeout':
            raise subprocess.TimeoutExpired('fixture-psql', 60)
        if self.failure == 'interrupt':
            raise KeyboardInterrupt()
        if self.failure == 'transport':
            raise transition.UnconfirmedSqlExecution()
        if sql == 'rollback':
            self.state = 'old'
        elif self.failure == 'rejected':
            raise RuntimeError('synthetic-private-value')
        elif self.failure == 'drift':
            self.state = 'foreign'
        else:
            self.state = 'new'
            if self.failure == 'lost-ack':
                raise RuntimeError('synthetic-private-value')


class TransitionTests(unittest.TestCase):
    def invoke(self, port, mode='apply'):
        proof = {
            'beforeDefinitionsSha256': transition.digest({'state': 'old'}),
            'afterDefinitionsSha256': transition.digest({'state': 'new'}),
            'migrationSha256': hashlib.sha256(b'apply').hexdigest(),
            'rollbackSha256': hashlib.sha256(b'rollback').hexdigest(),
        }
        receipt = transition.transition(port, mode, proof, 'apply')
        self.assertNotIn('synthetic-private-value', str(receipt))
        self.assertFalse(receipt['dataRestore'])
        self.assertFalse(receipt['workerStarted'])
        return receipt

    def test_exact_migration_and_protected_snapshot(self):
        port = Port()
        self.assertEqual(self.invoke(port)['status'], 'PASS')
        self.assertEqual(port.calls, ['preflight', 'snapshot', 'apply'])

    def test_gate_failure_does_not_submit(self):
        port = Port('gate')
        self.assertEqual(self.invoke(port)['status'], 'FAIL')
        self.assertEqual(port.calls, ['preflight'])

    def test_failed_transaction_reconciles_without_mutation(self):
        port = Port('rejected')
        receipt = self.invoke(port)
        self.assertEqual(receipt['status'], 'FAIL')
        self.assertTrue(receipt['previousDefinitionsVerified'])
        self.assertNotIn('rollback', port.calls)

    def test_lost_ack_reconciles_then_rolls_back_once(self):
        port = Port('lost-ack')
        receipt = self.invoke(port)
        self.assertEqual(receipt['status'], 'FAIL')
        self.assertTrue(receipt['rollbackTriggered'])
        self.assertEqual(port.calls.count('apply'), 1)
        self.assertEqual(port.calls.count('rollback'), 1)
        self.assertEqual(port.state, 'old')

    def test_unknown_definitions_never_overwrite_foreign_work(self):
        port = Port('drift')
        self.assertEqual(self.invoke(port)['status'], 'UNKNOWN')
        self.assertNotIn('rollback', port.calls)

    def test_unreadable_outcome_never_retries(self):
        port = Port('unreadable')
        self.assertEqual(self.invoke(port)['status'], 'UNKNOWN')
        self.assertEqual(port.calls.count('apply'), 1)
        self.assertNotIn('rollback', port.calls)

    def test_explicit_rollback_restores_only_definitions(self):
        port = Port()
        port.state = 'new'
        self.assertEqual(self.invoke(port, 'rollback')['status'], 'PASS')
        self.assertEqual(port.calls, ['preflight', 'snapshot', 'rollback'])

    def test_preexisting_drift_refuses_before_snapshot(self):
        port = Port()
        port.state = 'foreign'
        self.assertEqual(self.invoke(port)['status'], 'FAIL')
        self.assertEqual(port.calls, ['preflight'])

    def test_drift_after_precheck_is_not_overwritten(self):
        port = Port('pre-submit-drift')
        self.assertEqual(self.invoke(port)['status'], 'UNKNOWN')
        self.assertEqual(port.state, 'foreign')
        self.assertNotIn('apply', port.calls)

    def test_rollback_uses_previously_verified_bytes(self):
        port = Port('lost-ack')
        reads = []
        def rollback():
            reads.append(1)
            return 'rollback' if len(reads) == 1 else 'foreign-sql'
        port.rollback = rollback
        self.assertTrue(self.invoke(port)['rollbackTriggered'])
        self.assertEqual(len(reads), 1)
        self.assertNotIn('foreign-sql', port.calls)

    def test_timeout_keeps_unknown_even_when_old_definitions_visible(self):
        port = Port('timeout')
        receipt = self.invoke(port)
        self.assertEqual(receipt['status'], 'UNKNOWN')
        self.assertNotIn('previousDefinitionsVerified', receipt)
        self.assertNotIn('rollback', port.calls)

    def test_empty_backup_is_rejected(self):
        with self.assertRaises(AssertionError):
            transition.validate_backup({'artifacts': {}, 'restoredSchema': {},
                'rowCountsMatch': True, 'productionDdl': False})

    def test_interruption_keeps_unknown_without_reconciliation_or_retry(self):
        port = Port('interrupt')
        receipt = self.invoke(port)
        self.assertEqual(receipt['status'], 'UNKNOWN')
        self.assertNotIn('previousDefinitionsVerified', receipt)
        self.assertNotIn('rollback', port.calls)

    def test_transport_failure_keeps_unknown_while_old_definitions_visible(self):
        port = Port('transport')
        receipt = self.invoke(port)
        self.assertEqual(receipt['status'], 'UNKNOWN')
        self.assertNotIn('previousDefinitionsVerified', receipt)
        self.assertEqual(port.calls.count('apply'), 1)
        self.assertNotIn('rollback', port.calls)

    def test_remote_nonzero_does_not_claim_server_termination(self):
        port = transition.RemotePort({'proof': {}, 'sha': '0' * 40})
        with patch.object(transition.subprocess, 'run', return_value=subprocess.CompletedProcess([], 1, '', 'synthetic-private-value')):
            with self.assertRaises(transition.UnconfirmedSqlExecution):
                port.execute('BEGIN; COMMIT;')

    def test_complete_restore_receipt_accepted(self):
        receipt = json.loads(Path(__file__).with_name('backup-restore.json').read_text())
        transition.validate_backup(receipt)


class AdditivePort(Port):
    def execute_guarded(self, expected, sql):
        super().execute_guarded(expected, sql)
        if sql == 'rollback':
            self.state = 'history-preserved'
            if self.failure == 'rollback-lost-ack':
                raise RuntimeError('synthetic-private-value')


class AdditiveTransitionTests(unittest.TestCase):
    def invoke(self, port, mode='apply'):
        proof = {
            'beforeDefinitionsSha256': transition.digest({'state': 'old'}),
            'afterDefinitionsSha256': transition.digest({'state': 'new'}),
            'rollbackDefinitionsSha256': transition.digest({'state': 'history-preserved'}),
            'migrationSha256': hashlib.sha256(b'apply').hexdigest(),
            'rollbackSha256': hashlib.sha256(b'rollback').hexdigest(),
        }
        receipt = transition.transition(port, mode, proof, 'apply')
        self.assertNotIn('synthetic-private-value', str(receipt))
        self.assertFalse(receipt['dataRestore'])
        self.assertFalse(receipt['workerStarted'])
        return receipt

    def test_apply_and_additive_rollback_have_distinct_verified_targets(self):
        port = AdditivePort()
        self.assertEqual(self.invoke(port)['status'], 'PASS')
        self.assertEqual(self.invoke(port, 'rollback')['status'], 'PASS')
        self.assertEqual(port.state, 'history-preserved')
        self.assertEqual(port.calls.count('apply'), 1)
        self.assertEqual(port.calls.count('rollback'), 1)

    def test_apply_requires_original_baseline_even_after_additive_rollback(self):
        port = AdditivePort()
        port.state = 'history-preserved'
        self.assertEqual(self.invoke(port)['status'], 'FAIL')
        self.assertEqual(port.calls, ['preflight'])

    def test_rollback_requires_applied_state_not_original_or_preserved_state(self):
        for state in ('old', 'history-preserved', 'foreign'):
            with self.subTest(state=state):
                port = AdditivePort()
                port.state = state
                self.assertEqual(self.invoke(port, 'rollback')['status'], 'FAIL')
                self.assertEqual(port.calls, ['preflight'])

    def test_confirmed_apply_failure_compensates_without_claiming_original_state(self):
        port = AdditivePort('lost-ack')
        receipt = self.invoke(port)
        self.assertEqual(receipt['status'], 'FAIL')
        self.assertTrue(receipt['rollbackTriggered'])
        self.assertTrue(receipt['rollbackDefinitionsVerified'])
        self.assertFalse(receipt['previousDefinitionsVerified'])
        self.assertEqual(port.calls.count('rollback'), 1)

    def test_confirmed_rejection_accepts_original_state_without_rollback(self):
        port = AdditivePort('rejected')
        receipt = self.invoke(port)
        self.assertEqual(receipt['status'], 'FAIL')
        self.assertTrue(receipt['previousDefinitionsVerified'])
        self.assertFalse(receipt['rollbackDefinitionsVerified'])
        self.assertNotIn('rollback', port.calls)

    def test_rollback_commit_then_confirmed_error_reconciles_preserved_state_once(self):
        port = AdditivePort('rollback-lost-ack')
        port.state = 'new'
        receipt = self.invoke(port, 'rollback')
        self.assertEqual(receipt['status'], 'FAIL')
        self.assertTrue(receipt['rollbackDefinitionsVerified'])
        self.assertFalse(receipt['previousDefinitionsVerified'])
        self.assertEqual(port.calls.count('rollback'), 1)

    def test_wrong_rollback_target_never_passes(self):
        port = Port()
        port.state = 'new'
        receipt = self.invoke(port, 'rollback')
        self.assertEqual(receipt['status'], 'FAIL')
        self.assertTrue(receipt['previousDefinitionsVerified'])
        self.assertFalse(receipt['rollbackDefinitionsVerified'])
        self.assertEqual(port.calls.count('rollback'), 1)

    def test_unknown_apply_or_rollback_never_reconciles_or_retries(self):
        for mode in ('apply', 'rollback'):
            for failure in ('timeout', 'interrupt', 'transport'):
                with self.subTest(mode=mode, failure=failure):
                    port = AdditivePort(failure)
                    port.state = 'old' if mode == 'apply' else 'new'
                    receipt = self.invoke(port, mode)
                    self.assertEqual(receipt['status'], 'UNKNOWN')
                    self.assertNotIn('previousDefinitionsVerified', receipt)
                    self.assertNotIn('rollbackDefinitionsVerified', receipt)
                    self.assertEqual(port.calls, ['preflight', 'snapshot', mode])

    def test_foreign_drift_after_apply_never_triggers_rollback(self):
        port = AdditivePort('drift')
        self.assertEqual(self.invoke(port)['status'], 'UNKNOWN')
        self.assertEqual(port.state, 'foreign')
        self.assertNotIn('rollback', port.calls)


if __name__ == '__main__':
    unittest.main()
