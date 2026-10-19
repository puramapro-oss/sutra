"""Retest immutable integrated candidate. Synthetic environment; no external I/O."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
EXPECTED = os.environ.get('SUTRA_EXPECTED_SHA', '')
ACTUAL = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
assert len(EXPECTED) == 40 and ACTUAL == EXPECTED, 'Explicit exact integrated SHA required'
assert subprocess.check_output(['git', 'diff', '--name-only', 'HEAD', '--', 'src', 'scripts', 'migrations', 'supabase', 'package.json', 'package-lock.json', 'next.config.ts'], cwd=ROOT, text=True).strip() == '', 'Product changes forbidden during integrated proof'
manifest = json.loads((ROOT / 'qa/t02-final-sha-security-20261015/tested-product-manifest.json').read_text())
for entry in manifest['productFiles'] + manifest['harnessFiles']:
    assert hashlib.sha256((ROOT / entry['path']).read_bytes()).hexdigest() == entry['sha256'], 'Integrated correction/harness mismatch: ' + entry['path']
NODE = os.environ.get('SUTRA_TEST_NODE', '/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node')
FIXTURE_ENV = {
    'PATH': '/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin', 'LANG': 'C.UTF-8',
    'CI': '1', 'NEXT_TELEMETRY_DISABLED': '1', 'OTS_NETWORK': '0', 'LTX_TRACK_DB': '0',
    'T02_SALAD_TARGET': str(ROOT), 'T03_SALAD_SOURCE': str(ROOT),
    'NEXT_PUBLIC_SUPABASE_URL': 'https://sutra-test.invalid',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'fixture-anon', 'NEXT_PUBLIC_APP_SCHEMA': 'sutra',
    'SUPABASE_SERVICE_ROLE_KEY': 'fixture-service', 'STRIPE_SECRET_KEY': 'sk_test_isolated',
    'RESEND_API_KEY': 're_isolated', 'ZERNIO_API_KEY': 'fixture-only',
    'SUTRA_TEST_PG_BIN': os.environ.get('SUTRA_TEST_PG_BIN', '/opt/homebrew/opt/postgresql@18/bin'),
    'NODE_OPTIONS': '--require=' + str(ROOT / 'qa/t08/offline.cjs'),
}
PRELOAD = ['--experimental-test-module-mocks', '--experimental-vm-modules', '--require', './qa/t08/offline.cjs', '--import', 'tsx', '--test', '--test-reporter=tap', '--test-concurrency=2']
RECEIPTS = ['--require', './qa/t02-final-sha-security-20261015/evidence-output.cjs']
GROUPS = {
    'production': PRELOAD + ['scripts/test-t02-rpc-security-production.mts'],
    'oauth': PRELOAD + ['scripts/test-t06-final-social.mts', 'scripts/test-t06-social-final.mts', 'scripts/test-t06-social-routes.mts', 'scripts/test-t02-oauth-boundaries.mts'],
    'publication': PRELOAD + ['scripts/test-t06-social-autonomy.mts', 'scripts/test-t06-social-validation.mts', 'scripts/test-social-publication.mts'],
    'history': RECEIPTS + ['qa/t06-integrated-retest-20261015/run-postgres.mjs'],
    'postgres-cas': RECEIPTS + ['qa/t06-integrated-retest-20261015/run-postgres.mjs', 'legacy-cas'],
    'social-history': RECEIPTS + ['scripts/test-final-social-history.mjs'],
    'boundaries': PRELOAD + ['scripts/test-security-account.mts', 'scripts/test-auth-session.mts', 'scripts/test-private-media.mts', 'scripts/test-t02-final-security-grants.mts', 'scripts/test-security-storage.mts'],
    'cron': PRELOAD + ['--test-name-pattern=^cron', 'scripts/test-release-regressions.mts'],
    'rls': ['scripts/test-security-rls.mjs'],
    'write-permissions': ['scripts/test-final-write-permissions.mjs'],
    'ssrf': PRELOAD + ['scripts/test-security-media.mts', 'scripts/test-t02-rpc-security-dependencies.mts', 'qa/t02-salad-security-20261014/test-t02-salad-security-contract.mts'],
    'typecheck': ['node_modules/typescript/bin/tsc', '-p', 'qa/t02-final-sha-security-20261015/tsconfig.json', '--noEmit', '--incremental', 'false'],
    'lint': ['node_modules/eslint/bin/eslint.js', 'src/app/api/admin/users/route.ts', 'src/app/api/admin/users/[id]/route.ts', 'src/app/api/admin/stats/route.ts', 'src/app/api/admin/health/route.ts', 'src/app/api/stripe/webhook/route.ts', 'qa/t02-final-sha-security-20261015/admin-webhook.test.mts', 'qa/t02-final-sha-security-20261015/evidence-output.cjs'],
}
GROUPS['create-control'] = PRELOAD + ['qa/t01-create-cancel-20261016/control.test.mts', 'qa/t01-create-cancel-20261016/client.test.mts', 'qa/t01-create-cancel-20261016/submission.test.mts']
GROUPS['delta'] = PRELOAD + ['scripts/test-t02-rpc-security-production.mts', 'qa/t01-closure-20261015/production-status.test.mts', 'qa/t01-closure-20261015/auto-config.test.mts']
GROUPS['admin-webhook'] = PRELOAD + ['qa/t02-final-sha-security-20261015/admin-webhook.test.mts']
GROUPS['routes'] = PRELOAD + ['scripts/test-security-routes.mts']
GROUPS['autopilot'] = PRELOAD + ['qa/t06-final-integration-20261015/autopilot.test.mts']
failed = False
for name in sys.argv[1:]:
    args = GROUPS[name]
    start = time.monotonic()
    result = subprocess.run([NODE, *args], cwd=ROOT, env=FIXTURE_ENV, capture_output=True, text=True, timeout=300)
    log = result.stdout + result.stderr
    (OUT / f'{name}.log').write_text(log)
    receipt = {'command': [NODE, *args], 'exitCode': result.returncode,
               'status': 'PASS' if result.returncode == 0 else 'FAIL',
               'durationSeconds': round(time.monotonic() - start, 2),
               'head': ACTUAL, 'testedTree': 'exact integrated candidate; no product WIP',
               'logSha256': hashlib.sha256(log.encode()).hexdigest()}
    for label in ['tests', 'pass', 'fail', 'skipped']:
        found = re.search(r'^# ' + label + r' (\d+)$', log, re.M)
        if found: receipt[label] = int(found[1])
    (OUT / f'{name}.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(f'{name}: {receipt["status"]} ({receipt["durationSeconds"]}s)', flush=True)
    failed = failed or result.returncode != 0
sys.exit(1 if failed else 0)
