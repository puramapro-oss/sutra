"""Build the current source with its committed local font and no remote access."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import time

root = Path.cwd()
output = root / 'qa/t05/providers-20261013'
assert not any(p.name != '.env.example' for p in root.glob('.env*'))
safe_env = {key: os.environ[key] for key in ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot'] if key in os.environ}
safe_env.update(NODE_OPTIONS=f'--require={root}/qa/t08/offline.cjs', CI='1', NEXT_TELEMETRY_DISABLED='1',
                OTS_NETWORK='0', LTX_TRACK_DB='0',
                NEXT_PUBLIC_SUPABASE_URL='https://sutra-test.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY='fixture-anon',
                NEXT_PUBLIC_APP_SCHEMA='sutra', SUPABASE_SERVICE_ROLE_KEY='fixture-service',
                STRIPE_SECRET_KEY='sk_test_isolated', RESEND_API_KEY='re_isolated')
command = [shutil.which('node'), 'node_modules/next/dist/bin/next', 'build', '--webpack']
start = time.time()
with (output / 'build.log').open('w') as log:
    result = subprocess.run(command, env=safe_env, stdout=log, stderr=subprocess.STDOUT, timeout=900)
report = {'status': 'PASS' if result.returncode == 0 else 'FAIL', 'exitCode': result.returncode,
          'command': command, 'durationSeconds': round(time.time() - start, 2),
          'remoteNetwork': 'DENIED', 'font': 'COMMITTED_LOCAL_TTF', 'credentials': 'FIXTURES_ONLY'}
(output / 'build.json').write_text(json.dumps(report, indent=2) + '\n')
print(report['status'], 'offline build', flush=True)
raise SystemExit(result.returncode)
