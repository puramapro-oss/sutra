#!/usr/bin/env python3
"""SUTRA-only exact-commit OVH deployment / Compose rollback. Never called by CI."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import shlex
import subprocess
import sys
import promotion_guards as guards

HELPER = Path('/Users/matissdornier/purama/.coord/handoffs/OVH-MIGRATION-20261005/deploy_next.py')
HELPER_SHA256 = 'e830fef7d8f7e78e5ffdfc6a1afcce6d78f44d65c8887fd557abc1fae7eecda6'
ROOT = Path(__file__).resolve().parents[1]
REMOTE_ROOT = '/opt/purama/apps/sutra'


def restore_previous(helper, backup):
    # Only certified CAS snapshots can restore; legacy copies fail closed.
    source = guards.rollback_source(REMOTE_ROOT, backup)
    try:
        result = helper.ssh('python3 -c ' + shlex.quote(source), capture=True)
        assert result.returncode == 0
        receipt = json.loads(result.stdout)
        assert receipt['status'] == 'RESTORED' and receipt['health'] == 'healthy'
    except BaseException:
        raise RuntimeError('ROLLBACK_UNCONFIRMED_RECONCILE_CAS_AND_PROCESS_STATE') from None
    print('ROLLBACK_OK sutra exact previous image healthy; database and DNS unchanged')


def smoke(helper, public=False):
    # No authenticated mutation or provider health endpoint. Node verifies TLS
    # normally for the public probe; redirects and unexpected status codes fail.
    base = 'https://sutra.purama.dev' if public else 'http://127.0.0.1:3000'
    probe = """(async()=>{const base=BASE;const cases=[['/',200],['/login',200],
      ['/api/points',401],['/api/video/status/00000000-0000-0000-0000-000000000000',401],
      ['/api/media/b3duZXJzL3UvdGVzdC5tcDQ',401]];const out=[];
      for(const [path,expected] of cases){const r=await fetch(base+path,
        {redirect:'manual',signal:AbortSignal.timeout(15000)});
        out.push({path,status:r.status,expected});
        if(r.status!==expected)throw Error('SMOKE_STATUS '+path+' '+r.status);}
      console.log(JSON.stringify(out));})().catch(e=>{console.error(e.message);process.exit(1)})""".replace('BASE', json.dumps(base))
    response = helper.ssh('docker exec purama-sutra node -e ' + shlex.quote(probe), capture=True)
    print('SMOKE_OK ' + ('public' if public else 'internal') + ' ' + response.stdout.strip())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['deploy', 'rollback', 'smoke'])
    parser.add_argument('--source-ref', required=True, help='full immutable Git commit SHA')
    parser.add_argument('--ci-run', help='completed CI run for the exact source')
    parser.add_argument('--proof-dir', type=Path, default=ROOT / 'qa/t01-consolidation-20261014')
    parser.add_argument('--schema-ready', action='store_true', help='operator confirms reviewed SUTRA migrations already applied')
    parser.add_argument('--public', action='store_true', help='smoke public HTTPS after DNS cutover; rollback application on failure')
    args = parser.parse_args()
    if not re.fullmatch('[0-9a-f]{40}', args.source_ref):
        parser.error('full commit SHA required')
    if args.action == 'deploy' and (not args.schema_ready or not args.ci_run or not re.fullmatch('[0-9]+', args.ci_run)):
        parser.error('deploy requires --schema-ready and --ci-run; exact SQL and backup evidence are verified independently')
    if args.public and args.action != 'smoke':
        parser.error('--public is only allowed for smoke after DNS cutover')
    if args.action == 'deploy':
        # A single deployment path: no legacy helper bypass of CI/backup/SQL gates.
        subprocess.run([sys.executable, str(ROOT / 'qa/t01-consolidation-20261014/promote.py'),
            '--source-ref', args.source_ref, '--ci-run', args.ci_run,
            '--proof-dir', str(args.proof_dir)], cwd=ROOT, check=True)
        return
    subprocess.run(['git', 'cat-file', '-e', args.source_ref + '^{commit}'], cwd=ROOT, check=True)
    if hashlib.sha256(HELPER.read_bytes()).hexdigest() != HELPER_SHA256:
        raise RuntimeError('OVH helper changed: review it before deployment')
    spec = importlib.util.spec_from_file_location('sutra_ovh_helper', HELPER)
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    backup = f'{REMOTE_ROOT}/rollback-{args.source_ref}'
    if args.action == 'rollback':
        restore_previous(helper, backup)
        return
    if args.action == 'smoke':
        # A post-cutover smoke is a guarded release action, not a generic URL
        # checker. Refuse to start without the exact release rollback snapshot.
        helper.ssh(f'test -f {backup}/complete && test -s {backup}/compose.yml && test -s {backup}/runtime.env')
        try:
            smoke(helper, public=args.public)
        except Exception:
            restore_previous(helper, backup)
            raise
        return


if __name__ == '__main__':
    main()
