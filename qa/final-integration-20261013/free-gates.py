#!/usr/bin/env python3
"""Free local verification. Fresh fixture-only environment; never reads master or app secrets."""
import json, os, pathlib, pwd, subprocess, sys, time
ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = pathlib.Path(__file__).resolve().parent
pg = '/opt/homebrew/opt/postgresql@18/bin'
fixture = {k: os.environ[k] for k in ('PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP') if k in os.environ}
fixture.update(LC_ALL='C', LANG='C', CI='1', NEXT_TELEMETRY_DISABLED='1', LTX_TRACK_DB='0', OTS_NETWORK='0',
    NODE_OPTIONS='--require=' + str(ROOT / 'qa/t08/offline.cjs'),
    NEXT_PUBLIC_SUPABASE_URL='https://sutra-test.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY='fixture-anon',
    SUPABASE_SERVICE_ROLE_KEY='fixture-service', NEXT_PUBLIC_APP_SCHEMA='sutra',
    SUTRA_DISPOSABLE_DB='1', PGHOST='127.0.0.1', PGPORT='5432',
    SUTRA_TEST_PG_BIN=pg)
commands = {
 'postgres-pipeline': ['node', '--import', 'tsx', '--test', 'scripts/test-pipeline-postgres.mts'],
 'postgres-rls': ['node', 'scripts/test-security-rls.mjs'],
 'deploy-unit': ['python3', '-m', 'unittest', 'discover', '-s', 'deploy', '-p', 'test_*.py'],
 'suno-targeted': ['node', '--experimental-test-module-mocks', '--import', 'tsx', '--test',
    'scripts/test-api-contracts.mts', 'scripts/test-provider-safety.mts', 'scripts/test-suno-contract.mts',
    'qa/t03-provider-complement-20261013/music-recovery.test.mts'],
}
name = sys.argv[1]
if name == 'postgres-migration':
    database = 'sutra_ci_final_20261013_' + str(os.getpid())
    made = subprocess.run([pg + '/createdb', '-h', '127.0.0.1', '-p', '5432', '-w', database],
        env=fixture, cwd=ROOT, capture_output=True)
    if made.returncode: raise SystemExit('Disposable database creation failed; no schema action performed')
    fixture['DATABASE_URL_LOCAL'] = 'postgres://' + pwd.getpwuid(os.getuid()).pw_name + '@127.0.0.1:5432/' + database
    commands[name] = ['node', 'scripts/test-migration-local.mjs']
start = time.time()
with (OUT / (name + '.log')).open('w') as log:
    result = subprocess.run(commands[name], cwd=ROOT, env=fixture, stdout=log, stderr=subprocess.STDOUT, timeout=600)
receipt = dict(name=name, command=commands[name], exitCode=result.returncode, elapsedSeconds=round(time.time()-start, 2),
    fixtureOnly=True, networkGuard='qa/t08/offline.cjs')
(OUT / (name + '.json')).write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt))
sys.exit(result.returncode)
