"""Bounded delta checks; synthetic credentials, no inherited secrets, no remote I/O."""
import os
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[2]
output = Path(__file__).resolve().parent
node = '/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node'
environment = {k: os.environ[k] for k in ('PATH', 'HOME', 'TMPDIR', 'LANG') if k in os.environ}
environment.update({
    'NEXT_PUBLIC_SUPABASE_URL': 'https://database.invalid',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'synthetic-public-key', 'NEXT_PUBLIC_APP_SCHEMA': 'sutra',
    'RUNPOD_API_KEY': 'synthetic-runpod-key', 'RUNPOD_ENDPOINT_ID': 'endpoint-fixture',
    'ELEVENLABS_API_KEY': 'synthetic-voice-key', 'SUNO_API_KEY': 'synthetic-suno-key',
    'SUNO_API_BASE_URL': 'https://api.sunoapi.org/api/v1',
})
prefix = [node, '--require', './qa/t08/offline.cjs', '--experimental-test-module-mocks', '--import', 'tsx', '--test']
commands = {
    'contracts': prefix + ['qa/t04-providers-final-20261015/contracts.test.mts',
                          'qa/t04-providers-final-20261015/ltx-body.test.mts',
                          'qa/t04-final-providers-20261015/salad-read.test.mjs',
                          'qa/t04-salad-access-20261015/validate-access.test.mjs'],
    'regressions': prefix + ['--test-name-pattern=Pexels|ElevenLabs|voice|Voice|fallback',
                             'scripts/test-api-contracts.mts', 'scripts/test-provider-safety.mts',
                             'scripts/test-t04-provider-fixes.mts'],
    'ltx-regressions': prefix + ['scripts/test-ltx-v2-contracts.mts', 'scripts/test-ltx-v2-media.mts',
                                 'scripts/test-provider-safety.mts'],
    'typecheck': [node, 'node_modules/typescript/bin/tsc', '-p', 'qa/t04-providers-final-20261015/tsconfig.json'],
    'lint': [node, 'node_modules/eslint/bin/eslint.js', 'src/lib/pexels.ts', 'src/lib/elevenlabs.ts', 'src/lib/ltx-v2.ts',
             'qa/t04-providers-final-20261015/contracts.test.mts', 'qa/t04-final-providers-20261015/salad-read.mjs',
             'qa/t04-providers-final-20261015/ltx-body.test.mts',
             'qa/t04-providers-final-20261015/read-providers.mts',
             'qa/t04-providers-final-20261015/shotstack-owner-repro.mts',
             'qa/t04-salad-access-20261015/validate-access.mjs', 'scripts/test-api-contracts.mts'],
}
default_checks = list(commands)
# Owner reproduction is opt-in: its known FAIL is retained, never a skipped/green test.
commands['shotstack-owner-red'] = prefix + ['qa/t04-providers-final-20261015/shotstack-owner-repro.mts']
for name in sys.argv[1:] or default_checks:
    result = subprocess.run(commands[name], cwd=root, env=environment, capture_output=True, text=True, timeout=120)
    (output / f'{name}.txt').write_text(result.stdout + result.stderr)
    print(f'{name}: exit {result.returncode}')
    if result.returncode:
        print((result.stdout + result.stderr)[-6000:])
        sys.exit(result.returncode)
