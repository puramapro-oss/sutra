"""Reuse GET-only provider probe inside SUTRA; never export runtime credentials."""
import json
from pathlib import Path
import subprocess

here = Path(__file__).resolve().parent
root = here.parents[1]
source = (root / 'qa/provider-activation-20261014/runtime-probe.mjs').read_text()
remote = "import subprocess,json\np=subprocess.run(['docker','exec','-i','purama-sutra','node','--input-type=module'],input=" + repr(source) + ",capture_output=True,text=True,timeout=120)\ntry:\n assert p.returncode==0\n r=json.loads(p.stdout);print(json.dumps(r))\nexcept Exception:\n print(json.dumps({'pass':False,'gate':'SAFE_PROVIDER_EXECUTION_FAILED'}))\n"
result = subprocess.run(['ssh', '-i', str(Path.home() / '.ssh/purama_vps_ed25519'),
    '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
    'root@144.217.14.210', 'python3', '-'], input=remote, capture_output=True, text=True, timeout=150)
try:
    assert result.returncode == 0
    receipt = json.loads(result.stdout)
    assert set(receipt).issubset({'observedAt', 'generationRequests', 'runpod', 'shotstack', 'zernio', 'localEngine', 'pass', 'gate'})
except Exception:
    raise SystemExit('SAFE_PROVIDER_RESULT_UNAVAILABLE') from None
receipt['source'] = '86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164'
(here / 'provider-runtime.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt))
raise SystemExit(receipt.get('pass') is not True)
