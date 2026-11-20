"""Targeted final security checks. No inherited secrets, env files or remote I/O."""
import argparse
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--node', required=True)
parser.add_argument('--phase', choices=['media', 'production-error', 'quality'], required=True)
args = parser.parse_args()
media = 'scripts/test-t02-final-validation-media.mts'
production = 'qa/t02-final-validation-20261014/production-error.test.mts'
flags = [args.node, '--experimental-test-module-mocks', '--experimental-vm-modules',
         '--require', './qa/t08/offline.cjs', '--import', 'tsx', '--test']
commands = {
    'media': [('media', [*flags, media])],
    'production-error': [('production-error', [*flags, production])],
    'quality': [
        ('lint', [args.node, 'node_modules/eslint/bin/eslint.js', media, production]),
        ('types', [args.node, 'node_modules/typescript/bin/tsc', '-p', str(OUT / 'tsconfig.json')]),
    ],
}
records = []
for name, command in commands[args.phase]:
    with (OUT / f'{name}.log').open('w') as output:
        result = subprocess.run(command, cwd=ROOT, env={'PATH': '/usr/bin:/bin:/usr/sbin:/sbin', 'LANG': 'C.UTF-8'},
                                stdout=output, stderr=subprocess.STDOUT, timeout=120)
    records.append({'command': command, 'exitCode': result.returncode, 'log': f'{name}.log'})
    print(f'{name}: exit={result.returncode}', flush=True)
paths = [media, production, 'src/lib/account-access.ts', 'src/lib/private-media.ts', 'src/lib/media-download.ts',
         'src/lib/pipeline-submit.ts', 'src/app/api/production/route.ts', 'package-lock.json']
manifest = {
    'utc': datetime.now(timezone.utc).isoformat(), 'phase': args.phase,
    'base': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
    'inheritedSecrets': False, 'realProviderCalls': 0, 'commands': records,
    'sourceHashes': [{'path': p, 'sha256': hashlib.sha256((ROOT / p).read_bytes()).hexdigest()} for p in paths],
}
(OUT / f'{args.phase}-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
raise SystemExit(1 if any(r['exitCode'] for r in records) else 0)
