#!/usr/bin/env python3
"""SUTRA-only exact-commit OVH deployment / Compose rollback. Never called by CI."""
import argparse
import hashlib
import importlib.util
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time

HELPER = Path('/Users/matissdornier/purama/.coord/handoffs/OVH-MIGRATION-20261005/deploy_next.py')
HELPER_SHA256 = 'e830fef7d8f7e78e5ffdfc6a1afcce6d78f44d65c8887fd557abc1fae7eecda6'
ROOT = Path(__file__).resolve().parents[1]
REMOTE_ROOT = '/opt/purama/apps/sutra'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['deploy', 'rollback'])
    parser.add_argument('--source-ref', required=True, help='full immutable Git commit SHA')
    parser.add_argument('--schema-ready', action='store_true', help='operator confirms reviewed SUTRA migrations already applied')
    args = parser.parse_args()
    if not re.fullmatch('[0-9a-f]{40}', args.source_ref):
        parser.error('full commit SHA required')
    if args.action == 'deploy' and not args.schema_ready:
        parser.error('reviewed migrations must be applied separately; supply --schema-ready only after verification')
    subprocess.run(['git', 'cat-file', '-e', args.source_ref + '^{commit}'], cwd=ROOT, check=True)
    if hashlib.sha256(HELPER.read_bytes()).hexdigest() != HELPER_SHA256:
        raise RuntimeError('OVH helper changed: review it before deployment')
    spec = importlib.util.spec_from_file_location('sutra_ovh_helper', HELPER)
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    backup = f'{REMOTE_ROOT}/rollback-{args.source_ref}'
    if args.action == 'rollback':
        helper.ssh(f'test -f {backup}/complete && test -s {backup}/compose.yml && test -s {backup}/runtime.env && cp -a {backup}/runtime.env {REMOTE_ROOT}/runtime/.env && cp -a {backup}/compose.yml {REMOTE_ROOT}/compose.yml && cd {REMOTE_ROOT} && docker compose -f compose.yml config -q && docker compose -f compose.yml up -d --no-deps sutra')
        for attempt in range(18):
            result = helper.ssh("docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' purama-sutra", capture=True)
            if result.stdout.strip() == 'healthy':
                print('ROLLBACK_OK sutra healthy; database unchanged')
                return
            if result.stdout.strip() in ('unhealthy', 'none'):
                break
            if attempt < 17:
                time.sleep(5)
        raise RuntimeError('rollback health did not pass; inspect SUTRA before any further action')
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
        finally:
            sys.argv = original_argv


if __name__ == '__main__':
    main()
