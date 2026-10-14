"""Disposable fixture cluster; explicit local binaries, no inherited credentials."""
import json
from pathlib import Path
import socket
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
BIN = Path('/opt/homebrew/opt/postgresql@18/bin')
NODE = '/tmp/midas-t1-node24-20261012.NRxe8k/node-v24.21.0-darwin-arm64/bin/node'
phase = sys.argv[1]
assert phase.replace('-', '').isalnum()
directory = Path(tempfile.mkdtemp(prefix='sutra-t01-checkpoint-pg-'))
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
fixture = {'PATH': '/usr/bin:/bin:/opt/homebrew/bin', 'LC_ALL': 'C',
           'SUTRA_DISPOSABLE_DB': '1', 'PGHOST': '127.0.0.1', 'PGPORT': str(port), 'PGUSER': 'fixture'}
started = False
try:
    subprocess.run([str(BIN/'initdb'), '-D', str(directory/'data'), '-A', 'trust', '-U', 'fixture', '--no-locale'], env=fixture, check=True, capture_output=True)
    subprocess.run([str(BIN/'pg_ctl'), '-D', str(directory/'data'), '-l', str(directory/'server.log'), '-o', f'-h 127.0.0.1 -p {port} -k {directory}', '-w', 'start'], env=fixture, check=True, capture_output=True)
    started = True
    command = [NODE, '--import', 'tsx', '--test', *sys.argv[2:]]
    result = subprocess.run(command, cwd=ROOT, env=fixture, capture_output=True, text=True, timeout=180)
    (OUT/f'postgres-{phase}.log').write_text(result.stdout+result.stderr)
    receipt = {'command': command, 'exit': result.returncode, 'fixtureCluster': str(directory), 'secretsInherited': False, 'remoteDatabase': False}
    (OUT/f'postgres-{phase}.json').write_text(json.dumps(receipt, indent=2)+'\n')
    print(json.dumps(receipt))
    print('\n'.join(result.stdout.splitlines()[-9:]))
finally:
    if started:
        subprocess.run([str(BIN/'pg_ctl'), '-D', str(directory/'data'), '-m', 'fast', '-w', 'stop'], env=fixture, check=True, capture_output=True)

sys.exit(result.returncode)
