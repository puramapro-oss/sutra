"""One explicit free GET through the actual adapter; no raw account data output."""
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys

root = Path(__file__).resolve().parents[2]
target = Path(__file__).resolve().parent
try:
    if sys.argv[1:] != ['--authorized-free-read']:
        raise ValueError()
    spec = importlib.util.spec_from_file_location('private', root / 'qa/t04-salad-access-20261015/secure_setup.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    data, _ = module.read_private(Path.home() / '.env.purama.master')
    selected = []
    for line in data.decode().splitlines():
        match = re.fullmatch(r'\s*(?:export\s+)?(UNSPLASH_ACCESS_KEY)\s*=(.*)', line)
        if match:
            selected.append(match[1] + '=' + match[2])
    if len(selected) != 1:
        raise ValueError()
    result = subprocess.run([
        '/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node',
        '--import', 'tsx', str(target / 'unsplash-read.mts'), '--authorized-free-read'],
        cwd=root, env={'PATH': os.defpath}, input=selected[0], text=True,
        capture_output=True, timeout=30)
    if result.returncode or len(result.stdout) > 2048:
        raise ValueError()
    proof = json.loads(result.stdout)
    if proof['requests'] != 1 or proof['mutations'] != 0:
        raise ValueError()
    (target / 'unsplash-read.json').write_text(json.dumps(proof, indent=2) + '\n')
    print(json.dumps(proof))
except Exception:
    print('UNSPLASH_READ_FAILED_REDACTED')
    sys.exit(1)
