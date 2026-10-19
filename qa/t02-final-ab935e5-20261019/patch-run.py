"""Run the isolated correction gate; never label the base SHA as patched."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
ctx = {'__file__': str(OUT / 'run.py')}
source = (OUT / 'run.py').read_text().split('failed = False')[0]
source = '\n'.join(line for line in source.splitlines() if not line.startswith('assert subprocess.check_output'))
exec(compile(source, str(OUT / 'run.py'), 'exec'), ctx)
product = ['src/app/api/setup/route.ts', 'src/app/api/health/route.ts', 'src/app/api/contact/route.ts']
changed = subprocess.check_output(['git', 'diff', '--name-only', 'HEAD', '--', 'src', 'scripts', 'migrations', 'supabase', 'package.json', 'package-lock.json', 'next.config.ts'], cwd=ROOT, text=True).splitlines()
assert set(changed) <= set(product)
tests = ['qa/t02-final-ab935e5-20261019/' + name + '.test.mts' for name in ['diagnostics', 'contact', 'csrf-replay']]
groups = {
    'patch-regressions': [*ctx['PRELOAD'], *tests],
    'patch-typecheck': ['node_modules/typescript/bin/tsc', '-p', 'qa/t02-final-ab935e5-20261019/tsconfig.json', '--noEmit', '--incremental', 'false'],
    'patch-lint': ['node_modules/eslint/bin/eslint.js', '--max-warnings=0', *product, *tests],
}
failed = False
for group in sys.argv[1:]:
    args = [ctx['NODE'], *groups[group]]
    started = time.monotonic()
    result = subprocess.run(args, cwd=ROOT, env=ctx['FIXTURE_ENV'], capture_output=True, text=True, timeout=180)
    log = result.stdout + result.stderr
    (OUT / f'{group}.log').write_text(log)
    receipt = {'head': ctx['ACTUAL'], 'testedTree': 'isolated correction; hashes authoritative, not integrated candidate',
               'command': args, 'exitCode': result.returncode, 'status': 'PASS' if result.returncode == 0 else 'FAIL',
               'durationSeconds': round(time.monotonic() - started, 2),
               'productFiles': {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in product},
               'logSha256': hashlib.sha256(log.encode()).hexdigest()}
    for label in ['tests', 'pass', 'fail', 'skipped']:
        found = re.search(r'^# ' + label + r' (\d+)$', log, re.M)
        if found: receipt[label] = int(found[1])
    (OUT / f'{group}.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(group + ': ' + receipt['status'], flush=True)
    failed |= result.returncode != 0
sys.exit(int(failed))
