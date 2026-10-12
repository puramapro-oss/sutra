"""Offline build replay using the real font bytes from the T01 build, read-only.
This is a local compilation check, not a deployment or Google Fonts availability check.
Usage: python3 docs/t05-final-evidence/build_with_local_fonts.py T01_WORKTREE NODE_BINARY
"""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

root = Path.cwd()
source = Path(sys.argv[1])
node = Path(sys.argv[2])
assert subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip() == '589732cb49959c1a576a3ba381b310cd594600ac'
output = root / 'test-results/ci/quality-local-fonts'
output.mkdir(parents=True, exist_ok=True)
static = source / '.next/static'
rules, inputs = [], {}
for stylesheet in sorted((static / 'css').glob('*.css')):
    for rule in re.findall(r'@font-face\{[^}]+\}', stylesheet.read_text()):
        if not rule.startswith('@font-face{font-family:Space Grotesk;'):
            continue
        inputs[str(stylesheet)] = hashlib.sha256(stylesheet.read_bytes()).hexdigest()
        asset = re.search(r'src:url\(/_next/static/(media/[^)]+)\)', rule)
        assert asset, 'Real font asset required'
        font = static / asset[1]
        data = font.read_bytes()
        assert data.startswith(b'wOF2')
        inputs[str(font)] = hashlib.sha256(data).hexdigest()
        local = output / font.name
        local.write_bytes(data)
        rule = rule.replace(f'/_next/static/{asset[1]}', str(local)).replace('src:url(', 'src: url(')
        rules.append(rule)
assert len(rules) == 15, 'Expected 5 weights and 3 subsets'
url = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap'
responses = output / 'font-responses.cjs'
responses.write_text('module.exports = ' + json.dumps({url: '\n'.join(rules)}) + '\n')
# No inherited credentials; deny all remote connections and .env reads.
env = {key: os.environ[key] for key in ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot'] if key in os.environ}
env.update(NODE_OPTIONS=f'--require={root}/qa/t08/offline.cjs', CI='1', NEXT_TELEMETRY_DISABLED='1',
           OTS_NETWORK='0', LTX_TRACK_DB='0', NEXT_FONT_GOOGLE_MOCKED_RESPONSES=str(responses),
           NEXT_PUBLIC_SUPABASE_URL='https://sutra-test.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY='fixture-anon',
           NEXT_PUBLIC_APP_SCHEMA='sutra', SUPABASE_SERVICE_ROLE_KEY='fixture-service',
           STRIPE_SECRET_KEY='sk_test_isolated', RESEND_API_KEY='re_isolated')
command = [str(node), 'node_modules/next/dist/bin/next', 'build', '--webpack']
start = time.time()
with (output / 'build.log').open('w') as log:
    result = subprocess.run(command, env=env, stdout=log, stderr=subprocess.STDOUT, timeout=900)
report = {'status': 'PASS' if result.returncode == 0 else 'FAIL', 'exitCode': result.returncode,
          'command': command, 'durationSeconds': round(time.time() - start, 2),
          'fontInputsSha256': inputs, 'remoteNetwork': 'DENIED', 'fontLoader': 'LOCAL_RESPONSE_FIXTURE_REAL_WOFF2_BYTES'}
(output / 'results.json').write_text(json.dumps(report, indent=2) + '\n')
print(report['status'], 'build with local font bytes', flush=True)
sys.exit(result.returncode)
