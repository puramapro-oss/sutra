"""Explicit private read bridge. No credentials in argv, child environment or logs."""
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys

root = Path(__file__).resolve().parents[2]
target = Path(__file__).resolve().parent
allowed = {'RUNPOD_API_KEY', 'RUNPOD_ENDPOINT_ID', 'SHOTSTACK_API_KEY', 'SHOTSTACK_PRODUCTION_KEY',
           'SHOTSTACK_ENV', 'SUNO_API_KEY', 'SUNO_API_BASE_URL', 'SUNO_BASE_URL', 'LTX_API_KEY',
           'PEXELS_API_KEY', 'ELEVENLABS_API_KEY'}
try:
    if sys.argv[1:] != ['--authorized-free-reads']:
        raise ValueError()
    spec = importlib.util.spec_from_file_location('secure_setup', root / 'qa/t04-salad-access-20261015/secure_setup.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    data, _ = module.read_private(Path.home() / '.env.purama.master')
    lines = []
    for line in data.decode('utf-8').splitlines():
        match = re.fullmatch(r'\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=(.*)', line)
        if match and match[1] in allowed:
            lines.append(match[1] + '=' + match[2])
    node = '/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node'
    result = subprocess.run([node, '--import', 'tsx', str(target / 'read-providers.mts'), '--authorized-free-reads'],
                            cwd=root, env={'PATH': os.defpath}, input='\n'.join(lines), text=True,
                            capture_output=True, timeout=115)
    if result.returncode != 0 or len(result.stdout) > 16384:
        raise ValueError()
    proof = json.loads(result.stdout)
    if proof.get('mutations') != 0 or proof.get('requests', 100) > 7:
        raise ValueError()
    (target / 'free-reads.json').write_text(json.dumps(proof, indent=2) + '\n')
    print(json.dumps({'requests': proof['requests'], 'results': proof['results']}))
except Exception:
    print('T04_FREE_READS_BLOCKED_REDACTED')
    sys.exit(1)
