"""Exact tested SUTRA-only promotion; Salad disabled, runtime and database unchanged.

Requires separately verified CI, candidate and fresh restored backup receipts.
All remote output is captured. Only allowlisted receipts leave the VPS.
Any failure after starting replacement automatically restores the saved image/config.
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-ref', required=True)
    parser.add_argument('--ci-run', required=True)
    args = parser.parse_args()
    assert re.fullmatch('[0-9a-f]{40}', args.source_ref)
    assert re.fullmatch('[0-9]+', args.ci_run)
    assert hashlib.sha256(ovh.HELPER.read_bytes()).hexdigest() == ovh.HELPER_SHA256
    spec = importlib.util.spec_from_file_location('sutra_helper', ovh.HELPER)
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    ssh = ['ssh', '-i', str(helper.SSH_KEY), '-o', 'IdentitiesOnly=yes', '-o',
           'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', helper.REMOTE]

    def remote(source, timeout=120):
        result = subprocess.run(ssh + ['python3 -'], input=source, text=True,
                                capture_output=True, timeout=timeout)
        if result.returncode != 0:
            raise RuntimeError('SAFE_REMOTE_OPERATION_FAILED')
        return json.loads(result.stdout)

    def record(name, result):
        (PROOF / (name + '.json')).write_text(json.dumps(result, indent=2) + '\n')

    ci = json.loads(subprocess.check_output(['gh', 'run', 'view', args.ci_run,
        '--json', 'headSha,status,conclusion,jobs,url'], cwd=ROOT))
    assert ci['headSha'] == args.source_ref and ci['status'] == 'completed' and ci['conclusion'] == 'success'
    assert len(ci['jobs']) == 3 and all(j['conclusion'] == 'success' for j in ci['jobs'])
    record('ci-final', ci)
    manifest = json.loads(subprocess.check_output(['git', 'show',
        args.source_ref + ':qa/salad-integration-20261014/tested-source-manifest.json'], cwd=ROOT))
    for item in manifest['files']:
        data = subprocess.check_output(['git', 'show', args.source_ref + ':' + item['path']], cwd=ROOT)
        assert hashlib.sha256(data).hexdigest() == item['sha256']
    candidate = json.loads((PROOF / 'candidate.json').read_text())
    backup = json.loads((PROOF / 'backup-restore.json').read_text())
    before = json.loads((PROOF / 'ovh-preflight.json').read_text())
    assert candidate['source'] == args.source_ref and candidate['status'] == 'PASS' and candidate['network'] == 'none'
    assert backup['rowCountsMatch'] and all(backup['restoredSchema'].values()) and not backup['productionDdl']
    assert not backup['migrations'] and before['health'] == 'healthy' and not before['saladEnabled']
    snapshot = ovh.REMOTE_ROOT + '/rollback-' + args.source_ref
    constants = '\n'.join(k + '=' + repr(v) for k, v in {
        'SHA': args.source_ref, 'PREVIOUS': before['source'], 'OLD_IMAGE': before['imageId'],
        'IMAGE': candidate['image'], 'IMAGE_ID': candidate['imageId'], 'BACKUP': backup,
        'OTHER_CONTAINERS': before['otherContainers'], 'SNAPSHOT': snapshot,
    }.items()) + '\n'
    common = '''import pathlib,subprocess,json,hashlib,shutil,os,re
os.umask(0o077)
root=pathlib.Path('/opt/purama/apps/sutra');snapshot=pathlib.Path(SNAPSHOT)
def inspect(name):return json.loads(subprocess.check_output(['docker','inspect',name]))[0]
def checked(argv):
 r=subprocess.run(argv,capture_output=True)
 assert r.returncode==0,'COMMAND_FAILED'
'''
    receipt = remote(constants + common + '''x=inspect('purama-sutra')
assert x['Image']==OLD_IMAGE and x['Config']['Labels']['dev.purama.commit']==PREVIOUS
assert x['State']['Health']['Status']=='healthy'
assert x['Config']['Labels']['com.docker.compose.project.config_files']==str(root/'compose.yml')
runtime=dict(line.split('=',1) for line in (root/'runtime/.env').read_text().splitlines() if '=' in line and not line.lstrip().startswith('#'))
assert runtime.get('SALAD_ENABLED','').strip().strip(chr(34)).strip(chr(39)).lower() not in ('true','1','yes')
assert (root/'runtime/.env').stat().st_mode&0o777==0o600
assert all(hashlib.sha256((pathlib.Path(BACKUP['directory'])/n).read_bytes()).hexdigest()==v['sha256'] for n,v in BACKUP['artifacts'].items())
assert subprocess.check_output(['docker','image','inspect','--format={{.Id}}',IMAGE],text=True).strip()==IMAGE_ID
assert subprocess.check_output(['docker','image','inspect','--format={{index .Config.Labels "dev.purama.commit"}}',IMAGE],text=True).strip()==SHA
snapshot.mkdir(mode=0o700)
for source,target in [(root/'compose.yml',snapshot/'compose.yml'),(root/'runtime/.env',snapshot/'runtime.env')]:
 shutil.copy2(source,target);target.chmod(0o600);assert source.read_bytes()==target.read_bytes()
(snapshot/'complete').touch(mode=0o600,exist_ok=False)
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
        result = remote(constants + common + '''assert inspect('purama-sutra')['Image']==OLD_IMAGE
assert (root/'compose.yml').read_bytes()==(snapshot/'compose.yml').read_bytes()
assert (root/'runtime/.env').read_bytes()==(snapshot/'runtime.env').read_bytes()
old=(root/'compose.yml').read_text();new,n=re.subn(r'(?m)^    image: .*$', '    image: '+IMAGE,old);assert n==1
assert 'traefik.http.routers.sutra.tls.certresolver: mytlschallenge' in new
staged=root/('compose.promotion-'+SHA+'.yml')
with staged.open('x') as f:f.write(new)
staged.chmod(0o600)
checked(['docker','compose','--project-directory',str(root),'-f',str(staged),'config','-q'])
os.replace(staged,root/'compose.yml')
checked(['docker','compose','-f',str(root/'compose.yml'),'up','-d','--no-deps','--pull','never','sutra'])
assert (root/'runtime/.env').read_bytes()==(snapshot/'runtime.env').read_bytes()
print(json.dumps({'status':'PASS','runtimeUnchanged':True,'databaseChanged':False}))
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
        result = subprocess.run([sys.executable, str(PROOF / 'run-authenticated.py')], cwd=ROOT, capture_output=True, timeout=240)
        assert result.returncode == 0, 'AUTHENTICATED_SMOKE_FAILED'
        receipt = remote(constants + common + '''x=inspect('purama-sutra')
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
    except BaseException:
        if promoted:
            receipt = remote(constants + common + '''assert (snapshot/'complete').is_file()
assert (root/'runtime/.env').read_bytes()==(snapshot/'runtime.env').read_bytes()
shutil.copy2(snapshot/'compose.yml',root/'compose.yml')
checked(['docker','compose','-f',str(root/'compose.yml'),'up','-d','--no-deps','--pull','never','sutra'])
print(json.dumps({'status':'RESTORED','image':OLD_IMAGE,'databaseChanged':False}))
''')
            for attempt in range(18):
                state = remote(constants + common + "x=inspect('purama-sutra');print(json.dumps({'image':x['Image'],'health':x['State']['Health']['Status']}))")
                if state['image'] == before['imageId'] and state['health'] == 'healthy':
                    receipt['health'] = 'healthy'
                    break
                time.sleep(5)
            record('automatic-rollback', receipt)
            assert receipt.get('health') == 'healthy', 'ROLLBACK_HEALTH_UNCONFIRMED'
        raise RuntimeError('PROMOTION_FAILED_REVIEW_REDACTED_RECEIPTS') from None


if __name__ == '__main__':
    main()
