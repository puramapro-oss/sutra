#!/usr/bin/env python3
"""Build an exact SUTRA commit on OVH and smoke it with no external network.

Never changes Compose, production containers, database, DNS or TLS. The stopped
candidate and private build log are retained. Existing runtime credentials are
passed opaquely to Docker and are never read or printed here.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import tarfile
import tempfile
import time

from ovh import HELPER, HELPER_SHA256, REMOTE_ROOT, ROOT


def build_candidate(source_ref):
    if not re.fullmatch('[0-9a-f]{40}', source_ref):
        raise ValueError('full immutable commit SHA required')
    subprocess.run(['git', 'cat-file', '-e', source_ref + '^{commit}'], cwd=ROOT, check=True)
    if hashlib.sha256(HELPER.read_bytes()).hexdigest() != HELPER_SHA256:
        raise RuntimeError('OVH helper changed; review required')
    spec = importlib.util.spec_from_file_location('sutra_candidate_helper', HELPER)
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    release = source_ref + '-' + str(time.time_ns())
    remote = REMOTE_ROOT + '/candidates/' + release
    container = 'sutra-candidate-' + release
    image = 'purama/sutra-candidate:' + release
    with tempfile.TemporaryDirectory(prefix='sutra-candidate-') as directory:
        temp = Path(directory)
        record = dict(helper.project_record('sutra'), source=str(ROOT), vercelRootDirectory='')
        source, actual = helper.exact_source(record, temp, source_ref)
        if actual != source_ref:
            raise RuntimeError('archive commit mismatch')
        app = Path(source)
        package = helper.validate_app(app)
        helper.BUILD_ONLY_LOCAL_DEPENDENCIES['@purama/eslint-config'] = (
            app / 'tooling/eslint-config-purama', 'eslint-config-purama')
        vendored = helper.vendor_locked_git_dependencies(app, package)
        helper.DOCKERFILE = app / 'deploy/ovh.Dockerfile'
        helper.prepare_dockerfile(app, 24, None)
        shutil.copy2(helper.DOCKERIGNORE, app / '.dockerignore')
        archive = temp / 'context.tar.gz'
        with tarfile.open(archive, 'w:gz') as bundle:
            for child in sorted(app.iterdir()):
                bundle.add(child, arcname=child.name)
        helper.ssh(f'umask 077 && mkdir -p {REMOTE_ROOT}/candidates && mkdir {remote} && mkdir {remote}/context')
        helper.scp(archive, remote + '/context.tar.gz')
        helper.ssh(f'tar -xzf {remote}/context.tar.gz -C {remote}/context && '
            f'cd {remote}/context && DOCKER_BUILDKIT=1 docker build '
            f'--secret id=app_env,src={REMOTE_ROOT}/runtime/.env '
            f'--label dev.purama.commit={source_ref} -t {image} . >{remote}/build.log 2>&1')
    report = {'source': source_ref, 'image': image, 'container': container,
        'remoteDirectory': remote, 'vendoredDependencies': vendored,
        'productionChanged': False, 'network': 'none', 'checks': []}
    started = False
    try:
        helper.ssh(f'docker run -d --name {container} --network none '
            f'--env-file {REMOTE_ROOT}/runtime/.env {image} >/dev/null')
        started = True
        probe = """(async()=>{const cases=[['/',200],['/login',200],['/api/points',401],
          ['/api/video/jobs/00000000-0000-0000-0000-000000000000',401],
          ['/api/media/b3duZXJzL3UvdGVzdC5tcDQ',401]];const out=[];
          for(const [path,expected] of cases){const r=await fetch('http://127.0.0.1:3000'+path,{redirect:'manual'});
            out.push({path,status:r.status,expected});if(r.status!==expected)throw Error(JSON.stringify(out));}
          console.log(JSON.stringify(out));})().catch(e=>{console.error(e.message);process.exit(1)})"""
        for attempt in range(12):
            try:
                response = helper.ssh(f'docker exec {container} node -e {shlex.quote(probe)}', capture=True)
                report['checks'] = json.loads(response.stdout)
                break
            except subprocess.CalledProcessError:
                if attempt == 11:
                    raise
                time.sleep(2)
        helper.ssh(f'docker exec {container} sh -c ' + shlex.quote(
            'ffmpeg -hide_banner -filters 2>/dev/null | grep -q subtitles && '
            'ffmpeg -hide_banner -filters 2>/dev/null | grep -q drawtext && ffprobe -version >/dev/null'))
        report['ffmpegSubtitlesDrawtextFfprobe'] = True
        report['imageId'] = helper.ssh(f"docker image inspect --format='{{{{.Id}}}}' {image}", capture=True).stdout.strip()
        report['status'] = 'PASS'
        print(json.dumps(report, indent=2))
    finally:
        if started:
            helper.ssh(f'docker stop {container} >/dev/null')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-ref', required=True)
    build_candidate(parser.parse_args().source_ref)
