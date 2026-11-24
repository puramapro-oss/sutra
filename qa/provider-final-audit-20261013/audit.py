#!/usr/bin/python3
"""Read-only provider audit. Never emit credentials, raw bodies or exception text.

Only the master file supplies credentials. Other configurations are comparison
inputs. HTTP is restricted to explicit non-generative GET endpoints, with no
redirect, no retry and bounded time/body. No account/OAuth flow is initiated.
"""
import datetime
import json
import pathlib
import re
import stat
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

NAMES = (
    'RUNPOD_API_KEY', 'RUNPOD_ENDPOINT_ID', 'RUNPOD_POD_URL',
    'SHOTSTACK_API_KEY', 'SHOTSTACK_PRODUCTION_KEY', 'SHOTSTACK_ENV',
    'SUNO_API_KEY', 'SUNO_BASE_URL', 'SUNO_API_BASE_URL',
    'ZERNIO_API_KEY', 'ZERNIO_BASE_URL', 'ZERNIO_WEBHOOK_SECRET',
    'NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_APP_URL',
)
HOSTS = {'rest.runpod.io', 'api.runpod.ai', 'api.shotstack.io', 'zernio.com', 'api.suno.ai'}


def read_config(path):
    values, counts = {}, {}
    if not path.is_file():
        return values, counts
    for line in path.read_text().splitlines():
        match = re.match(r'^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$', line)
        if not match or match[1] not in NAMES:
            continue
        name, value = match.groups()
        counts[name] = counts.get(name, 0) + 1
        if value[:1] in ('"', "'"):
            if len(value) < 2 or value[-1] != value[0]:
                raise ValueError('UNSUPPORTED_CONFIG_SYNTAX')
            double_quoted = value[0] == '"'
            value = value[1:-1]
            if double_quoted:
                value = value.replace('\\n', '\n').replace('\\r', '\r')
        else:
            value = re.split(r'\s+#', value, maxsplit=1)[0].strip()
        if '${' in value:
            raise ValueError('UNSUPPORTED_CONFIG_EXPANSION')
        values[name] = value
    if any(count > 1 for count in counts.values()):
        raise ValueError('DUPLICATE_SELECTED_VARIABLE')
    return values, counts


def compare(master, candidate):
    return [{
        'name': name, 'master_present': bool(master.get(name)),
        'candidate_present': bool(candidate.get(name)),
        'matches_master': master.get(name) == candidate.get(name) if name in master else None,
    } for name in NAMES]


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def get(url, key=None, header='Authorization'):
    if key and any(character in key for character in ('\n', '\r')):
        return {'result': 'INVALID_HEADER_CONTROL_CHARACTER', 'credentials_sent': False}, None
    parsed = urllib.parse.urlsplit(url)
    allowed_path = (
        parsed.hostname == 'rest.runpod.io' and parsed.path == '/v1/endpoints'
        or parsed.hostname == 'api.runpod.ai' and re.fullmatch(r'/v2/[A-Za-z0-9_-]+/health', parsed.path)
        or parsed.hostname == 'api.shotstack.io' and parsed.path in ('/edit/stage/templates', '/edit/v1/templates')
        or parsed.hostname == 'zernio.com' and parsed.path == '/api/v1/accounts'
        or parsed.hostname == 'api.suno.ai' and parsed.path == '/v1' and key is None
    )
    if (parsed.scheme != 'https' or parsed.hostname not in HOSTS or parsed.username
            or parsed.password or parsed.port or not allowed_path):
        return {'result': 'BLOCKED_ALLOWLIST'}, None
    headers = {'User-Agent': 'SUTRA-readonly-audit/1.0', 'Accept': 'application/json'}
    if key:
        headers[header] = 'Bearer ' + key if header == 'Authorization' else key
    info = {'method': 'GET', 'credentials_sent': bool(key), 'timeout_seconds': 18,
            'attempts': 1, 'redirects': False, 'tls_verified': True}
    try:
        response = urllib.request.build_opener(NoRedirect).open(
            urllib.request.Request(url, headers=headers, method='GET'), timeout=18)
    except urllib.error.HTTPError as error:
        response = error
    except Exception:
        return dict(info, result='TRANSPORT_FAILED'), None
    with response:
        info['http_status'] = response.status
        body = response.read(1048577)
    if len(body) > 1048576:
        return dict(info, result='BODY_LIMIT'), None
    try:
        data = json.loads(body)
    except (ValueError, UnicodeError):
        data = None
    info['json'] = data is not None
    normalized = body.decode('utf-8', errors='replace').lower()
    info['recognized_error'] = next((code for needle, code in (
        ('invalid api key', 'INVALID_API_KEY'), ('invalid or disabled', 'INVALID_OR_DISABLED'),
        ('forbidden', 'FORBIDDEN'), ('unauthorized', 'UNAUTHORIZED'),
    ) if needle in normalized), None)
    info['edge_challenge'] = any(term in normalized for term in ('cf-chl-', 'just a moment', 'attention required'))
    return info, data


def probes(master):
    result = {}
    key = master.get('RUNPOD_API_KEY')
    endpoint = master.get('RUNPOD_ENDPOINT_ID', '')
    if key:
        result['runpod_list'], data = get('https://rest.runpod.io/v1/endpoints', key)
        if result['runpod_list'].get('http_status') == 200 and isinstance(data, list):
            result['runpod_list']['endpoint_count'] = len(data)
            result['runpod_list']['configured_endpoint_found'] = any(isinstance(item, dict) and item.get('id') == endpoint for item in data)
        if re.fullmatch(r'[A-Za-z0-9_-]{1,200}', endpoint):
            result['runpod_health'], _ = get('https://api.runpod.ai/v2/' + endpoint + '/health', key)
        else:
            result['runpod_health'] = {'result': 'MISSING_OR_INVALID_ENDPOINT'}
    else:
        result['runpod_list'] = {'result': 'MISSING_MASTER_KEY'}
    for name in ('SHOTSTACK_API_KEY', 'SHOTSTACK_PRODUCTION_KEY'):
        for stage in ('stage', 'v1'):
            label = name.lower() + '_' + stage
            result[label] = get('https://api.shotstack.io/edit/' + stage + '/templates', master[name], 'x-api-key')[0] if master.get(name) else {'result': 'MISSING_MASTER_KEY'}
    result['suno'] = {'master_key_present': bool(master.get('SUNO_API_KEY')), 'auth_validated': False,
                      'reason': 'NO_VERIFIED_AUTH_CONTRACT', 'credentials_sent': False,
                      'base_matches_legacy_code_default': master.get('SUNO_BASE_URL') == 'https://api.suno.ai/v1',
                      'unused_alias_matches_base': master.get('SUNO_API_BASE_URL') == master.get('SUNO_BASE_URL')}
    if result['suno']['base_matches_legacy_code_default']:
        result['suno']['public_base'] = get('https://api.suno.ai/v1')[0]
    if master.get('ZERNIO_BASE_URL', 'https://zernio.com/api/v1').rstrip('/') != 'https://zernio.com/api/v1':
        result['zernio'] = {'result': 'UNRECOGNIZED_BASE_NO_CREDENTIAL_SENT'}
    elif master.get('ZERNIO_API_KEY'):
        result['zernio'], data = get('https://zernio.com/api/v1/accounts?page=1&limit=100', master['ZERNIO_API_KEY'])
        if result['zernio'].get('http_status') == 200 and isinstance(data, dict):
            accounts = data.get('accounts')
            if isinstance(accounts, list):
                result['zernio']['returned_account_count'] = len(accounts)
    else:
        result['zernio'] = {'result': 'MISSING_MASTER_KEY'}
    return result


def remote_audit(master):
    result = {'source': 'docker:purama-sutra', 'configuration_read_only': True}
    proc = subprocess.run(['docker', 'inspect', 'purama-sutra'], capture_output=True, timeout=15)
    if proc.returncode:
        return dict(result, result='DOCKER_INSPECT_FAILED')
    data = json.loads(proc.stdout)[0]
    values = dict(item.split('=', 1) for item in data.get('Config', {}).get('Env', []) if '=' in item)
    result['comparison'] = compare(master, values)
    result['running'] = data.get('State', {}).get('Running') is True
    result['health'] = data.get('State', {}).get('Health', {}).get('Status') in ('healthy',)
    image = data.get('Image', '')
    result['image_digest'] = image if re.fullmatch(r'sha256:[a-f0-9]{64}', image) else 'UNRECOGNIZED'
    result['runtime_files'] = []
    for path in sorted(pathlib.Path('/opt/purama/apps/sutra/runtime').glob('.env*')):
        if path.is_file():
            candidate, _ = read_config(path)
            result['runtime_files'].append({'source': 'runtime_config_' + str(len(result['runtime_files']) + 1),
                                            'mode': oct(stat.S_IMODE(path.stat().st_mode)),
                                            'comparison': compare(master, candidate)})
    result['master_probes_from_vps'] = probes(master)
    return result


def main():
    master_path = pathlib.Path.home() / '.env.purama.master'
    master, counts = read_config(master_path)
    normalization = []
    if sys.argv[1:] == ['--normalize-terminal-literal-newline']:
        # Explicit diagnostic projection only; never change the source file.
        for name in NAMES:
            value = master.get(name, '')
            if value.endswith('\n') and '\n' not in value[:-1] and '\r' not in value and '\\' not in value:
                master[name] = value[:-1]
                normalization.append(name)
            elif value.endswith('\\n') and '\\' not in value[:-2]:
                master[name] = value[:-2]
                normalization.append(name)
    elif sys.argv[1:]:
        raise ValueError('INVALID_ARGUMENT')
    result = {'timestamp_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'code_base': '48f2d5e9e45a2a49e267a8b5b3a57834b7bac1f4',
              'credential_source': '~/.env.purama.master',
              'diagnostic_projection_only': bool(normalization),
              'terminal_literal_newline_removed_in_memory': normalization,
              'master_mode': oct(stat.S_IMODE(master_path.stat().st_mode)),
              'variables': [{'name': name, 'present': bool(master.get(name)), 'occurrences': counts.get(name, 0)} for name in NAMES]}
    candidate_path = pathlib.Path.home() / 'purama/sutra/.env.local'
    candidate, _ = read_config(candidate_path)
    result['mac_config'] = {'source': '~/purama/sutra/.env.local',
                            'mode': oct(stat.S_IMODE(candidate_path.stat().st_mode)),
                            'comparison': compare(master, candidate)}
    result['master_probes_from_mac'] = probes(master)
    # Credentials travel only on SSH stdin. Never in argv, files or command text.
    source = pathlib.Path(__file__).read_text().rsplit("if __name__ == '__main__':", 1)[0]
    remote_code = source + '\ntry:\n print(json.dumps(remote_audit(' + repr(master) + ')))\nexcept Exception:\n print(json.dumps({"result":"REMOTE_AUDIT_FAILED"}))\n'
    proc = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
                           '-o', 'ConnectTimeout=8', 'purama-ovh', 'python3', '-'],
                          input=remote_code, capture_output=True, text=True, timeout=190)
    try:
        result['vps'] = json.loads(proc.stdout) if proc.returncode == 0 else {'result': 'SSH_FAILED'}
    except ValueError:
        result['vps'] = {'result': 'REMOTE_OUTPUT_INVALID'}
    serialized = json.dumps(result, indent=2)
    # Defense in depth: refuse the whole output if any credential could leak.
    secrets = [value for name, value in master.items() if re.search(r'KEY|SECRET|ENDPOINT_ID', name) and len(value) >= 6]
    if any(value in serialized for value in secrets):
        raise ValueError('OUTPUT_SECRET_CHECK_FAILED')
    print(serialized)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print(json.dumps({'result': 'AUDIT_FAILED_SAFE', 'details': 'not_logged'}))
        sys.exit(1)
