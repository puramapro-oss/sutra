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
