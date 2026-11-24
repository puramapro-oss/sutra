import pathlib,json,subprocess,datetime,socket,ssl
p=pathlib.Path(__file__).resolve().parent
out={'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164','cloudflare':{'inference':'DNS-only: authoritative A resolves directly to OVH','apiConfiguration':'NOT_TESTED','dnsChanged':False},'dns':[]}
for server in ['rita.ns.cloudflare.com','viddy.ns.cloudflare.com','1.1.1.1','8.8.8.8']:
 for record in ['A','AAAA']:
  r=subprocess.run(['dig','@'+server,'sutra.purama.dev',record,'+short','+time=5','+tries=1'],capture_output=True,text=True,check=True);answers=r.stdout.strip().splitlines();assert answers==(['144.217.14.210'] if record=='A' else []);out['dns'].append({'server':server,'type':record,'answer':answers})
with socket.create_connection(('sutra.purama.dev',443),timeout=15) as raw:
 with ssl.create_default_context().wrap_socket(raw,server_hostname='sutra.purama.dev') as tls:
  cert=tls.getpeercert();out['tls']={'verified':True,'protocol':tls.version(),'issuer':cert['issuer'],'subjectAltName':cert['subjectAltName'],'notAfter':cert['notAfter']}
r=subprocess.run(['curl','--silent','--show-error','--max-time','20','--output','/dev/null','--write-out','%{http_code} %{ssl_verify_result}','https://sutra.purama.dev/login'],capture_output=True,text=True,check=True);assert r.stdout=='200 0';out['externalHttps']={'path':'/login','status':200,'sslVerifyResult':0}
(p/'dns-tls-final.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
