"""Targeted offline security gates; clean synthetic environment, no secrets."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
NODE = os.environ.get('SUTRA_TEST_NODE', '/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node')
FIXTURE_ENV = {
    'PATH': '/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin', 'LANG': 'C.UTF-8',
    'CI': '1', 'NEXT_TELEMETRY_DISABLED': '1', 'OTS_NETWORK': '0', 'LTX_TRACK_DB': '0',
    'T02_SALAD_TARGET': str(ROOT), 'T03_SALAD_SOURCE': str(ROOT),
    'NEXT_PUBLIC_SUPABASE_URL': 'https://sutra-test.invalid',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'fixture-anon', 'NEXT_PUBLIC_APP_SCHEMA': 'sutra',
    'SUPABASE_SERVICE_ROLE_KEY': 'fixture-service', 'STRIPE_SECRET_KEY': 'sk_test_isolated',
    'RESEND_API_KEY': 're_isolated',
}
PRELOAD = ['--experimental-test-module-mocks', '--experimental-vm-modules', '--require', './qa/t08/offline.cjs', '--import', 'tsx', '--test', '--test-concurrency=2']
GROUPS = {
    'production': PRELOAD + ['scripts/test-t02-rpc-security-production.mts'],
    'security': PRELOAD + [
        'scripts/test-security-account.mts', 'scripts/test-auth-session.mts',
        'scripts/test-security-routes.mts', 'scripts/test-security-storage.mts',
        'scripts/test-private-media.mts', 'scripts/test-t02-final-security-grants.mts',
        'scripts/test-t02-security-fixes-session-media.mts', 'scripts/test-t02-final-validation-media.mts',
        'scripts/test-security-media.mts', 'scripts/test-t02-security-fixes-storage.mts',
        'scripts/test-t02-security-fixes-proof.mts', 'scripts/test-t02-rpc-security-dependencies.mts',
        'scripts/test-release-oauth.mts', 'scripts/test-zernio-oauth-contracts.mts',
        'scripts/test-t02-oauth-boundaries.mts', 'scripts/test-t06-final-social.mts',
        'qa/t02-salad-security-20261014/test-t02-salad-security-contract.mts',
        'scripts/test-t02-rpc-security-production.mts',
        'qa/t02-final-validation-20261014/production-error.test.mts',
        'qa/t03-final-durable-20261015/cancel-ack.test.mts',
    ],
    'cron': PRELOAD + ['--test-name-pattern=^cron', 'scripts/test-release-regressions.mts'],
    'rls': ['scripts/test-security-rls.mjs'],
    'write-permissions': ['scripts/test-final-write-permissions.mjs'],
    'social-history': ['--require', './qa/t02-rpc-security-20261015/evidence-output.cjs', 'scripts/test-final-social-history.mjs'],
    'typecheck': ['node_modules/typescript/bin/tsc', '-p', 'qa/t02-rpc-security-20261015/tsconfig.json', '--noEmit', '--incremental', 'false'],
    'lint': ['node_modules/eslint/bin/eslint.js', 'src/app/api/production/route.ts', 'scripts/test-t02-rpc-security-production.mts', 'scripts/test-t02-rpc-security-dependencies.mts'],
}

failed = False
for name in sys.argv[1:]:
    args = GROUPS[name]
    start = time.monotonic()
    result = subprocess.run([NODE, *args], cwd=ROOT, env=FIXTURE_ENV, capture_output=True, text=True, timeout=300)
    (OUT / f'{name}.log').write_text(result.stdout + result.stderr)
    evidence = {'command': [NODE, *args], 'exitCode': result.returncode,
                'status': 'PASS' if result.returncode == 0 else 'FAIL',
                'durationSeconds': round(time.monotonic() - start, 2),
                'head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
                'routeSha256': hashlib.sha256((ROOT / 'src/app/api/production/route.ts').read_bytes()).hexdigest(),
                'lockSha256': hashlib.sha256((ROOT / 'package-lock.json').read_bytes()).hexdigest()}
    (OUT / f'{name}.json').write_text(json.dumps(evidence, indent=2) + '\n')
    print(f'{name}: {evidence["status"]} ({evidence["durationSeconds"]}s)', flush=True)
    failed = failed or result.returncode != 0
sys.exit(1 if failed else 0)
