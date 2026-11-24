"""Install the existing read-only observer after an exact successful promotion.

This operational receipt driver never calls an application or provider endpoint.
An uncertain SSH outcome must be reconciled from the protected remote receipt.
"""
import argparse
import json
from pathlib import Path
import re
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source-ref', required=True)
args = parser.parse_args()
assert re.fullmatch('[0-9a-f]{40}', args.source_ref)
deployment = json.loads((ROOT / 'qa/t01-final-20261015/deployment.json').read_text())
assert deployment['status'] == 'PASS' and deployment['source'] == args.source_ref
files = {}
for name, target in (
    ('scheduler_observer.py', '/opt/purama/apps/sutra/ops/scheduler_observer.py'),
    ('scheduler-observer.service', '/etc/systemd/system/purama-sutra-observer.service'),
    ('scheduler-observer.timer', '/etc/systemd/system/purama-sutra-observer.timer'),
):
    data = subprocess.check_output(['git', 'show', args.source_ref + ':deploy/' + name], cwd=ROOT).decode()
    if name.endswith('.service'):
        previous = '86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164'
        assert data.count(previous) == 1
        data = data.replace(previous, args.source_ref)
    files[target] = data
remote = 'SHA=' + repr(args.source_ref) + '\nFILES=' + repr(files) + '\n' + r'''
import datetime,fcntl,hashlib,json,os,pathlib,subprocess
os.umask(0o077)
root=pathlib.Path('/opt/purama/apps/sutra')
fd=os.open(root/'.deployment.lock',os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600)
fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
snapshot=root/('observer-install-'+SHA)
receipt={'source':SHA,'status':'PREPARING','dispatchEnabled':False,'generationCalls':0,'publicationCalls':0}
installed=False
try:
    live=json.loads(subprocess.check_output(['docker','inspect','purama-sutra']))[0]
    assert live['Config']['Labels']['dev.purama.commit']==SHA
    assert live['State']['Running'] and live['State']['Health']['Status']=='healthy'
    assert (root/('rollback-'+SHA)).is_dir()
    for target in FILES:
        assert not pathlib.Path(target).exists() and not pathlib.Path(target).is_symlink()
    for unit in ['purama-sutra-observer.service','purama-sutra-observer.timer']:
        state=subprocess.run(['systemctl','show',unit,'--property=LoadState','--value'],capture_output=True,text=True,timeout=10)
        assert state.stdout.strip()=='not-found'
    snapshot.mkdir(mode=0o700)
    (snapshot/'prior-state.json').write_text(json.dumps({'filesAbsent':list(FILES),'unitsAbsent':True}))
    assert not (root/'ops').is_symlink()
    (root/'ops').mkdir(mode=0o700,exist_ok=True)
    assert (root/'ops').is_dir() and (root/'ops').stat().st_uid==0
    receipt['files']={}
    for target,data in FILES.items():
        with pathlib.Path(target).open('x') as out: out.write(data)
        os.chmod(target,0o600)
        receipt['files'][target]=hashlib.sha256(pathlib.Path(target).read_bytes()).hexdigest()
    installed=True
    check=subprocess.run(['systemd-analyze','verify','/etc/systemd/system/purama-sutra-observer.service','/etc/systemd/system/purama-sutra-observer.timer'],capture_output=True,timeout=30)
    assert check.returncode==0
    for argv in [['systemctl','daemon-reload'],['systemctl','start','purama-sutra-observer.service']]:
        check=subprocess.run(argv,capture_output=True,timeout=50);assert check.returncode==0
    state=subprocess.run(['systemctl','show','purama-sutra-observer.service','--property=Result','--property=ExecMainStatus'],capture_output=True,text=True,timeout=10)
    assert state.returncode==0 and 'Result=success' in state.stdout and 'ExecMainStatus=0' in state.stdout
    journal=subprocess.run(['journalctl','-u','purama-sutra-observer.service','-n','10','-o','cat','--no-pager'],capture_output=True,text=True,timeout=10)
    observations=[]
    for line in journal.stdout.splitlines():
        if line.startswith('{'):
            value=json.loads(line)
            if value.get('mode')=='observe-only' and value.get('source')==SHA: observations.append(value)
    assert observations and observations[-1]['status']=='PASS'
    receipt['firstObservation']=observations[-1]
    check=subprocess.run(['systemctl','enable','--now','purama-sutra-observer.timer'],capture_output=True,timeout=30)
    assert check.returncode==0
    for verb in ['is-enabled','is-active']:
        check=subprocess.run(['systemctl',verb,'purama-sutra-observer.timer'],capture_output=True,text=True,timeout=10)
        assert check.returncode==0
        receipt[verb]=check.stdout.strip()
    receipt.update(status='PASS',mode='observe-only',interval='5min',snapshot=str(snapshot),observedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
except Exception:
    receipt['status']='FAIL'
    if installed:
        stop=subprocess.run(['systemctl','disable','--now','purama-sutra-observer.timer'],capture_output=True,timeout=30)
        receipt['timerDisabledAfterFailure']=stop.returncode==0
finally:
    if snapshot.is_dir(): (snapshot/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt))
'''
try:
    result = subprocess.run(['ssh', '-i', str(Path.home() / '.ssh/purama_vps_ed25519'),
        '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
        'root@144.217.14.210', 'python3', '-'], input=remote, capture_output=True, text=True, timeout=200)
    assert result.returncode == 0
    receipt = json.loads(result.stdout)
except Exception:
    raise SystemExit('OBSERVER_OUTCOME_UNKNOWN_INSPECT_PROTECTED_RECEIPT_NO_RETRY') from None
(HERE / 'scheduler-installed.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt))
raise SystemExit(receipt['status'] != 'PASS')
