"""Targeted, offline verification. No inherited credential or env-file load."""
import os
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[2]
node = os.environ.get('T04_NODE', '/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node')
environment = {key: os.environ[key] for key in ('PATH', 'HOME', 'TMPDIR', 'LANG') if key in os.environ}
environment.update({'NEXT_PUBLIC_SUPABASE_URL': 'https://database.invalid',
                    'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'synthetic-public-key',
                    'NEXT_PUBLIC_APP_SCHEMA': 'sutra'})
scope = ['src/lib/salad', 'scripts/test-salad-worker.mts', 'scripts/test-salad-host.mts', 'scripts/test-local-engine-e2e.mts', 'src/lib/local-engine.ts',
         'src/lib/ltx.ts', 'src/lib/ltx-types.ts', 'src/lib/ltx-workflow.ts', 'src/lib/ltx-utils.ts', 'src/lib/fallbacks.ts',
         'src/app/api/video/capabilities/route.ts']
commands = {
    'contracts': [node, '--require', './qa/t08/offline.cjs', '--experimental-test-module-mocks',
                  '--import', 'tsx', '--test', 'scripts/test-salad-worker.mts', 'scripts/test-salad-host.mts'],
    'legacy-e2e': [node, '--require', './qa/t08/offline.cjs', '--import', 'tsx', '--test', 'scripts/test-local-engine-e2e.mts'],
    'routing-regression': [node, '--require', './qa/t08/offline.cjs', '--experimental-test-module-mocks', '--import', 'tsx', '--test', '--test-name-pattern=smart|visual|existing LTX|configured WAN|provenance|quality/cost', 'scripts/test-provider-safety.mts'],
    'typecheck': [node, 'node_modules/typescript/bin/tsc', '-p', 'qa/t04-salad-20261014/tsconfig.json'],
    'lint': [node, 'node_modules/eslint/bin/eslint.js', *scope],
}
for name in sys.argv[1:] or commands:
    command = commands[name]
    result = subprocess.run(command, cwd=root, env=environment, capture_output=True, text=True)
    (root / 'qa/t04-salad-20261014' / f'{name}.log').write_text(result.stdout + result.stderr)
    print(f'{name}: exit {result.returncode}')
    if result.returncode:
        print(result.stdout + result.stderr)
        sys.exit(result.returncode)
