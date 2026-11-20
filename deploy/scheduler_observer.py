"""SUTRA-only read-only scheduler diagnostics, never a job dispatcher.

No credentials, HTTP requests, job claims, mutations or provider adapters.
Docker's Unix socket is needed only to inspect SUTRA and query aggregate counts
inside the existing database container. SQL runs in a read-only transaction.
"""
import argparse
import json
import re
import subprocess
import sys

SQL = """BEGIN READ ONLY;
SET LOCAL statement_timeout='5000ms';
SELECT json_build_object(
 'queued', (SELECT count(*) FROM sutra.video_jobs WHERE status='queued'),
 'processing', (SELECT count(*) FROM sutra.video_jobs WHERE status='processing'),
 'expired', (SELECT count(*) FROM sutra.video_jobs WHERE status='processing' AND lease_until<now()),
 'uncertain', (SELECT count(*) FROM sutra.video_jobs WHERE status='reconciliation_required'),
 'autoActive', (SELECT count(*) FROM sutra.sutra_auto_config WHERE is_active),
 'autoPublication', (SELECT count(*) FROM sutra.sutra_auto_config WHERE is_active AND auto_publish AND NOT require_approval_before_publish));
ROLLBACK;"""
COUNTS = {'queued', 'processing', 'expired', 'uncertain', 'autoActive', 'autoPublication'}
INSPECT = ['docker', 'inspect', '--format', '{{json .State}}|{{index .Config.Labels "dev.purama.commit"}}', 'purama-sutra']
QUERY = ['docker', 'exec', '-i', 'supabase-db', 'psql', '-X', '-q', '-A', '-t', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1']


def execute(argv, data=None):
    """Fixed callers only; discard raw stderr, including any upstream detail."""
    result = subprocess.run(argv, input=data, capture_output=True, text=True, timeout=15)
    if result.returncode:
        raise RuntimeError('CHECK_UNAVAILABLE')
    return result.stdout


def observe(expected_source, runner=execute):
    """Return allowlisted metadata only, without copying Docker/DB responses."""
    if not re.fullmatch(r'[0-9a-f]{40}', expected_source):
        raise ValueError('INVALID_SOURCE')
    state_text, source = runner(INSPECT).strip().rsplit('|', 1)
    state = json.loads(state_text)
    if source != expected_source:
        raise RuntimeError('SOURCE_MISMATCH')
    counts = json.loads(runner(QUERY, SQL))
    if set(counts) != COUNTS or any(type(n) is not int or n < 0 for n in counts.values()):
        raise RuntimeError('INVALID_COUNTS')
    healthy = state.get('Health', {}).get('Status') == 'healthy' and state.get('Running') is True
    attention = not healthy or any(counts[k] for k in ('queued', 'expired', 'uncertain', 'autoActive', 'autoPublication'))
    return {
        'mode': 'observe-only', 'source': source,
        'status': 'ATTENTION' if attention else 'PASS', 'healthy': healthy,
        'counts': counts, 'dispatchEnabled': False,
        'generationCalls': 0, 'publicationCalls': 0,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expected-source', required=True)
    args = parser.parse_args(argv)
    try:
        result = observe(args.expected_source)
    except Exception:
        # Never interpolate an exception, subprocess output or configuration.
        print(json.dumps({'mode': 'observe-only', 'status': 'UNAVAILABLE', 'dispatchEnabled': False}))
        return 1
    print(json.dumps(result, sort_keys=True))
    return 0 if result['status'] == 'PASS' else 2


if __name__ == '__main__':
    sys.exit(main())
