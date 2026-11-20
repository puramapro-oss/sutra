"""SUTRA authorization history transition, using the existing one-shot engine.

Importing this module is inert. T01 alone may invoke its CLI after authorization.
No credentials or rows are returned; ambiguous SQL outcomes require inspection.
"""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
MIGRATION = 'migrations/20261015_social_authorization_history.sql'
ENGINE = 'qa/t01-consolidation-20261014/checkpoint-transition.py'
METADATA = 'qa/t01-final-20261015/social-history-metadata.sql'
ROLLBACK = 'qa/t01-final-20261015/social-history-rollback.sql'
STATE_SQL = "-- Read-only stable metadata attestation; no account or event data is queried.\nSELECT jsonb_build_object(\n  'table', (SELECT jsonb_build_object('name',n.nspname||'.'||c.relname,\n    'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,\n    'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text)\n    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace\n    WHERE c.oid=to_regclass('sutra.social_authorization_history')),\n  'columns', COALESCE((SELECT jsonb_agg(jsonb_build_object('position',a.attnum,\n    'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,\n    'identity',a.attidentity,'generated',a.attgenerated,'acl',a.attacl::text,\n    'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)\n    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum\n    WHERE a.attrelid=to_regclass('sutra.social_authorization_history')\n      AND a.attnum>0 AND NOT a.attisdropped),'[]'::jsonb),\n  'constraints', COALESCE((SELECT jsonb_agg(jsonb_build_object('name',c.conname,\n    'type',c.contype,'validated',c.convalidated,'deferrable',c.condeferrable,\n    'initially_deferred',c.condeferred,'definition',pg_get_constraintdef(c.oid)) ORDER BY c.conname)\n    FROM pg_constraint c WHERE c.conrelid=to_regclass('sutra.social_authorization_history')),'[]'::jsonb),\n  'indexes', COALESCE((SELECT jsonb_agg(jsonb_build_object('name',c.relname,\n    'valid',i.indisvalid,'ready',i.indisready,'unique',i.indisunique,\n    'definition',pg_get_indexdef(i.indexrelid)) ORDER BY c.relname)\n    FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid\n    WHERE i.indrelid=to_regclass('sutra.social_authorization_history')),'[]'::jsonb),\n  'policies', COALESCE((SELECT jsonb_agg(jsonb_build_object('name',policyname,\n    'permissive',permissive,'roles',roles,'command',cmd,'using',qual,'check',with_check) ORDER BY policyname)\n    FROM pg_policies WHERE schemaname='sutra' AND tablename='social_authorization_history'),'[]'::jsonb),\n  'triggers', COALESCE((SELECT jsonb_agg(jsonb_build_object('table',t.tgrelid::regclass::text,\n    'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) ORDER BY t.tgname)\n    FROM pg_trigger t WHERE NOT t.tgisinternal AND t.tgname IN\n      ('sutra_capture_social_authorization_history','sutra_social_history_immutable')\n      AND t.tgrelid IN (to_regclass('public.social_accounts'),to_regclass('sutra.social_authorization_history'))),'[]'::jsonb),\n  'functions', COALESCE((SELECT jsonb_agg(jsonb_build_object('name',p.proname,\n    'owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,'config',p.proconfig,\n    'acl',p.proacl::text,'definition',pg_get_functiondef(p.oid)) ORDER BY p.proname)\n    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sutra'\n      AND p.proname IN ('capture_social_authorization_history','reject_social_history_mutation')\n      AND p.pronargs=0),'[]'::jsonb),\n  'role_privileges', (SELECT jsonb_agg(jsonb_build_object('role',role_name,\n    'select',has_table_privilege(role_name,to_regclass('sutra.social_authorization_history'),'SELECT'),\n    'insert',has_table_privilege(role_name,to_regclass('sutra.social_authorization_history'),'INSERT'),\n    'update',has_table_privilege(role_name,to_regclass('sutra.social_authorization_history'),'UPDATE'),\n    'delete',has_table_privilege(role_name,to_regclass('sutra.social_authorization_history'),'DELETE'),\n    'truncate',has_table_privilege(role_name,to_regclass('sutra.social_authorization_history'),'TRUNCATE')) ORDER BY role_name)\n    FROM unnest(ARRAY['anon','authenticated','service_role']) role_name)\n);\n"


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def load_engine(source):
    engine = {'__name__': 'checkpoint_engine',
        '__file__': '/opt/purama/apps/sutra/checkpoint-transition.py'}
    exec(source, engine)
    return engine


def query(database, sql):
    result = subprocess.run(['docker', 'exec', '-i', 'supabase-db', 'psql', '-X', '-qAt',
        '-U', 'supabase_admin', '-d', database, '-v', 'ON_ERROR_STOP=1'],
        input=sql, capture_output=True, text=True, timeout=90)
    if result.returncode:
        raise RuntimeError('SOCIAL_HISTORY_SQL_UNCONFIRMED')
    return result.stdout.strip()


def state(database):
    return json.loads(query(database, STATE_SQL))


def data_digest(database):
    # Only aggregates leave PostgreSQL, never the account/provider data hashed.
    tables = ['public.social_accounts']
    if query(database, "SELECT to_regclass('sutra.social_authorization_history') IS NOT NULL;") == 't':
        tables.append('sutra.social_authorization_history')
    result = {}
    for table in tables:
        result[table] = json.loads(query(database, "SELECT jsonb_build_object('rows',count(*),'digest',"
            "md5(coalesce(string_agg(md5(row_to_json(t)::text),'' ORDER BY md5(row_to_json(t)::text)),''))) FROM "
            + table + ' t;'))
    result.setdefault('sutra.social_authorization_history', {'rows': 0, 'digest': hashlib.md5(b'').hexdigest()})
    return digest(result)


def guarded_sql(expected, sql):
    encoded = json.dumps(expected).replace("'", "''")
    assert '$history_guard$' not in encoded, 'CATALOG_DELIMITER_REQUIRES_REVIEW'
    guard = """BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='20s';
SELECT pg_advisory_xact_lock(hashtextextended('sutra.social_authorization_history.transition.v1',0));
LOCK TABLE public.social_accounts IN ACCESS EXCLUSIVE MODE;
DO $history_lock$ BEGIN
 IF to_regclass('sutra.social_authorization_history') IS NOT NULL THEN
  LOCK TABLE sutra.social_authorization_history IN ACCESS EXCLUSIVE MODE;
 END IF;
END $history_lock$;
SELECT c.oid FROM pg_class c WHERE c.oid IN
 (to_regclass('public.social_accounts'),to_regclass('sutra.social_authorization_history'))
 ORDER BY c.oid FOR UPDATE OF c;
SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='sutra' AND p.proname IN
 ('capture_social_authorization_history','reject_social_history_mutation') AND p.pronargs=0
 ORDER BY p.oid FOR UPDATE OF p;
DO $history_guard$ BEGIN
 IF (""" + STATE_SQL.rstrip().rstrip(';') + ")::jsonb IS DISTINCT FROM '" + encoded + "'::jsonb THEN\n"
    guard += "RAISE EXCEPTION 'SUTRA_SOCIAL_HISTORY_STATE_DRIFT'; END IF; END $history_guard$;\n"
    assert sql.count('BEGIN;') == 1 and sql.rstrip().endswith('COMMIT;')
    return sql.replace('BEGIN;', guard, 1)


def rollback_shape(applied, reverted):
    # Rollback only suspends capture; every other catalog fact stays protected.
    expected = dict(applied)
    expected['triggers'] = [item for item in applied['triggers']
        if item['name'] != 'sutra_capture_social_authorization_history']
    expected['functions'] = [item for item in applied['functions']
        if item['name'] != 'capture_social_authorization_history']
    assert reverted == expected and reverted['table'] is not None, 'ROLLBACK_SHAPE_DRIFT'
    assert len(reverted['triggers']) == 1 and len(reverted['functions']) == 1


def verify_copy(backup, migration, rollback, engine_source):
    os.umask(0o077)
    engine = load_engine(engine_source)
    engine['validate_backup'](backup)
    database = backup['database']
    assert re.fullmatch('sutra_restore_t01_[a-z0-9]+', database)
    folder = Path(backup['directory'])
    assert folder.parent == Path('/opt/purama/apps/sutra') and not folder.is_symlink()
    for name, item in backup['artifacts'].items():
        assert '/' not in name and name not in ('.', '..')
        artifact = folder / name
        assert not artifact.is_symlink()
        assert hashlib.sha256(artifact.read_bytes()).hexdigest() == item['sha256']
    before = state(database)
    production = state('postgres')
    assert before == production, 'RESTORE_BASELINE_DRIFT'
    migration_hash = hashlib.sha256(migration.encode()).hexdigest()
    protected = folder / ('social-history-' + migration_hash[:12])
    protected.mkdir(mode=0o700)
    for name, content in [('before.json', json.dumps(before)), ('rollback.sql', rollback), ('migration.sql', migration)]:
        with (protected / name).open('x') as stream:
            stream.write(content)
        assert (protected / name).stat().st_mode & 0o777 == 0o600
    rows = data_digest(database)
    query(database, guarded_sql(before, migration))
    after = state(database)
    assert digest(after) != digest(before), 'MIGRATION_ALREADY_APPLIED'
    assert data_digest(database) == rows, 'MIGRATION_CHANGED_DATA'
    query(database, guarded_sql(after, migration))
    assert state(database) == after and data_digest(database) == rows, 'REPLAY_DRIFT'
    # A failed or uncertain call exits without compensating submission.
    query(database, guarded_sql(after, rollback))
    reverted = state(database)
    rollback_shape(after, reverted)
    assert data_digest(database) == rows, 'ROLLBACK_CHANGED_HISTORY'
    # The rollback retains new objects, so this is deliberately not the baseline.
    query(database, guarded_sql(reverted, migration))
    assert state(database) == after and data_digest(database) == rows, 'REAPPLY_DRIFT'
    query(database, guarded_sql(after, rollback))
    assert state(database) == reverted and data_digest(database) == rows, 'SECOND_ROLLBACK_DRIFT'
    assert state('postgres') == production, 'PRODUCTION_STATE_DRIFT'
    for name, value in [('after.json', after), ('rollback-state.json', reverted)]:
        with (protected / name).open('x') as stream:
            json.dump(value, stream)
    return {'status': 'PASS', 'productionChanged': False, 'dataUnchanged': True,
        'replaySafe': True, 'rollbackPreservesHistory': True,
        'migrationSha256': migration_hash, 'beforeStateSha256': digest(before),
        'afterStateSha256': digest(after), 'rollbackStateSha256': digest(reverted),
        'protectedRollback': str(protected), 'rollbackSha256': hashlib.sha256(rollback.encode()).hexdigest()}


def remote_apply(config, migration, engine_source):
    engine = load_engine(engine_source)
    proof = dict(config['proof'])
    proof['beforeDefinitionsSha256'] = proof['beforeStateSha256']
    proof['afterDefinitionsSha256'] = proof['afterStateSha256']
    proof['rollbackDefinitionsSha256'] = proof['rollbackStateSha256']

    class HistoryPort(engine['RemotePort']):
        def __init__(self, cfg):
            super().__init__(cfg)
            self.folder = Path('/opt/purama/apps/sutra') / ('social-history-transition-' + cfg['sha'])

        def definitions(self):
            # Use engine.execute so transport errors retain the UNKNOWN contract.
            return json.loads(self.execute(STATE_SQL))

        def execute_guarded(self, expected, sql):
            self.execute(guarded_sql(expected, sql))

        def rollback(self):
            protected = Path(self.proof['protectedRollback'])
            assert protected.parent == Path(config['backup']['directory'])
            assert not protected.is_symlink() and protected.stat().st_mode & 0o777 == 0o700
            file = protected / 'rollback.sql'
            assert not file.is_symlink() and file.stat().st_mode & 0o777 == 0o600
            return file.read_text()

    result = engine['transition'](HistoryPort({**config, 'proof': proof}), config['mode'], proof, migration)
    result['stateVerified'] = result.pop('definitionsVerified', False)
    for old, new in [('previousDefinitionsVerified', 'previousStateVerified'),
        ('rollbackDefinitionsVerified', 'rollbackStateVerified')]:
        if old in result:
            result[new] = result.pop(old)
    if result['status'] == 'PASS' and result['stateVerified']:
        result['stateSha256'] = proof['afterStateSha256' if config['mode'] == 'apply' else 'rollbackStateSha256']
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['verify-copy', 'apply', 'rollback', 'inspect'])
    parser.add_argument('--source-ref')
    parser.add_argument('--ci-run')
    args = parser.parse_args()
    name = 'restore' if args.mode == 'verify-copy' else args.mode
    receipt_file = HERE / ('social-history-' + name + '.json')
    assert not receipt_file.exists(), 'INSPECT_EXISTING_RECEIPT_BEFORE_RETRY'
    backup = json.loads((HERE / 'backup-restore.json').read_text())
    module = Path(__file__).read_text()
    engine_source = (ROOT / ENGINE).read_text()
    load_engine(engine_source)['validate_backup'](backup)
    migration = (ROOT / MIGRATION).read_text()
    rollback = (ROOT / ROLLBACK).read_text()
    assert STATE_SQL == (ROOT / METADATA).read_text(), 'METADATA_SOURCE_DRIFT'
    config = {'backup': backup, 'mode': args.mode, 'sha': args.source_ref}
    if args.mode in ('apply', 'rollback'):
        assert re.fullmatch('[a-f0-9]{40}', args.source_ref or '')
        assert re.fullmatch('[0-9]+', args.ci_run or '')
        for file in (MIGRATION, ENGINE, METADATA, ROLLBACK, str(Path(__file__).relative_to(ROOT))):
            assert subprocess.check_output(['git', 'show', args.source_ref + ':' + file], cwd=ROOT, text=True) == (ROOT / file).read_text(), 'UNCOMMITTED_SOURCE'
        proof = json.loads((HERE / 'social-history-restore.json').read_text())
        assert proof['status'] == 'PASS' and proof['productionChanged'] is False
        assert all(proof[key] is True for key in ('dataUnchanged', 'replaySafe', 'rollbackPreservesHistory'))
        for key in ('beforeStateSha256', 'afterStateSha256', 'rollbackStateSha256'):
            assert re.fullmatch('[a-f0-9]{64}', proof[key])
        assert proof['migrationSha256'] == hashlib.sha256(migration.encode()).hexdigest()
        assert proof['rollbackSha256'] == hashlib.sha256(rollback.encode()).hexdigest()
        config['proof'] = proof
        if args.mode == 'apply':
            ci = json.loads(subprocess.check_output(['gh', 'run', 'view', args.ci_run,
                '--json', 'headSha,status,conclusion,jobs'], cwd=ROOT))
            assert ci['headSha'] == args.source_ref and ci['status'] == 'completed' and ci['conclusion'] == 'success'
            assert len(ci['jobs']) == 3 and all(job['conclusion'] == 'success' for job in ci['jobs'])
            candidate = json.loads((HERE / 'candidate.json').read_text())
            assert candidate['source'] == args.source_ref and candidate['status'] == 'PASS' and candidate['network'] == 'none'
            age = datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat(backup['observedAt'])
            assert datetime.timedelta(0) <= age <= datetime.timedelta(hours=4), 'FRESH_BACKUP_REQUIRED'
    source = "__name__='social_history_remote'\n__file__='/opt/purama/apps/sutra/social-history-transition.py'\n" + module
    source += '\nconfig=' + repr(config) + '\nmigration=' + repr(migration) + '\nrollback=' + repr(rollback) + '\n'
    if args.mode == 'verify-copy':
        source += "result=verify_copy(config['backup'],migration,rollback," + repr(engine_source) + ')\n'
    elif args.mode == 'inspect':
        source += "result={'status':'PASS','stateSha256':digest(state('postgres')),'readOnly':True}\n"
    else:
        source += 'result=remote_apply(config,migration,' + repr(engine_source) + ')\n'
    source += "print(json.dumps(result))\nraise SystemExit(0 if result['status']=='PASS' else 1)\n"
    try:
        remote = subprocess.run(['ssh', '-i', str(Path.home() / '.ssh/purama_vps_ed25519'),
            '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
            'root@144.217.14.210', 'python3 -'], input=source, capture_output=True, text=True, timeout=240)
        receipt = json.loads(remote.stdout)
        assert remote.returncode == 0 or receipt['status'] != 'PASS'
    except BaseException:
        receipt = {'status': 'UNKNOWN', 'action': 'Inspect protected state and process before any retry.'}
    receipt.update(source=args.source_ref, mode=args.mode,
        migrationSha256=hashlib.sha256(migration.encode()).hexdigest(),
        observedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
    with receipt_file.open('x') as stream:
        json.dump(receipt, stream, indent=2)
        stream.write('\n')
    print(json.dumps(receipt))
    raise SystemExit(0 if receipt['status'] == 'PASS' else 1)


if __name__ == '__main__':
    main()
