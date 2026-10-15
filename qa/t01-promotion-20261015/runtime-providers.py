"""Reuse reviewed GET-only probes in the exact promoted container; no secret leaves it."""
import argparse
import json
from pathlib import Path
import re
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source-ref', required=True)
args = parser.parse_args()
assert re.fullmatch('[0-9a-f]{40}', args.source_ref)
deployment = json.loads((ROOT / 'qa/t01-final-20261015/deployment.json').read_text())
assert deployment['status'] == 'PASS' and deployment['source'] == args.source_ref
original = subprocess.check_output(['git', 'show', args.source_ref + ':qa/provider-activation-20261014/runtime-probe.mjs'], cwd=ROOT, text=True)
assert original.count('process.stdout.write(JSON.stringify(out))') == 1
source = "import {planReads,probe} from './qa/t04-provider-validation-20261014/probe.mjs';\n" + original.replace(
    'process.stdout.write(JSON.stringify(out))',
    "const sunoPlan=planReads(process.env).find(p=>p.provider==='suno');\n"
    "out.suno=sunoPlan?await probe(sunoPlan):{status:'BLOQUE',reason:'CONFIGURATION_ABSENT'};\n"
    "out.pass=out.pass && out.suno.status==='PASS';\n"
    "process.stdout.write(JSON.stringify(out));")
bundle_script = """
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
const result=await build({stdin:{contents:readFileSync(0,'utf8'),resolveDir:process.cwd(),sourcefile:'postdeploy-provider-probes.mjs'},bundle:true,write:false,
platform:'node',format:'esm',target:'node22',banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"}});
process.stdout.write(result.outputFiles[0].text);
"""
bundle = subprocess.run(['node', '--input-type=module', '-e', bundle_script], input=source, cwd=ROOT, capture_output=True, text=True, timeout=60)
assert bundle.returncode == 0, 'LOCAL_BUNDLE_FAILED'
remote = 'SHA=' + repr(args.source_ref) + '\nSOURCE=' + repr(bundle.stdout) + '\n' + r'''
import json,subprocess
try:
 live=json.loads(subprocess.check_output(['docker','inspect','purama-sutra']))[0]
 assert live['Config']['Labels']['dev.purama.commit']==SHA and live['State']['Health']['Status']=='healthy'
 p=subprocess.run(['docker','exec','-i','purama-sutra','node','--input-type=module'],input=SOURCE,capture_output=True,text=True,timeout=150)
 assert p.returncode==0
 receipt=json.loads(p.stdout)
 assert set(receipt).issubset({'observedAt','generationRequests','runpod','shotstack','zernio','localEngine','suno','pass'})
 receipt['source']=SHA
 print(json.dumps(receipt))
except Exception:
 print(json.dumps({'pass':False,'gate':'SAFE_PROVIDER_EXECUTION_FAILED'}))
'''
result = subprocess.run(['ssh', '-i', str(Path.home() / '.ssh/purama_vps_ed25519'),
    '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
    'root@144.217.14.210', 'python3', '-'], input=remote, capture_output=True, text=True, timeout=180)
try:
    assert result.returncode == 0
    receipt = json.loads(result.stdout)
except Exception:
    raise SystemExit('SAFE_PROVIDER_RESULT_UNAVAILABLE') from None
(HERE / 'provider-runtime.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt))
raise SystemExit(receipt.get('pass') is not True)
