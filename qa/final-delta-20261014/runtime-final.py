"""Read-only final SUTRA metadata; raw runtime, SQL rows and logs never leave SSH."""
import datetime
import json
from pathlib import Path
import subprocess

here = Path(__file__).resolve().parent
sha = '86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164'
before = json.loads((here / 'ovh-preflight.json').read_text())
source = 'SHA=' + repr(sha) + '\nOTHERS=' + repr(before['otherContainers']) + '\n' + '''
import pathlib,subprocess,json,re
root=pathlib.Path('/opt/purama/apps/sutra')
x=json.loads(subprocess.check_output(['docker','inspect','purama-sutra']))[0]
assert x['Config']['Labels']['dev.purama.commit']==SHA
assert x['State']['Health']['Status']=='healthy' and x['RestartCount']==0
assert (root/'runtime/.env').read_bytes()==(root/('rollback-'+SHA)/'runtime.env').read_bytes()
assert (root/'runtime/.env').stat().st_mode&0o777==0o600
for before in OTHERS:
 current=json.loads(subprocess.check_output(['docker','inspect',before['name']]))[0]
 assert current['Id']==before['id'] and current['State']['StartedAt']==before['startedAt']
logs=subprocess.run(['docker','logs','--since',x['State']['StartedAt'],'purama-sutra'],capture_output=True,text=True)
errors=len(re.findall(r'(?im)(?:^|\\s)(?:error|fatal|panic)(?:[:\\s]|$)',logs.stdout+logs.stderr))
sql="""BEGIN READ ONLY;
SELECT json_build_object(
'schema',EXISTS(SELECT FROM pg_namespace WHERE nspname='sutra'),
'jobs',to_regclass('sutra.video_jobs') IS NOT NULL,
'saladJournalPresent',to_regclass('salad_worker.jobs') IS NOT NULL,
'invalidSutraIndexes',(SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='sutra' AND NOT i.indisvalid),
'databaseRecovery',pg_is_in_recovery(),
'activeTransactionsOver5Minutes',(SELECT count(*) FROM pg_stat_activity WHERE state='active' AND xact_start<now()-interval '5 minutes'));
ROLLBACK;"""
r=subprocess.run(['docker','exec','-i','supabase-db','psql','-U','postgres','-d','postgres','-X','-A','-t','-q','-v','ON_ERROR_STOP=1'],input=sql,capture_output=True,text=True)
assert r.returncode==0,'READ_ONLY_SQL_FAILED'
database=json.loads(r.stdout)
assert database['schema'] and database['jobs'] and database['invalidSutraIndexes']==0 and not database['databaseRecovery']
assert not database['saladJournalPresent'],'UNEXPECTED_SCHEMA_DRIFT'
print(json.dumps({'source':SHA,'status':'PASS' if errors==0 else 'FAIL','health':'healthy','restarts':0,'errorLines':errors,'database':database,'runtimeUnchanged':True,'otherContainersUnchanged':len(OTHERS),'productionDdl':False,'saladEnabled':False,'readOnly':True}))
'''
result = subprocess.run(['ssh', '-i', str(Path.home() / '.ssh/purama_vps_ed25519'), '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', 'root@144.217.14.210', 'python3', '-'], input=source, capture_output=True, text=True, timeout=120)
try:
    assert result.returncode == 0
    receipt = json.loads(result.stdout)
    assert set(receipt).issubset({'source', 'status', 'health', 'restarts', 'errorLines', 'database', 'runtimeUnchanged', 'otherContainersUnchanged', 'productionDdl', 'saladEnabled', 'readOnly'})
except Exception:
    raise SystemExit('SAFE_FINAL_RUNTIME_CHECK_FAILED') from None
receipt['observedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
(here / 'runtime-final.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt))
raise SystemExit(receipt['status'] != 'PASS')
