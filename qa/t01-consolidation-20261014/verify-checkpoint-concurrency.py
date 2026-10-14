"""Execute the exact guard with two PostgreSQL sessions on the private restore."""
import datetime
import json
from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
module = (HERE / 'checkpoint-transition.py').read_text()
backup = json.loads((HERE / 'backup-restore.json').read_text())
proof = json.loads((HERE / 'checkpoint-restore.json').read_text())
migration = (ROOT / 'migrations/20261014_durable_checkpoint_integrity.sql').read_text()
source = "__file__='/opt/purama/apps/sutra/checkpoint-transition.py'\n__name__='sutra_guard_test'\n" + module
source += '\nBACKUP=' + repr(backup) + '\nPROOF=' + repr(proof) + '\nMIGRATION=' + repr(migration)
source += r'''
import time
database=BACKUP['database']
assert re.fullmatch('sutra_restore_t01_[a-z0-9]+',database)
command=['docker','exec','-i','supabase-db','psql','-U','supabase_admin','-X','-A','-t','-q','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-d']
report={'status':'FAIL','productionChanged':False,'sessions':2}
def query(db,sql):
    result=subprocess.run(command+[db],input=sql,text=True,capture_output=True,timeout=45)
    if result.returncode: raise RuntimeError('SQL_OPERATION_FAILED')
    return result.stdout.strip()
def definitions(db): return json.loads(query(db,DEFINITIONS))
production=definitions('postgres')
before=definitions(database)
assert digest(before)==PROOF['beforeDefinitionsSha256']
rollback=(Path(PROOF['protectedRollback'])/'rollback.sql').read_text()
assert hashlib.sha256(rollback.encode()).hexdigest()==PROOF['rollbackSha256']
assert hashlib.sha256(MIGRATION.encode()).hexdigest()==PROOF['migrationSha256']
session=None
try:
    guarded=guarded_sql(before,MIGRATION).replace('COMMIT;', 'SELECT pg_sleep(5); COMMIT;')
    session=subprocess.Popen(command+[database],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    session.stdin.write("SET application_name='sutra_checkpoint_guard_a';\n"+guarded)
    session.stdin.close();session.stdin=None
    sleeping=False
    for _ in range(50):
        if query(database,"SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND application_name='sutra_checkpoint_guard_a' AND wait_event='PgSleep';")=='1':
            sleeping=True;break
        time.sleep(.1)
    assert sleeping,'LOCK_HOLDER_NOT_OBSERVED'
    competing="BEGIN; SET LOCAL search_path TO sutra,pg_temp; SET LOCAL lock_timeout='500ms';\n"+before[0]['definition']+'; COMMIT;'
    result=subprocess.run(command+[database],input=competing,text=True,capture_output=True,timeout=20)
    states=re.findall(r'(?:ERROR|FATAL):\s+([A-Z0-9]{5}):',result.stderr)
    assert result.returncode!=0 and '55P03' in states,'CONCURRENT_DDL_NOT_BLOCKED'
    session.communicate(timeout=20);assert session.returncode==0
    after=definitions(database);assert digest(after)==PROOF['afterDefinitionsSha256']
    report.update(concurrentDdlBlocked=True,sqlstate='55P03',guardedMigration=True)
finally:
    if session is not None and session.poll() is None:
        session.communicate(timeout=30)
    observed=definitions(database)
    if digest(observed)==PROOF['afterDefinitionsSha256']:
        query(database,guarded_sql(observed,rollback))
    assert definitions(database)==before,'RESTORED_COPY_ROLLBACK_REQUIRED'
    assert definitions('postgres')==production,'PRODUCTION_DRIFT'
report.update(status='PASS',rollbackExact=True,productionUnchanged=True,
    limitation='Three existing function rows only; not a global schema or role lock.')
print(json.dumps(report))
'''
result = subprocess.run(['ssh', '-i', str(Path.home() / '.ssh/purama_vps_ed25519'), '-o',
    'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
    'root@144.217.14.210', 'python3 -'], input=source, capture_output=True, text=True, timeout=150)
try:
    receipt = json.loads(result.stdout)
    assert result.returncode == 0
except Exception:
    receipt = {'status': 'UNKNOWN', 'action': 'Inspect private restore state before retry.'}
receipt.update(observedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
    command='python3 qa/t01-consolidation-20261014/verify-checkpoint-concurrency.py')
(HERE / 'checkpoint-concurrency.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt))
raise SystemExit(0 if receipt['status'] == 'PASS' else 1)
