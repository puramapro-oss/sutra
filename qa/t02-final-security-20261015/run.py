"""Targeted T02 proofs: clean synthetic environment, no env-file or remote reads."""
import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--phase', required=True, choices=['red', 'green', 'regression', 'quality'])
args = parser.parse_args()
node = '/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node'
test = 'scripts/test-t02-final-security-grants.mts'
flags = [node, '--experimental-test-module-mocks', '--experimental-vm-modules', '--require', './qa/t08/offline.cjs', '--import', 'tsx', '--test']
commands = {
    'red': [flags + [test]], 'green': [flags + [test]],
    'regression': [flags + ['scripts/test-private-media.mts', 'scripts/test-t02-security-fixes-session-media.mts', 'scripts/test-t02-final-validation-media.mts']],
    'quality': [[node, 'node_modules/eslint/bin/eslint.js', test, 'scripts/test-private-media.mts', 'src/lib/private-media.ts'], [node, 'node_modules/typescript/bin/tsc', '-p', str(OUT / 'tsconfig.json')]],
}
results = []
for i, command in enumerate(commands[args.phase]):
    log = OUT / f'{args.phase}-{i}.txt'
    with log.open('w') as output:
        result = subprocess.run(command, cwd=ROOT, env={'PATH': '/usr/bin:/bin:/usr/sbin:/sbin', 'LANG': 'C.UTF-8'}, stdout=output, stderr=subprocess.STDOUT, timeout=120)
    results.append({'command': command, 'exitCode': result.returncode, 'log': log.name})
    print(f'{args.phase}-{i}: exit={result.returncode}')
(OUT / f'{args.phase}.json').write_text(json.dumps(results, indent=2) + '\n')
raise SystemExit(1 if any(r['exitCode'] for r in results) else 0)
