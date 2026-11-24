"""Only owned new tests and regressions affected by this delta; synthetic credentials."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
TARGET = 'scripts/test-t03-final-durable.mts'
FILES = ['src/lib/video-queue.ts', 'src/lib/pipeline-state.ts', 'src/lib/production-pipeline.ts', 'scripts/test-t03-orchestration-fixes.mts', TARGET]
NODE = os.environ.get('T03_TEST_NODE', 'node')
checks = {
    'cancel_ack': ['node', '--experimental-test-module-mocks', '--import', 'tsx', '--test', 'qa/t03-final-durable-20261015/cancel-ack.test.mts'],
    'cancellation': ['node', '--experimental-test-module-mocks', '--import', 'tsx', '--test', 'qa/t03-final-durable-20261015/cancellation.test.mts'],
    'salad_recovery': ['node', '--experimental-test-module-mocks', '--import', 'tsx', '--test', 'scripts/test-t03-salad-recovery.mts'],
    'new': ['node', '--experimental-test-module-mocks', '--import', 'tsx', '--test', TARGET],
    'affected': ['node', '--experimental-test-module-mocks', '--import', 'tsx', '--test', 'scripts/test-pipeline-interruptions.mts', 'scripts/test-t03-durable-reliability.mts', 'scripts/test-t03-orchestration-fixes.mts', 'scripts/test-production-queue.mts'],
    'cancel_regression': ['node', '--experimental-test-module-mocks', '--import', 'tsx', '--test', 'scripts/test-production-queue.mts'],
    'auto_export': ['node', '--experimental-test-module-mocks', '--import', 'tsx', '--test', 'scripts/test-auto-export-queue.mts'],
    'typecheck': ['node', 'node_modules/typescript/bin/tsc', '--project', str(HERE / 'tsconfig.json')],
    'lint': ['node', 'node_modules/eslint/bin/eslint.js', *FILES, str(HERE / 'postgres.test.mts'), str(HERE / 'postgres.mjs'), str(HERE / 'cancellation.test.mts'), str(HERE / 'cancel-ack.test.mts'), '--max-warnings', '0'],
}
PROOFS = FILES
config = {key: os.environ[key] for key in ('PATH', 'HOME', 'TMPDIR') if key in os.environ}
config.update({'NODE_ENV': 'test', 'NODE_OPTIONS': '--require=' + str(ROOT / 'qa/t03-salad-recovery-20261014/offline.cjs'),
    'NEXT_PUBLIC_SUPABASE_URL': 'https://db.fixture.invalid', 'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'fixture-anon',
    'SUPABASE_SERVICE_ROLE_KEY': 'fixture-service', 'LOCAL_ENGINE_ENABLED': 'true', 'LOCAL_ENGINE_MODE': 'auto',
    'LOCAL_VIDEO_API_URL': 'https://worker.fixture.invalid/generate', 'RUNPOD_API_KEY': 'fixture-unused',
    'RUNPOD_ENDPOINT_ID': 'fixture-unused', 'LTX_API_KEY': 'fixture-unused'})
selected = sys.argv[1:] or list(checks)
label = 'before' if selected[0] == 'before' else 'after'
if label == 'before': selected = selected[1:] or ['new']
failed = False
for name in selected:
    command = checks[name]
    result = subprocess.run(command, cwd=ROOT, env=config, capture_output=True, text=True, timeout=180)
    stem = label + '-' + name
    (HERE / (stem + '.log')).write_text(result.stdout + result.stderr)
    (HERE / (stem + '.json')).write_text(json.dumps({'command': command, 'exit_code': result.returncode,
        'source_head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'source_sha256': {path: hashlib.sha256((ROOT / path).read_bytes()).hexdigest() for path in PROOFS},
        'environment': 'synthetic fixtures only; secrets, sockets and media processes denied'}, indent=2) + '\n')
    print(stem, 'PASS' if result.returncode == 0 else 'FAIL', result.returncode)
    failed |= result.returncode != 0
raise SystemExit(int(failed))
