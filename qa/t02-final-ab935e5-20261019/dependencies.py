"""Read-only public npm advisory lookup, empty configuration and no credentials."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
assert not (ROOT / '.npmrc').exists(), 'Do not load project npm credentials'
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
minimal = {'PATH': '/opt/homebrew/bin:/usr/bin:/bin', 'NPM_CONFIG_USERCONFIG': '/dev/null',
           'NPM_CONFIG_GLOBALCONFIG': str(OUT / 'empty-npmrc'), 'NPM_CONFIG_CACHE': str(OUT / '.npm-cache'),
           'NPM_CONFIG_UPDATE_NOTIFIER': 'false'}
for scope in ['production', 'all']:
    args = ['npm', 'audit', '--json', '--ignore-scripts', '--registry=https://registry.npmjs.org']
    if scope == 'production': args += ['--omit=dev']
    result = subprocess.run(args, cwd=ROOT, env=minimal, capture_output=True, text=True, timeout=120)
    data = json.loads(result.stdout)
    assert 'metadata' in data, 'Audit lookup failed; do not treat as clean'
    target = OUT / f'npm-audit-{scope}.json'
    target.write_text(json.dumps(data, indent=2) + '\n')
    previous = json.loads((ROOT / f'qa/t02-final-integration-proof-20261015/npm-audit-{scope}.json').read_text())
    receipt = {'head': head, 'command': args, 'exitCode': result.returncode,
               'status': 'ALERTS_RETAINED' if data['metadata']['vulnerabilities']['total'] else 'PASS',
               'counts': data['metadata']['vulnerabilities'],
               'sameVulnerabilitiesAsPrior': data['vulnerabilities'] == previous['vulnerabilities'],
               'packageLockSha256': hashlib.sha256((ROOT / 'package-lock.json').read_bytes()).hexdigest(),
               'logSha256': hashlib.sha256(target.read_bytes()).hexdigest(),
               'credentials': 'none; empty npmrc and minimal environment', 'installOrMutation': False}
    (OUT / f'npm-audit-{scope}-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({'scope': scope, 'counts': receipt['counts'], 'sameAsPrior': receipt['sameVulnerabilitiesAsPrior']}), flush=True)
