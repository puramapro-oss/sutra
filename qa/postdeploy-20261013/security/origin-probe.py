#!/usr/bin/env python3
"""Check the public same-origin CSRF boundary without a session or provider call."""
import datetime
import json
from pathlib import Path
import urllib.error
import urllib.request

base = 'https://sutra.purama.dev'
results = []
for origin, expected in [(base, 401), ('https://postdeploy.invalid', 403)]:
    request = urllib.request.Request(base + '/api/social/connect', method='POST',
        headers={'Origin': origin, 'Content-Type': 'application/json',
                 'User-Agent': 'SUTRA-postdeploy-negative-security/20261013'},
        data=b'{"platform":"youtube"}')
    try:
        response = urllib.request.urlopen(request, timeout=15)
    except urllib.error.HTTPError as exc:
        response = exc
    body = json.loads(response.read(256))
    result = {'origin': origin, 'expectedStatus': expected, 'status': response.status,
              'error': body.get('error'), 'pass': response.status == expected}
    results.append(result)
    print(json.dumps(result, ensure_ascii=False))
Path(__file__).with_name('origin-probe.json').write_text(json.dumps({
    'timestampUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'url': base+'/api/social/connect',
    'command': 'python3 qa/postdeploy-20261013/security/origin-probe.py',
    'cases': results,
}, indent=2, ensure_ascii=False)+'\n')
raise SystemExit(any(not r['pass'] for r in results))
