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
scope = ['src/lib/salad', 'src/lib/runpod.ts', 'src/lib/elevenlabs.ts', 'src/lib/provider-response.ts', 'src/lib/suno.ts', 'scripts/test-t04-provider-fixes.mts', 'scripts/test-salad-host.mts', 'scripts/test-api-contracts.mts', 'scripts/test-provider-safety.mts', 'scripts/test-t04-pollinations.mts', 'src/lib/storyboard.ts', 'src/app/api/production/route.ts']
environment.update({'RUNPOD_API_KEY':'synthetic-runpod-key', 'RUNPOD_ENDPOINT_ID':'endpoint-fixture', 'ELEVENLABS_API_KEY':'synthetic-voice-key', 'SUNO_API_KEY':'synthetic-suno-key', 'SUNO_API_BASE_URL':'https://api.sunoapi.org/api/v1'})
commands = {
 'images': [node, '--require', './qa/t08/offline.cjs', '--experimental-test-module-mocks', '--import', 'tsx', '--test', 'scripts/test-t04-pollinations.mts'],
 'contracts': [node, '--require', './qa/t08/offline.cjs', '--experimental-test-module-mocks', '--import', 'tsx', '--test', 'scripts/test-t04-provider-fixes.mts'],
 'regressions': [node, '--require', './qa/t08/offline.cjs', '--experimental-test-module-mocks', '--import', 'tsx', '--test', 'scripts/test-salad-worker.mts', 'scripts/test-salad-host.mts'],
 'provider-regressions': [node, '--require', './qa/t08/offline.cjs', '--experimental-test-module-mocks', '--import', 'tsx', '--test', '--test-name-pattern=RunPod|runpod|WAN|voice|Voice|ElevenLabs|Suno|suno|music', 'scripts/test-provider-safety.mts', 'scripts/test-api-contracts.mts'],
 'typecheck': [node, 'node_modules/typescript/bin/tsc', '-p', 'qa/t04-provider-fixes-20261014/tsconfig.json'],
 'lint': [node, 'node_modules/eslint/bin/eslint.js', *scope],
}
for name in sys.argv[1:] or commands:
 command=commands[name]
 result=subprocess.run(command,cwd=root,env=environment,capture_output=True,text=True,timeout=120)
 (root / 'qa/t04-provider-fixes-20261014' / f'{name}.log').write_text(result.stdout+result.stderr)
 print(f'{name}: exit {result.returncode}')
 if result.returncode:
  print(result.stdout+result.stderr)
  sys.exit(result.returncode)
