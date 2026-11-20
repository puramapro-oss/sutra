"""Exercise the checkpoint migration on the existing private OVH restore only."""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--proof-dir', type=Path, default=HERE)
args = parser.parse_args()
PROOF = args.proof_dir.resolve()
assert PROOF.is_relative_to(ROOT / 'qa')
assert not (PROOF / 'checkpoint-restore.json').exists(), 'Receipt already exists; inspect before retry.'
migration = (ROOT / 'migrations/20261015_final_durable_integrity.sql').read_text()
backup = json.loads((PROOF / 'backup-restore.json').read_text())
source = 'MIGRATION=' + repr(migration) + '\nBACKUP=' + repr(backup) + '\n' + r'''
import hashlib,json,os,pathlib,subprocess,re
os.umask(0o077)
stage='preconditions'
names=['finish_video_job','checkpoint_video_job_v2','claim_video_job_by_key','claim_video_jobs','persist_video_job_video','video_job_result_valid','cancel_video_job']
report={'status':'FAIL','productionChanged':False,'migrationSha256':hashlib.sha256(MIGRATION.encode()).hexdigest(),'migrationPath':'migrations/20261015_final_durable_integrity.sql'}
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
 WHERE n.nspname='sutra' AND p.proname IN ('finish_video_job','checkpoint_video_job_v2','claim_video_job_by_key','claim_video_jobs','persist_video_job_video','video_job_result_valid','cancel_video_job');"""
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
    assert len(before)==6 and before==production and not any(r['name']=='video_job_result_valid' for r in before)
    assert all(not row['securityDefiner'] and row['serviceExecute'] for row in before)
    rollback='BEGIN;\nSET LOCAL search_path TO sutra, pg_temp;\n'+''.join(row['definition']+';\n' for row in before)+'DROP FUNCTION sutra.video_job_result_valid(sutra.video_jobs);\nCOMMIT;\n'
    protected=folder/('checkpoint-'+report['migrationSha256'][:12]+'-v2'); protected.mkdir(mode=0o700,exist_ok=False)
    (protected/'before.json').write_text(json.dumps(before))
    (protected/'rollback.sql').write_text(rollback)
    (protected/'migration.sql').write_text(MIGRATION)
    assert all(p.stat().st_mode&0o777==0o600 for p in protected.iterdir())
    data_before=rows_digest(database)
    stage='restored_migration'
    query(database,MIGRATION); after=definitions(database)
    stage='restored_metadata'
    assert len(after)==7
    inherited=[row for row in after if row['name']!='video_job_result_valid']
    expected=metadata(before)
    for row in expected: row['config']=['search_path=sutra, pg_temp']
    assert metadata(inherited)==expected
    assert all(a['definition']!=b['definition'] for a,b in zip(inherited,before))
    helper=next(row for row in after if row['name']=='video_job_result_valid')
    assert not helper['securityDefiner'] and helper['serviceExecute']
    assert not helper['anonymousExecute'] and not helper['authenticatedExecute']
    assert helper['owner']=='supabase_admin' and helper['config']==['search_path=sutra, pg_temp']
    stage='restored_replay'
    query(database,MIGRATION); assert definitions(database)==after
    assert rows_digest(database)==data_before
    query(database,rollback)
    stage='restored_rollback'
    assert definitions(database)==before and rows_digest(database)==data_before
    assert definitions('postgres')==production
    report.update({'status':'PASS','database':'isolated restored SUTRA copy','protectedRollback':str(protected),
        'tablesDataUnchanged':len(data_before),'definitionsRestoredExactly':True,'replaySafe':True,'aclAndOwnershipUnchanged':True,
        'scope':'Six existing RPCs retain ACL and owner; search_path sutra, pg_temp. New invoker-only helper service-only, removed by rollback.',
        'permissions':metadata(before),'backupVerified':True,'rollbackSha256':hashlib.sha256(rollback.encode()).hexdigest(),
        'beforeDefinitionsSha256':hashlib.sha256(json.dumps(before,sort_keys=True).encode()).hexdigest(),
        'afterDefinitionsSha256':hashlib.sha256(json.dumps(after,sort_keys=True).encode()).hexdigest()})
except Exception as error:
    report.update({'failedStage':stage,'errorType':type(error).__name__})
print(json.dumps(report))
raise SystemExit(0 if report['status']=='PASS' else 1)
'''
try:
    result = subprocess.run(['ssh', '-i', str(Path.home() / '.ssh/purama_vps_ed25519'), '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', 'root@144.217.14.210', 'python3 -'], input=source, capture_output=True, text=True, timeout=180)
    receipt = json.loads(result.stdout)
    assert result.returncode == 0 or receipt['status'] != 'PASS'
except BaseException:
    receipt = {'status': 'UNKNOWN', 'details': 'Safe remote receipt unavailable; inspect before retry.'}
receipt['observedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
receipt['command'] = 'python3 qa/t01-consolidation-20261014/verify-checkpoint-restore.py --proof-dir ' + str(PROOF.relative_to(ROOT))
with (PROOF / 'checkpoint-restore.json').open('x') as stream:
    json.dump(receipt, stream, indent=2)
    stream.write('\n')
print(json.dumps(receipt))
raise SystemExit(0 if receipt['status'] == 'PASS' else 1)
