"""Exercise the checkpoint migration on the existing private OVH restore only."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
migration = (ROOT / 'migrations/20261014_durable_checkpoint_integrity.sql').read_text()
backup = json.loads((HERE / 'backup-restore.json').read_text())
source = 'MIGRATION=' + repr(migration) + '\nBACKUP=' + repr(backup) + '\n' + r'''
import hashlib,json,os,pathlib,subprocess,re
os.umask(0o077)
stage='preconditions'
names=['finish_video_job','checkpoint_video_job_v2','claim_video_job_by_key']
report={'status':'FAIL','productionChanged':False,'migrationSha256':hashlib.sha256(MIGRATION.encode()).hexdigest()}
def query(database,sql):
    result=subprocess.run(['docker','exec','-i','supabase-db','psql','-U','supabase_admin','-d',database,'-X','-A','-t','-q','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'],input=sql,text=True,capture_output=True,timeout=60)
    if result.returncode:
        report['sqlstates']=re.findall(r'(?:ERROR|FATAL):\s+([A-Z0-9]{5}):',result.stderr)
        raise RuntimeError('SQL_OPERATION_FAILED')
    return result.stdout.strip()
definition_query="""SELECT json_agg(json_build_object(
 'name',p.proname,'signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),
 'owner',pg_get_userbyid(p.proowner),'acl',p.proacl,'config',p.proconfig,'securityDefiner',p.prosecdef,
 'anonymousExecute',has_function_privilege('anon',p.oid,'EXECUTE'),
 'authenticatedExecute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
 'serviceExecute',has_function_privilege('service_role',p.oid,'EXECUTE')) ORDER BY p.proname)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='sutra' AND p.proname IN ('finish_video_job','checkpoint_video_job_v2','claim_video_job_by_key');"""
def definitions(database): return json.loads(query(database,definition_query))
def metadata(rows): return [{k:v for k,v in row.items() if k!='definition'} for row in rows]
def rows_digest(database):
    tables=json.loads(query(database,"SELECT json_agg(tablename ORDER BY tablename) FROM pg_tables WHERE schemaname='sutra'"))
    assert all(re.fullmatch('[a-zA-Z_][a-zA-Z_0-9]*',table) for table in tables)
    parts=["SELECT '"+table+"' AS name,count(*)::text AS rows,md5(coalesce(string_agg(md5(row_to_json(t)::text),'' ORDER BY md5(row_to_json(t)::text)),'')) AS digest FROM sutra.\""+table+"\" t" for table in tables]
    return json.loads(query(database,'SELECT json_agg(r ORDER BY name) FROM ('+' UNION ALL '.join(parts)+') r;'))
try:
    runtime=json.loads(subprocess.check_output(['docker','inspect','purama-sutra']))[0]
    assert runtime['Config']['Labels']['dev.purama.commit']=='86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164'
    assert runtime['State']['Health']['Status']=='healthy'
    database=BACKUP['database']; assert re.fullmatch('sutra_restore_t01_[a-z0-9]+',database)
    folder=pathlib.Path(BACKUP['directory'])
    assert folder.parent==pathlib.Path('/opt/purama/apps/sutra')
    for name,item in BACKUP['artifacts'].items():
        assert hashlib.sha256((folder/name).read_bytes()).hexdigest()==item['sha256']
    before=definitions(database); production=definitions('postgres')
    assert len(before)==3 and before==production
    assert all(not row['securityDefiner'] and row['serviceExecute'] for row in before)
    rollback='BEGIN;\nSET LOCAL search_path TO sutra, pg_temp;\n'+''.join(row['definition']+';\n' for row in before)+'COMMIT;\n'
    protected=folder/('checkpoint-'+report['migrationSha256'][:12]+'-v2'); protected.mkdir(mode=0o700,exist_ok=False)
    (protected/'before.json').write_text(json.dumps(before))
    (protected/'rollback.sql').write_text(rollback)
    (protected/'migration.sql').write_text(MIGRATION)
    assert all(p.stat().st_mode&0o777==0o600 for p in protected.iterdir())
    data_before=rows_digest(database)
    stage='restored_migration'
    try:
        query(database,MIGRATION); after=definitions(database)
        stage='restored_metadata'
        expected=metadata(before)
        for row in expected:
            if row['name']=='claim_video_job_by_key': row['config']=['search_path=sutra, pg_temp']
        assert metadata(after)==expected
        assert all(a['definition']!=b['definition'] for a,b in zip(after,before))
        stage='restored_replay'
        query(database,MIGRATION); assert definitions(database)==after
        assert rows_digest(database)==data_before
    finally:
        query(database,rollback)
    stage='restored_rollback'
    assert definitions(database)==before and rows_digest(database)==data_before
    assert definitions('postgres')==production
    report.update({'status':'PASS','database':'isolated restored SUTRA copy','protectedRollback':str(protected),
        'tablesDataUnchanged':len(data_before),'definitionsRestoredExactly':True,'replaySafe':True,'aclAndOwnershipUnchanged':True,
        'onlyConfigChange':'claim_video_job_by_key search_path hardened to sutra, pg_temp',
        'permissions':metadata(before),'backupVerified':True,'rollbackSha256':hashlib.sha256(rollback.encode()).hexdigest(),
        'beforeDefinitionsSha256':hashlib.sha256(json.dumps(before,sort_keys=True).encode()).hexdigest(),
        'afterDefinitionsSha256':hashlib.sha256(json.dumps(after,sort_keys=True).encode()).hexdigest()})
except Exception as error:
    report.update({'failedStage':stage,'errorType':type(error).__name__})
print(json.dumps(report))
raise SystemExit(0 if report['status']=='PASS' else 1)
'''
result = subprocess.run(['ssh', '-i', str(Path.home() / '.ssh/purama_vps_ed25519'), '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', 'root@144.217.14.210', 'python3 -'], input=source, capture_output=True, text=True, timeout=180)
try:
    receipt = json.loads(result.stdout)
except Exception:
    receipt = {'status': 'UNKNOWN', 'details': 'Safe remote receipt unavailable; inspect before retry.'}
receipt['observedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
receipt['command'] = 'python3 qa/t01-consolidation-20261014/verify-checkpoint-restore.py'
previous = HERE / 'checkpoint-restore.json'
if previous.exists() and not (HERE / 'checkpoint-restore-before.json').exists():
    (HERE / 'checkpoint-restore-before.json').write_bytes(previous.read_bytes())
previous.write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt))
raise SystemExit(0 if result.returncode == 0 and receipt['status'] == 'PASS' else 1)
