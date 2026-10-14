"""T08 bounded rechecks. Existing owner scenarios reused, no provider or env-file access."""
import json
import hashlib
import os
from pathlib import Path
import re
import subprocess
import sys
from datetime import datetime, timezone
ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
NODE = os.environ.get('T08_NODE', '/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node')
CONFIG = {key: os.environ[key] for key in ('PATH', 'HOME', 'TMPDIR', 'LANG') if key in os.environ}
CONFIG.update(NODE_OPTIONS='--require='+str(ROOT/'qa/t08/offline.cjs'), NODE_ENV='test', NEXT_TELEMETRY_DISABLED='1', LTX_TRACK_DB='0', OTS_NETWORK='0', NEXT_PUBLIC_SUPABASE_URL='https://sutra.fixture.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY='fixture-anon', SUPABASE_SERVICE_ROLE_KEY='fixture-service', ZERNIO_API_KEY='fixture-only')
FLAGS = [NODE, '--experimental-test-module-mocks', '--experimental-vm-modules', '--import', 'tsx', '--test', '--test-concurrency=1']
TESTS = {
 'production-error': ['qa/t08-closure-20261014/production-error.test.mts'],
 'journey': ['scripts/test-t08-integration-journey.mts'],
 'suno': ['scripts/test-t03-suno-recovery.mts'],
 'oauth': ['scripts/test-t06-social-routes.mts'],
 'oauth-races': ['scripts/test-t06-social-final.mts'],
 'storage-proof': ['scripts/test-t02-security-fixes-storage.mts', 'scripts/test-t02-security-fixes-proof.mts'],
 'ots': ['scripts/test-t02-security-fixes-ots.mts'],
}
for phase in sys.argv[1:] or TESTS:
 command = [*FLAGS, *TESTS[phase]]
 result = subprocess.run(command, cwd=ROOT, env=CONFIG, text=True, capture_output=True, timeout=120)
 output = result.stdout + result.stderr
 (OUT/(phase+'.log')).write_text(output)
 counts = {key:int(value) for key,value in re.findall(r'(?:#|ℹ) (tests|pass|fail|skipped) (\d+)', output)}
 record = {'phase':phase, 'candidate':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(), 'utc':datetime.now(timezone.utc).isoformat(), 'command':command, 'exitCode':result.returncode, 'counts':counts, 'testFilesSHA256':{path:hashlib.sha256((ROOT/path).read_bytes()).hexdigest() for path in TESTS[phase]}, 'journeyFixtureSHA256':hashlib.sha256((ROOT/'qa/t08-integration-journey-20261014/database.mts').read_bytes()).hexdigest(), 'environment':'allowlist; synthetic values; offline preload; env-file denied', 'log':phase+'.log'}
 (OUT/(phase+'.json')).write_text(json.dumps(record,indent=2)+'\n')
 print(phase, result.returncode, counts, flush=True)
 if result.returncode: sys.exit(result.returncode)
