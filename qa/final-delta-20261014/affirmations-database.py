"""Test the minimal permission migration on the existing isolated restore; no secrets output."""
import datetime
import json
from pathlib import Path
import subprocess

here = Path(__file__).resolve().parent
root = here.parents[1]
migration = (root / 'migrations/20261014_affirmations_read_permission.sql').read_text()
source = 'MIGRATION=' + repr(migration) + '\n' + r'''
import json,subprocess,uuid,re
gate='runtime_identity'
try:
    runtime=json.loads(subprocess.check_output(['docker','inspect','purama-sutra']))[0]
    configuration=dict(entry.split('=',1) for entry in runtime['Config']['Env'] if '=' in entry)
    bindings=json.loads(configuration['ZERNIO_PROFILE_BINDINGS'])
    assert len(bindings)==1
    uid=str(uuid.UUID(next(iter(bindings))))
    inner=MIGRATION.replace('BEGIN;\n','',1).rsplit('COMMIT;',1)[0]
    denied="""DO $$ BEGIN
      BEGIN PERFORM count(*) FROM sutra.affirmations;
        RAISE EXCEPTION 'EXPECTED_READ_DENIAL';
      EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    END $$;"""
    sql="BEGIN;\n\\echo STAGE_before\nSET LOCAL ROLE authenticated;\n"+denied+"\nRESET ROLE;\n\\echo STAGE_migration\n"+inner+inner
    sql+="\nSELECT has_table_privilege('authenticated','sutra.affirmations','SELECT');\n\\echo STAGE_active\nSET LOCAL request.jwt.claim.sub='"+uid+"';\nSET LOCAL ROLE authenticated;\n"
    sql+="""DO $$ BEGIN
      IF NOT sutra.account_is_active() OR (SELECT count(*) FROM sutra.affirmations)<>30
        THEN RAISE EXCEPTION 'ACTIVE_READ_FAILED'; END IF;
      IF has_table_privilege(current_user,'sutra.affirmations','INSERT')
        OR has_table_privilege(current_user,'sutra.affirmations','UPDATE')
        OR has_table_privilege(current_user,'sutra.affirmations','DELETE')
        THEN RAISE EXCEPTION 'WRITE_PERMISSION_UNEXPECTED'; END IF;
    END $$; RESET ROLE;
    \echo STAGE_revoked
    UPDATE sutra.profiles SET access_revoked_at=now() WHERE id=auth.uid();
    SET LOCAL ROLE authenticated;
    DO $$ BEGIN
      IF sutra.account_is_active() OR (SELECT count(*) FROM sutra.affirmations)<>0
        THEN RAISE EXCEPTION 'REVOKED_ACCOUNT_READ'; END IF;
    END $$;
    \echo STAGE_unknown
    SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000000';
    DO $$ BEGIN
      IF sutra.account_is_active() OR (SELECT count(*) FROM sutra.affirmations)<>0
        THEN RAISE EXCEPTION 'UNKNOWN_ACCOUNT_READ'; END IF;
    END $$; RESET ROLE;
    \echo STAGE_anon
    SET LOCAL ROLE anon;
    """+denied+"""
    \echo STAGE_rollback
    RESET ROLE; REVOKE SELECT ON sutra.affirmations FROM authenticated;
    DO $$ BEGIN
      IF has_table_privilege('authenticated','sutra.affirmations','SELECT')
        THEN RAISE EXCEPTION 'ROLLBACK_FAILED'; END IF;
    END $$;
    ROLLBACK;
    SELECT NOT has_table_privilege('authenticated','sutra.affirmations','SELECT');
    """
    gate='isolated_sql'
    result=subprocess.run(['docker','exec','-i','supabase-db','psql','-U','supabase_admin','-d','sutra_restore_t01_hkj3yfvq','-X','-A','-t','-q','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'],input=sql,capture_output=True,text=True,timeout=60)
    if result.returncode!=0 or result.stdout.strip().splitlines()[-1]!='t':
        codes=re.findall(r'ERROR:\s+([0-9A-Z]{5}):',result.stderr)
        print(json.dumps({'status':'FAIL','stage':gate,'sqlStates':codes,'flags':re.findall(r'(?m)^[tf]$',result.stdout),'contexts':re.findall(r'(?:PL/pgSQL|SQL) function ([A-Za-z_][A-Za-z_0-9.]*)',result.stderr),'lastStage':re.findall(r'STAGE_[a-z]+',result.stdout)[-1:],'permissionObjects':re.findall(r'permission denied for (?:schema|table|function|language) ([A-Za-z_][A-Za-z_0-9.]*)',result.stderr),'namedAssertion':[x for x in ['EXPECTED_READ_DENIAL','ACTIVE_READ_FAILED','WRITE_PERMISSION_UNEXPECTED','REVOKED_ACCOUNT_READ','UNKNOWN_ACCOUNT_READ','ROLLBACK_FAILED','SUTRA_AFFIRMATIONS_SCHEMA_REVIEW_REQUIRED','SUTRA_AFFIRMATIONS_GRANT_NOT_APPLIED'] if x in result.stderr]}))
        raise SystemExit(1)
    print(json.dumps({'status':'PASS','database':'isolated restored SUTRA copy','checks':['reproduced_authenticated_read_denied','migration_idempotent','active_account_reads_30_rows','writes_remain_denied','revoked_account_reads_zero','unknown_account_reads_zero','anonymous_read_denied','revoke_rollback_and_outer_transaction_restored'],'productionChanged':False}))
except Exception as error:
    print(json.dumps({'status':'FAIL','stage':gate,'errorType':type(error).__name__}))
    raise SystemExit(1)
'''
result = subprocess.run(['ssh', '-i', str(Path.home() / '.ssh/purama_vps_ed25519'), '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', 'root@144.217.14.210', 'python3 -'], input=source, capture_output=True, text=True, timeout=90)
try:
    receipt = json.loads(result.stdout)
except Exception:
    receipt = {'status': 'FAIL', 'details': 'Safe remote receipt unavailable'}
receipt['observedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
receipt['command'] = 'python3 qa/final-delta-20261014/affirmations-database.py'
(here / 'affirmations-database.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt))
raise SystemExit(0 if result.returncode == 0 and receipt['status'] == 'PASS' else 1)
