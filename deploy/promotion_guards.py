"""Shared SUTRA release gates. Remote functions never print config or credentials."""
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess


class RemoteOutcomeUnknown(RuntimeError):
    """Transport completion does not prove completion of the remote mutation."""


ADDITIONAL_MIGRATIONS = (
    'migrations/20261019_partner_scan_atomic.sql',
    'migrations/20261020_t03_auto_scheduler.sql',
)

# Catalogue only: no user rows, configuration values or credentials. Names and
# ordering are canonical so restored databases need not preserve object OIDs.
ADDITIONAL_SCHEMA_SQL = """
SELECT jsonb_build_object('version','sutra-additional-migrations-v1',
 'schema',(SELECT jsonb_build_object('owner',pg_get_userbyid(nspowner),'acl',nspacl::text)
   FROM pg_namespace WHERE nspname='sutra'),
 'functions',(SELECT jsonb_agg(jsonb_build_object('name',p.proname,
   'arguments',pg_get_function_identity_arguments(p.oid),'definition',pg_get_functiondef(p.oid),
   'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,
   'service',has_function_privilege('service_role',p.oid,'EXECUTE'),
   'anon',has_function_privilege('anon',p.oid,'EXECUTE'),
   'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE')) ORDER BY p.proname)
   FROM pg_proc p WHERE p.pronamespace='sutra'::regnamespace
   AND p.proname IN ('record_partner_scan','schedule_auto_video_jobs','t03_reset_auto_cursor')),
 'tables',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,
   'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,
   'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
   'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,
     'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,
     'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)
     FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
     WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
   'constraints',(SELECT jsonb_agg(pg_get_constraintdef(oid) ORDER BY conname)
     FROM pg_constraint WHERE conrelid=c.oid),
   'policies',(SELECT jsonb_agg(to_jsonb(pol) ORDER BY policyname) FROM pg_policies pol
     WHERE schemaname='sutra' AND tablename=c.relname),
   'indexes',(SELECT jsonb_agg(jsonb_build_object('name',ic.relname,
     'definition',pg_get_indexdef(i.indexrelid),'valid',i.indisvalid) ORDER BY ic.relname)
     FROM pg_index i JOIN pg_class ic ON ic.oid=i.indexrelid WHERE i.indrelid=c.oid),
   'triggers',(SELECT jsonb_agg(jsonb_build_object('name',tgname,'enabled',tgenabled,
     'definition',pg_get_triggerdef(oid)) ORDER BY tgname)
     FROM pg_trigger WHERE tgrelid=c.oid AND NOT tgisinternal)) ORDER BY c.relname)
   FROM pg_class c WHERE c.relnamespace='sutra'::regnamespace
     AND c.relname IN ('partners','partner_scans','sutra_auto_config')));
"""


def validate_additional_state(state, expected_hash):
    """Refuse absent objects and disabled guards as well as catalogue drift."""
    assert state['version'] == 'sutra-additional-migrations-v1'
    functions = {item['name']: item for item in state['functions']}
    assert len(state['functions']) == len(functions) == 3
    assert set(functions) == {'record_partner_scan', 'schedule_auto_video_jobs', 't03_reset_auto_cursor'}
    for name, item in functions.items():
        assert item['anon'] is False and item['authenticated'] is False, 'ADDITIONAL_RPC_CLIENT_ACCESS'
        if name != 't03_reset_auto_cursor':
            assert item['service'] is True, 'ADDITIONAL_RPC_SERVICE_ACCESS'
    tables = {item['name']: item for item in state['tables']}
    assert len(state['tables']) == len(tables) == 3
    assert set(tables) == {'partners', 'partner_scans', 'sutra_auto_config'}
    cursor = [c for c in tables['sutra_auto_config']['columns'] if c['name'] == 'scheduler_cursor']
    assert len(cursor) == 1 and cursor[0]['type'] == 'timestamp with time zone' and cursor[0]['notNull'] is True
    triggers = [t for t in tables['sutra_auto_config']['triggers'] if t['name'] == 't03_auto_cursor']
    assert len(triggers) == 1 and triggers[0]['enabled'] in ('O', 'A'), 'SCHEDULER_CURSOR_GUARD_DISABLED'
    indexes = [i for i in tables['partner_scans']['indexes'] if i['name'] == 'idx_partner_scans_window']
    assert len(indexes) == 1 and indexes[0]['valid'] is True
    assert sha256(json.dumps(state, sort_keys=True).encode()) == expected_hash, 'ADDITIONAL_SCHEMA_DRIFT'


def validate_additional_migration_proofs(backup, receipt, source, migrations, now=None):
    """A source-bound, fresh restore/replay/rollback proof is mandatory for both deltas."""
    now = now or datetime.datetime.now(datetime.timezone.utc)
    start = datetime.datetime.fromisoformat(backup['observedAt'])
    assert start.tzinfo is not None and datetime.timedelta(0) <= now-start <= datetime.timedelta(hours=4), 'BACKUP_STALE'
    assert receipt['source'] == source and receipt['status'] == 'PASS'
    assert receipt['backupDirectory'] == backup['directory']
    assert receipt['backupArtifacts'] == backup['artifacts'], 'ADDITIONAL_BACKUP_MISMATCH'
    assert set(migrations) == set(ADDITIONAL_MIGRATIONS)
    assert receipt['migrations'] == {p: sha256(migrations[p]) for p in ADDITIONAL_MIGRATIONS}, 'ADDITIONAL_MIGRATION_MISMATCH'
    assert all(receipt[key] is True for key in ('dataPreserved', 'replaySafe', 'rollbackPreservesData', 'restoredStateVerified'))
    assert receipt['productionChangedByRehearsal'] is False
    rehearsal = datetime.datetime.fromisoformat(receipt['rehearsedAt'])
    applied = datetime.datetime.fromisoformat(receipt['appliedAt'])
    assert start <= rehearsal <= applied <= now, 'ADDITIONAL_PROOF_TIME_INVALID'
    assert Path(receipt['protectedRollback']).parent == Path(backup['directory'])
    for key in ('beforeStateSha256', 'afterStateSha256', 'rollbackStateSha256'):
        assert re.fullmatch('[0-9a-f]{64}', receipt[key])
    assert receipt['stateQuerySha256'] == sha256(ADDITIONAL_SCHEMA_SQL.encode())
    validate_additional_state(receipt['afterState'], receipt['afterStateSha256'])


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def validate_release_proofs(backup, proof, applied, source, migration, validate_backup, now=None):
    # One canonical structural validator, also used by checkpoint transitions.
    validate_backup(backup)
    now = now or datetime.datetime.now(datetime.timezone.utc)
    age = now - datetime.datetime.fromisoformat(backup['observedAt'])
    assert datetime.timedelta(0) <= age <= datetime.timedelta(hours=4), 'BACKUP_STALE'
    assert Path(backup['directory']).parent == Path('/opt/purama/apps/sutra')
    for artifact in backup['artifacts'].values():
        assert re.fullmatch('[0-9a-f]{64}', artifact['sha256'])
    assert proof['status'] == 'PASS' and proof['definitionsRestoredExactly'] is True
    assert proof['aclAndOwnershipUnchanged'] is True
    assert proof['migrationSha256'] == sha256(migration), 'MIGRATION_PROOF_MISMATCH'
    for key in ('beforeDefinitionsSha256', 'afterDefinitionsSha256'):
        assert re.fullmatch('[0-9a-f]{64}', proof[key])
    assert applied['status'] == 'PASS' and applied['mode'] == 'apply'
    assert applied['source'] == source and applied['migrationSha256'] == proof['migrationSha256'], 'SQL_APPLY_NOT_EXACT'
    assert datetime.datetime.fromisoformat(backup['observedAt']) <= datetime.datetime.fromisoformat(applied['observedAt']) <= now


def validate_permission_proofs(backup, proof, applied, source, migration, now=None):
    """Only an exact rehearsed and applied permission state can authorize release."""
    now = now or datetime.datetime.now(datetime.timezone.utc)
    assert proof['status'] == 'PASS'
    assert all(proof[key] is True for key in ('stateRestoredExactly', 'dataUnchanged', 'replaySafe'))
    for key in ('beforeStateSha256', 'afterStateSha256', 'rollbackSha256', 'migrationSha256'):
        assert re.fullmatch('[0-9a-f]{64}', proof[key])
    assert proof['migrationSha256'] == sha256(migration), 'PERMISSION_MIGRATION_MISMATCH'
    assert Path(proof['protectedRollback']).parent == Path(backup['directory'])
    assert applied['status'] == 'PASS' and applied['mode'] == 'apply'
    assert applied['source'] == source and applied['migrationSha256'] == proof['migrationSha256'], 'PERMISSION_APPLY_NOT_EXACT'
    assert applied['stateVerified'] is True and applied['stateSha256'] == proof['afterStateSha256'], 'PERMISSION_STATE_NOT_VERIFIED'
    assert datetime.datetime.fromisoformat(backup['observedAt']) <= datetime.datetime.fromisoformat(applied['observedAt']) <= now


def validate_social_history_proofs(backup, proof, applied, source, migration, now=None):
    """Additive history rollback preserves facts; it is not a baseline restore."""
    now = now or datetime.datetime.now(datetime.timezone.utc)
    assert proof['status'] == 'PASS'
    assert all(proof[key] is True for key in ('dataUnchanged', 'replaySafe', 'rollbackPreservesHistory'))
    assert proof['productionChanged'] is False
    for key in ('beforeStateSha256', 'afterStateSha256', 'rollbackStateSha256', 'rollbackSha256', 'migrationSha256'):
        assert re.fullmatch('[0-9a-f]{64}', proof[key])
    assert len({proof[key] for key in ('beforeStateSha256', 'afterStateSha256', 'rollbackStateSha256')}) == 3
    assert proof['migrationSha256'] == sha256(migration), 'SOCIAL_MIGRATION_MISMATCH'
    assert Path(proof['protectedRollback']).parent == Path(backup['directory'])
    assert applied['status'] == 'PASS' and applied['mode'] == 'apply'
    assert applied['source'] == source and applied['migrationSha256'] == proof['migrationSha256'], 'SOCIAL_APPLY_NOT_EXACT'
    assert applied['stateVerified'] is True and applied['stateSha256'] == proof['afterStateSha256'], 'SOCIAL_STATE_NOT_VERIFIED'
    assert datetime.datetime.fromisoformat(backup['observedAt']) <= datetime.datetime.fromisoformat(applied['observedAt']) <= now


def remote_json(ssh, source, timeout=120):
    try:
        result = subprocess.run(ssh + ['python3 -'], input=source, text=True,
                                capture_output=True, timeout=timeout)
        if result.returncode != 0:
            raise RemoteOutcomeUnknown()
        receipt = json.loads(result.stdout)
        if not isinstance(receipt, dict) or receipt.get('status') not in ('PASS', 'RESTORED'):
            raise RemoteOutcomeUnknown()
        return receipt
    except BaseException:
        # Includes KeyboardInterrupt: no compensating SSH may race a remote child.
        raise RemoteOutcomeUnknown('REMOTE_OUTCOME_UNKNOWN_RECONCILE_BEFORE_ACTION') from None


def acquire_lock(root):
    """Nonblocking, shared by promotion and rollback; inherited by Compose CLI."""
    descriptor = os.open(root / '.deployment.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    lock = os.fdopen(descriptor, 'a+')
    try:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BaseException:
        lock.close()
        raise RuntimeError('DEPLOYMENT_BUSY') from None
    return lock


def write_private(path, value):
    # Same-filesystem atomic publication, never emit the protected content.
    staged = path.with_name(path.name + '.pending')
    with staged.open('x') as stream:
        os.chmod(staged, 0o600)
        stream.write(json.dumps(value))
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(staged, path)


def ensure_idle(root):
    marker = root / '.deployment-operation.json'
    if marker.exists():
        assert json.loads(marker.read_text())['phase'] == 'complete', 'PREVIOUS_OPERATION_UNKNOWN'


def begin_operation(root, snapshot, operation):
    ensure_idle(root)
    write_private(root / '.deployment-operation.json', {
        'phase': 'running', 'snapshot': str(snapshot), 'operation': operation})


def complete_operation(root, snapshot, operation):
    write_private(root / '.deployment-operation.json', {
        'phase': 'complete', 'snapshot': str(snapshot), 'operation': operation})


def prepare_snapshot(root, snapshot, source, previous, old_image, new_image, image_tag):
    ensure_idle(root)
    assert snapshot.parent == root and snapshot.name == 'rollback-' + source
    old = (root / 'compose.yml').read_bytes()
    runtime = (root / 'runtime/.env').read_bytes()
    new, count = re.subn(rb'(?m)^    image: .*$', ('    image: ' + image_tag).encode(), old)
    assert count == 1 and b'traefik.http.routers.sutra.tls.certresolver: mytlschallenge' in new
    assert new != old, 'IMAGE_ALREADY_SELECTED'
    snapshot.mkdir(mode=0o700)
    for name, data in [('compose.yml', old), ('runtime.env', runtime), ('promoted-compose.yml', new)]:
        with (snapshot / name).open('xb') as stream:
            os.chmod(snapshot / name, 0o600)
            stream.write(data)
    write_private(snapshot / 'cas.json', {
        'version': 1, 'source': source, 'previous': previous, 'oldImage': old_image,
        'newImage': new_image, 'oldComposeSha256': sha256(old),
        'newComposeSha256': sha256(new), 'runtimeSha256': sha256(runtime)})
    (snapshot / 'complete').touch(mode=0o600, exist_ok=False)


def snapshot_contract(root, snapshot):
    assert snapshot.parent == root and re.fullmatch('rollback-[0-9a-f]{40}', snapshot.name)
    assert snapshot.is_dir() and not snapshot.is_symlink() and snapshot.stat().st_mode & 0o777 == 0o700
    for name in ('cas.json', 'complete', 'compose.yml', 'promoted-compose.yml', 'runtime.env'):
        file = snapshot / name
        assert file.is_file() and not file.is_symlink() and file.stat().st_mode & 0o777 == 0o600, 'UNCERTIFIED_SNAPSHOT'
    contract = json.loads((snapshot / 'cas.json').read_text())
    assert contract['version'] == 1 and snapshot.name == 'rollback-' + contract['source']
    assert sha256((snapshot / 'compose.yml').read_bytes()) == contract['oldComposeSha256']
    assert sha256((snapshot / 'promoted-compose.yml').read_bytes()) == contract['newComposeSha256']
    assert sha256((snapshot / 'runtime.env').read_bytes()) == contract['runtimeSha256']
    return contract


def check_live(root, contract, inspect, promote=False):
    assert sha256((root / 'runtime/.env').read_bytes()) == contract['runtimeSha256'], 'RUNTIME_DRIFT'
    assert (root / 'runtime/.env').stat().st_mode & 0o777 == 0o600
    allowed = [contract['oldComposeSha256']] if promote else [contract['oldComposeSha256'], contract['newComposeSha256']]
    assert sha256((root / 'compose.yml').read_bytes()) in allowed, 'COMPOSE_DRIFT'
    live = inspect('purama-sutra')
    expected = {contract['oldImage']: contract['previous']}
    if not promote:
        expected[contract['newImage']] = contract['source']
    assert live['Image'] in expected, 'IMAGE_DRIFT'
    assert live['Config']['Labels']['dev.purama.commit'] == expected[live['Image']], 'SOURCE_DRIFT'
    assert live['Config']['Labels']['com.docker.compose.project.config_files'] == str(root / 'compose.yml')


def replace_compose(root, snapshot, operation, checked, inspect):
    """Caller holds acquire_lock throughout. Unknown commands leave a durable fence."""
    ensure_idle(root)
    contract = snapshot_contract(root, snapshot)
    check_live(root, contract, inspect, promote=operation == 'promote')
    data = (snapshot / ('promoted-compose.yml' if operation == 'promote' else 'compose.yml')).read_bytes()
    staged = root / ('compose.' + operation + '-' + contract['source'] + '.yml')
    with staged.open('xb') as stream:
        os.chmod(staged, 0o600)
        stream.write(data)
    checked(['docker', 'compose', '--project-directory', str(root), '-f', str(staged), 'config', '-q'])
    # Recheck immediately before replacement under the same common lock.
    check_live(root, contract, inspect, promote=operation == 'promote')
    begin_operation(root, snapshot, operation)
    os.replace(staged, root / 'compose.yml')
    checked(['docker', 'compose', '-f', str(root / 'compose.yml'), 'up', '-d', '--no-deps', '--pull', 'never', 'sutra'])
    complete_operation(root, snapshot, operation)
    return contract


def rollback_source(root, snapshot):
    """Self-contained remote script; no runtime content enters its stdout."""
    return Path(__file__).read_text() + '\n' + f'''
root=Path({str(root)!r});snapshot=Path({str(snapshot)!r})
os.umask(0o077)
lock=acquire_lock(root)
def inspect(name):return json.loads(subprocess.check_output(['docker','inspect',name]))[0]
def checked(argv):
    result=subprocess.run(argv,capture_output=True,timeout=120,pass_fds=(lock.fileno(),))
    assert result.returncode==0,'COMMAND_UNCONFIRMED'
contract=replace_compose(root,snapshot,'rollback',checked,inspect)
import time
for attempt in range(18):
    live=inspect('purama-sutra')
    if live['Image']==contract['oldImage'] and live['Config']['Labels']['dev.purama.commit']==contract['previous'] and live['State'].get('Health',{{}}).get('Status')=='healthy':
        check_live(root,contract,inspect)
        print(json.dumps({{'status':'RESTORED','image':contract['oldImage'],'source':contract['previous'],'health':'healthy','databaseChanged':False}}))
        break
    time.sleep(5)
else:raise RuntimeError('ROLLBACK_HEALTH_UNCONFIRMED')
'''
