"""Bounded T02 checks: synthetic values, denied network/env-file access, no build."""
import argparse
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
PARSER = argparse.ArgumentParser()
PARSER.add_argument('--node', required=True)
PARSER.add_argument('--phase', choices=['red', 'green', 'session', 'quality', 'ots'], required=True)
ARGS = PARSER.parse_args()
CONFIG = {'PATH': '/usr/bin:/bin:/usr/sbin:/sbin', 'LANG': 'C.UTF-8'}
TESTS = ['scripts/test-t02-security-fixes-storage.mts', 'scripts/test-t02-security-fixes-proof.mts']
SESSION = 'scripts/test-t02-security-fixes-session-media.mts'
OTS = 'scripts/test-t02-security-fixes-ots.mts'
FLAGS = [ARGS.node, '--experimental-test-module-mocks', '--experimental-vm-modules',
         '--require', './qa/t08/offline.cjs', '--import', 'tsx', '--test']
COMMANDS = {
    'red': [('reproduction', [*FLAGS, *TESTS])],
    'green': [('targeted', [*FLAGS, *TESTS, 'scripts/test-security-storage.mts', 'scripts/test-private-media.mts'])],
    'session': [('session-media', [*FLAGS, SESSION])],
    'ots': [('ots', [*FLAGS, OTS, 'scripts/test-opentimestamps.mjs'])],
    'quality': [
        ('lint', [ARGS.node, 'node_modules/eslint/bin/eslint.js', *TESTS, SESSION, OTS, 'scripts/test-security-storage.mts',
                  'src/lib/storage.ts', 'src/lib/opentimestamps.ts', 'src/lib/ots-transport.ts', 'src/app/api/verify/[videoId]/route.ts']),
        ('types', [ARGS.node, 'node_modules/typescript/bin/tsc', '-p', 'qa/t02-security-fixes-20261014/tsconfig.json']),
    ],
}
records = []
for name, command in COMMANDS[ARGS.phase]:
    with (OUT / f'{name}.log').open('w') as stream:
        result = subprocess.run(command, cwd=ROOT, env=CONFIG, stdout=stream, stderr=subprocess.STDOUT, timeout=120)
    records.append({'command': command, 'exitCode': result.returncode, 'log': f'{name}.log'})
    print(f'{name}: exit={result.returncode}', flush=True)
paths = [*TESTS, SESSION, OTS, 'src/lib/ots-transport.ts', 'src/lib/opentimestamps.ts', 'src/lib/storage.ts', 'src/lib/private-media.ts', 'src/lib/account-access.ts',
         'src/app/api/media/[reference]/route.ts', 'src/app/api/verify/[videoId]/route.ts', 'package-lock.json']
manifest = {'utc': datetime.now(timezone.utc).isoformat(), 'phase': ARGS.phase,
            'base': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
            'inheritedSecrets': False, 'providerCalls': 0, 'commands': records,
            'sourceHashes': [{'path': path, 'sha256': hashlib.sha256((ROOT / path).read_bytes()).hexdigest()} for path in paths]}
(OUT / f'{ARGS.phase}-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
raise SystemExit(1 if any(record['exitCode'] != 0 for record in records) else 0)
