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
import tempfile
import time

HELPER = Path('/Users/matissdornier/purama/.coord/handoffs/OVH-MIGRATION-20261005/deploy_next.py')
HELPER_SHA256 = 'e830fef7d8f7e78e5ffdfc6a1afcce6d78f44d65c8887fd557abc1fae7eecda6'
ROOT = Path(__file__).resolve().parents[1]
REMOTE_ROOT = '/opt/purama/apps/sutra'


def restore_previous(helper, backup):
    helper.ssh(f'test -f {backup}/complete && test -s {backup}/compose.yml && test -s {backup}/runtime.env && cp -a {backup}/runtime.env {REMOTE_ROOT}/runtime/.env && cp -a {backup}/compose.yml {REMOTE_ROOT}/compose.yml && cd {REMOTE_ROOT} && docker compose -f compose.yml config -q && docker compose -f compose.yml up -d --no-deps sutra')
    for attempt in range(18):
        result = helper.ssh("docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' purama-sutra", capture=True)
        if result.stdout.strip() == 'healthy':
            print('ROLLBACK_OK sutra healthy; database and DNS unchanged')
            return
        if result.stdout.strip() in ('unhealthy', 'none'):
            break
        if attempt < 17:
            time.sleep(5)
    raise RuntimeError('rollback health did not pass; inspect SUTRA before any further action')


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
    parser.add_argument('--schema-ready', action='store_true', help='operator confirms reviewed SUTRA migrations already applied')
    parser.add_argument('--public', action='store_true', help='smoke public HTTPS after DNS cutover; rollback application on failure')
    args = parser.parse_args()
    if not re.fullmatch('[0-9a-f]{40}', args.source_ref):
        parser.error('full commit SHA required')
    if args.action == 'deploy' and not args.schema_ready:
        parser.error('reviewed migrations must be applied separately; supply --schema-ready only after verification')
    if args.public and args.action != 'smoke':
        parser.error('--public is only allowed for smoke after DNS cutover')
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
    dockerfile = subprocess.check_output(['git', 'show', args.source_ref + ':deploy/ovh.Dockerfile'], cwd=ROOT)
    original_vendor = helper.vendor_locked_git_dependencies

    def vendor_committed_dependencies(app, package):
        # `app` is the helper's git-archive checkout of source-ref. Never use
        # another terminal's mutable shared ESLint configuration for this build.
        helper.BUILD_ONLY_LOCAL_DEPENDENCIES['@purama/eslint-config'] = (
            app / 'tooling/eslint-config-purama', 'eslint-config-purama',
        )
        return original_vendor(app, package)

    helper.vendor_locked_git_dependencies = vendor_committed_dependencies
    # Opaque remote copies: no credential content is read or printed by this wrapper.
    # mkdir fails on repeat; incomplete snapshots cannot be used for rollback.
    helper.ssh(f'test -s {REMOTE_ROOT}/compose.yml && test -s {REMOTE_ROOT}/runtime/.env && umask 077 && mkdir {backup} && cp -a {REMOTE_ROOT}/compose.yml {backup}/compose.yml && cp -a {REMOTE_ROOT}/runtime/.env {backup}/runtime.env && touch {backup}/complete')
    with tempfile.TemporaryDirectory(prefix='sutra-ovh-recipe-') as directory:
        recipe = Path(directory) / 'Dockerfile'
        recipe.write_bytes(dockerfile)
        helper.DOCKERFILE = recipe
        original_argv = sys.argv
        try:
            sys.argv = [str(HELPER), 'sutra', '--source-ref', args.source_ref, '--node-major', '24', '--replace-existing']
            helper.main()
            smoke(helper)
        except Exception:
            # The canonical helper only guards replacement/health. Also cover
            # later probe/receipt errors and our application status assertions.
            restore_previous(helper, backup)
            raise
        finally:
            sys.argv = original_argv


if __name__ == '__main__':
    main()
