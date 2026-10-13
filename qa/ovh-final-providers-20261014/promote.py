"""One-shot SUTRA-only release. Secrets travel over SSH stdin, never argv/logs.

Preconditions: exact CI, committed manifest, isolated candidate, restored backup.
Rollback restores Compose/runtime only; the additive OAuth table is retained.
"""
import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
import shlex
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
PROOF = Path(__file__).resolve().parent
SHA = 'e3b17117256269e281304cd4ab83bc722a6f7894'
PREVIOUS = 'f770e272d2d8e3bb3dde5b523fe7aa37f122399d'
sys.path.insert(0, str(ROOT / 'deploy'))
import ovh

assert hashlib.sha256(ovh.HELPER.read_bytes()).hexdigest() == ovh.HELPER_SHA256
spec = importlib.util.spec_from_file_location('sutra_helper', ovh.HELPER)
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
ssh = ['ssh', '-i', str(helper.SSH_KEY), '-o', 'IdentitiesOnly=yes', '-o',
       'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', helper.REMOTE]
ci = json.loads(subprocess.check_output(['gh', 'run', 'view', '38475022601',
    '--json', 'headSha,status,conclusion,jobs,url'], cwd=ROOT))
assert ci['headSha'] == SHA and ci['status'] == 'completed' and ci['conclusion'] == 'success'
assert len(ci['jobs']) == 3 and all(j['conclusion'] == 'success' for j in ci['jobs'])
(PROOF / 'ci-final.json').write_text(json.dumps(ci, indent=2) + '\n')
manifest = json.loads((ROOT / 'qa/final-integration-20261013/tested-source-manifest.json').read_text())
for item in manifest['files']:
    data = subprocess.check_output(['git', 'show', SHA + ':' + item['path']], cwd=ROOT)
    assert hashlib.sha256(data).hexdigest() == item['sha256']
candidate = json.loads((PROOF / 'candidate.json').read_text())
backup = json.loads((PROOF / 'backup-restore.json').read_text())
restored = json.loads((PROOF / 'oauth-restored-check.json').read_text())
before = json.loads((PROOF / 'readonly-preflight.json').read_text())
assert candidate['source'] == SHA and candidate['status'] == 'PASS' and candidate['network'] == 'none'
assert backup['rowCountsMatch'] and backup['restoredTables'] == 140
assert restored['status'] == 'PASS' and restored['backupHashesMatch']
assert before['source'] == PREVIOUS and before['health'] == 'healthy'
migration = subprocess.check_output(['git', 'show', SHA + ':migrations/20261011_social_oauth_state.sql'], cwd=ROOT).decode()
assert hashlib.sha256(migration.encode()).hexdigest() == backup['migrations'][0]['sha256']
assert backup['migrations'][0]['applications'] == 2
# Whitelist one necessary configuration value. No key/origin is synchronized.
master_value = json.loads(subprocess.check_output(['node', '-e',
    "const fs=require('fs'),d=require('dotenv').parse(fs.readFileSync(process.env.HOME+'/.env.purama.master'));process.stdout.write(JSON.stringify((d.SUNO_API_BASE_URL||'').trim()));"], cwd=ROOT))
assert master_value.rstrip('/') == 'https://api.sunoapi.org/api/v1'
snapshot = ovh.REMOTE_ROOT + '/rollback-' + SHA
remote_prepare = '''import pathlib,subprocess,json,hashlib,shutil,os
os.umask(0o077)
root=pathlib.Path('/opt/purama/apps/sutra');snapshot=root/('rollback-'+SHA)
x=json.loads(subprocess.check_output(['docker','inspect','purama-sutra']))[0]
assert x['Image']==OLD_IMAGE and x['Config']['Labels']['dev.purama.commit']==PREVIOUS
assert x['State']['Health']['Status']=='healthy'
assert x['Config']['Labels']['com.docker.compose.project.config_files']==str(root/'compose.yml')
assert all(hashlib.sha256((pathlib.Path(BACKUP['directory'])/n).read_bytes()).hexdigest()==v['sha256'] for n,v in BACKUP['artifacts'].items())
assert subprocess.check_output(['docker','image','inspect','--format={{.Id}}',IMAGE],text=True).strip()==IMAGE_ID
assert subprocess.check_output(['docker','image','inspect','--format={{index .Config.Labels "dev.purama.commit"}}',IMAGE],text=True).strip()==SHA
snapshot.mkdir(mode=0o700)
shutil.copy2(root/'compose.yml',snapshot/'compose.yml');shutil.copy2(root/'runtime/.env',snapshot/'runtime.env')
for p in snapshot.iterdir():p.chmod(0o600)
(snapshot/'complete').touch(mode=0o600,exist_ok=False)
raw=(snapshot/'runtime.env').read_bytes()
assert not any(line.startswith(b'SUNO_API_BASE_URL=') for line in raw.splitlines())
with (snapshot/'candidate.runtime.env').open('xb') as file:file.write(raw+b'\\nSUNO_API_BASE_URL='+NEW_URL.encode()+b'\\n')
(snapshot/'candidate.runtime.env').chmod(0o600)
print(json.dumps({'snapshot':str(snapshot),'status':'PASS','changedVariables':['SUNO_API_BASE_URL'],'source':'~/.env.purama.master','existingBytesPreserved':True,'mode':'0700/0600'}))
'''
payload = ('SHA=' + repr(SHA) + '\nPREVIOUS=' + repr(PREVIOUS) + '\nOLD_IMAGE=' + repr(before['imageId']) +
    '\nIMAGE=' + repr(candidate['image']) + '\nIMAGE_ID=' + repr(candidate['imageId']) +
    '\nBACKUP=' + repr(backup) + '\nNEW_URL=' + repr(master_value) + '\n' + remote_prepare)
result = subprocess.run(ssh + ['python3 -'], input=payload, text=True, capture_output=True)
assert result.returncode == 0, 'SNAPSHOT_PREPARATION_FAILED_NO_PROMOTION'
(PROOF / 'snapshot.json').write_text(json.dumps(json.loads(result.stdout), indent=2) + '\n')
del payload, master_value
# Verify both new runtime and rollback image in new, network-isolated containers.
probe = """(async()=>{const out=[];for(const [path,status] of [['/',200],['/login',200],['/api/points',401],['/api/video/status/00000000-0000-0000-0000-000000000000',401],['/api/media/b3duZXJzL3UvdGVzdC5tcDQ',401]]){const r=await fetch('http://127.0.0.1:3000'+path,{redirect:'manual',signal:AbortSignal.timeout(15000)});if(r.status!==status)throw Error('SMOKE_FAILED');out.push({path,status:r.status});}console.log(JSON.stringify(out));})().catch(()=>process.exit(1))"""
for label, image, runtime in [('candidate-runtime', candidate['image'], 'candidate.runtime.env'), ('rollback-runtime', before['imageId'], 'runtime.env')]:
    name = 'sutra-' + label + '-' + SHA[:12]
    helper.ssh('docker run -d --network none --name ' + name + ' --env-file ' + snapshot + '/' + runtime + ' ' + image + ' >/dev/null')
    try:
        for attempt in range(15):
            try:
                response = helper.ssh('docker exec ' + name + ' node -e ' + shlex.quote(probe), capture=True)
                checks = json.loads(response.stdout)
                break
            except subprocess.CalledProcessError:
                if attempt == 14: raise
                time.sleep(2)
        (PROOF / (label + '.json')).write_text(json.dumps({'status':'PASS','image':image,'network':'none','checks':checks}, indent=2) + '\n')
    finally:
        helper.ssh('docker stop ' + name + ' >/dev/null')
print('SNAPSHOT_AND_ISOLATED_ROLLBACK_PASS', flush=True)
promoted = False
try:
    schema_sql = (PROOF / 'oauth-schema-check.sql').read_text()
    remote_migrate = '''import pathlib,subprocess,json,hashlib,os
root=pathlib.Path('/opt/purama/apps/sutra');s=root/('rollback-'+SHA)
assert (root/'compose.yml').read_bytes()==(s/'compose.yml').read_bytes()
assert (root/'runtime/.env').read_bytes()==(s/'runtime.env').read_bytes()
base=['docker','exec','-i','supabase-db','psql','-XqAt','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1']
assert subprocess.check_output(base+['-c',"SELECT to_regclass('sutra.social_oauth_states') IS NULL"],text=True).strip()=='t'
with (s/'migration-private.log').open('wb') as log:
 r=subprocess.run(base,input=("SET lock_timeout='5s'; SET statement_timeout='30s';\\n"+MIGRATION+"\\nNOTIFY pgrst, 'reload schema';").encode(),stdout=log,stderr=log)
assert r.returncode==0,'ADDITIVE_MIGRATION_FAILED'
checks=json.loads(subprocess.check_output(base+['-c',CHECK_SQL],text=True));assert all(checks.values())
print(json.dumps({'status':'PASS','checks':checks,'migrationSha256':hashlib.sha256(MIGRATION.encode()).hexdigest(),'additiveOnly':True,'rowsModified':0,'rollbackPolicy':'Retain additive table; never restore old database over current writes.'}))
'''
    payload = 'SHA='+repr(SHA)+'\nMIGRATION='+repr(migration)+'\nCHECK_SQL='+repr(schema_sql)+'\n'+remote_migrate
    result = subprocess.run(ssh + ['python3 -'], input=payload, text=True, capture_output=True)
    assert result.returncode == 0, 'PRODUCTION_SCHEMA_GATE_FAILED'
    (PROOF / 'migration-production.json').write_text(json.dumps(json.loads(result.stdout), indent=2) + '\n')
    remote_promote = '''import pathlib,subprocess,re,os
root=pathlib.Path('/opt/purama/apps/sutra');s=root/('rollback-'+SHA)
assert (root/'compose.yml').read_bytes()==(s/'compose.yml').read_bytes()
assert (root/'runtime/.env').read_bytes()==(s/'runtime.env').read_bytes()
assert subprocess.check_output(['docker','inspect','--format={{.Image}}','purama-sutra'],text=True).strip()==OLD_IMAGE
assert subprocess.check_output(['docker','image','inspect','--format={{.Id}}',IMAGE],text=True).strip()==IMAGE_ID
old=(root/'compose.yml').read_text();new,n=re.subn(r'(?m)^    image: .*$', '    image: '+IMAGE,old);assert n==1
assert 'traefik.http.routers.sutra.tls.certresolver: mytlschallenge' in new
staged=root/('compose.promotion-'+SHA+'.yml')
with staged.open('x') as f:f.write(new)
staged.chmod(0o600)
subprocess.run(['docker','compose','--project-directory',str(root),'-f',str(staged),'config','-q'],check=True)
runtime=root/'runtime'/('promotion-'+SHA+'.env')
with runtime.open('xb') as f:f.write((s/'candidate.runtime.env').read_bytes())
runtime.chmod(0o600);os.replace(runtime,root/'runtime/.env');os.replace(staged,root/'compose.yml')
subprocess.run(['docker','compose','-f',str(root/'compose.yml'),'up','-d','--no-deps','--pull','never','sutra'],check=True)
'''
    promoted = True # A partial Compose/runtime write must also invoke rollback.
    payload = 'SHA='+repr(SHA)+'\nOLD_IMAGE='+repr(before['imageId'])+'\nIMAGE='+repr(candidate['image'])+'\nIMAGE_ID='+repr(candidate['imageId'])+'\n'+remote_promote
    result = subprocess.run(ssh + ['python3 -'], input=payload, text=True, capture_output=True)
    assert result.returncode == 0, 'COMPOSE_PROMOTION_FAILED'
    for attempt in range(18):
        status = helper.ssh("docker inspect --format='{{.State.Health.Status}}' purama-sutra", capture=True).stdout.strip()
        if status == 'healthy': break
        time.sleep(5)
    else: raise RuntimeError('NEW_IMAGE_UNHEALTHY')
    actual = helper.ssh("docker inspect --format='{{.Image}}' purama-sutra", capture=True).stdout.strip()
    assert actual == candidate['imageId']
    ovh.smoke(helper)
    ovh.smoke(helper, public=True)
    origin_probe = (ROOT / 'qa/postdeploy-20261013/root/origin-runtime-probe.cjs.txt').read_text()
    for label, base in [('internal','http://127.0.0.1:3000'),('public','https://sutra.purama.dev')]:
        response = helper.ssh('docker exec purama-sutra node -e '+shlex.quote(origin_probe)+' '+shlex.quote(base),capture=True)
        check = json.loads(response.stdout); assert check['passed']==14 and check['failed']==0
        (PROOF / ('origin-'+label+'.json')).write_text(json.dumps(check,indent=2)+'\n')
    sql = (ROOT / 'qa/deployment-20261013/permissions-live-check.sql').read_text()
    response = helper.ssh('docker exec supabase-db psql -XqAt -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c '+shlex.quote(sql),capture=True)
    checks = json.loads(response.stdout); assert len(checks)==120 and all(checks.values())
    (PROOF / 'permissions-production.json').write_text(json.dumps(checks,indent=2)+'\n')
    db_probe = (ROOT / 'qa/deployment-20261013/supabase-readonly-smoke.mjs').read_text().replace('const cases=[','const cases=[["sutra", "social_oauth_states"],')
    response = helper.ssh('docker exec purama-sutra node -e '+shlex.quote(db_probe),capture=True)
    check = json.loads(response.stdout);assert len(check['checks'])==36 and all(c['status']==200 for c in check['checks'])
    (PROOF / 'supabase-readonly.json').write_text(json.dumps(check,indent=2)+'\n')
    for command in [['python3',str(PROOF/'security-probe.py')],['node',str(PROOF/'public-browser.cjs')],
                    ['node',str(PROOF/'media-smoke.mjs')],['python3',str(PROOF/'dns-tls.py')]]:
        result = subprocess.run(command,cwd=ROOT,capture_output=True,text=True)
        assert result.returncode==0,'POSTPROMOTION_PUBLIC_GATE_FAILED'
    result = subprocess.run(ssh + ['python3 -'], input=(PROOF/'operations-final.py.txt').read_text(),
                            text=True, capture_output=True)
    assert result.returncode == 0, 'POSTPROMOTION_OPERATIONS_GATE_FAILED'
    (PROOF/'operations-final.json').write_text(json.dumps(json.loads(result.stdout),indent=2)+'\n')
    report={'source':SHA,'previous':PREVIOUS,'image':candidate['image'],'imageId':actual,'health':status,
        'rollbackSnapshot':snapshot,'backup':backup['directory'],'changedVariables':['SUNO_API_BASE_URL'],
        'migration':'20261011_social_oauth_state.sql','paidCalls':0,'publicationCalls':0,
        'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'PASS'}
    (PROOF/'deployment.json').write_text(json.dumps(report,indent=2)+'\n')
    print('PROMOTION_PASS '+SHA)
except BaseException:
    if promoted:
        ovh.restore_previous(helper,snapshot)
        (PROOF/'automatic-rollback.json').write_text(json.dumps({'source':SHA,'rollback':'PASS','additiveTableRetained':True})+'\n')
    raise
