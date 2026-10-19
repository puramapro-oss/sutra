"""Targeted partner correction and separate SQL-owner counterexample; synthetic I/O."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[1]
ctx = {'__file__': str(OUT / 'run.py')}
source = (OUT / 'run.py').read_text().split('failed = False')[0]
source = '\n'.join(line for line in source.splitlines() if not line.startswith('assert subprocess.check_output'))
exec(compile(source, str(OUT / 'run.py'), 'exec'), ctx)
product = ['src/app/api/partner/qr/[code]/route.ts', 'src/app/api/partner/scan/[code]/route.ts']
changed = subprocess.check_output(['git', 'diff', '--name-only', 'HEAD', '--', 'src', 'scripts', 'migrations', 'package.json', 'package-lock.json'], cwd=ROOT, text=True).splitlines()
assert set(changed) <= set(product), 'Unexpected product delta'
tests = [str(OUT.relative_to(ROOT) / name) for name in ['partner-boundary.test.mts', 'partner-quota-atomicity.test.mts']]
groups = {
    'partner-green': [*ctx['PRELOAD'], tests[0]],
    'partner-atomicity-red': [*ctx['PRELOAD'], tests[1]],
    'partner-typecheck': ['node_modules/typescript/bin/tsc', '-p', str(OUT.relative_to(ROOT) / 'tsconfig-partner.json'), '--noEmit', '--incremental', 'false'],
    'partner-lint': ['node_modules/eslint/bin/eslint.js', '--max-warnings=0', *product, *tests],
}
failed = False
for group in sys.argv[1:]:
    args = [ctx['NODE'], *groups[group]]
    result = subprocess.run(args, cwd=ROOT, env=ctx['FIXTURE_ENV'], capture_output=True, text=True, timeout=120)
    log = result.stdout + result.stderr
    (OUT / f'{group}.log').write_text(log)
    receipt = {'head': ctx['ACTUAL'], 'testedTree': 'local partner correction; not integrated',
               'command': args, 'exitCode': result.returncode,
               'productFiles': {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in product},
               'logSha256': hashlib.sha256(log.encode()).hexdigest()}
    for label in ['tests', 'pass', 'fail', 'skipped']:
        found = re.search(r'^# ' + label + r' (\d+)$', log, re.M)
        if found: receipt[label] = int(found[1])
    (OUT / f'{group}.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(f'{group}: exit {result.returncode}', flush=True)
    failed |= result.returncode != 0
sys.exit(int(failed))
