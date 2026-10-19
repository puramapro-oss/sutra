"""Reuse T01's exact-head CI only for unchanged tracked source and dependency blobs."""
import hashlib
import json
from pathlib import Path
import re
import subprocess

root = Path(__file__).resolve().parents[2]
output = Path(__file__).resolve().parent
base = 'ab935e59ca4e39776630f05b2ba6c0422c74ec62'
owner = Path('/Users/matissdornier/purama-worktrees/sutra-final-providers-20261013')
evidence = owner / 'qa/t01-browser-readiness-20261016'
receipt = json.loads((evidence / 'ci-final.json').read_text())
assert receipt['headSha'] == base and receipt['conclusion'] == 'success'
assert receipt['url'].endswith('/38827288351')
assert all(job['conclusion'] == 'success' for job in receipt['jobs'])
tree = subprocess.check_output(['git', 'ls-tree', '-r', base, '--', 'src', 'scripts', 'qa',
                               'package.json', 'package-lock.json', 'tsconfig.json',
                               'eslint.config.mjs', '.github/workflows'], cwd=root, text=True)
checked = []
for line in tree.splitlines():
    info, path = line.split('\t')
    mode, kind, oid = info.split()
    if kind != 'blob' or mode not in ('100644', '100755') or path == 'src/lib/stock.ts':
        continue
    if Path(path).suffix not in ('.ts', '.tsx', '.mts', '.mjs', '.cjs', '.py', '.yml', '.yaml') and path not in (
        'package.json', 'package-lock.json', 'tsconfig.json',
        'src/lib/salad/container/package.json', 'src/lib/salad/container/package-lock.json',
        'src/lib/salad/container/requirements.lock', 'src/lib/salad/container/Dockerfile'):
        continue
    data = (root / path).read_bytes()
    actual = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
    assert actual == oid, f'Changed source requires affected tests: {path}'
    checked.append({'path': path, 'gitBlob': oid})
groups = []
for group in json.loads((evidence / 'contracts-counts.json').read_text()):
    path = evidence / 'ci-contracts' / group['path']
    contents = path.read_text()
    assert all(count in contents for count in group['counts'])
    assert all(not re.search(r'fail [1-9]', count) for count in group['counts'])
    groups.append({**group, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
log = evidence / 'ci-contracts/test-results/ci/contracts/contracts.log'
entries = [line for line in log.read_text().splitlines()
           if line.startswith(('✔', '✖')) and re.search(r'ltx|salad|runpod|suno|shotstack|pexels|eleven|wan|pollination', line, re.I)]
assert entries and not any(line.startswith('✖') for line in entries)
commands_path = evidence / 'ci-contracts/test-results/ci/contracts/results.json'
commands = json.loads(commands_path.read_text())
assert all(item['status'] == 'PASS' for item in commands)
report = {'base': base, 'ciRun': 38827288351, 'ciUrl': receipt['url'],
          'sourceEvidenceDirectory': str(evidence),
          'ciReceiptSha256': hashlib.sha256((evidence / 'ci-final.json').read_bytes()).hexdigest(),
          'jobs': [{'name': job['name'], 'conclusion': job['conclusion']} for job in receipt['jobs']],
          'contracts': groups, 'commands': commands, 'unchangedFileCount': len(checked),
          'unchangedFiles': checked, 'providerNamedAssertions': entries, 'notAdditive': True,
          'excludedChangedSource': ['src/lib/stock.ts'],
          'newDeltaTests': 'stock-after.txt; separate from reused CI',
          'limitations': ['Local artifact provenance is T01 downloaded evidence; hashes recorded at this read.',
                         'No new global build/CI/runtime/provider generation proof.',
                         'Live master diagnostics are separate from synthetic CI configuration.']}
(output / 'ci-reuse.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'status': 'PASS', 'base': base, 'unchangedFiles': len(checked),
                  'providerNamedAssertions': len(entries), 'groups': len(groups)}))
