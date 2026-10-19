"""Verify the promotion catalogue query against the completed disposable R107 database.
Never accepts a remote database or a live cluster; starts/stops only the private fixture.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'deploy'))
import promotion_guards as guards

receipt = json.loads(Path(sys.argv[1]).read_text())
directory = Path(receipt['private_cluster']).resolve()
assert directory.name.startswith('sutra-t03-closure-pg-')
assert directory.parent == Path(tempfile.gettempdir()).resolve()
assert receipt['stopped'] is True and receipt['external_calls'] == 0
assert receipt['synthetic_environment_only'] is True
assert all(c['exit_code'] == 0 for c in receipt['commands'])
start = next(c['command'] for c in receipt['commands'] if c['log'] == 'pg-start.log')
bin_dir = Path(start[0]).parent
assert Path(start[0]).name == 'pg_ctl' and Path(start[2]).resolve() == directory / 'data'
assert not (directory / 'data/postmaster.pid').exists(), 'FIXTURE_ALREADY_RUNNING'
environment = {k: os.environ[k] for k in ('PATH', 'HOME') if k in os.environ}
environment['LC_ALL'] = 'C'
output = Path(sys.argv[1]).parent
started = False
try:
    result = subprocess.run(start, env=environment, capture_output=True, timeout=30)
    assert result.returncode == 0, 'PRIVATE_FIXTURE_START_FAILED'
    started = True
    # Socket belongs to this fixture; no default localhost/production fallback.
    port = (directory / 'data/postmaster.pid').read_text().splitlines()[3]
    command = [str(bin_dir / 'psql'), '-h', str(directory), '-p', port,
        '-U', 'fixture', '-d', 't03_scheduler', '-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1']
    # T03 ends the partner coexistence test after rollback. Replay the exact
    # additive migrations in this disposable database before checking the gate.
    for path in guards.ADDITIONAL_MIGRATIONS:
        result = subprocess.run(command, input=(ROOT / path).read_text(), text=True,
            env=environment, capture_output=True, timeout=30)
        assert result.returncode == 0, 'FIXTURE_MIGRATION_REPLAY_FAILED'
    result = subprocess.run(command,
        input=guards.ADDITIONAL_SCHEMA_SQL, text=True, env=environment, capture_output=True, timeout=30)
    assert result.returncode == 0, 'CATALOGUE_QUERY_INVALID'
    state = json.loads(result.stdout)
    digest = hashlib.sha256(json.dumps(state, sort_keys=True).encode()).hexdigest()
    guards.validate_additional_state(state, digest)
    proof = {'status': 'PASS', 'querySha256': guards.sha256(guards.ADDITIONAL_SCHEMA_SQL.encode()),
        'catalogueSha256': digest, 'functions': len(state['functions']), 'tables': len(state['tables']),
        'externalCalls': 0, 'dataRead': False, 'fixtureOnly': True}
    (output / 'promotion-catalogue.json').write_text(json.dumps(proof, indent=2) + '\n')
    print(json.dumps(proof))
finally:
    if started:
        result = subprocess.run([str(bin_dir / 'pg_ctl'), '-D', str(directory / 'data'), '-m', 'fast', '-w', 'stop'],
            env=environment, capture_output=True, timeout=30)
        assert result.returncode == 0, 'PRIVATE_FIXTURE_STOP_UNCONFIRMED'
