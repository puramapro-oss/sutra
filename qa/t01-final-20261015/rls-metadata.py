"""Read-only metadata proof for six SUTRA tables flagged by T02."""
import datetime
import json
from pathlib import Path
import subprocess

SQL = """BEGIN READ ONLY;
SET LOCAL statement_timeout='5000ms';
SELECT coalesce(json_agg(x),'[]'::json) FROM (
 SELECT c.relname AS table_name,c.relrowsecurity AS rls_enabled,c.relforcerowsecurity AS force_rls,
 r.rolname AS role_name,
 has_table_privilege(r.oid,c.oid,'SELECT') AS table_select,
 has_any_column_privilege(r.oid,c.oid,'SELECT') AS any_column_select,
 has_table_privilege(r.oid,c.oid,'INSERT') AS table_insert,
 has_any_column_privilege(r.oid,c.oid,'INSERT') AS any_column_insert,
 has_table_privilege(r.oid,c.oid,'UPDATE') AS table_update,
 has_any_column_privilege(r.oid,c.oid,'UPDATE') AS any_column_update,
 has_table_privilege(r.oid,c.oid,'DELETE') AS table_delete,
 has_table_privilege(r.oid,c.oid,'TRUNCATE') AS table_truncate,
 (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid) AS policy_count
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN pg_roles r
 WHERE n.nspname='sutra' AND c.relkind IN ('r','p')
 AND c.relname IN ('activity_logs','api_logs','error_logs','contest_submissions','referral_commissions','referrals')
 AND r.rolname IN ('anon','authenticated','service_role') ORDER BY c.relname,r.rolname
) x;
ROLLBACK;"""
SOURCE = "import json,subprocess\nr=subprocess.run(['docker','exec','-i','supabase-db','psql','-X','-q','-A','-t','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],input="+repr(SQL)+",capture_output=True,text=True,timeout=20)\nassert r.returncode==0,'METADATA_QUERY_FAILED'\nprint(json.dumps(json.loads(r.stdout)))\n"
r=subprocess.run(['ssh','-i',str(Path.home()/'.ssh/purama_vps_ed25519'),'-o','IdentitiesOnly=yes','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','root@144.217.14.210','python3','-'],input=SOURCE,capture_output=True,text=True,timeout=60)
try:
 assert r.returncode==0
 rows=json.loads(r.stdout)
 assert len(rows)==18
 assert all(set(x)=={'table_name','rls_enabled','force_rls','role_name','table_select','any_column_select','table_insert','any_column_insert','table_update','any_column_update','table_delete','table_truncate','policy_count'} for x in rows)
except Exception:
 raise SystemExit('SAFE_METADATA_READ_FAILED') from None
receipt={'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'readOnly':True,'businessRowsRead':0,'rows':rows}
with (Path(__file__).parent/'rls-metadata.json').open('x') as f: json.dump(receipt,f,indent=2);f.write('\n')
print(json.dumps(receipt))
