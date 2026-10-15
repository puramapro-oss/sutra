"""Exact tested SUTRA-only promotion; Salad disabled, runtime and database unchanged.

Requires separately verified CI, candidate and fresh restored backup receipts.
All remote output is captured. Only allowlisted receipts leave the VPS.
Confirmed failures restore the exact snapshot. Unknown transport outcomes never race rollback.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import shlex
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
PROOF = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'deploy'))
import ovh
import promotion_guards as guards


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-ref', required=True)
    parser.add_argument('--ci-run', required=True)
    parser.add_argument('--proof-dir', type=Path, default=PROOF)
    args = parser.parse_args()
    proof_dir = args.proof_dir.resolve()
    assert proof_dir.parent == ROOT / 'qa' and proof_dir.is_dir(), 'INVALID_PROOF_DIRECTORY'
    assert re.fullmatch('[0-9a-f]{40}', args.source_ref)
    assert re.fullmatch('[0-9]+', args.ci_run)
    assert hashlib.sha256(ovh.HELPER.read_bytes()).hexdigest() == ovh.HELPER_SHA256
    spec = importlib.util.spec_from_file_location('sutra_helper', ovh.HELPER)
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    ssh = ['ssh', '-i', str(helper.SSH_KEY), '-o', 'IdentitiesOnly=yes', '-o',
           'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', helper.REMOTE]

    def remote(source, timeout=120):
        return guards.remote_json(ssh, source, timeout)

    def record(name, result):
        (proof_dir / (name + '.json')).write_text(json.dumps(result, indent=2) + '\n')

    ci = json.loads(subprocess.check_output(['gh', 'run', 'view', args.ci_run,
        '--json', 'headSha,status,conclusion,jobs,url'], cwd=ROOT))
    assert ci['headSha'] == args.source_ref and ci['status'] == 'completed' and ci['conclusion'] == 'success'
    assert len(ci['jobs']) == 3 and all(j['conclusion'] == 'success' for j in ci['jobs'])
    record('ci-final', ci)
    manifest_path = (proof_dir / 'tested-source-manifest.json').relative_to(ROOT).as_posix()
    manifest = json.loads(subprocess.check_output(['git', 'show',
        args.source_ref + ':' + manifest_path], cwd=ROOT))
    assert manifest['files'] and len({item['path'] for item in manifest['files']}) == len(manifest['files'])
    for item in manifest['files']:
        data = subprocess.check_output(['git', 'show', args.source_ref + ':' + item['path']], cwd=ROOT)
        assert hashlib.sha256(data).hexdigest() == item['sha256']
    candidate = json.loads((proof_dir / 'candidate.json').read_text())
    backup = json.loads((proof_dir / 'backup-restore.json').read_text())
    before = json.loads((proof_dir / 'ovh-preflight.json').read_text())
    assert candidate['source'] == args.source_ref and candidate['status'] == 'PASS' and candidate['network'] == 'none'
    checkpoint = {}
    checkpoint_source = (PROOF / 'checkpoint-transition.py').read_text()
    exec(compile(checkpoint_source, 'checkpoint-transition.py', 'exec'), checkpoint := {
        '__file__': str(PROOF / 'checkpoint-transition.py'), '__name__': 'sutra_checkpoint_gates'})
    sql_proof = json.loads((proof_dir / 'checkpoint-restore.json').read_text())
    applied = json.loads((proof_dir / 'checkpoint-apply.json').read_text())
    checkpoint_migration_path = 'migrations/20261015_final_durable_integrity.sql'
    migration_path = sql_proof.get('migrationPath', checkpoint_migration_path)
    assert re.fullmatch(r'migrations/[A-Za-z0-9_-]+\.sql', migration_path)
    migration = subprocess.check_output(['git', 'show', args.source_ref + ':' + migration_path], cwd=ROOT)
    guards.validate_release_proofs(backup, sql_proof, applied, args.source_ref, migration, checkpoint['validate_backup'])
    assert applied.get('definitionsVerified') is True
    permission_path = 'qa/t01-final-20261015/client-permissions.py'
    permission_source = subprocess.check_output(['git', 'show', args.source_ref + ':' + permission_path], cwd=ROOT).decode()
    assert permission_source == (ROOT / permission_path).read_text(), 'PERMISSION_GATE_SCRIPT_DRIFT'
    permissions = {'__file__': str(ROOT / permission_path), '__name__': 'sutra_permission_gates'}
    exec(compile(permission_source, permission_path, 'exec'), permissions)
    assert re.fullmatch(r'migrations/[A-Za-z0-9_-]+\.sql', permissions['MIGRATION'])
    permission_migration = subprocess.check_output(['git', 'show', args.source_ref + ':' + permissions['MIGRATION']], cwd=ROOT)
    permission_proof = json.loads((proof_dir / 'client-permissions-restore.json').read_text())
    permission_applied = json.loads((proof_dir / 'client-permissions-apply.json').read_text())
    guards.validate_permission_proofs(backup, permission_proof, permission_applied, args.source_ref, permission_migration)
    social_path = 'qa/t01-final-20261015/social-history-transition.py'
    social_source = subprocess.check_output(['git', 'show', args.source_ref + ':' + social_path], cwd=ROOT).decode()
    assert social_source == (ROOT / social_path).read_text(), 'SOCIAL_GATE_SCRIPT_DRIFT'
    social = {'__file__': str(ROOT / social_path), '__name__': 'sutra_social_gates'}
    exec(compile(social_source, social_path, 'exec'), social)
    assert re.fullmatch(r'migrations/[A-Za-z0-9_-]+\.sql', social['MIGRATION'])
    social_migration = subprocess.check_output(['git', 'show', args.source_ref + ':' + social['MIGRATION']], cwd=ROOT)
    social_proof = json.loads((proof_dir / 'social-history-restore.json').read_text())
    social_applied = json.loads((proof_dir / 'social-history-apply.json').read_text())
    guards.validate_social_history_proofs(backup, social_proof, social_applied, args.source_ref, social_migration)
    assert before['health'] == 'healthy' and before['saladEnabled'] is False
    assert re.fullmatch('[0-9a-f]{40}', before['source'])
    assert re.fullmatch('[a-zA-Z0-9_.:/-]+', candidate['image'])
    for image in (candidate['imageId'], before['imageId']):
        assert re.fullmatch('sha256:[0-9a-f]{64}', image)
    # Executed deployment gates must be the exact committed version, not local WIP.
    for path in ('deploy/promotion_guards.py', 'deploy/ovh.py',
                 'qa/t01-consolidation-20261014/promote.py',
                 'qa/t01-consolidation-20261014/checkpoint-transition.py',
                 'qa/t01-consolidation-20261014/run-authenticated.py'):
        assert subprocess.check_output(['git', 'show', args.source_ref + ':' + path], cwd=ROOT) == (ROOT / path).read_bytes(), 'DEPLOY_SCRIPT_DRIFT'
    snapshot = ovh.REMOTE_ROOT + '/rollback-' + args.source_ref
    constants = '\n'.join(k + '=' + repr(v) for k, v in {
        'SHA': args.source_ref, 'PREVIOUS': before['source'], 'OLD_IMAGE': before['imageId'],
        'IMAGE': candidate['image'], 'IMAGE_ID': candidate['imageId'], 'BACKUP': backup,
        'OTHER_CONTAINERS': before['otherContainers'], 'SNAPSHOT': snapshot,
        'DEFINITIONS': checkpoint['DEFINITIONS'], 'SQL_HASH': sql_proof['afterDefinitionsSha256'],
        'PERMISSION_MODULE': permission_source, 'PERMISSION_HASH': permission_proof['afterStateSha256'],
        'SOCIAL_MODULE': social_source, 'SOCIAL_HASH': social_proof['afterStateSha256'],
    }.items()) + '\n'
    common = Path(guards.__file__).read_text() + '\n' + '''
import pathlib,shutil
os.umask(0o077)
root=pathlib.Path('/opt/purama/apps/sutra');snapshot=pathlib.Path(SNAPSHOT)
lock=acquire_lock(root)
permissions={'__file__':'/opt/purama/apps/sutra/client-permissions.py','__name__':'sutra_permission_gates'}
exec(PERMISSION_MODULE,permissions)
social={'__file__':'/opt/purama/apps/sutra/social-history-transition.py','__name__':'sutra_social_gates'}
exec(SOCIAL_MODULE,social)
def inspect(name):return json.loads(subprocess.check_output(['docker','inspect',name]))[0]
def checked(argv):
 r=subprocess.run(argv,capture_output=True,timeout=120,pass_fds=(lock.fileno(),))
 assert r.returncode==0,'COMMAND_UNCONFIRMED'
def check_backup():
 age=datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(BACKUP['observedAt'])
 assert datetime.timedelta(0)<=age<=datetime.timedelta(hours=4),'BACKUP_STALE'
 assert all(sha256((Path(BACKUP['directory'])/n).read_bytes())==v['sha256'] for n,v in BACKUP['artifacts'].items()),'BACKUP_DRIFT'
def check_sql():
 r=subprocess.run(['docker','exec','-i','supabase-db','psql','-U','supabase_admin','-d','postgres','-X','-A','-t','-q','-v','ON_ERROR_STOP=1'],input=DEFINITIONS,text=True,capture_output=True,timeout=30)
 assert r.returncode==0,'SQL_READ_UNCONFIRMED'
 assert sha256(json.dumps(json.loads(r.stdout),sort_keys=True).encode())==SQL_HASH,'SQL_DEFINITION_DRIFT'
 assert permissions['digest'](permissions['state']('postgres'))==PERMISSION_HASH,'PERMISSION_STATE_DRIFT'
 assert social['digest'](social['state']('postgres'))==SOCIAL_HASH,'SOCIAL_STATE_DRIFT'
'''
    receipt = remote(constants + common + '''x=inspect('purama-sutra')
assert x['Image']==OLD_IMAGE and x['Config']['Labels']['dev.purama.commit']==PREVIOUS
assert x['State']['Health']['Status']=='healthy'
assert x['Config']['Labels']['com.docker.compose.project.config_files']==str(root/'compose.yml')
runtime=dict(line.split('=',1) for line in (root/'runtime/.env').read_text().splitlines() if '=' in line and not line.lstrip().startswith('#'))
assert runtime.get('SALAD_ENABLED','').strip().strip(chr(34)).strip(chr(39)).lower() not in ('true','1','yes')
assert (root/'runtime/.env').stat().st_mode&0o777==0o600
check_backup()
check_sql()
assert subprocess.check_output(['docker','image','inspect','--format={{.Id}}',IMAGE],text=True).strip()==IMAGE_ID
assert subprocess.check_output(['docker','image','inspect','--format={{index .Config.Labels "dev.purama.commit"}}',IMAGE],text=True).strip()==SHA
prepare_snapshot(root,snapshot,SHA,PREVIOUS,OLD_IMAGE,IMAGE_ID,IMAGE)
print(json.dumps({'status':'PASS','snapshot':str(snapshot),'mode':'0700/0600','runtimeUnchanged':True,'saladEnabled':False}))
''')
    record('snapshot', receipt)
    # Prove the saved image starts with its exact saved configuration, without networking.
    probe = """(async()=>{const out=[];for(const [path,status] of [['/',200],['/login',200],['/api/points',401],['/api/video/capabilities',401]]){const r=await fetch('http://127.0.0.1:3000'+path,{redirect:'manual',signal:AbortSignal.timeout(15000)});if(r.status!==status)throw Error('SMOKE_FAILED');out.push({path,status:r.status});}console.log(JSON.stringify(out));})().catch(()=>process.exit(1))"""
    # The previous image predates the capabilities route; use the stable auth route there.
    rollback_probe = probe.replace('/api/video/capabilities', '/api/video/status/00000000-0000-0000-0000-000000000000')
    name = 'sutra-rollback-salad-' + args.source_ref[:12]
    helper.ssh('docker run -d --network none --name ' + name + ' --env-file ' + snapshot + '/runtime.env ' + before['imageId'] + ' >/dev/null', capture=True)
    try:
        for attempt in range(15):
            try:
                result = helper.ssh('docker exec ' + name + ' node -e ' + shlex.quote(rollback_probe), capture=True)
                record('rollback-runtime', {'status': 'PASS', 'network': 'none', 'image': before['imageId'], 'checks': json.loads(result.stdout)})
                break
            except subprocess.CalledProcessError:
                if attempt == 14:
                    raise RuntimeError('ROLLBACK_IMAGE_NOT_PROVEN') from None
                time.sleep(2)
    finally:
        helper.ssh('docker stop ' + name + ' >/dev/null', capture=True)
    promoted = False
    try:
        promoted = True  # A partial config replacement also requires restoration.
        result = remote(constants + common + '''check_backup()
check_sql()
replace_compose(root,snapshot,'promote',checked,inspect)
print(json.dumps({'status':'PASS','runtimeUnchanged':True,'databaseChanged':False,'terminationConfirmed':True}))
''')
        record('promotion', result)
        for attempt in range(18):
            if helper.ssh("docker inspect --format='{{.State.Health.Status}}' purama-sutra", capture=True).stdout.strip() == 'healthy':
                break
            time.sleep(5)
        else:
            raise RuntimeError('NEW_IMAGE_UNHEALTHY')
        for label, url in [('internal', 'http://127.0.0.1:3000'), ('public', 'https://sutra.purama.dev')]:
            result = helper.ssh('docker exec purama-sutra node -e ' + shlex.quote(probe.replace('http://127.0.0.1:3000', url)), capture=True)
            record('smoke-' + label, {'status': 'PASS', 'checks': json.loads(result.stdout)})
        authenticated = 'exec(compile(' + repr((PROOF / 'run-authenticated.py').read_text()) + ', \"run-authenticated.py\", \"exec\"), {\"__name__\": \"__main__\", \"__file__\": ' + repr(str(proof_dir / 'run-authenticated.py')) + '})'
        result = subprocess.run([sys.executable, '-c', authenticated], cwd=ROOT, capture_output=True, timeout=240)
        assert result.returncode == 0, 'AUTHENTICATED_SMOKE_FAILED'
        receipt = remote(constants + common + '''check_sql()
check_live(root,snapshot_contract(root,snapshot),inspect)
x=inspect('purama-sutra')
assert x['Image']==IMAGE_ID and x['Config']['Labels']['dev.purama.commit']==SHA
assert x['State']['Health']['Status']=='healthy' and x['RestartCount']==0
assert (root/'runtime/.env').read_bytes()==(snapshot/'runtime.env').read_bytes()
for before in OTHER_CONTAINERS:
 current=inspect(before['name']);assert current['Id']==before['id'] and current['State']['StartedAt']==before['startedAt']
logs=subprocess.run(['docker','logs','--since',x['State']['StartedAt'],'purama-sutra'],capture_output=True,text=True)
errors=len(re.findall(r'(?im)(?:^|\\s)(?:error|fatal|panic)(?:[:\\s]|$)',logs.stdout+logs.stderr))
assert errors==0,'RUNTIME_ERROR_DETECTED'
print(json.dumps({'status':'PASS','source':SHA,'imageId':x['Image'],'health':'healthy','restarts':0,'errorLines':errors,'runtimeUnchanged':True,'otherContainersUnchanged':True,'saladEnabled':False,'databaseChanged':False,'url':'https://sutra.purama.dev','rollback':SNAPSHOT}))
''')
        record('deployment', receipt)
        print('SUTRA_PROMOTED_SMOKE_PASS_SALAD_DISABLED')
    except (guards.RemoteOutcomeUnknown, subprocess.TimeoutExpired, KeyboardInterrupt):
        record('deployment', {'status': 'UNKNOWN', 'source': args.source_ref,
            'action': 'Reconcile protected operation marker and remote process completion before rollback or retry.'})
        raise RuntimeError('PROMOTION_UNKNOWN_NO_CONCURRENT_ROLLBACK') from None
    except BaseException:
        if promoted:
            try:
                receipt = remote(guards.rollback_source(ovh.REMOTE_ROOT, snapshot), timeout=240)
                record('automatic-rollback', receipt)
            except BaseException:
                record('automatic-rollback', {'status': 'UNKNOWN', 'action': 'Inspect CAS drift and operation marker; no retry.'})
                raise RuntimeError('ROLLBACK_UNCONFIRMED_NO_RETRY') from None
        raise RuntimeError('PROMOTION_FAILED_REVIEW_REDACTED_RECEIPTS') from None


if __name__ == '__main__':
    main()
