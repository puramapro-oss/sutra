"""Two-session proof on the private restore; import is side-effect free."""
import argparse
import datetime
import json
from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def pause_before_ddl(guarded, *, locking=True):
    """Pause after row locks, before equality check and before the first DDL."""
    marker = ' ORDER BY p.oid FOR UPDATE OF p;'
    assert guarded.count(marker) == 1
    if not locking:
        # Exact same guard without catalog locking: discriminating negative control.
        guarded = guarded.replace(' FOR UPDATE OF p;', ';', 1)
        marker = ' ORDER BY p.oid;'
    return guarded.replace(marker, marker + '\nSELECT pg_sleep(5);', 1)


def build_source(module, backup, proof, migration):
    source = "__file__='/opt/purama/apps/sutra/checkpoint-transition.py'\n__name__='sutra_guard_test'\n" + module
    source += '\nBACKUP=' + repr(backup) + '\nPROOF=' + repr(proof) + '\nMIGRATION=' + repr(migration)
    # Use the same pause transformer locally and remotely.
    import inspect
    source += '\n' + inspect.getsource(pause_before_ddl)
    source += r'''
import time,copy
database=BACKUP['database']
assert re.fullmatch('sutra_restore_t01_[a-z0-9]+',database)
command=['docker','exec','-i','supabase-db','psql','-U','supabase_admin','-X','-A','-t','-q','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-d']
report={'status':'FAIL','productionChanged':False,'sessions':2}
def query(db,sql):
    result=subprocess.run(command+[db],input=sql,text=True,capture_output=True,timeout=45)
    if result.returncode: raise RuntimeError('SQL_OPERATION_FAILED')
    return result.stdout.strip()
def definitions(db): return json.loads(query(db,DEFINITIONS))
def sqlstates(result):return re.findall(r'(?:ERROR|FATAL):\s+([A-Z0-9]{5}):',result.stderr)
def session_at_pause(locking):
    sql=pause_before_ddl(guarded_sql(before,MIGRATION),locking=locking)
    process=subprocess.Popen(command+[database],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    process.stdin.write("SET application_name='sutra_checkpoint_guard_a';\n"+sql)
    process.stdin.close();process.stdin=None
    try:
        for _ in range(50):
            if query(database,"SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND application_name='sutra_checkpoint_guard_a' AND wait_event='PgSleep';")=='1':
                # DDL must not already have run: this proves the intended boundary.
                assert definitions(database)==before,'PAUSE_AFTER_DDL'
                return process
            time.sleep(.1)
        raise RuntimeError('LOCK_HOLDER_NOT_OBSERVED')
    except BaseException:
        process.communicate(timeout=30)
        raise
production=definitions('postgres')
before=definitions(database)
assert digest(before)==PROOF['beforeDefinitionsSha256']
rollback=(Path(PROOF['protectedRollback'])/'rollback.sql').read_text()
assert hashlib.sha256(rollback.encode()).hexdigest()==PROOF['rollbackSha256']
assert hashlib.sha256(MIGRATION.encode()).hexdigest()==PROOF['migrationSha256']
original=before[0]['definition']
assert original.count('AS $function$')==1
modified=original.replace('AS $function$','AS $function$\n-- SUTRA_GUARD_NEGATIVE_CONTROL\n',1)
controlled=copy.deepcopy(before);controlled[0]['definition']=modified
competing="BEGIN; SET LOCAL search_path TO sutra,pg_temp; SET LOCAL lock_timeout='500ms';\n"+modified+'; COMMIT;'
session=None
try:
    session=session_at_pause(True)
    result=subprocess.run(command+[database],input=competing,text=True,capture_output=True,timeout=20)
    assert result.returncode!=0 and '55P03' in sqlstates(result),'CONCURRENT_DDL_NOT_BLOCKED'
    session.communicate(timeout=20);assert session.returncode==0
    after=definitions(database);assert digest(after)==PROOF['afterDefinitionsSha256']
    report.update(concurrentDdlBlocked=True,sqlstate='55P03',guardedMigration=True,pauseBeforeFirstDdl=True)
    query(database,guarded_sql(after,rollback));assert definitions(database)==before
    # Without the row lock, competing DDL must succeed at the SAME pause.
    session=session_at_pause(False)
    result=subprocess.run(command+[database],input=competing,text=True,capture_output=True,timeout=20)
    assert result.returncode==0,'NEGATIVE_CONTROL_DDL_DID_NOT_COMMIT'
    observed=definitions(database)
    assert observed==controlled,'UNEXPECTED_CONTROL_DEFINITION'
    stdout,stderr=session.communicate(timeout=20)
    assert session.returncode!=0 and 'SUTRA_FUNCTION_DEFINITION_DRIFT' in stderr,'NO_LOCK_GUARD_MISSED_DRIFT'
    report.update(withoutLockDdlCommitted=True,withoutLockGuardRejected=True)
finally:
    if session is not None and session.poll() is None:
        session.communicate(timeout=30)
    observed=definitions(database)
    if digest(observed)==PROOF['afterDefinitionsSha256']:
        query(database,guarded_sql(observed,rollback))
    elif observed==controlled:
        query(database,guarded_sql(controlled,'BEGIN; SET LOCAL search_path TO sutra,pg_temp;\n'+original+'; COMMIT;'))
    # Unknown drift is never overwritten, even in the restored database.
    assert definitions(database)==before,'RESTORED_COPY_ROLLBACK_REQUIRED'
    assert definitions('postgres')==production,'PRODUCTION_DRIFT'
report.update(status='PASS',rollbackExact=True,productionUnchanged=True,
    limitation='Existing scoped function rows only; not a global schema or role lock.')
print(json.dumps(report))
'''
    return source


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--proof-dir', type=Path, default=HERE)
    args = parser.parse_args()
    proof_dir = args.proof_dir.resolve()
    assert proof_dir.parent == ROOT / 'qa' and proof_dir.is_dir()
    module = (HERE / 'checkpoint-transition.py').read_text()
    backup = json.loads((proof_dir / 'backup-restore.json').read_text())
    proof = json.loads((proof_dir / 'checkpoint-restore.json').read_text())
    migration = (ROOT / proof.get('migrationPath', 'migrations/20261015_final_durable_integrity.sql')).read_text()
    source = build_source(module, backup, proof, migration)
    try:
        result = subprocess.run(['ssh', '-i', str(Path.home() / '.ssh/purama_vps_ed25519'), '-o',
            'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
            'root@144.217.14.210', 'python3 -'], input=source, capture_output=True, text=True, timeout=180)
        receipt = json.loads(result.stdout)
        assert result.returncode == 0
    except BaseException:
        receipt = {'status': 'UNKNOWN', 'action': 'Inspect private restore state before retry.'}
    receipt.update(observedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        command='python3 qa/t01-consolidation-20261014/verify-checkpoint-concurrency.py --proof-dir ' + str(proof_dir))
    (proof_dir / 'checkpoint-concurrency.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt))
    raise SystemExit(0 if receipt['status'] == 'PASS' else 1)


if __name__ == '__main__':
    main()
