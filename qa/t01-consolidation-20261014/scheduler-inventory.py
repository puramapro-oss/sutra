"""Read-only SUTRA scheduler inventory. Remote raw configuration never leaves SSH."""
import datetime
import json
from pathlib import Path
import subprocess

SOURCE = r'''
import json,pathlib,subprocess
def run(args, **kwargs):
    return subprocess.run(args,capture_output=True,text=True,timeout=20,**kwargs)
x=json.loads(run(['docker','inspect','purama-sutra']).stdout)[0]
root=pathlib.Path('/opt/purama/apps/sutra')
units=run(['systemctl','list-unit-files','--no-legend','--no-pager']).stdout
unit_names=[line.split()[0] for line in units.splitlines() if 'sutra' in line.lower()]
cron_files=list(pathlib.Path('/etc/cron.d').glob('*'))+[pathlib.Path('/etc/crontab')]
cron_lines=[]
for p in cron_files:
    if p.is_file(): cron_lines.extend(p.read_text(errors='replace').splitlines())
cron_lines.extend(run(['crontab','-l']).stdout.splitlines())
cron_count=sum(1 for line in cron_lines if not line.lstrip().startswith('#') and 'sutra' in line.lower())
config={}
for line in (root/'runtime/.env').read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        k,v=line.split('=',1);config[k.strip()]=v.strip().strip('"').strip("'")
sql="""BEGIN READ ONLY;
SET LOCAL statement_timeout='5000ms';
SELECT json_build_object(
'queuedJobs',(SELECT count(*) FROM sutra.video_jobs WHERE status='queued'),
'processingJobs',(SELECT count(*) FROM sutra.video_jobs WHERE status='processing'),
'expiredLeases',(SELECT count(*) FROM sutra.video_jobs WHERE status='processing' AND lease_until<now()),
'uncertainJobs',(SELECT count(*) FROM sutra.video_jobs WHERE status='reconciliation_required'),
'activeAutoConfigurations',(SELECT count(*) FROM sutra.sutra_auto_config WHERE is_active),
'automaticPublicationEnabled',(SELECT count(*) FROM sutra.sutra_auto_config WHERE is_active AND auto_publish AND NOT require_approval_before_publish),
'sutraPgCronJobs',(SELECT count(*) FROM cron.job WHERE coalesce(jobname,'') ILIKE '%sutra%' OR command ILIKE '%sutra%'),
'invalidSutraIndexes',(SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='sutra' AND NOT i.indisvalid),
'affirmationsRead',has_table_privilege('authenticated','sutra.affirmations','SELECT'));
ROLLBACK;"""
r=run(['docker','exec','-i','supabase-db','psql','-X','-q','-A','-t','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],input=sql)
assert r.returncode==0,'READ_ONLY_SQL_FAILED'
database=json.loads(r.stdout)
names=['CRON_SECRET','RUNPOD_API_KEY','RUNPOD_ENDPOINT_ID','SHOTSTACK_API_KEY','SHOTSTACK_PRODUCTION_KEY','ZERNIO_API_KEY','ZERNIO_PROFILE_BINDINGS','NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SALAD_GATEWAY_URL','SALAD_GATEWAY_TOKEN']
print(json.dumps({'source':x['Config']['Labels']['dev.purama.commit'],'image':x['Image'],'health':x['State']['Health']['Status'],'restarts':x['RestartCount'],'systemdUnits':unit_names,'hostCronEntries':cron_count,'database':database,'variablesPresent':{k:bool(config.get(k)) for k in names},'saladEnabled':config.get('SALAD_ENABLED')=='true','configurationMode':oct((root/'runtime/.env').stat().st_mode&0o777),'readOnly':True,'providerCalls':0,'generationCalls':0,'publicationCalls':0}))
'''

r = subprocess.run(['ssh', '-i', str(Path.home()/'.ssh/purama_vps_ed25519'), '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', 'root@144.217.14.210', 'python3', '-'], input=SOURCE, capture_output=True, text=True, timeout=60)
try:
    assert r.returncode == 0
    result=json.loads(r.stdout)
    assert result['source']=='86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164'
except Exception:
    raise SystemExit('SAFE_SCHEDULER_INVENTORY_FAILED') from None
result['observedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
(Path(__file__).parent/'scheduler-inventory.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
