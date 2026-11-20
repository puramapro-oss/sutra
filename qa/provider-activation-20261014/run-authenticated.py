"""Bundle installed SDKs, execute inside SUTRA, export only an allowlisted receipt."""
import json
from pathlib import Path
import subprocess

here = Path(__file__).resolve().parent
bundle = subprocess.run(['node', '--input-type=module', '-e', """
import {build} from 'esbuild';
const result=await build({entryPoints:['qa/provider-activation-20261014/authenticated-smoke.mjs'],bundle:true,write:false,
platform:'node',format:'esm',target:'node22',banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"}});
process.stdout.write(result.outputFiles[0].text);
"""], cwd=here.parents[1], capture_output=True, text=True, timeout=60)
assert bundle.returncode == 0, 'LOCAL_BUNDLE_FAILED'
remote = "import subprocess,json\np=subprocess.run(['docker','exec','-i','purama-sutra','node','--input-type=module'],input=" + repr(bundle.stdout) + ",capture_output=True,text=True,timeout=180)\ntry:\n r=json.loads(p.stdout);print(json.dumps(r))\nexcept Exception:\n print(json.dumps({'pass':False,'gate':'SAFE_REMOTE_EXECUTION_FAILED','exit':p.returncode}))\n"
p = subprocess.run(['ssh', '-i', str(Path.home() / '.ssh/purama_vps_ed25519'), '-o', 'IdentitiesOnly=yes',
                    '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', 'root@144.217.14.210', 'python3', '-'],
                   input=remote, capture_output=True, text=True, timeout=220)
try:
    result = json.loads(p.stdout)
    assert set(result).issubset({'observedAt', 'checks', 'generationRequests', 'identityVerified', 'socialAccountCount',
                                 'pass', 'failedGate', 'testSessionRevoked', 'gate', 'exit'})
except Exception:
    raise SystemExit('SAFE_SSH_RESULT_UNAVAILABLE') from None
(here / 'authenticated-smoke.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
raise SystemExit(not result.get('pass', False))
