"""Real promotion entry point with synthetic local host/process ports only."""
import json
import copy
import datetime
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'deploy'))
import test_salad_promotion as promotion_tests
import promotion_guards as guards


class NewMigrationBoundaryTests(unittest.TestCase):
    def case(self):
        case = promotion_tests.PromotionInterruptionTests()
        case.setUp()
        self.addCleanup(case.doCleanups)
        return case

    def test_missing_new_migration_receipts_prevent_any_remote_action(self):
        case = self.case()
        (case.proof / 'additional-migrations.json').unlink(missing_ok=True)
        with self.assertRaises((AssertionError, FileNotFoundError)):
            case.invoke()
        self.assertEqual(case.helper_commands, [])
        self.assertEqual(case.replacements, [])

    def test_receipts_must_bind_exact_source_backup_and_rehearsal(self):
        case = self.case()
        valid = case.fixtures['additional-migrations']
        mutations = [
            ('source', 'b' * 40), ('status', 'FAIL'), ('backupDirectory', '/wrong'),
            ('backupArtifacts', {}), ('migrations', {}), ('dataPreserved', False),
            ('replaySafe', False), ('rollbackPreservesData', False),
            ('restoredStateVerified', False), ('productionChangedByRehearsal', True),
            ('rehearsedAt', '2099-01-01T00:00:00+00:00'),
            ('appliedAt', '2000-01-01T00:00:00+00:00'),
            ('protectedRollback', '/different/rollback'), ('rollbackStateSha256', ''),
            ('stateQuerySha256', '0' * 64), ('afterStateSha256', '0' * 64),
        ]
        for key, value in mutations:
            with self.subTest(key=key):
                receipt = copy.deepcopy(valid); receipt[key] = value
                (case.proof / 'additional-migrations.json').write_text(json.dumps(receipt))
                with self.assertRaises((AssertionError, KeyError, TypeError, ValueError)):
                    case.invoke()
                self.assertEqual(case.helper_commands, [])
                self.assertEqual(case.replacements, [])

    def test_stale_backup_cannot_certify_additional_migrations(self):
        case = self.case()
        backup = copy.deepcopy(case.fixtures['backup-restore'])
        backup['observedAt'] = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=5)).isoformat()
        with self.assertRaisesRegex(AssertionError, 'BACKUP_STALE'):
            guards.validate_additional_migration_proofs(backup, case.fixtures['additional-migrations'],
                promotion_tests.SHA, {p: (case.root / p).read_bytes() for p in guards.ADDITIONAL_MIGRATIONS})

    def test_invalid_guards_cannot_be_blessed_by_a_matching_catalogue_hash(self):
        case = self.case()
        for boundary in ('anonymous', 'authenticated', 'service', 'cursor', 'trigger', 'index', 'function'):
            with self.subTest(boundary=boundary):
                state = copy.deepcopy(case.additional_state)
                if boundary == 'anonymous': state['functions'][0]['anon'] = True
                if boundary == 'authenticated': state['functions'][1]['authenticated'] = True
                if boundary == 'service': state['functions'][1]['service'] = False
                if boundary == 'cursor': state['tables'][2]['columns'][0]['notNull'] = False
                if boundary == 'trigger': state['tables'][2]['triggers'][0]['enabled'] = 'D'
                if boundary == 'index': state['tables'][1]['indexes'][0]['valid'] = False
                if boundary == 'function': state['functions'].pop()
                with self.assertRaises(AssertionError):
                    guards.validate_additional_state(state, guards.sha256(json.dumps(state, sort_keys=True).encode()))

    def test_live_catalogue_drift_prevents_snapshot_and_promotion(self):
        case = self.case()
        case.additional_state['functions'][1]['definition'] = 'drift after rehearsal'
        with self.assertRaises(RuntimeError):
            case.invoke()
        self.assertEqual(case.replacements, [])
        self.assertFalse((case.live / ('rollback-' + promotion_tests.SHA)).exists())
        self.assertNotIn(promotion_tests.SECRET_CANARY, case.output.getvalue())


if __name__ == '__main__':
    unittest.main()
