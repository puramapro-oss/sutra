#!/usr/bin/env python3
"""Public negative cron/OAuth probes only; never sends a real token or follows redirects."""
import datetime
import hashlib
import json
from pathlib import Path
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
BASE = 'https://sutra.purama.dev'
DEPLOYED_SHA = '86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164'
INVALID_AUTH = 'Bearer sutra-postdeploy-intentionally-invalid-20261013'

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

opener = urllib.request.build_opener(NoRedirect())
results = []

def probe(name, path, status, *, method='GET', headers=None, body=None, location=None, error=None):
    request_headers = {'User-Agent': 'SUTRA-postdeploy-negative-security/20261013', 'Accept': 'application/json'}
    request_headers.update(headers or {})
    req = urllib.request.Request(BASE + path, method=method, headers=request_headers, data=body)
    started = time.monotonic()
    item = {'name': name, 'method': method, 'path': path, 'expectedStatus': status}
    try:
        try:
            response = opener.open(req, timeout=20)
        except urllib.error.HTTPError as exc:
            response = exc
        received = response.read(4096)
        actual_location = response.headers.get('Location')
        item.update(status=response.status, durationMs=round((time.monotonic()-started)*1000),
                    redirectLocation=actual_location,
                    setCookie=bool(response.headers.get('Set-Cookie')))
        try:
            parsed = json.loads(received)
        except Exception:
            parsed = {}
        # Only persist an expected generic error, never arbitrary response data or cookies.
        if error is not None:
            item['errorMatches'] = parsed.get('error') == error
        item['pass'] = (response.status == status and
                        (location is None or actual_location == location) and
                        (error is None or parsed.get('error') == error))
    except Exception as exc:
        item.update(pass_=False, failureType=type(exc).__name__)
        item['pass'] = False
    results.append(item)
    print(f"{'PASS' if item['pass'] else 'FAIL'} {name}: {item.get('status', item.get('failureType'))}", flush=True)

cron_routes = []
for file in sorted((ROOT/'src/app/api/cron').glob('*/route.ts')):
    source = file.read_text()
    methods = re.findall(r'export async function (GET|POST)\(', source)
    if file.parent.name == 'auto-plan':
        methods = ['GET']
    if not methods:
        raise RuntimeError('Unreviewed cron route: ' + str(file))
    for method in methods:
        path = '/api/cron/' + file.parent.name
        cron_routes.append({'path': path, 'method': method, 'sourceSha256': hashlib.sha256(file.read_bytes()).hexdigest()})
        for authorization in (None, INVALID_AUTH):
            probe(f'cron {file.parent.name} {method} ' + ('missing' if authorization is None else 'invalid'), path, 401,
                  method=method, headers={} if authorization is None else {'Authorization': authorization}, error='Unauthorized')

callback_cases = [
    ('missing', '', 'missing_params'),
    ('denied', '?error=access_denied', 'missing_params'),
    ('missing-state', '?connected=youtube&profileId=aaaaaaaaaaaaaaaaaaaaaaaa&accountId=bbbbbbbbbbbbbbbbbbbbbbbb&platform=youtube', 'missing_params'),
    ('invalid-platform', '?connected=youtube&profileId=aaaaaaaaaaaaaaaaaaaaaaaa&accountId=bbbbbbbbbbbbbbbbbbbbbbbb&state=postdeploy-invalid-state&platform=postdeploy-invalid', 'invalid_platform'),
    ('no-session', '?connected=youtube&profileId=aaaaaaaaaaaaaaaaaaaaaaaa&accountId=bbbbbbbbbbbbbbbbbbbbbbbb&state=postdeploy-invalid-state&platform=youtube', 'session_required'),
    ('legacy-user-state', '?connected=youtube&profileId=aaaaaaaaaaaaaaaaaaaaaaaa&accountId=bbbbbbbbbbbbbbbbbbbbbbbb&state=00000000-0000-0000-0000-000000000000&platform=youtube', 'session_required'),
    ('redirect-in-state', '?connected=youtube&profileId=aaaaaaaaaaaaaaaaaaaaaaaa&accountId=bbbbbbbbbbbbbbbbbbbbbbbb&state=https%3A%2F%2Finvalid.example&platform=youtube', 'session_required'),
]
for label, query, reason in callback_cases:
    probe('social callback ' + label, '/api/social/callback'+query, 302,
          location=BASE+'/settings/social?error='+reason)
probe('social callback forwarded-host ignored', '/api/social/callback?error=access_denied', 302,
      headers={'X-Forwarded-Host':'postdeploy.invalid'}, location=BASE+'/settings/social?error=missing_params')
probe('social callback repeated invalid session', '/api/social/callback?connected=youtube&profileId=aaaaaaaaaaaaaaaaaaaaaaaa&accountId=bbbbbbbbbbbbbbbbbbbbbbbb&state=postdeploy-invalid-state&platform=youtube', 302,
      location=BASE+'/settings/social?error=session_required')
probe('social connect no session', '/api/social/connect', 401, method='POST',
      headers={'Content-Type':'application/json'}, body=b'{"platform":"youtube"}', error='Non autorisé')
probe('social connect malformed body no session', '/api/social/connect', 401, method='POST',
      headers={'Content-Type':'application/json'}, body=b'{', error='Non autorisé')
probe('social connect cross-origin', '/api/social/connect', 403, method='POST',
      headers={'Content-Type':'application/json','Origin':'https://postdeploy.invalid'}, body=b'{"platform":"youtube"}', error='Origine refusee')
probe('social connect disallowed method', '/api/social/connect', 405)
probe('auth callback missing code', '/auth/callback', 307, location=BASE+'/login?error=missing_code')
probe('auth callback external next rejected without code', '/auth/callback?next=https%3A%2F%2Fpostdeploy.invalid', 307,
      location=BASE+'/login?error=missing_code')
probe('auth callback forwarded-host ignored', '/auth/callback', 307,
      headers={'X-Forwarded-Host':'postdeploy.invalid'}, location=BASE+'/login?error=missing_code')

sources = ['src/lib/cron-auth.ts', 'src/app/api/social/connect/route.ts', 'src/app/api/social/callback/route.ts',
           'src/lib/social-oauth-state.ts', 'src/app/auth/callback/route.ts','src/lib/auth-navigation.ts','src/middleware.ts']
report = {
    'timestampUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'baseUrl': BASE, 'deployedSha': DEPLOYED_SHA,
    'worktreeHead': subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
    'command': 'python3 qa/final-delta-20261014/security-probe.py',
    'scope': 'Live unauthenticated negative paths only; no provider, valid token, valid OAuth code, account or database mutation.',
    'cronRoutes': cron_routes,
    'sourceHashes': {p: hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in sources},
    'results': results,
    'passed': sum(r['pass'] for r in results), 'failed': sum(not r['pass'] for r in results),
    'limits': ['OAuth successful provider exchange not invoked.', 'Cron authenticated work intentionally not invoked.',
               'OAuth atomic consumption/replay remains covered by unchanged CI; these live requests never have a valid session or state.',
               'Source inspection establishes pre-effect returns; no outbound packet capture performed.'],
}
(OUT/'public-negative-results.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'passed':report['passed'],'failed':report['failed'],'routes':len(cron_routes)}))
raise SystemExit(bool(report['failed']))
