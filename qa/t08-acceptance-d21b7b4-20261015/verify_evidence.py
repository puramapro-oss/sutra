"""Verify exact CI lineage and retained artefacts without repeating builds/provider calls."""
import hashlib
import json
import subprocess
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
SOURCE = Path('/Users/matissdornier/purama-worktrees/sutra-final-providers-20261013')
QA = SOURCE / 'qa/t01-final-20261015'
CANDIDATE = 'd21b7b4cdaf4d0a7699560af78cdd38cfb20d2b2'
RECEIPT = '56754679abed9aa1e51323c29aed5bef38bc17d0'
checks = []

def check(label, condition):
    checks.append({'check': label, 'status': 'PASS' if condition else 'FAIL'})

def digest(data):
    return hashlib.sha256(data).hexdigest()

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

manifest = json.loads((ROOT / 'qa/t01-final-20261015/tested-source-manifest.json').read_text())
paths = [r['path'] for r in manifest['files']]
check('candidate ancestor of documentary receipt', git('merge-base', CANDIDATE, RECEIPT).decode().strip() == CANDIDATE)
check('receipt delta excludes tested sources', not set(git('diff', '--name-only', CANDIDATE, RECEIPT).decode().splitlines()) & set(paths))
blob_stream = subprocess.run(['git', 'cat-file', '--batch'], cwd=ROOT, input=''.join(CANDIDATE + ':' + p + '\n' for p in paths).encode(), capture_output=True, check=True).stdout
position = 0
for row in manifest['files']:
    end = blob_stream.index(b'\n', position)
    size = int(blob_stream[position:end].split()[-1])
    data = blob_stream[end+1:end+1+size]
    position = end + size + 2
    check('source exact ' + row['path'], digest(data) == row['sha256'] == digest((ROOT / row['path']).read_bytes()))

receipts = {}
for name in ['ci-d21b7b4-status.json', 'ci-d21b7b4-tests.json', 'ci-d21b7b4-database.json', 'backup-restore.json', 'checkpoint-restore.json', 'client-permissions-restore.json', 'social-history-restore.json', 'provider-runtime.json']:
    data = git('show', RECEIPT + ':qa/t01-final-20261015/' + name)
    target = OUT / 'receipts' / name
    target.parent.mkdir(exist_ok=True)
    target.write_bytes(data)
    receipts[name] = json.loads(data)
    check('receipt unchanged ' + name, (QA / name).read_bytes() == data)
status = receipts['ci-d21b7b4-status.json']
check('CI binds exact candidate and all three jobs', status['headSha'] == CANDIDATE and status['conclusion'] == 'success' and len(status['jobs']) == 3 and all(j['conclusion'] == 'success' for j in status['jobs']))
tests = receipts['ci-d21b7b4-tests.json']
check('test and PG receipts exact candidate', all(receipts[n]['candidate'] == CANDIDATE for n in ['ci-d21b7b4-tests.json','ci-d21b7b4-database.json']))
artifacts = {}
for name, expected in tests['artifactHashes'].items():
    data = (QA / name).read_bytes()
    artifacts[name] = digest(data)
    check('CI artifact digest ' + name, digest(data) == expected)

browser = []
base = QA / 'ci-d21b7b4-quality-artifacts/qa/t01-final-20261015/browser-final'
for path in sorted(base.glob('*/*/results.json')):
    data = json.loads(path.read_text())
    runtime_path = path.with_name('runtime-errors.json')
    runtime = json.loads(runtime_path.read_text())
    methods = Counter(q.get('matchingFetch', {}).get('method', 'UNKNOWN') for q in runtime['qualified'])
    check('browser assertions ' + str(path.relative_to(base)), bool(data['results']) and all(r['status'] == 'PASS' for r in data['results']))
    check('qualified diagnostics are actually GET ' + str(path.relative_to(base)), not set(methods) - {'GET'} and not runtime['unexpected'] and not runtime['domErrors'])
    browser.append({'family': str(path.parent.relative_to(base)), 'results': data['results'],
                    'rawDiagnostics': len(runtime['errors']), 'qualifiedMethods': dict(methods), 'unexpected': len(runtime['unexpected']),
                    'domErrors': len(runtime['domErrors']), 'resultsSHA256': digest(path.read_bytes()), 'runtimeSHA256': digest(runtime_path.read_bytes())})
check('20 browser families', len(browser) == 20)

media_base = QA / 'ci-d21b7b4-contract-artifacts/qa/t05-final-media-20261015'
media_path = media_base / 'media-ci.json'
media = json.loads(media_path.read_text())
exports = []
for row in media['exports']:
    path = media_base / row['file']
    final = row['validation']['final']
    actual = digest(path.read_bytes())
    check('retained CPU export hash ' + row['name'], actual == final['sha256'] and path.stat().st_size == final['bytes'] and final['fullDecode'])
    exports.append({'name': row['name'], 'sha256': actual, 'bytes': path.stat().st_size, 'video': final['video'], 'audio': final['audio'], 'duration': final['duration'], 'source': str(path)})
check('17 retained real CPU exports', len(exports) == 17)
backup_age = (datetime.now(timezone.utc) - datetime.fromisoformat(receipts['backup-restore.json']['observedAt'])).total_seconds() / 3600
result = {'candidate': CANDIDATE, 'documentaryReceipt': RECEIPT, 'observedAt': datetime.now(timezone.utc).isoformat(),
          'command': 'python3 qa/t08-acceptance-d21b7b4-20261015/verify_evidence.py',
          'sourceCount': len(paths), 'ciRun': 38677062190, 'ciUrl': status['url'],
          'counts': dict(Counter(c['status'] for c in checks)), 'checks': checks, 'artifactHashes': artifacts,
          'browser': browser, 'exports': exports, 'mediaReceiptSHA256': digest(media_path.read_bytes()),
          'backupAgeHours': round(backup_age, 2), 'backupCurrentlyFreshUnder4h': backup_age < 4,
          'limits': ['CI evidence reused on exact candidate; no duplicate build or browser run',
                     'GET-only actual browser diagnostics do not close independent classifier mutation counterexamples',
                     'provider runtime receipt is old runtime 86d04c8, not a candidate provider execution',
                     'no paid AI, GPU, personal consent, live publication, production migration or deployment']}
(OUT / 'evidence-verification.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'candidate': CANDIDATE, 'counts': result['counts'], 'browserFamilies': len(browser), 'realCPUExports': len(exports), 'backupAgeHours': result['backupAgeHours']}))
raise SystemExit(any(c['status'] != 'PASS' for c in checks))
