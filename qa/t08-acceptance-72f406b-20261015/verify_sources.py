"""Bind current execution and deliberately reused evidence to the immutable candidate."""
import hashlib
import json
import subprocess
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
CANDIDATE = '72f406b940b7e3cdfb27873751a4059375646f25'
OLD = 'd21b7b4cdaf4d0a7699560af78cdd38cfb20d2b2'
checks = []

def check(label, condition):
    checks.append({'check': label, 'status': 'PASS' if condition else 'FAIL'})

def digest(data):
    return hashlib.sha256(data).hexdigest()

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

manifest = json.loads((ROOT / 'qa/t01-final-20261015/tested-source-manifest.json').read_text())
paths = [row['path'] for row in manifest['files']]
stream = subprocess.run(['git', 'cat-file', '--batch'], cwd=ROOT,
                        input=''.join(CANDIDATE + ':' + p + '\n' for p in paths).encode(),
                        capture_output=True, check=True).stdout
position = 0
for row in manifest['files']:
    end = stream.index(b'\n', position)
    size = int(stream[position:end].split()[-1])
    data = stream[end+1:end+1+size]
    position = end + size + 2
    check('source exact ' + row['path'], digest(data) == row['sha256'] == digest((ROOT / row['path']).read_bytes()))
delta = git('diff', '--name-only', OLD, CANDIDATE).decode().splitlines()
product_delta = [p for p in delta if p.startswith(('src/', 'migrations/')) or p in ['package.json', 'package-lock.json']]
expected_delta = ['migrations/20261015_social_authorization_history.sql', 'src/app/api/production/route.ts', 'src/lib/social-account-revocation.ts']
check('only three expected product/SQL changes; dependencies unchanged', product_delta == expected_delta)
for owner, path in [('8c416290ebdabe9b0e8a1fa9708f537c8c0a45f5', 'src/app/api/production/route.ts'),
                    ('3edae7ae1d3c13ed2b385a9602a9ad8da6ca5b6d', 'src/lib/social-account-revocation.ts')]:
    check('integrated owner bytes ' + path, git('show', owner + ':' + path) == (ROOT / path).read_bytes())
check('canonical corrected history SQL', digest((ROOT / expected_delta[0]).read_bytes()) == 'd2f6a9cb380a15285759085cdf602701f0d9d785d4a7f76f2061438d38ab9ddc')

reuse = {}
for label, path in [('T03', 'qa/t03-durable-closure-20261015/integration-source-manifest.json'),
                    ('T05', 'qa/t05-integrated-retest-20261015/integration.json'),
                    ('T07', 'qa/t07-integrated-retest-20261015/integration.json')]:
    receipt = json.loads((ROOT / path).read_text())
    rows = []
    for row in receipt['files']:
        same = digest((ROOT / row['path']).read_bytes()) == row['sha256']
        rows.append({'path': row['path'], 'unchanged': same})
        check(label + ' source parity or explicitly retested delta ' + row['path'], same or row['path'] in expected_delta)
    reuse[label] = {'manifest': path, 'manifestSHA256': digest((ROOT / path).read_bytes()), 'sources': rows}

phases = ['harness', 'rpc', 'history-routes', 'history-sql', 'cancellation', 'capabilities', 'social-authority', 'journey']
executions = {}
total = Counter()
for name in phases:
    row = json.loads((OUT / (name + '.json')).read_text())
    check('execution exact and successful ' + name, row['candidate'] == CANDIDATE and row['exitCode'] == 0 and row['counts']['fail'] == row['counts']['skipped'] == 0)
    for path, sha in row['testFilesSHA256'].items():
        check('executed test unchanged ' + path, digest((ROOT / path).read_bytes()) == sha)
    total.update(row['counts'])
    executions[name] = {'counts': row['counts'], 'logSHA256': digest((OUT / row['log']).read_bytes()), 'receiptSHA256': digest((OUT / (name + '.json')).read_bytes())}
check('112 direct tests, no fail or skip', dict(total) == {'tests': 112, 'pass': 112, 'fail': 0, 'skipped': 0})

exports = []
base = ROOT / 'qa/t05-integrated-retest-20261015'
for row in json.loads((base / 'measurements.json').read_text())['exports']:
    path = base / row['file']
    final = row['validation']['final']
    check('retained CPU 4K export ' + row['format'], path.exists() and digest(path.read_bytes()) == row['sha256'] == final['sha256'] and path.stat().st_size == final['bytes'] and final['fullDecode'])
    exports.append({'format': row['format'], 'path': str(path.relative_to(ROOT)), 'sha256': row['sha256'], 'bytes': final['bytes'], 'fullDecodeFromOwner': final['fullDecode']})

result = {'candidate': CANDIDATE, 'previousCandidate': OLD, 'observedAt': datetime.now(timezone.utc).isoformat(),
          'command': 'python3 qa/t08-acceptance-72f406b-20261015/verify_sources.py', 'counts': dict(Counter(c['status'] for c in checks)),
          'notFunctionalTestCount': True, 'sourceCount': len(paths), 'productDelta': product_delta,
          'testedSourceDelta': sorted(set(delta) & set(paths)), 'checks': checks, 'reusedOwnerSources': reuse,
          'directExecutions': executions, 'directTotals': dict(total), 'retainedSyntheticCPU4KExports': exports,
          'limits': ['Source verification is not a new execution of unchanged suites.', 'No GPU, live publication, production change or provider call.', 'Exact candidate CI/browser evidence is recorded separately.']}
(OUT / 'source-verification.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'counts': result['counts'], 'directTotals': dict(total), 'sourceCount': len(paths), 'productDelta': product_delta}))
for c in checks:
    if c['status'] != 'PASS':
        print(c)
raise SystemExit(any(c['status'] != 'PASS' for c in checks))
