"""Wake only previously accepted SUTRA social journals over local HTTP.

Uses the existing application's cron authorization. No video generation route,
provider credential, remote destination, or redirect is accepted here.
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def request_for(environment):
    url = environment.get('SUTRA_SOCIAL_WORKER_URL', '')
    secret = environment.get('CRON_SECRET', '')
    parsed = urllib.parse.urlsplit(url)
    if (parsed.scheme != 'http' or parsed.hostname not in ('127.0.0.1', '::1')
            or parsed.path != '/api/cron/social-worker' or parsed.query
            or parsed.fragment or parsed.username or parsed.password
            or not parsed.port or not 1 <= parsed.port <= 65535):
        raise ValueError('WORKER_ENDPOINT_INVALID')
    if (not secret.strip() or secret.strip().lower() in ('dev', 'undefined', 'null')
            or '\r' in secret or '\n' in secret):
        raise ValueError('WORKER_AUTH_UNAVAILABLE')
    return urllib.request.Request(url, data=b'', method='POST', headers={
        'Authorization': f'Bearer {secret}', 'Accept': 'application/json',
    })


def dispatch(environment, opener=None):
    request = request_for(environment)
    client = opener or urllib.request.build_opener(NoRedirect())
    with client.open(request, timeout=290) as response:
        if response.status != 200:
            raise RuntimeError('WORKER_UNCONFIRMED')
        body = response.read(65537)
        if len(body) > 65536:
            raise RuntimeError('WORKER_RECEIPT_INVALID')
        receipt = json.loads(body)
    if (type(receipt.get('processed')) is not int or not 0 <= receipt['processed'] <= 4
            or receipt.get('confirmed') is not True
            or not isinstance(receipt.get('receipts'), list)
            or len(receipt['receipts']) != receipt['processed']):
        raise RuntimeError('WORKER_RECEIPT_INVALID')
    # Do not copy user IDs, provider errors or credential-bearing URLs into logs.
    return {'status': 'PASS', 'processed': receipt['processed']}


def main():
    try:
        result = dispatch(os.environ)
    except Exception:
        print(json.dumps({'status': 'UNAVAILABLE'}))
        return 1
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == '__main__':
    sys.exit(main())
