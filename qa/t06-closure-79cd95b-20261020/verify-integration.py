"""Read-only Git/CI reconciliation; no functional test or provider invocation."""
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
SHARED = Path('/Users/matissdornier/purama/.coord/handoffs/SUTRA-20261012')
CANDIDATE = '79cd95bfdb3e5837e2a78e45efaea444cb8dcf8a'
DELIVERY = '46870824d434dfbfc8d7c87e899e7e57ae0a9d9a'


def blob(ref, path):
    return subprocess.check_output(['git', 'show', f'{ref}:{path}'], cwd=ROOT)


def digest(value):
    return hashlib.sha256(value).hexdigest()


receipt = {'candidate': CANDIDATE, 'recordedAt': datetime.now(timezone.utc).isoformat(),
           'mode': 'CI proof reuse with exact Git input hashes; not a new test run',
           'invariants': [], 'deliveredComponents': [], 'ciReceipts': []}
previous = json.loads((ROOT/'qa/t06-ux-social-ab935-20261019/integration.json').read_text())
for entry in previous['files']:
    path = entry['path']
    actual = digest(blob(CANDIDATE, path))
    receipt['invariants'].append({'path': path, 'sha256': actual,
                                  'unchangedSincePrevious': actual == entry['sha256']})
# Gate machinery changed, but no social/backend/test/dependency input did.
required = [e for e in receipt['invariants'] if not e['path'].startswith(('scripts/run-ci', '.github/'))]
assert all(e['unchangedSincePrevious'] for e in required), [e for e in required if not e['unchangedSincePrevious']]
for name in ['PublishEverywhereButton.tsx', 'publish/PublishScheduleSection.tsx',
             'publish/PublishPlatformGrid.tsx', 'publish/PublishCaptionSection.tsx',
             'publish/PublishResultsSection.tsx', 'publish/PublishModalFooter.tsx']:
    path = 'src/components/social/'+name
    assert blob(CANDIDATE, path) == blob(DELIVERY, path), path
    receipt['deliveredComponents'].append({'path': path, 'sha256': digest(blob(CANDIDATE, path)), 'status': 'EXACT'})
trigger = 'src/components/social/publish/PublishTriggerButton.tsx'
delta = subprocess.check_output(['git', 'diff', DELIVERY, CANDIDATE, '--', trigger], cwd=ROOT, text=True)
assert delta.count('+          e.currentTarget.focus()') == 1 and delta.count('+        e.currentTarget.focus()') == 1
receipt['focusDelta'] = {'path': trigger, 'sha256': digest(blob(CANDIDATE, trigger)), 'diff': delta}
for name in ['T01-CI-FINAL-20261019.json', 'T01-CI-79CD-CONTRACT-MEDIA-20261019.json',
             'T01-CI-79CD-QUALITY-ARTIFACT-20261019.json']:
    content = (SHARED/name).read_bytes()
    data = json.loads(content)
    assert data['headSha'] == CANDIDATE
    receipt['ciReceipts'].append({'source': str(SHARED/name), 'sha256': digest(content), 'receipt': data})
ci, contracts, quality = [entry['receipt'] for entry in receipt['ciReceipts']]
assert ci['status'] == 'completed' and ci['conclusion'] == 'success'
assert all(job['conclusion'] == 'success' for job in ci['jobs'])
commands = contracts['results']['test-results/ci/contracts/results.json']
assert all(c['status'] == 'PASS' and c['exitCode'] == 0 for c in commands)
social_tests = ['scripts/test-t06-final-social.mts', 'scripts/test-t06-social-final.mts',
                'scripts/test-t06-social-routes.mts', 'scripts/test-t02-oauth-boundaries.mts',
                'scripts/test-t06-social-autonomy.mts', 'scripts/test-t06-social-validation.mts',
                'scripts/test-social-publication.mts', 'scripts/test-zernio-oauth-contracts.mts',
                'qa/t06-final-integration-20261015/autopilot.test.mts',
                'qa/t01-closure-20261015/auto-config.test.mts',
                'qa/t01-closure-20261015/schedule-cas.test.mts']
assert all(p in commands[0]['command'] for p in social_tests)
receipt['socialTestFilesInExactCI'] = social_tests
assert all(c['status'] == 'PASS' and c['exitCode'] == 0 for c in quality['results']['test-results/ci/quality/results.json'])
receipt['status'] = 'PASS'
(OUT/'integration.json').write_text(json.dumps(receipt, indent=2, ensure_ascii=False)+'\n')
print(f'PASS: {len(required)} unchanged social inputs, 6 exact components, 2 focus lines, {len(social_tests)} social test files in exact successful CI')
