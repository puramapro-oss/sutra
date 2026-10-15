"""T01 scoped function migration. Never restores data or starts a worker.

The remote transition is tested with an injected port. Remote exceptions never
leave the host; only fixed status fields and hashes are returned. Unknown SSH
outcomes require inspection, never automatic resubmission.
"""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import re
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
MIGRATION = 'migrations/20261015_final_durable_integrity.sql'
PREVIOUS = '86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164'
DEFINITIONS = """SELECT json_agg(json_build_object(
 'name',p.proname,'signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),
 'owner',pg_get_userbyid(p.proowner),'acl',p.proacl,'config',p.proconfig,'securityDefiner',p.prosecdef,
 'anonymousExecute',has_function_privilege('anon',p.oid,'EXECUTE'),
 'authenticatedExecute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
 'serviceExecute',has_function_privilege('service_role',p.oid,'EXECUTE')) ORDER BY p.proname)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='sutra' AND p.proname IN ('finish_video_job','checkpoint_video_job_v2','claim_video_job_by_key','claim_video_jobs','persist_video_job_video','video_job_result_valid');"""


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


class UnconfirmedSqlExecution(Exception):
    """The client did not prove that the remote SQL process terminated."""


def transition(port, mode, proof, migration):
    """One submission, then reconcile the scoped definitions before any rollback."""
    receipt = {'status': 'FAIL', 'mode': mode, 'dataRestore': False, 'workerStarted': False}
    submitted = False
    try:
        assert mode in ('apply', 'rollback')
        port.preflight(mode)
        old = proof['beforeDefinitionsSha256']
        new = proof['afterDefinitionsSha256']
        reverted = proof.get('rollbackDefinitionsSha256', old)
        assert all(re.fullmatch('[0-9a-f]{64}', value) for value in (old, new, reverted))
        expected = port.definitions()
        current = digest(expected)
        assert current == (old if mode == 'apply' else new), 'DEFINITION_DRIFT'
        rollback = port.rollback()
        assert hashlib.sha256(rollback.encode()).hexdigest() == proof['rollbackSha256']
        assert hashlib.sha256(migration.encode()).hexdigest() == proof['migrationSha256']
        port.snapshot(expected)
        submitted = True  # Includes ambiguous transport failures after SQL submission.
        port.execute_guarded(expected, migration if mode == 'apply' else rollback)
        assert digest(port.definitions()) == (new if mode == 'apply' else reverted)
        receipt.update(status='PASS', definitionsVerified=True, rollbackTriggered=False)
    except (subprocess.TimeoutExpired, KeyboardInterrupt, UnconfirmedSqlExecution):
        receipt.update(status='UNKNOWN', submitted=submitted,
            action='SQL process completion unconfirmed; inspect before any retry.')
    except BaseException:
        receipt['submitted'] = submitted
        if submitted:
            try:
                observed_definitions = port.definitions()
                observed = digest(observed_definitions)
                if mode == 'apply' and observed == new:
                    port.execute_guarded(observed_definitions, rollback)
                    observed = digest(port.definitions())
                    receipt['rollbackTriggered'] = True
                assert observed in (old, reverted)
                receipt['previousDefinitionsVerified'] = observed == old
                receipt['rollbackDefinitionsVerified'] = observed == reverted
            except BaseException:
                receipt['status'] = 'UNKNOWN'
                receipt['action'] = 'Inspect protected definitions and receipt before any retry.'
    return receipt


class RemotePort:
    def __init__(self, config):
        self.config = config
        self.proof = config['proof']
        self.folder = Path('/opt/purama/apps/sutra') / ('checkpoint-transition-' + config['sha'])

    def execute(self, sql):
        # Transaction-local limits do not alter the tested function definitions.
        sql = sql.replace('BEGIN;', "BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='20s';", 1)
        try:
            result = subprocess.run(['docker', 'exec', '-i', 'supabase-db', 'psql', '-U',
                'supabase_admin', '-d', 'postgres', '-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1'],
                input=sql, text=True, capture_output=True, timeout=60)
        except OSError:
            raise UnconfirmedSqlExecution() from None
        if result.returncode:
            # docker's exit status alone cannot distinguish SQL rejection from
            # lost transport while psql remains active. Never infer completion.
            raise UnconfirmedSqlExecution()
        return result.stdout.strip()

    def definitions(self):
        return json.loads(self.execute(DEFINITIONS))

    def execute_guarded(self, expected, sql):
        self.execute(guarded_sql(expected, sql))

    def rollback(self):
        protected = Path(self.proof['protectedRollback'])
        assert protected.parent.parent == Path('/opt/purama/apps/sutra')
        file = protected / 'rollback.sql'
        assert protected.stat().st_mode & 0o777 == 0o700
        assert file.stat().st_mode & 0o777 == 0o600
        return file.read_text()

    def preflight(self, mode):
        runtime = json.loads(subprocess.check_output(['docker', 'inspect', 'purama-sutra']))[0]
        # Rollback follows image rollback: never downgrade SQL underneath a new image.
        assert runtime['Config']['Labels']['dev.purama.commit'] == PREVIOUS
        assert runtime['State']['Health']['Status'] == 'healthy'
        backup = self.config['backup']
        validate_backup(backup)
        folder = Path(backup['directory'])
        assert folder.parent == Path('/opt/purama/apps/sutra')
        for name, item in backup['artifacts'].items():
            assert '/' not in name and name not in ('.', '..')
            assert hashlib.sha256((folder / name).read_bytes()).hexdigest() == item['sha256']
        active = self.execute("SELECT count(*) FROM sutra.video_jobs WHERE status IN ('queued','processing');")
        assert active == '0', 'ACTIVE_JOBS'
        if mode == 'apply':
            assert not self.folder.exists(), 'INSPECT_PREVIOUS_ATTEMPT'

    def snapshot(self, expected):
        import os
        os.umask(0o077)
        self.folder.mkdir(mode=0o700, exist_ok=self.config['mode'] == 'rollback')
        assert self.definitions() == expected, 'DEFINITION_DRIFT'
        file = self.folder / (self.config['mode'] + '-before.json')
        with file.open('x') as output:
            json.dump(expected, output)
        assert file.stat().st_mode & 0o777 == 0o600


def guarded_sql(expected, sql):
    """Lock only the existing scoped SUTRA catalog rows, then compare under those locks."""
    encoded = json.dumps(expected).replace("'", "''")
    guard = """BEGIN;
SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='sutra' AND p.proname IN
 ('finish_video_job','checkpoint_video_job_v2','claim_video_job_by_key','claim_video_jobs','persist_video_job_video','video_job_result_valid')
 ORDER BY p.oid FOR UPDATE OF p;
DO $sutra_transition_guard$ BEGIN
 IF (""" + DEFINITIONS.rstrip(';') + ")::jsonb IS DISTINCT FROM '" + encoded + "'::jsonb THEN\n"
    guard += "RAISE EXCEPTION 'SUTRA_FUNCTION_DEFINITION_DRIFT'; END IF; END $sutra_transition_guard$;\n"
    assert 'BEGIN;' in sql
    return sql.replace('BEGIN;', guard, 1)


def validate_backup(backup):
    required = {'sutra.dump', 'public-social.dump', 'public-social-dependencies.sql',
        'sutra-assets.tar.gz', 'storage-metadata.json', 'referenced-auth-ids.json'}
    assert set(backup['artifacts']) == required
    assert set(backup['restoredSchema']) == {'jobs', 'quota', 'journals', 'mediaOwnership'}
    assert all(value is True for value in backup['restoredSchema'].values())
    assert backup['rowCountsMatch'] is True and backup['productionDdl'] is False
    assert backup['restoredTables'] >= 141 and backup['migrations'] == []


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['apply', 'rollback'])
    parser.add_argument('--source-ref', required=True)
    parser.add_argument('--ci-run', required=True)
    parser.add_argument('--proof-dir', type=Path, default=HERE)
    args = parser.parse_args()
    proof_dir = args.proof_dir.resolve()
    assert proof_dir.parent == ROOT / 'qa' and proof_dir.is_dir()
    assert re.fullmatch('[0-9a-f]{40}', args.source_ref)
    assert re.fullmatch('[0-9]+', args.ci_run)
    proof = json.loads((proof_dir / 'checkpoint-restore.json').read_text())
    assert proof['status'] == 'PASS' and proof['definitionsRestoredExactly'] and proof['aclAndOwnershipUnchanged']
    migration = subprocess.check_output(['git', 'show', args.source_ref + ':' + MIGRATION], cwd=ROOT, text=True)
    assert migration == (ROOT / MIGRATION).read_text()
    assert hashlib.sha256(migration.encode()).hexdigest() == proof['migrationSha256']
    backup = json.loads((proof_dir / 'backup-restore.json').read_text())
    validate_backup(backup)
    if args.mode == 'apply':
        ci = json.loads(subprocess.check_output(['gh', 'run', 'view', args.ci_run,
            '--json', 'headSha,status,conclusion,jobs'], cwd=ROOT))
        assert ci['headSha'] == args.source_ref and ci['status'] == 'completed' and ci['conclusion'] == 'success'
        assert len(ci['jobs']) == 3 and all(job['conclusion'] == 'success' for job in ci['jobs'])
        candidate = json.loads((proof_dir / 'candidate.json').read_text())
        assert candidate['source'] == args.source_ref and candidate['status'] == 'PASS' and candidate['network'] == 'none'
        age = datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat(backup['observedAt'])
        assert datetime.timedelta(0) <= age <= datetime.timedelta(hours=4), 'FRESH_BACKUP_REQUIRED'
    config = {'mode': args.mode, 'sha': args.source_ref, 'proof': proof, 'backup': backup}
    # Send the committed module; do not execute its local CLI in the remote namespace.
    module = subprocess.check_output(['git', 'show', args.source_ref + ':qa/t01-consolidation-20261014/checkpoint-transition.py'], cwd=ROOT, text=True)
    assert module == Path(__file__).read_text()
    source = "__file__='/opt/purama/apps/sutra/checkpoint-transition.py'\n__name__='sutra_remote'\n" + module
    source += '\nconfig=' + repr(config) + '\nmigration=' + repr(migration)
    source += "\nresult=transition(RemotePort(config),config['mode'],config['proof'],migration)\nprint(json.dumps(result))\nraise SystemExit(0 if result['status']=='PASS' else 1)\n"
    try:
        result = subprocess.run(['ssh', '-i', str(Path.home() / '.ssh/purama_vps_ed25519'), '-o',
            'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
            'root@144.217.14.210', 'python3 -'], input=source, capture_output=True, text=True, timeout=180)
        receipt = json.loads(result.stdout)
        assert result.returncode == 0 or receipt['status'] != 'PASS'
    except BaseException:
        receipt = {'status': 'UNKNOWN', 'action': 'Inspect protected definitions before any retry.'}
    receipt.update(source=args.source_ref, migrationSha256=proof['migrationSha256'],
        observedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
    with (proof_dir / ('checkpoint-' + args.mode + '.json')).open('x') as output:
        output.write(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt))
    raise SystemExit(0 if receipt['status'] == 'PASS' else 1)


if __name__ == '__main__':
    main()
