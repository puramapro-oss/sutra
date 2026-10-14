"""Authorized T01-only minimal grant, guarded by a tested commit and protected rollback."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

here = Path(__file__).resolve().parent
root = here.parents[1]
commit = subprocess.check_output(['git', 'rev-parse', '6800a8d^{commit}'], cwd=root, text=True).strip()
migration = subprocess.check_output(['git', 'show', commit + ':migrations/20261014_affirmations_read_permission.sql'], cwd=root, text=True)
assert migration == (root / 'migrations/20261014_affirmations_read_permission.sql').read_text()
assert json.loads((here / 'affirmations-database.json').read_text())['status'] == 'PASS'
source = 'COMMIT=' + repr(commit) + '\nMIGRATION=' + repr(migration) + '\n' + r'''
import hashlib,json,os,pathlib,subprocess
os.umask(0o077)
stage='preconditions'; applied=False
report={'status':'FAIL','codeSource':'86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164','migrationCommit':COMMIT,'migrationSha256':hashlib.sha256(MIGRATION.encode()).hexdigest()}
command=['docker','exec','-i','supabase-db','psql','-U','supabase_admin','-d','postgres','-X','-A','-t','-q','-v','ON_ERROR_STOP=1']
query="""BEGIN READ ONLY; SELECT json_build_object(
'authenticatedSelect',has_table_privilege('authenticated','sutra.affirmations','SELECT'),
'anonymousSelect',has_table_privilege('anon','sutra.affirmations','SELECT'),
'authenticatedWrite',has_table_privilege('authenticated','sutra.affirmations','INSERT,UPDATE,DELETE'),
'rls',(SELECT relrowsecurity FROM pg_class WHERE oid='sutra.affirmations'::regclass),
'rows',(SELECT count(*) FROM sutra.affirmations),
'dataHash',(SELECT md5(string_agg(row_to_json(a)::text,'' ORDER BY id)) FROM sutra.affirmations a),
'policies',(SELECT json_agg(p ORDER BY policyname) FROM pg_policies p WHERE schemaname='sutra' AND tablename='affirmations'));
ROLLBACK;"""
try:
    runtime=json.loads(subprocess.check_output(['docker','inspect','purama-sutra']))[0]
    assert runtime['Config']['Labels']['dev.purama.commit']==report['codeSource']
    assert runtime['State']['Health']['Status']=='healthy'
    raw=subprocess.run(command,input=query,text=True,capture_output=True,timeout=30)
    assert raw.returncode==0
    before=json.loads(raw.stdout)
    assert before['authenticatedSelect'] is False and before['anonymousSelect'] is False
    assert before['authenticatedWrite'] is False and before['rls'] is True and before['rows']==30
    folder=pathlib.Path('/opt/purama/apps/sutra')/('backup-affirmations-'+COMMIT[:12])
    folder.mkdir(mode=0o700,exist_ok=False)
    stage='backup'
    dump=subprocess.run(['docker','exec','supabase-db','pg_dump','-U','supabase_admin','-d','postgres','--format=custom','--table=sutra.affirmations'],capture_output=True,timeout=60)
    assert dump.returncode==0 and len(dump.stdout)>100
    (folder/'affirmations.dump').write_bytes(dump.stdout)
    check=subprocess.run(['docker','exec','-i','supabase-db','pg_restore','--list'],input=dump.stdout,capture_output=True,timeout=30)
    assert check.returncode==0 and b' sutra affirmations ' in check.stdout
    (folder/'before.json').write_text(json.dumps(before))
    rollback='BEGIN; REVOKE SELECT ON sutra.affirmations FROM authenticated; COMMIT;\n'
    (folder/'rollback.sql').write_text(rollback)
    (folder/'migration.sql').write_text(MIGRATION)
    assert all(p.stat().st_mode&0o777==0o600 for p in folder.iterdir())
    report.update({'backup':str(folder),'backupSha256':hashlib.sha256(dump.stdout).hexdigest(),'backupArchiveReadable':True,'permissions':'0700/0600','rollbackTestedOnRestore':True})
    stage='apply'
    # Mark uncertainty before submission so any returned failure triggers the scoped revoke.
    applied=True
    result=subprocess.run(command,input=MIGRATION,text=True,capture_output=True,timeout=30)
    assert result.returncode==0
    stage='postconditions'
    raw=subprocess.run(command,input=query,text=True,capture_output=True,timeout=30)
    assert raw.returncode==0
    after=json.loads(raw.stdout)
    assert after.pop('authenticatedSelect') is True
    before.pop('authenticatedSelect')
    assert after==before
    report.update({'status':'PASS','rowsUnchanged':True,'policiesUnchanged':True,'anonymousAndWritesUnchanged':True,'authenticatedSelect':True,'dataChanged':False,'rollbackTriggered':False,'otherApplicationsChanged':False})
except Exception as error:
    report.update({'failedStage':stage,'errorType':type(error).__name__})
    if applied:
        rollback_result=subprocess.run(command,input='BEGIN; REVOKE SELECT ON sutra.affirmations FROM authenticated; COMMIT;',text=True,capture_output=True,timeout=30)
        report['rollbackTriggered']=True
        report['rollbackCommandSuccess']=rollback_result.returncode==0
print(json.dumps(report))
raise SystemExit(0 if report['status']=='PASS' else 1)
'''
result = subprocess.run(['ssh', '-i', str(Path.home() / '.ssh/purama_vps_ed25519'), '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', 'root@144.217.14.210', 'python3 -'], input=source, capture_output=True, text=True, timeout=150)
try:
    report = json.loads(result.stdout)
except Exception:
    report = {'status': 'UNKNOWN', 'action': 'Read remote grant and protected backup before any retry; never rerun blindly.'}
report['observedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
(here / 'affirmations-applied.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
raise SystemExit(0 if result.returncode == 0 and report['status'] == 'PASS' else 1)
