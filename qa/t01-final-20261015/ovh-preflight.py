"""Read-only SUTRA runtime inventory. Only an explicit non-secret receipt is emitted."""
import datetime
import json
from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent
REMOTE = r'''
import json,pathlib,shutil,subprocess
root=pathlib.Path('/opt/purama/apps/sutra')
x=json.loads(subprocess.check_output(['docker','inspect','purama-sutra']))[0]
assert x['Config']['Labels']['com.docker.compose.project.config_files']==str(root/'compose.yml')
p=root/'runtime/.env'
values={line.split('=',1)[0].strip():line.split('=',1)[1].strip().strip(chr(34)).strip(chr(39)) for line in p.read_text().splitlines() if '=' in line and not line.lstrip().startswith('#')}
names=['NEXT_PUBLIC_APP_URL','CRON_SECRET','RUNPOD_API_KEY','RUNPOD_ENDPOINT_ID','SHOTSTACK_API_KEY','SHOTSTACK_PRODUCTION_KEY','SUNO_API_KEY','SUNO_API_BASE_URL','ZERNIO_API_KEY','ZERNIO_PROFILE_BINDINGS','SUPABASE_SERVICE_ROLE_KEY','NEXT_PUBLIC_SUPABASE_URL','SALAD_GATEWAY_URL','SALAD_WORKER_TOKEN','SALAD_WORKER_DATABASE_URL']
ids=subprocess.check_output(['docker','ps','-q'],text=True).split()
others=[]
for ident in ids:
 y=json.loads(subprocess.check_output(['docker','inspect','--format','{{json .Name}}|{{json .Id}}|{{json .State.StartedAt}}',ident],text=True).split('|')[0])
 if y=='/purama-sutra':continue
 row=subprocess.check_output(['docker','inspect','--format','{{json .Name}}|{{json .Id}}|{{json .State.StartedAt}}',ident],text=True).strip().split('|')
 others.append(dict(zip(['name','id','startedAt'],map(json.loads,row))))
print(json.dumps({'source':x['Config']['Labels']['dev.purama.commit'],'imageId':x['Image'],'health':x['State']['Health']['Status'],'restarts':x['RestartCount'],'saladEnabled':values.get('SALAD_ENABLED','').lower() in ('true','1','yes'),'runtimeMode':oct(p.stat().st_mode&0o777),'freeBytes':shutil.disk_usage(root).free,'variablesPresent':{k:bool(values.get(k)) for k in names},'originSutra':values.get('NEXT_PUBLIC_APP_URL','').rstrip('/')=='https://sutra.purama.dev','otherContainers':others,'readOnly':True}))
'''
try:
    result = subprocess.run(['ssh', '-i', str(Path.home()/'.ssh/purama_vps_ed25519'),
        '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
        'root@144.217.14.210', 'python3', '-'], input=REMOTE, capture_output=True,
        text=True, timeout=90)
    assert result.returncode == 0
    receipt = json.loads(result.stdout)
    assert set(receipt) == {'source', 'imageId', 'health', 'restarts', 'saladEnabled',
        'runtimeMode', 'freeBytes', 'variablesPresent', 'originSutra', 'otherContainers', 'readOnly'}
    assert receipt['originSutra'] and receipt['runtimeMode'] == '0o600'
except BaseException:
    raise SystemExit('OVH_READONLY_PREFLIGHT_UNCONFIRMED') from None
receipt['observedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
with (HERE/'ovh-preflight.json').open('x') as output:
    json.dump(receipt, output, indent=2)
    output.write('\n')
print(json.dumps({k:receipt[k] for k in ['source','imageId','health','restarts','saladEnabled',
    'runtimeMode','freeBytes','originSutra','readOnly','observedAt']}))
