"""Bounded SUTRA configuration activation. Explicit user authorization 2026-10-14.

Secrets are captured only in memory, sent over SSH stdin, never argv/logs/reports.
Actions: preflight (read only), activate (only four master vars + verified binding).
"""
import datetime
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
KEYS = ('RUNPOD_API_KEY', 'RUNPOD_ENDPOINT_ID', 'SHOTSTACK_API_KEY', 'SHOTSTACK_PRODUCTION_KEY')
SSH = ['ssh', '-i', str(Path.home() / '.ssh/purama_vps_ed25519'), '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', 'root@144.217.14.210', 'python3 -']
SMOKE = """const out=[];for(const base of ['http://127.0.0.1:3000','https://sutra.purama.dev'])for(const [path,expected]of [['/',200],['/login',200],['/api/points',401],['/api/social/accounts',401],['/api/video/status/00000000-0000-0000-0000-000000000000',401]]){const r=await fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(15000)});await r.body?.cancel();out.push({surface:base.startsWith('https')?'public':'internal',path,http:r.status,expected});if(r.status!==expected)throw Error('SMOKE_STATUS')}process.stdout.write(JSON.stringify(out))"""


def main():
    action = sys.argv[1]
    assert action in ('preflight', 'activate')
    master_path = Path.home() / '.env.purama.master'
    assert not master_path.is_symlink() and master_path.stat().st_mode & 0o077 == 0
    p = subprocess.run(['node', '-e', "const fs=require('fs'),d=require('dotenv').parse(fs.readFileSync(process.env.HOME+'/.env.purama.master'));process.stdout.write(JSON.stringify(d))"], cwd=ROOT, capture_output=True, text=True)
    assert p.returncode == 0
    all_values = json.loads(p.stdout)
    normalized = [k for k in (*KEYS, 'ZERNIO_API_KEY') if all_values[k] != all_values[k].strip()]
    master = {k: all_values[k].strip() for k in (*KEYS, 'ZERNIO_API_KEY')}
    for k, v in master.items():
        assert isinstance(v, str) and re.fullmatch('[A-Za-z0-9_.-]{6,512}', v), 'SELECTED_MASTER_FORMAT'
    raw = master_path.read_text()
    assert all(len(re.findall(r'^(?:export\s+)?' + k + r'\s*=', raw, re.M)) == 1 for k in master)
    local = ROOT / '.env.local'
    assert not local.is_symlink()
    ignored = subprocess.run(['git', 'check-ignore', '-q', '.env.local'], cwd=ROOT, capture_output=True)
    assert ignored.returncode == 0
    old_local = local.read_bytes() if local.exists() else b''
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    payload = {'master': master, 'action': action, 'stamp': stamp, 'probe': (HERE / 'runtime-probe.mjs').read_text(), 'smoke': SMOKE}
    remote = (HERE / 'remote.py').read_text() + '\ntry:\n result=main(' + repr(payload) + ')\n print(json.dumps(result))\nexcept Exception as error:\n print(json.dumps({"failure":"ACTIVATION_FAILED_ROLLBACK_VERIFIED" if str(error)=="ACTIVATION_FAILED_ROLLBACK_VERIFIED" else "SAFE_OPERATION_FAILED", "kind":type(error).__name__,"gate":GATE}))\n'
    p = subprocess.run(SSH, input=remote, capture_output=True, text=True, timeout=600)
    assert p.returncode == 0, 'SSH_FAILED_NO_OUTPUT_EXPORTED'
    result = json.loads(p.stdout)
    if 'failure' in result:
        print(json.dumps(result))
        return 1
    report = result['report']
    report['masterSource'] = '~/.env.purama.master'
    report['masterMode'] = oct(master_path.stat().st_mode & 0o777)
    report['trimmedBoundaryWhitespace'] = normalized
    report['localConfigExisted'] = local.exists()
    if action == 'activate':
        # Local config mutation only after verified remote activation.
        spec = importlib.util.spec_from_file_location('sutra_activation_remote', HERE / 'remote.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        assert (local.read_bytes() if local.exists() else b'') == old_local
        selected = {k: master[k] for k in KEYS}
        selected['ZERNIO_PROFILE_BINDINGS'] = result['binding']
        updated = module.patch_bytes(old_local, selected)
        backup = ROOT.parent / ('.sutra-config-backup-' + stamp)
        backup.mkdir(mode=0o700)
        fd = os.open(backup / 'local.env.previous', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'wb') as f:
            f.write(old_local)
        module.atomic_write(local, updated)
        parsed = subprocess.run(['node', '-e', "const fs=require('fs'),d=require('dotenv').parse(fs.readFileSync('.env.local'));process.stdout.write(JSON.stringify(d))"], cwd=ROOT, capture_output=True, text=True)
        assert parsed.returncode == 0 and all(json.loads(parsed.stdout).get(k) == v for k, v in selected.items())
        report['local'] = {'selectedVariablesVerified': True, 'mode': oct(local.stat().st_mode & 0o777), 'backup': str(backup), 'otherBytesPreserved': True}
    serialized = json.dumps(report, indent=2) + '\n'
    assert not any(v in serialized for v in all_values.values() if isinstance(v, str) and len(v) >= 12)
    (HERE / (action + '.json')).write_text(serialized)
    print(serialized)
    return 0 if action == 'activate' or report['candidateProviders']['pass'] else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as error:
        print(json.dumps({'failure': 'SAFE_LOCAL_OPERATION_FAILED', 'kind': type(error).__name__}))
        sys.exit(1)
