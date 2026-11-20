"""Inspect exact candidate CI receipts and raw artifacts downloaded once by T01."""
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
SOURCE = Path('/Users/matissdornier/purama-worktrees/sutra-final-providers-20261013')
QA = SOURCE / 'qa/t01-final-20261015'
CANDIDATE = '72f406b940b7e3cdfb27873751a4059375646f25'
checks = []

def digest(data):
    return hashlib.sha256(data).hexdigest()

def check(label, condition):
    checks.append({'check': label, 'status': 'PASS' if condition else 'FAIL'})

status_path = OUT / 'receipts/ci-status.json'
status = json.loads(status_path.read_text())
QA = SOURCE / 'qa/t01-promotion-20261015'
check('exact CI candidate', status['headSha'] == CANDIDATE)
check('three successful CI jobs', status['conclusion'] == 'success' and len(status['jobs']) == 3 and all(j['conclusion'] == 'success' for j in status['jobs']))
artifacts = {'ci-status.json': digest(status_path.read_bytes())}
groups = []
for group in ['contracts', 'media']:
    path = QA / 'ci-contract-artifacts/test-results/ci' / group / 'results.json'
    rows = json.loads(path.read_text())
    artifacts[str(path.relative_to(QA))] = digest(path.read_bytes())
    for row in rows:
        log = path.parent / (row['name'] + '.log')
        counts = {}
        import re
        for name, value in re.findall(r'^[#ℹ] (tests|pass|fail|skipped) (\d+)\s*$', log.read_text(), re.M):
            counts[name] = int(value)
        groups.append({**row, 'group': group, 'counts': counts, 'logSHA256': digest(log.read_bytes())})
        check('CI group ' + group + '/' + row['name'], row['status'] == 'PASS' and row['exitCode'] == 0 and counts.get('fail', 0) == 0)
database = OUT / 'receipts/ci-database.log'
artifacts['ci-database.log'] = digest(database.read_bytes())
for job in status['jobs']:
    if job['name'] == 'disposable-database':
        check('disposable database job', job['conclusion'] == 'success')

browser = []
base = QA / 'ci-quality-artifacts/qa/t01-final-20261015/browser-final'
for path in sorted(base.glob('*/*/results.json')):
    data = json.loads(path.read_text())
    runtime_path = path.with_name('runtime-errors.json')
    runtime = json.loads(runtime_path.read_text())
    methods = Counter(q.get('matchingFetch', {}).get('method', 'UNKNOWN') for q in runtime['qualified'])
    family = str(path.parent.relative_to(base))
    check('browser assertions ' + family, bool(data['results']) and all(r['status'] == 'PASS' for r in data['results']))
    check('qualified diagnostics read methods only ' + family, not set(methods) - {'GET', 'HEAD'} and not runtime['unexpected'] and not runtime['domErrors'])
    browser.append({'family': family, 'assertionCount': len(data['results']), 'allAssertionsPass': all(r['status'] == 'PASS' for r in data['results']),
                    'rawDiagnostics': len(runtime['errors']), 'qualifiedMethods': dict(methods), 'unexpected': len(runtime['unexpected']),
                    'domErrors': len(runtime['domErrors']), 'resultsSHA256': digest(path.read_bytes()), 'runtimeSHA256': digest(runtime_path.read_bytes())})
check('20 browser families', len(browser) == 20)

media_base = QA / 'ci-contract-artifacts/qa/t05-final-media-20261015'
media_path = media_base / 'media-ci.json'
exports = []
for row in json.loads(media_path.read_text())['exports']:
    path = media_base / row['file']
    final = row['validation']['final']
    actual = digest(path.read_bytes())
    check('real synthetic CPU export ' + row['name'], actual == final['sha256'] and path.stat().st_size == final['bytes'] and final['fullDecode'])
    exports.append({'name': row['name'], 'sha256': actual, 'bytes': path.stat().st_size, 'video': final['video'], 'audio': final['audio'], 'duration': final['duration'], 'source': str(path)})
check('17 CI real CPU exports', len(exports) == 17)
result = {'candidate': CANDIDATE, 'observedAt': datetime.now(timezone.utc).isoformat(),
          'command': 'python3 qa/t08-acceptance-72f406b-20261015/verify_ci.py', 'ciRun': 38745298450, 'ciUrl': status['url'],
          'counts': dict(Counter(c['status'] for c in checks)), 'notFunctionalTestCount': True,
          'checks': checks, 'artifactHashes': artifacts, 'groups': groups, 'browser': browser, 'exports': exports,
          'ciConclusion': status['conclusion'], 'jobs': status['jobs'],
          'mediaReceiptSHA256': digest(media_path.read_bytes()),
          'limits': ['Raw browser artifacts retained by T01; derived report omits synthetic UUID details.',
                     'Simulated identities/providers and real CPU exports are not GPU or public publication proof.',
                     'No independent duplicate build, browser run or CI artifact download.']}
(OUT / 'ci-verification.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'candidate': CANDIDATE, 'counts': result['counts'], 'browserFamilies': len(browser), 'realCPUExports': len(exports)}))
raise SystemExit(any(c['status'] != 'PASS' for c in checks))
