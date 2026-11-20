"""Synthetic transaction on the private restored SUTRA database only."""
import datetime,json,re,subprocess
from pathlib import Path
HERE=Path(__file__).parent
backup=json.loads((HERE/'backup-restore.json').read_text())
assert re.fullmatch('sutra_restore_t01_[a-z0-9]+',backup['database'])
a='11000000-0000-4000-8000-000000000001'
b='11000000-0000-4000-8000-000000000002'
sql=f"""BEGIN;
SET LOCAL statement_timeout='5000ms';
INSERT INTO auth.users(id) VALUES ('{a}'),('{b}');
INSERT INTO sutra.profiles(id,email,subscription_status) VALUES ('{a}','t01-rls-a@test.invalid','active'),('{b}','t01-rls-b@test.invalid','active');
INSERT INTO sutra.referral_commissions(id,referrer_id,referred_id,amount,status) VALUES ('11000000-0000-4000-8000-000000000011','{a}','{b}',1,'pending');
INSERT INTO sutra.referrals(id,referrer_id,referred_id,referral_code,status) VALUES ('11000000-0000-4000-8000-000000000012','{a}','{b}','T01FIXTURE','pending');
INSERT INTO sutra.contest_submissions(id,user_id,contest_id) VALUES ('11000000-0000-4000-8000-000000000013','{a}','T01-FIXTURE');
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='{a}';
WITH changed AS (UPDATE sutra.referral_commissions SET amount=999,status='paid' WHERE id='11000000-0000-4000-8000-000000000011' RETURNING id) SELECT json_build_object('case','commission_owner_mutation','unauthorizedChanges',count(*)) FROM changed;
WITH changed AS (UPDATE sutra.referrals SET level=3,first_payment_processed=true WHERE id='11000000-0000-4000-8000-000000000012' RETURNING id) SELECT json_build_object('case','referral_owner_mutation','unauthorizedChanges',count(*)) FROM changed;
WITH changed AS (UPDATE sutra.contest_submissions SET ai_score=100,community_votes=999,status='winner' WHERE id='11000000-0000-4000-8000-000000000013' RETURNING id) SELECT json_build_object('case','contest_owner_score_mutation','unauthorizedChanges',count(*)) FROM changed;
ROLLBACK;
"""
source='import subprocess,json,re\nr=subprocess.run('+repr(['docker','exec','-i','supabase-db','psql','-X','-qAt','-U','supabase_admin','-d',backup['database'],'-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'])+',input='+repr(sql)+',capture_output=True,text=True,timeout=30)\nprint(json.dumps({"returncode":r.returncode,"cases":[json.loads(s) for s in r.stdout.splitlines() if s.startswith("{")],"sqlstates":re.findall(r"(?:ERROR|FATAL):\\s+([A-Z0-9]{5}):",r.stderr)}))'
r=subprocess.run(['ssh','-i',str(Path.home()/'.ssh/purama_vps_ed25519'),'-o','IdentitiesOnly=yes','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','root@144.217.14.210','python3','-'],input=source,capture_output=True,text=True,timeout=60)
if r.returncode:raise SystemExit('RESTORED_RLS_PROBE_UNCONFIRMED')
x=json.loads(r.stdout)
x.update({'database':'private restored SUTRA copy','syntheticOnly':True,'transactionRolledBack':True,'productionChanged':False,'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()})
with (HERE/'rls-write-red-admin.json').open('x') as f:json.dump(x,f,indent=2);f.write('\n')
print(json.dumps(x))
