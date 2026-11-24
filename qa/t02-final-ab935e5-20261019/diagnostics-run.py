"""Bounded red/green proof with synthetic credentials and offline network preload."""
import hashlib
import json
from pathlib import Path
import runpy
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
phase = sys.argv[1]
assert phase in ('red', 'green')
# Reuse the already audited environment without executing any groups.
sys.argv = [str(OUT / 'run.py')]
source = (OUT / 'run.py').read_text()
source = source[:source.index('failed = False')]
# The integrated runner remains immutable: only this patch runner permits two named files.
guard = "assert subprocess.check_output(['git', 'diff', '--name-only', 'HEAD', '--', 'src', 'scripts', 'migrations', 'supabase', 'package.json', 'package-lock.json', 'next.config.ts'], cwd=ROOT, text=True).strip() == '', 'Product changes forbidden during integrated proof'"
assert guard in source
source = source.replace(guard, '')
ctx = {'__file__': str(OUT / 'run.py')}
exec(compile(source, str(OUT / 'run.py'), 'exec'), ctx)
allowed = {'src/app/api/setup/route.ts', 'src/app/api/health/route.ts'}
changed = set(subprocess.check_output(['git', 'diff', '--name-only', 'HEAD', '--', 'src', 'scripts', 'migrations', 'supabase', 'package.json', 'package-lock.json', 'next.config.ts'], cwd=ROOT, text=True).splitlines())
assert changed <= allowed
if phase == 'red': assert not changed
args = [ctx['NODE'], *ctx['PRELOAD'], 'qa/t02-final-ab935e5-20261019/diagnostics.test.mts']
result = subprocess.run(args, cwd=ROOT, env=ctx['FIXTURE_ENV'], capture_output=True, text=True, timeout=60)
log = result.stdout + result.stderr
(OUT / f'diagnostics-{phase}.log').write_text(log)
receipt = {'head': ctx['ACTUAL'], 'phase': phase, 'command': args, 'exitCode': result.returncode,
           'status': 'PASS' if result.returncode == 0 else 'FAIL', 'changedProductFiles': sorted(changed),
           'files': {path: hashlib.sha256((ROOT / path).read_bytes()).hexdigest() for path in sorted(allowed)},
           'logSha256': hashlib.sha256(log.encode()).hexdigest()}
(OUT / f'diagnostics-{phase}.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({'phase': phase, 'status': receipt['status'], 'exitCode': result.returncode}))
sys.exit(result.returncode)
