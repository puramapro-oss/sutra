#!/usr/bin/env python3
"""Prepare pinned tools only in an ephemeral GitHub-hosted Linux CI job.

No APT, mirrors, product-source changes or production resources. The sole
privileged operation creates two absent /usr/bin links required by existing
fixtures; it never overwrites an existing file. Imported helpers have no effects.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import platform
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile


FFMPEG = {
    'url': 'https://github.com/FFmpeg-Builds/FFmpeg-Builds/releases/download/autobuild-2026-10-31-12-59/ffmpeg-n8.1.3-27-g8dca1586f4-linux64-gpl-8.1.tar.xz',
    'root': 'ffmpeg-n8.1.3-27-g8dca1586f4-linux64-gpl-8.1',
    'bytes': 152246308,
    'sha256': '41e9c565594c390622cf968d82fa4135d9e9a11d06c1515644288cbc844e3380',
    'version': 'n8.1.3-27-g8dca1586f4-20261031',
    'asset_id': 695398022,
}
BLENDER = {
    'url': 'https://download.blender.org/release/Blender4.5/blender-4.5.16-linux-x64.tar.xz',
    'checksums_url': 'https://download.blender.org/release/Blender4.5/blender-4.5.16.sha256',
    'root': 'blender-4.5.16-linux-x64',
    'bytes': 377826288,
    'sha256': '23432b064977908beb1ab4b7f32f024e7331105c875c187dce002aff84b10c11',
    'version': '4.5.16',
}
NATIVE_TEST = 'Blender creates an editable scene, preserves existing work, reopens and renders it'


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def sha256(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def verify_cinema_log(path):
    """Reject skipped, missing, failed or unrecognized native-test evidence."""
    require(path.is_file() and path.stat().st_size <= 2_000_000, 'Missing/oversized native Blender test log')
    text = path.read_text(encoding='utf-8')
    text = re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]', '', text)
    counts = {}
    for name, expected in {'tests': 1, 'pass': 1, 'fail': 0, 'cancelled': 0, 'skipped': 0, 'todo': 0}.items():
        matches = re.findall(r'^\s*(?:#\s+|ℹ\s+)?' + name + r'\s+(\d+)\s*$', text, re.MULTILINE)
        require(matches == [str(expected)], f'Native Blender {name}: expected one summary with {expected}, got {matches}')
        counts[name] = expected
    title = re.escape(NATIVE_TEST)
    success = re.findall(r'^\s*(?:ok 1 - |✔\s+)' + title + r'(?:\s+\([^\n]*\))?\s*$', text, re.MULTILINE)
    require(len(success) == 1, 'Expected native Blender test success record is missing or duplicated')
    require('# SKIP' not in text, 'Native Blender test was skipped')
    return {'status': 'PASS', 'test': NATIVE_TEST, 'counts': counts, 'log_sha256': sha256(path)}


def checked_command(command, evidence, name, timeout=30, env=None):
    result = subprocess.run(command, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            timeout=timeout, check=False, env=env)
    (evidence / f'{name}.stdout.log').write_text(result.stdout)
    (evidence / f'{name}.stderr.log').write_text(result.stderr)
    require(result.returncode == 0, f'{name} failed with exit {result.returncode}: {result.stderr[-1500:]}')
    return result.stdout


def download(pin, work, evidence, name):
    archive = work / (pin['root'] + '.tar.xz')
    checked_command([
        'curl', '--fail', '--location', '--silent', '--show-error',
        '--proto', '=https', '--proto-redir', '=https',
        '--connect-timeout', '20', '--max-time', '240', '--retry', '1',
        '--retry-max-time', '300', '--max-filesize', str(pin['bytes']),
        '--output', str(archive), pin['url'],
    ], evidence, f'{name}-download', timeout=330)
    require(archive.stat().st_size == pin['bytes'], f'{name} archive length mismatch')
    require(sha256(archive) == pin['sha256'], f'{name} archive SHA256 mismatch')
    return archive


def extract_ffmpeg(archive, destination):
    expected = {
        f"{FFMPEG['root']}/bin/ffmpeg": ('bin/ffmpeg', 512 * 1024 * 1024, 0o755),
        f"{FFMPEG['root']}/bin/ffprobe": ('bin/ffprobe', 512 * 1024 * 1024, 0o755),
        f"{FFMPEG['root']}/LICENSE.txt": ('LICENSE.txt', 1024 * 1024, 0o644),
    }
    destination.mkdir()
    (destination / 'bin').mkdir()
    observed = {}
    with tarfile.open(archive, 'r|xz') as bundle:
        for member in bundle:
            if member.name not in expected:
                continue
            relative, limit, mode = expected[member.name]
            require(member.name not in observed and member.isfile() and not member.sparse
                    and 0 < member.size <= limit, 'Unsafe/duplicate FFmpeg member')
            target = destination / relative
            with bundle.extractfile(member) as source, target.open('xb') as output:
                shutil.copyfileobj(source, output, length=1024 * 1024)
            require(target.stat().st_size == member.size, 'Incomplete FFmpeg member')
            target.chmod(mode)
            observed[member.name] = {'bytes': member.size, 'sha256': sha256(target)}
    require(set(observed) == set(expected), 'FFmpeg binary or licence absent')
    require(sha256(destination / 'LICENSE.txt') == '8ceb4b9ee5adedde47b31e975c1d90c73ad27b6b165a1dcd80c7c545eb65b903',
            'Unexpected FFmpeg GPLv3 licence')
    return observed


def blender_filter(member, destination):
    parts = PurePosixPath(member.name).parts
    require(parts and parts[0] == BLENDER['root'] and '..' not in parts
            and not PurePosixPath(member.name).is_absolute(), 'Unsafe Blender member path')
    require(not member.sparse and (member.isfile() or member.isdir() or member.issym() or member.islnk()),
            'Unsupported Blender archive member')
    # Python's data filter also rejects escaping symbolic/hard links, devices
    # and unsafe permissions; internal library links remain usable.
    return tarfile.data_filter(member, destination)


def extract_blender(archive, destination):
    destination.mkdir()
    with tarfile.open(archive, 'r:xz') as bundle:
        members = bundle.getmembers()
        require(0 < len(members) < 100_000, 'Unexpected Blender archive member count')
        require(sum(member.size for member in members) <= 4 * 1024**3, 'Blender extracted size exceeds bound')
        require(len({member.name for member in members}) == len(members), 'Duplicate Blender archive paths')
        bundle.extractall(destination, members=members, filter=blender_filter)
    root = destination / BLENDER['root']
    require((root / 'blender').is_file(), 'Blender executable is absent')
    licence = root / 'license' / 'license.md'
    require(licence.is_file() and licence.stat().st_size < 1_000_000, 'Blender bundled licence manifest is absent')
    data = licence.read_bytes()
    require(hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
            == 'd6e52afa75eba990a2d0b26752e5d285ae863ce5', 'Blender licence differs from official v4.5.16 source')
    return root


def install():
    require(os.environ.get('GITHUB_ACTIONS') == 'true', 'Installation is limited to a GitHub Actions job')
    require(platform.system() == 'Linux' and platform.machine() == 'x86_64', 'Expected Linux x86_64 runner')
    require(sys.version_info >= (3, 12), 'Python with tar data filter is required')
    release = dict(line.split('=', 1) for line in Path('/etc/os-release').read_text().splitlines() if '=' in line)
    require(release.get('ID', '').strip('"') == 'ubuntu' and release.get('VERSION_ID', '').strip('"') == '26.04',
            'Expected explicitly selected Ubuntu 26.04 runner')
    temporary = Path(os.environ['RUNNER_TEMP']).resolve(strict=True)
    require(temporary.is_dir() and temporary != Path('/'), 'Invalid runner temporary directory')
    path_file = Path(os.environ['GITHUB_PATH'])
    require(path_file.is_file(), 'Expected GitHub PATH command file')
    evidence = temporary / 'sutra-contract-tools-evidence'
    evidence.mkdir(mode=0o700)
    work = Path(tempfile.mkdtemp(prefix='sutra-contract-tools-', dir=temporary))
    report = {'status': 'FAIL', 'scope': 'Temporary CI tools only; no production installation',
              'ffmpeg_pin': FFMPEG, 'blender_pin': BLENDER, 'build_attestation_verified': False}
    try:
        # Both are needed because retained fixture scripts bypass PATH.
        for binary in ('ffmpeg', 'ffprobe'):
            require(not os.path.lexists('/usr/bin/' + binary), f'Refusing to replace existing /usr/bin/{binary}')
        font = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
        require(font.is_file() and 0 < font.stat().st_size < 5_000_000, 'Required preinstalled DejaVuSans.ttf is absent')
        selected = checked_command(['fc-match', '-f', '%{file}\n', 'DejaVu Sans'], evidence, 'font-selection').strip()
        require(Path(selected).resolve() == font.resolve(), 'Fontconfig did not select the required DejaVu font')
        package = checked_command(['dpkg-query', '-W', '-f', '${Package} ${Version}\n', 'fonts-dejavu-core'],
                                  evidence, 'font-package').strip()
        copyright_file = Path('/usr/share/doc/fonts-dejavu-core/copyright')
        require(copyright_file.is_file(), 'DejaVu licence record is absent')
        shutil.copyfile(copyright_file, evidence / 'dejavu-copyright.txt')
        report['font'] = {'path': str(font), 'sha256': sha256(font), 'package': package,
                          'copyright_sha256': sha256(copyright_file)}

        ffmpeg_dir = work / 'ffmpeg'
        report['ffmpeg_extracted'] = extract_ffmpeg(download(FFMPEG, work, evidence, 'ffmpeg'), ffmpeg_dir)
        shutil.copyfile(ffmpeg_dir / 'LICENSE.txt', evidence / 'ffmpeg-LICENSE.txt')
        blender_dir = extract_blender(download(BLENDER, work, evidence, 'blender'), work / 'blender')
        shutil.copyfile(blender_dir / 'license' / 'license.md', evidence / 'blender-license.md')
        report['blender_executable_sha256'] = sha256(blender_dir / 'blender')
        report['blender_licence_sha256'] = sha256(blender_dir / 'license' / 'license.md')

        # Match the environment preserved by scripts/run-ci.mjs and qa/t08/run.mjs.
        env = {key: os.environ[key] for key in ('PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot') if key in os.environ}
        env['PATH'] = str(ffmpeg_dir / 'bin') + ':' + str(blender_dir) + ':' + env.get('PATH', '')
        for binary in ('ffmpeg', 'ffprobe'):
            version = checked_command([str(ffmpeg_dir / 'bin' / binary), '-version'], evidence, binary + '-version', env=env)
            require(version.startswith(binary + ' version ' + FFMPEG['version']), f'{binary} version differs from pin')
        filters = checked_command([str(ffmpeg_dir / 'bin' / 'ffmpeg'), '-hide_banner', '-filters'], evidence, 'ffmpeg-filters', env=env)
        for required in ('rubberband', 'drawtext', 'subtitles'):
            require(any(line.split()[1:2] == [required] for line in filters.splitlines()), f'Missing FFmpeg filter: {required}')
        encoders = checked_command([str(ffmpeg_dir / 'bin' / 'ffmpeg'), '-hide_banner', '-encoders'], evidence, 'ffmpeg-encoders', env=env)
        require(any(line.split()[1:2] == ['libx264'] for line in encoders.splitlines()), 'Missing libx264 encoder')
        checked_command([str(ffmpeg_dir / 'bin' / 'ffmpeg'), '-nostdin', '-v', 'error', '-f', 'lavfi',
                         '-i', 'color=c=black:s=64x64:d=0.04', '-vf', "drawtext=font='DejaVu Sans':text=SUTRA:fontcolor=white:fontsize=16",
                         '-frames:v', '1', '-f', 'null', '-'], evidence, 'font-render', env=env)
        version = checked_command([str(blender_dir / 'blender'), '--version'], evidence, 'blender-version', env=env)
        require(version.startswith('Blender ' + BLENDER['version']), 'Blender version differs from pin')
        checked_command([str(blender_dir / 'blender'), '--background', '--factory-startup', '--disable-autoexec',
                         '--python-exit-code', '7', '--python-expr',
                         "import bpy; assert bpy.app.version == (4, 5, 16); assert bpy.app.build_options.cycles; bpy.context.scene.render.engine='CYCLES'; bpy.context.scene.cycles.device='CPU'; print('SUTRA_CYCLES_CPU_READY')"],
                        evidence, 'blender-cycles-probe', timeout=60, env=env)

        # No shell, no force flag, and --no-target-directory: an existing path
        # causes ln to fail instead of being replaced or interpreted as a folder.
        report['compatibility_links'] = {}
        for binary in ('ffmpeg', 'ffprobe'):
            source, target = ffmpeg_dir / 'bin' / binary, Path('/usr/bin') / binary
            checked_command(['sudo', '-n', 'ln', '-s', '-T', '--', str(source), str(target)],
                            evidence, binary + '-compatibility-link')
            require(target.is_symlink() and target.resolve() == source.resolve(), 'Unexpected compatibility link')
            report['compatibility_links'][str(target)] = str(source)
        with path_file.open('a') as stream:
            stream.write(str(ffmpeg_dir / 'bin') + '\n' + str(blender_dir) + '\n')
        report['status'] = 'PASS'
    except BaseException as error:
        report['error'] = f'{type(error).__name__}: {error}'
        raise
    finally:
        (evidence / 'provenance.json').write_text(json.dumps(report, indent=2) + '\n')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--verify-cinema-log', type=Path)
    args = parser.parse_args()
    if args.verify_cinema_log:
        print(json.dumps(verify_cinema_log(args.verify_cinema_log)))
    else:
        install()


if __name__ == '__main__':
    main()
