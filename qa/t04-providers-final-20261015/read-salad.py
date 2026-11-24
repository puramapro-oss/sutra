"""Only explicit safe scoped reads; metadata only, no master mutation or secret output."""
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from datetime import datetime, timezone

root = Path(__file__).resolve().parents[2]
target = Path(__file__).resolve().parent
try:
    if sys.argv[1:] != ['--authorized-free-reads']:
        raise ValueError()
    spec = importlib.util.spec_from_file_location('secure_setup', root / 'qa/t04-salad-access-20261015/secure_setup.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    data, _ = module.read_private(Path.home() / '.env.purama.master')
    names = ['SALAD_API_KEY', 'SALAD_ORGANIZATION_NAME', 'SALAD_PROJECT_NAME']
    values, metadata = {}, []
    for name in names:
        matches = []
        for line in data.decode('utf-8').splitlines():
            match = re.fullmatch(r'\s*(?:export\s+)?' + name + r'\s*=(.*)', line)
            if match:
                matches.append(match[1])
        pattern = r'[A-Za-z0-9._~-]{16,512}' if name == 'SALAD_API_KEY' else r'[a-z][a-z0-9-]{0,61}[a-z0-9]'
        valid = len(matches) == 1 and re.fullmatch(pattern, matches[0]) is not None
        metadata.append({'name': name, 'present': bool(matches), 'unique': len(matches) == 1,
                         'literalTransportSyntax': valid, 'source': 'master' if matches else 'absent'})
        if valid:
            values[name] = matches[0]
    proof = {'observedAt': datetime.now(timezone.utc).isoformat(), 'source': '~/.env.purama.master',
             'permissionsRestricted': True, 'variables': metadata, 'requests': 0, 'mutations': 0, 'retries': 0,
             'status': 'BLOQUE', 'reason': 'MISSING_OR_INVALID_SELECTED_FIELDS',
             'authentication': 'NON_TESTE', 'credits': 'NON_TESTE', 'generation': 'NON_TESTE'}
    if len(values) == 3:
        node = '/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node'
        result = subprocess.run([node, str(root / 'qa/t04-salad-access-20261015/validate-access.mjs')],
                                cwd=root, env={'PATH': os.defpath}, input=json.dumps(values), text=True,
                                capture_output=True, timeout=40)
        if result.returncode or len(result.stdout) > 8192:
            raise ValueError()
        audit = json.loads(result.stdout)
        if audit.get('requests', 3) > 2:
            raise ValueError()
        proof.update({'results': audit, 'requests': audit['requests'], 'status': audit['status'],
                      'reason': 'SEE_SCOPED_READ_RESULTS',
                      'authentication': 'CONFIRMED' if audit['status'] == 'PASS_READ_ONLY' else 'UNPROVEN'})
    (target / 'salad-read.json').write_text(json.dumps(proof, indent=2) + '\n')
    print(json.dumps(proof))
except Exception:
    print('T04_SALAD_READ_BLOCKED_REDACTED')
    sys.exit(1)
