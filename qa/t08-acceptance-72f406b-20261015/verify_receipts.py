"""Verify bounded owner receipts, without opening backups or contacting production."""
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
receipts = OUT / 'receipts'
data = {p.stem: json.loads(p.read_text()) for p in receipts.glob('*.json')}
checks = []
for row in data['provenance']['receipts']:
    actual = hashlib.sha256((receipts / Path(row['path']).name).read_bytes()).hexdigest()
    checks.append({'check': 'snapshotted receipt ' + row['path'], 'status': 'PASS' if actual == row['sha256'] else 'FAIL'})
for stem, migration, rollback_key in [
    ('checkpoint-restore', '20261015_final_durable_integrity.sql', 'definitionsRestoredExactly'),
    ('client-permissions-restore', '20261015_client_write_permissions.sql', 'stateRestoredExactly'),
    ('social-history-restore', '20261015_social_authorization_history.sql', 'rollbackPreservesHistory'),
]:
    row = data[stem]
    source_hash = hashlib.sha256((ROOT / 'migrations' / migration).read_bytes()).hexdigest()
    valid = row['status'] == 'PASS' and not row['productionChanged'] and row['replaySafe'] and row[rollback_key] and row['migrationSha256'] == source_hash
    checks.append({'check': 'exact migration, private replay and rollback ' + stem, 'status': 'PASS' if valid else 'FAIL'})
backup = data['backup-restore']
age = (datetime.now(timezone.utc) - datetime.fromisoformat(backup['observedAt'])).total_seconds() / 3600
valid_backup = backup['snapshotShared'] and backup['rowCountsMatch'] and backup['restoredTables'] == 141 and not backup['productionDdl'] and not backup['migrations'] and all(backup['restoredSchema'].values())
checks.append({'check': 'bounded restore141 receipt', 'status': 'PASS' if valid_backup else 'FAIL'})
checks.append({'check': 'backup receipt under4h at this snapshot', 'status': 'PASS' if 0 <= age < 4 else 'FAIL'})
candidate = data['candidate']
valid_candidate = candidate['source'] == '72f406b940b7e3cdfb27873751a4059375646f25' and candidate['status'] == 'PASS' and candidate['network'] == 'none' and not candidate['productionChanged'] and len(candidate['checks']) == 5 and all(c['status'] == c['expected'] for c in candidate['checks']) and candidate['ffmpegSubtitlesDrawtextFfprobe']
checks.append({'check': 'exact isolated OVH image receipt with five smokes and FFmpeg', 'status': 'PASS' if valid_candidate else 'FAIL'})
scheduler = data['scheduler-inventory']
inactive = not scheduler['systemdUnits'] and scheduler['hostCronEntries'] == scheduler['database']['sutraPgCronJobs'] == scheduler['database']['activeAutoConfigurations'] == scheduler['database']['automaticPublicationEnabled'] == 0
checks.append({'check': 'scheduler remains explicitly inactive in current receipt', 'status': 'PASS' if inactive else 'FAIL'})
plan = data['scheduler-plan']
checks.append({'check': 'observer plan is not a dispatch executor', 'status': 'PASS' if plan['status'] == 'PREPARED_NOT_INSTALLED' and plan['mode'] == 'observe-only' and not plan['dispatchEnabled'] and plan['generationCalls'] == plan['publicationCalls'] == 0 else 'FAIL'})
result = {'candidate': '72f406b940b7e3cdfb27873751a4059375646f25', 'observedAt': datetime.now(timezone.utc).isoformat(),
          'command': 'python3 qa/t08-acceptance-72f406b-20261015/verify_receipts.py',
          'counts': dict(Counter(c['status'] for c in checks)), 'notFunctionalTestCount': True, 'checks': checks,
          'backupAgeHours': round(age, 2), 'runtimeAtReceipt': scheduler['source'],
          'limits': ['Owner T01 executed remote read-only/copy checks; T08 verifies receipts only.',
                     'Auth IDs only and blobs not atomically frozen; no complete backup certification.',
                     'Scheduler inactivity is confirmed as a blocker, not a feature PASS.',
                     'No production deployment, DDL or rollback is executed or authorized by this verification.']}
(OUT / 'receipt-verification.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'counts': result['counts'], 'backupAgeHours': result['backupAgeHours']}))
raise SystemExit(any(c['status'] != 'PASS' for c in checks))
