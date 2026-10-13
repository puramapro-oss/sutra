"""Invoked with a private stdin payload. Never print secret values or exceptions."""
import datetime
import json
import os
import pathlib
import re
import shutil
import subprocess
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path('/opt/purama/apps/sutra')
IMAGE = 'sha256:b0750d6f7552940017a0fcd06422304cafdde0d49aead7bc6e11af98b7d65a16'
KEYS = ('RUNPOD_API_KEY', 'RUNPOD_ENDPOINT_ID', 'SHOTSTACK_API_KEY', 'SHOTSTACK_PRODUCTION_KEY')
GATE = 'start'


def command(args, data=None):
    p = subprocess.run(args, input=data, text=True, capture_output=True, timeout=180)
    if p.returncode:
        raise RuntimeError('SUBPROCESS_FAILED')
    return p.stdout


def inspect():
    return json.loads(command(['docker', 'inspect', 'purama-sutra']))[0]


def runtime_values(container):
    return dict(v.split('=', 1) for v in container['Config']['Env'] if '=' in v)


def sql(statement):
    return json.loads(command(['docker', 'exec', '-i', 'supabase-db', 'psql', '-XqAt', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], statement))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


def discover_binding(values, master):
    global GATE
    GATE = 'zernio_master_runtime_equality'
    assert values.get('ZERNIO_API_KEY') == master['ZERNIO_API_KEY']
    assert values.get('ZERNIO_BASE_URL', 'https://zernio.com/api/v1').rstrip('/') == 'https://zernio.com/api/v1'
    request = urllib.request.Request('https://zernio.com/api/v1/profiles', headers={'Authorization': 'Bearer ' + master['ZERNIO_API_KEY']}, method='GET')
    with urllib.request.build_opener(NoRedirect).open(request, timeout=18) as response:
        assert response.status == 200
        body = json.loads(response.read(1048577))
    GATE = 'user_confirmed_organization_profile_ownership'
    # User explicitly confirmed this master credential's organization PURAMA.
    # Zernio names the initial profile Default: prove owner equality, never
    # infer organization from a display name or choose an arbitrary profile.
    profiles = body['profiles']
    assert len(profiles) == 1
    profile = profiles[0]
    assert re.fullmatch('[a-f0-9]{24}', profile.get('_id', ''))
    assert profile.get('name') in ('Default', 'PURAMA')
    request = urllib.request.Request('https://zernio.com/api/v1/users', headers={'Authorization': 'Bearer ' + master['ZERNIO_API_KEY']}, method='GET')
    with urllib.request.build_opener(NoRedirect).open(request, timeout=18) as response:
        assert response.status == 200
        team = json.loads(response.read(1048577))
    owners = [u for u in team['users'] if u.get('_id') == team.get('currentUserId') and u.get('role') == 'owner']
    assert len(owners) == 1 and profile.get('userId') == owners[0]['_id']
    # Exact user-confirmed email; read-only shared-auth and SUTRA profile lookup.
    GATE = 'server_auth_profile_identity'
    identity = sql("SELECT json_build_object('users',(SELECT json_agg(json_build_object('id',u.id,'confirmed',u.email_confirmed_at IS NOT NULL,'sutraProfileExists',p.id IS NOT NULL,'profileEmailMatches',lower(p.email)=lower(u.email),'plan',p.plan)) FROM auth.users u LEFT JOIN sutra.profiles p ON p.id=u.id WHERE lower(u.email)='matiss.frasne@gmail.com')); ")
    assert len(identity['users'] or []) == 1
    user = identity['users'][0]
    assert user['confirmed'] and user['sutraProfileExists'] and user['profileEmailMatches']
    bindings = json.loads(values.get('ZERNIO_PROFILE_BINDINGS') or '{}')
    assert isinstance(bindings, dict)
    assert all(re.fullmatch('[a-f0-9-]{36}', k) and re.fullmatch('[a-f0-9]{24}', v) for k, v in bindings.items())
    assert len(set(bindings.values())) == len(bindings)
    pid = profiles[0]['_id']
    assert bindings.get(user['id'], pid) == pid
    assert all(k == user['id'] or v != pid for k, v in bindings.items())
    bindings[user['id']] = pid
    return json.dumps(bindings, separators=(',', ':')), {'authIdentityUnique': True, 'confirmed': True, 'sutraProfileMatches': True, 'organization': 'PURAMA (user confirmed)', 'existingProfileName': profile['name'], 'existingProfileUnique': True, 'currentOwnerOwnsProfile': True, 'plan': user['plan'], 'bindingCount': len(bindings)}


def patch_bytes(before, values):
    text = before.decode()
    for key, value in values.items():
        assert not any(c in value for c in "\r\n'\x00")
        pattern = re.compile(r'^(?:export\s+)?' + re.escape(key) + r'\s*=.*$', re.M)
        assert len(pattern.findall(text)) <= 1
        line = key + "='" + value + "'"
        if pattern.search(text):
            text = pattern.sub(lambda _: line, text)
        else:
            text += ('\n' if text and not text.endswith('\n') else '') + line + '\n'
    return text.encode()


def atomic_write(path, data):
    temporary = path.with_name(path.name + '.t01-candidate')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'wb') as f:
        f.write(data)
        f.flush()
        os.fsync(f.fileno())
    os.replace(temporary, path)


def health():
    for _ in range(24):
        c = inspect()
        if c['State'].get('Health', {}).get('Status') == 'healthy':
            assert c['Image'] == IMAGE
            return c
        time.sleep(3)
    raise RuntimeError('HEALTH_FAILED')


def other_containers():
    rows = command(['docker', 'ps', '-a', '--format', '{{.Names}} {{.ID}}']).splitlines()
    return sorted(v for v in rows if not v.startswith('purama-sutra '))


def main(payload):
    global GATE
    master = payload['master']
    current = inspect()
    GATE = 'live_image_health'
    assert current['Image'] == IMAGE and current['State']['Health']['Status'] == 'healthy'
    GATE = 'compose_target'
    assert current['Config']['Labels']['com.docker.compose.project.config_files'] == str(ROOT / 'compose.yml')
    values = runtime_values(current)
    GATE = 'sutra_origins'
    assert all(values.get(k, '').rstrip('/') == 'https://sutra.purama.dev' for k in ('NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SITE_URL'))
    GATE = 'dedicated_pod_override'
    assert not values.get('RUNPOD_POD_URL'), 'DEDICATED_OVERRIDE_REQUIRES_REVIEW'
    binding, identity = discover_binding(values, master)
    changes = {k: master[k] for k in KEYS}
    changes['ZERNIO_PROFILE_BINDINGS'] = binding
    runtime = ROOT / 'runtime/.env'
    assert not runtime.is_symlink() and runtime.stat().st_mode & 0o077 == 0
    original = runtime.read_bytes()
    candidate = patch_bytes(original, changes)
    out = {'observedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'identity': identity,
           'imageUnchanged': current['Image'] == IMAGE, 'healthy': True, 'runtimeMode': oct(runtime.stat().st_mode & 0o777),
           'masterComparison': {k: values.get(k) == master[k] for k in KEYS}, 'originsPreserved': True,
           'changedVariables': [k for k, v in changes.items() if values.get(k) != v], 'zernioMasterMatchesRuntime': True,
           'localMode': {'enabled': values.get('LOCAL_ENGINE_ENABLED') == 'true', 'urlPresent': bool(values.get('LOCAL_VIDEO_API_URL'))}}
    if payload['action'] == 'preflight':
        # New credentials in this one process only; runtime file/container unchanged.
        probe_source = 'Object.assign(process.env,' + json.dumps(changes) + ');\n' + payload['probe']
        out['candidateProviders'] = json.loads(command(['docker', 'exec', '-i', 'purama-sutra', 'node', '--input-type=module'], probe_source))
        return {'report': out}
    before_others = other_containers()
    compose = (ROOT / 'compose.yml').read_bytes()
    snapshot = ROOT / ('rollback-provider-config-' + payload['stamp'])
    snapshot.mkdir(mode=0o700)
    for name, data in [('runtime.env', original), ('compose.yml', compose), ('candidate.runtime.env', candidate)]:
        fd = os.open(snapshot / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'wb') as f:
            f.write(data)
    assert (snapshot / 'runtime.env').read_bytes() == original
    # Compare-and-swap the complete runtime and image immediately before change.
    assert runtime.read_bytes() == original and (ROOT / 'compose.yml').read_bytes() == compose
    assert inspect()['Id'] == current['Id']
    rollback = 'NOT_NEEDED'
    try:
        GATE = 'activate_runtime_compare_and_swap'
        atomic_write(runtime, candidate)
        command(['docker', 'compose', '-f', str(ROOT / 'compose.yml'), 'config', '-q'])
        command(['docker', 'compose', '-f', str(ROOT / 'compose.yml'), 'up', '-d', '--no-deps', '--pull', 'never', '--force-recreate', 'sutra'])
        updated = health()
        GATE = 'activated_environment_preservation'
        after = runtime_values(updated)
        assert all(after.get(k) == v for k, v in changes.items())
        assert {k: v for k, v in values.items() if k not in changes} == {k: v for k, v in after.items() if k not in changes}
        assert other_containers() == before_others
        GATE = 'activated_smoke_and_provider_contracts'
        smoke = json.loads(command(['docker', 'exec', '-i', 'purama-sutra', 'node', '--input-type=module'], payload['smoke']))
        probe = json.loads(command(['docker', 'exec', '-i', 'purama-sutra', 'node', '--input-type=module'], payload['probe']))
        assert probe['pass']
        GATE = 'activated_log_error_check'
        logs = subprocess.run(['docker', 'logs', '--since', updated['State']['StartedAt'], 'purama-sutra'], capture_output=True, text=True)
        errors = sum(bool(re.search(r'uncaught|unhandled|out of memory|ECONNREFUSED|permission denied', line, re.I)) for line in (logs.stdout + logs.stderr).splitlines())
        assert errors == 0
        out.update({'runtimeAllSelectedMatchMaster': True, 'otherRuntimeValuesPreserved': True, 'otherContainersUnchanged': True,
                    'backup': str(snapshot), 'backupMode': '0700/0600', 'backupBytesVerified': True,
                    'containerHealthy': True, 'restarts': updated['RestartCount'], 'smoke': smoke, 'providers': probe, 'logErrorCount': errors,
                    'rollback': rollback, 'applicationCommit': updated['Config']['Labels'].get('dev.purama.commit')})
        return {'report': out, 'binding': binding}
    except Exception:
        atomic_write(runtime, original)
        assert (ROOT / 'compose.yml').read_bytes() == compose
        command(['docker', 'compose', '-f', str(ROOT / 'compose.yml'), 'up', '-d', '--no-deps', '--pull', 'never', '--force-recreate', 'sutra'])
        health()
        assert runtime.read_bytes() == original and other_containers() == before_others
        raise RuntimeError('ACTIVATION_FAILED_ROLLBACK_VERIFIED') from None
