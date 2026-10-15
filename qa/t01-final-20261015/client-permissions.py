"""Scoped SUTRA ACL transition; private-copy rehearsal precedes production.

Reuse the checkpoint transition state machine: only its state reader and SQL
guard differ. All transport output is captured; no rows or credentials leave
the VPS. An uncertain submission never triggers another SQL submission.
"""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import re
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
MIGRATION = 'migrations/20261015_client_write_permissions.sql'
ENGINE = 'qa/t01-consolidation-20261014/checkpoint-transition.py'
TABLES = ('contest_submissions', 'referral_commissions', 'referrals')
ROLES = ('PUBLIC', 'anon', 'authenticated', 'service_role')
POLICY = 't01_contest_submission_input'
STATE_SQL = """SELECT json_agg(t ORDER BY name) FROM (
 SELECT c.relname AS name,pg_get_userbyid(c.relowner) AS owner,
 c.relrowsecurity AS rls,c.relforcerowsecurity AS force_rls,
 (SELECT coalesce(json_agg(a ORDER BY col,grantee,grantor,privilege),'[]') FROM (
   SELECT '' AS col,CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END AS grantee,
    pg_get_userbyid(x.grantor) AS grantor,x.privilege_type AS privilege,x.is_grantable AS grantable
   FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) x
   UNION ALL
   SELECT a.attname,CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END,
    pg_get_userbyid(x.grantor),x.privilege_type,x.is_grantable
   FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) x
   WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
 ) a) AS grants,
 (SELECT json_agg(a.attname ORDER BY a.attnum) FROM pg_attribute a
   WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns,
 (SELECT coalesce(json_agg(p ORDER BY policyname),'[]') FROM (
   SELECT policyname,permissive,roles,cmd,qual,with_check FROM pg_policies
   WHERE schemaname='sutra' AND tablename=c.relname
 ) p) AS policies
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='sutra' AND c.relname IN ('contest_submissions','referral_commissions','referrals')
) t;"""


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def ident(value):
    return '"' + value.replace('"', '""') + '"'


def rollback_sql(state):
    assert tuple(t['name'] for t in state) == TABLES
    statements = ['BEGIN;']
    roles = ','.join('PUBLIC' if r == 'PUBLIC' else ident(r) for r in ROLES)
    for table in state:
        target = 'sutra.' + ident(table['name'])
        grants = [g for g in table['grants'] if g['grantee'] in ROLES]
        # Refuse grant chains: removing an inherited grant option could affect
        # an unowned downstream grant. None exists in the verified baseline.
        assert all(not g['grantable'] for g in grants), 'GRANT_CHAIN_REQUIRES_REVIEW'
        statements.append(f'REVOKE ALL ON TABLE {target} FROM {roles};')
        for col in table['columns']:
            statements.append(f'REVOKE ALL ({ident(col)}) ON {target} FROM {roles};')
        for grant in grants:
            assert grant['privilege'] in ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')
            role = 'PUBLIC' if grant['grantee'] == 'PUBLIC' else ident(grant['grantee'])
            column = ' (' + ident(grant['col']) + ')' if grant['col'] else ''
            statements.extend([f'SET LOCAL ROLE {ident(grant["grantor"])};',
                f'GRANT {grant["privilege"]}{column} ON TABLE {target} TO {role};', 'RESET ROLE;'])
        statements.append(f'ALTER TABLE {target} {"ENABLE" if table["rls"] else "DISABLE"} ROW LEVEL SECURITY;')
        statements.append(f'ALTER TABLE {target} {"FORCE" if table["force_rls"] else "NO FORCE"} ROW LEVEL SECURITY;')
    statements.append(f'DROP POLICY IF EXISTS {POLICY} ON sutra.contest_submissions;')
    for policy in state[0]['policies']:
        if policy['policyname'] != POLICY:
            continue
        assert policy['permissive'] in ('PERMISSIVE','RESTRICTIVE')
        assert policy['cmd'] in ('ALL','SELECT','INSERT','UPDATE','DELETE')
        roles = ','.join('PUBLIC' if r == 'public' else ident(r) for r in policy['roles'])
        statement = f'CREATE POLICY {POLICY} ON sutra.contest_submissions AS {policy["permissive"]} FOR {policy["cmd"]} TO {roles}'
        if policy['qual'] is not None: statement += ' USING (' + policy['qual'] + ')'
        if policy['with_check'] is not None: statement += ' WITH CHECK (' + policy['with_check'] + ')'
        statements.append(statement + ';')
    return '\n'.join(statements + ['COMMIT;', ''])


def guarded_sql(expected, sql):
    encoded = json.dumps(expected).replace("'", "''")
    guard = """BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='20s';
LOCK TABLE sutra.contest_submissions,sutra.referral_commissions,sutra.referrals IN ACCESS EXCLUSIVE MODE;
SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='sutra' AND c.relname IN ('contest_submissions','referral_commissions','referrals')
 ORDER BY c.oid FOR UPDATE OF c;
DO $permission_guard$ BEGIN
 IF (""" + STATE_SQL.rstrip(';') + ")::jsonb IS DISTINCT FROM '" + encoded + "'::jsonb THEN\n"
    guard += "RAISE EXCEPTION 'SUTRA_PERMISSION_STATE_DRIFT'; END IF; END $permission_guard$;\n"
    assert sql.startswith('BEGIN;') or '\nBEGIN;' in sql
    return sql.replace('BEGIN;', guard, 1)


def query(database, sql):
    result = subprocess.run(['docker','exec','-i','supabase-db','psql','-X','-qAt',
        '-U','supabase_admin','-d',database,'-v','ON_ERROR_STOP=1'],
        input=sql,capture_output=True,text=True,timeout=90)
    if result.returncode:
        raise RuntimeError('PERMISSION_SQL_UNCONFIRMED')
    return result.stdout.strip()


def state(database):
    return json.loads(query(database,STATE_SQL))


def data_digest(database):
    parts = [f"SELECT '{name}' AS name,count(*) AS rows,md5(coalesce(string_agg(md5(row_to_json(t)::text),'' ORDER BY md5(row_to_json(t)::text)),'')) AS digest FROM sutra.{name} t" for name in TABLES]
    return digest(json.loads(query(database,'SELECT json_agg(t ORDER BY name) FROM ('+' UNION ALL '.join(parts)+') t;')))


def verify_copy(backup, migration):
    import os
    os.umask(0o077)
    database = backup['database']
    assert re.fullmatch('sutra_restore_t01_[a-z0-9]+',database)
    folder = Path(backup['directory'])
    assert folder.parent == Path('/opt/purama/apps/sutra')
    for name,item in backup['artifacts'].items():
        assert '/' not in name and hashlib.sha256((folder/name).read_bytes()).hexdigest() == item['sha256']
    before = state(database)
    production = state('postgres')
    assert before == production, 'RESTORE_BASELINE_DRIFT'
    rollback = rollback_sql(before)
    migration_hash = hashlib.sha256(migration.encode()).hexdigest()
    protected = folder / ('permissions-' + migration_hash[:12])
    protected.mkdir(mode=0o700)
    for name,content in [('before.json',json.dumps(before)),('rollback.sql',rollback),('migration.sql',migration)]:
        with (protected/name).open('x') as stream: stream.write(content)
        assert (protected/name).stat().st_mode & 0o777 == 0o600
    rows = data_digest(database)
    query(database,guarded_sql(before,migration))
    after = state(database)
    assert digest(after) != digest(before)
    query(database,guarded_sql(after,migration))
    assert state(database) == after and data_digest(database) == rows
    # No finally compensation: a timeout may leave a SQL process running.
    # Only these confirmed commands permit the single rollback submission.
    query(database,guarded_sql(after,rollback))
    assert state(database) == before and data_digest(database) == rows
    assert state('postgres') == production
    return {'status':'PASS','productionChanged':False,'stateRestoredExactly':True,
        'dataUnchanged':True,'replaySafe':True,'tables':list(TABLES),
        'migrationSha256':migration_hash,'beforeStateSha256':digest(before),'afterStateSha256':digest(after),
        'protectedRollback':str(protected),'rollbackSha256':hashlib.sha256(rollback.encode()).hexdigest()}


def remote_apply(config, migration, engine_source):
    engine = {'__name__':'checkpoint_engine','__file__':'/opt/purama/apps/sutra/checkpoint-transition.py'}
    exec(engine_source, engine)
    class PermissionPort(engine['RemotePort']):
        def __init__(self, cfg):
            super().__init__(cfg)
            self.folder = Path('/opt/purama/apps/sutra') / ('permissions-transition-' + cfg['sha'])
        def definitions(self): return state('postgres')
        def execute_guarded(self, expected, sql): self.execute(guarded_sql(expected,sql))
        def rollback(self):
            protected = Path(self.proof['protectedRollback'])
            assert protected.parent == Path(config['backup']['directory'])
            assert protected.stat().st_mode & 0o777 == 0o700
            file = protected/'rollback.sql'
            assert file.stat().st_mode & 0o777 == 0o600
            return file.read_text()
    proof = dict(config['proof'])
    # Compatibility adapter for the already-tested generic one-shot/CAS engine.
    proof['beforeDefinitionsSha256'] = proof['beforeStateSha256']
    proof['afterDefinitionsSha256'] = proof['afterStateSha256']
    result = engine['transition'](PermissionPort({**config,'proof':proof}),config['mode'],proof,migration)
    result['stateVerified'] = result.pop('definitionsVerified',False)
    if result.get('previousDefinitionsVerified'):
        result['previousStateVerified'] = result.pop('previousDefinitionsVerified')
    result['stateSha256'] = digest(state('postgres'))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode',choices=['verify-copy','apply','rollback','inspect'])
    parser.add_argument('--source-ref')
    parser.add_argument('--ci-run')
    args = parser.parse_args()
    backup = json.loads((HERE/'backup-restore.json').read_text())
    module = Path(__file__).read_text()
    migration = (ROOT/MIGRATION).read_text()
    config = {'backup':backup,'mode':args.mode,'sha':args.source_ref}
    if args.mode in ('apply','rollback'):
        assert re.fullmatch('[a-f0-9]{40}',args.source_ref or '')
        assert re.fullmatch('[0-9]+',args.ci_run or '')
        for file in (MIGRATION,ENGINE,str(Path(__file__).relative_to(ROOT))):
            assert subprocess.check_output(['git','show',args.source_ref+':'+file],cwd=ROOT,text=True) == (ROOT/file).read_text()
        proof = json.loads((HERE/'client-permissions-restore.json').read_text())
        assert proof['status']=='PASS' and proof['stateRestoredExactly'] and proof['dataUnchanged'] and proof['replaySafe']
        assert proof['migrationSha256']==hashlib.sha256(migration.encode()).hexdigest()
        config['proof'] = proof
        if args.mode=='apply':
            ci=json.loads(subprocess.check_output(['gh','run','view',args.ci_run,'--json','headSha,status,conclusion,jobs'],cwd=ROOT))
            assert ci['headSha']==args.source_ref and ci['status']=='completed' and ci['conclusion']=='success'
            assert len(ci['jobs'])==3 and all(j['conclusion']=='success' for j in ci['jobs'])
            candidate=json.loads((HERE/'candidate.json').read_text())
            assert candidate['source']==args.source_ref and candidate['status']=='PASS' and candidate['network']=='none'
            age=datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(backup['observedAt'])
            assert datetime.timedelta(0)<=age<=datetime.timedelta(hours=4)
    source="__name__='permissions_remote'\n__file__='/opt/purama/apps/sutra/client-permissions.py'\n"+module
    source+='\nconfig='+repr(config)+'\nmigration='+repr(migration)+'\n'
    if args.mode=='verify-copy':
        source+="result=verify_copy(config['backup'],migration)\n"
    elif args.mode=='inspect':
        source+="result={'status':'PASS','stateSha256':digest(state('postgres')),'readOnly':True}\n"
    else:
        source+='result=remote_apply(config,migration,'+repr((ROOT/ENGINE).read_text())+')\n'
    source+="print(json.dumps(result))\n"
    try:
        r=subprocess.run(['ssh','-i',str(Path.home()/'.ssh/purama_vps_ed25519'),'-o','IdentitiesOnly=yes',
            '-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','root@144.217.14.210','python3 -'],
            input=source,capture_output=True,text=True,timeout=240)
        assert r.returncode==0
        receipt=json.loads(r.stdout)
    except BaseException:
        receipt={'status':'UNKNOWN','action':'Inspect protected state and process before any retry.'}
    receipt.update(source=args.source_ref,mode=args.mode,migrationSha256=hashlib.sha256(migration.encode()).hexdigest(),
        observedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
    name='restore' if args.mode=='verify-copy' else args.mode
    with (HERE/('client-permissions-'+name+'.json')).open('x') as stream:
        json.dump(receipt,stream,indent=2);stream.write('\n')
    print(json.dumps(receipt))
    raise SystemExit(0 if receipt['status']=='PASS' else 1)


if __name__=='__main__': main()
