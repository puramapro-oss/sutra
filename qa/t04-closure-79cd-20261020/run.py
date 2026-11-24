"""Offline, sanitized environment only; no master, no provider network."""
import json, os, pathlib, subprocess, sys, time
ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = pathlib.Path(__file__).resolve().parent
NODE = '/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node'
child = {k: os.environ[k] for k in ('PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot') if k in os.environ}
child.update(NODE_OPTIONS='--require=' + str(ROOT / 'qa/t08/offline.cjs'), CI='1', NEXT_TELEMETRY_DISABLED='1',
             NEXT_PUBLIC_SUPABASE_URL='https://database.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY='fixture-only',
             SUPABASE_SERVICE_ROLE_KEY='fixture-only', NEXT_PUBLIC_APP_SCHEMA='sutra', LTX_TRACK_DB='0',
             RUNPOD_API_KEY='fixture-only', RUNPOD_ENDPOINT_ID='fixture-only', SUNO_API_KEY='fixture-only',
             SUNO_API_BASE_URL='https://api.sunoapi.org/api/v1', ELEVENLABS_API_KEY='fixture-only')
label, *args = sys.argv[1:]
command = [NODE, *args]
start = time.monotonic()
result = subprocess.run(command, cwd=ROOT, env=child, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=240)
(OUT / (label + '.log')).write_text(result.stdout)
receipt = dict(command=command, base=subprocess.check_output(['git','rev-parse','HEAD'], cwd=ROOT, text=True).strip(),
               exitCode=result.returncode, seconds=round(time.monotonic()-start,2), network='denied except loopback', secrets='not loaded')
(OUT / (label + '.json')).write_text(json.dumps(receipt, indent=2)+'\n')
print(json.dumps(receipt))
print('\n'.join(result.stdout.splitlines()[-10:]))
sys.exit(result.returncode)
