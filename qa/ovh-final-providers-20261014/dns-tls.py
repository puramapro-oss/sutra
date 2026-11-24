"""Read-only authoritative DNS and ordinary TLS verification for SUTRA only."""
import datetime
import json
from pathlib import Path
import socket
import ssl
import subprocess

proof = Path(__file__).resolve().parent
host = 'sutra.purama.dev'
nameservers = subprocess.check_output(['dig', '+short', 'NS', 'purama.dev'], text=True).split()
assert nameservers and all(n.endswith('.ns.cloudflare.com.') for n in nameservers)
checks = []
for resolver in nameservers + ['1.1.1.1', '8.8.8.8']:
    answers = {}
    for record in ['A', 'AAAA']:
        values = subprocess.check_output(['dig', '@'+resolver, '+short', '+time=5', '+tries=1', record, host], text=True).split()
        answers[record] = values
    checks.append({'resolver':resolver,'answers':answers,'pass':answers['A']==['144.217.14.210'] and not answers['AAAA']})
with socket.create_connection((host,443),timeout=20) as sock:
    with ssl.create_default_context().wrap_socket(sock,server_hostname=host) as tls:
        cert=tls.getpeercert()
        san=[v for k,v in cert['subjectAltName'] if k=='DNS']
        expires=ssl.cert_time_to_seconds(cert['notAfter'])
        assert host in san and expires>datetime.datetime.now(datetime.timezone.utc).timestamp()+86400
        tls_result={'verified':True,'version':tls.version(),'sanMatches':True,'notAfter':cert['notAfter'],'issuer':cert['issuer']}
report={'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'host':host,'dns':checks,'tls':tls_result,
    'cloudflare':'Authoritative Cloudflare DNS points directly to OVH (DNS-only observed); no DNS/TLS change.',
    'cloudflareApi':'Not queried: no Cloudflare credential in the authorized master source.',
    'status':'PASS' if all(c['pass'] for c in checks) else 'FAIL'}
(proof/'dns-tls.json').write_text(json.dumps(report,indent=2)+'\n')
assert report['status']=='PASS'
print('DNS_TLS_PASS')
