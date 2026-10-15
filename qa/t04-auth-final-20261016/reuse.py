"""Verify exact source/dependency identity before reusing T01's downloaded CI evidence."""
import hashlib
import json
from pathlib import Path
import re
import subprocess

root = Path(__file__).resolve().parents[2]
output = Path(__file__).resolve().parent
base = 'f36013ae8b3bd7d9a702f7aebfdff1ac430c05f5'
owner = Path('/Users/matissdornier/purama-worktrees/sutra-final-providers-20261013')
receipt_path = 'qa/t01-closure-20261015/ci-f36013a-contract-counts.json'
receipt = json.loads((owner / receipt_path).read_text())
assert receipt['source'] == base and receipt['ciRun'] == 38809803219
group = next(g for g in receipt['groups'] if g['path'] == 'test-results/ci/contracts/contracts.log')
log = owner / 'qa/t01-closure-20261015/ci-f36013a-contract-artifacts' / group['path']
assert hashlib.sha256(log.read_bytes()).hexdigest() == group['sha256']
tree = subprocess.check_output(['git', 'ls-tree', '-r', base, '--', 'src', 'scripts', 'qa',
                               'package.json', 'package-lock.json', 'tsconfig.json',
                               'eslint.config.mjs', '.github/workflows'], cwd=root, text=True)
checked = []
for line in tree.splitlines():
    info, path = line.split('\t')
    mode, kind, oid = info.split()
    if kind != 'blob' or mode not in ('100644', '100755'):
        continue
    if Path(path).suffix not in ('.ts', '.tsx', '.mts', '.mjs', '.cjs', '.py', '.yml') and path not in (
        'package.json', 'package-lock.json', 'tsconfig.json',
        'src/lib/salad/container/package.json', 'src/lib/salad/container/package-lock.json',
        'src/lib/salad/container/requirements.lock', 'src/lib/salad/container/Dockerfile'):
        continue
    data = (root / path).read_bytes()
    actual = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
    assert actual == oid, f'Changed source requires affected tests: {path}'
    checked.append({'path': path, 'gitBlob': oid, 'sha256': hashlib.sha256(data).hexdigest()})
entries = [line for line in log.read_text().splitlines()
           if line.startswith(('✔', '✖')) and re.search(r'ltx|salad|runpod|suno|shotstack|pexels|eleven', line, re.I)]
assert entries and not any(line.startswith('✖') for line in entries)
report = {'base': base, 'ciRun': receipt['ciRun'], 'sourceReceipt': receipt_path,
          'logSha256Verified': True, 'contracts': group, 'unchangedFileCount': len(checked),
          'unchangedFiles': checked, 'providerNamedAssertions': entries,
          'notAdditive': True, 'globalQuality': 'FAIL_BROWSER_HARNESS_OWNED_BY_T01',
          'newDiagnosticTests': 'separate diagnostic-tests.txt; not part of this reused CI'}
(output / 'ci-reuse.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'status': 'PASS', 'unchangedFiles': len(checked), 'providerNamedAssertions': len(entries),
                  'ciContracts': group['counts']}))
