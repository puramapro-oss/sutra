"""Bounded secret scan. Never open env files or report matching values."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
paths = [p for p in tracked if p and (p.startswith(('src/', 'scripts/', 'migrations/', 'supabase/'))
         or p in ('package.json', 'package-lock.json', 'next.config.ts'))]
paths += [str(p.relative_to(ROOT)) for p in OUT.iterdir() if p.is_file()
          and p.suffix in ('.py', '.mts', '.json', '.log', '.md') and not p.name.startswith('gitleaks')]
parts = []; ranges = []; line = 1
for path in sorted(set(paths)):
    assert not any(part.startswith('.env') for part in Path(path).parts)
    raw = (ROOT / path).read_bytes()
    try: content = raw.decode('utf8')
    except UnicodeDecodeError: continue
    chunk = f'\nFILE: {path}\n' + content + '\n'
    ranges.append((line + 2, line + chunk.count('\n'), path))
    line += chunk.count('\n'); parts.append(chunk)
payload = ''.join(parts)
args = ['gitleaks', 'stdin', '--redact=100', '--report-format=json', '--report-path', str(OUT / 'gitleaks.json'), '--no-banner']
result = subprocess.run(args, input=payload, env={'PATH': '/opt/homebrew/bin:/usr/bin:/bin'}, capture_output=True, text=True, timeout=120)
assert result.returncode in (0, 1), 'Scanner failed'
findings = json.loads((OUT / 'gitleaks.json').read_text())
triage = []
for finding in findings:
    location = next(((start, path) for start, end, path in ranges if start <= finding['StartLine'] <= end), None)
    assert location
    start, path = location
    triage.append({'rule': finding['RuleID'], 'file': path, 'line': finding['StartLine'] - start + 1,
                   'fileSha256': hashlib.sha256((ROOT / path).read_bytes()).hexdigest()})
receipt = {'head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
           'command': args, 'exitCode': result.returncode, 'inputFiles': len(ranges),
           'inputSha256': hashlib.sha256(payload.encode()).hexdigest(), 'findings': triage,
           'scope': 'source/scripts/SQL/packages/config plus this QA; no env/master/history/remote artifacts',
           'rules': 'default, redact100, no suppression'}
(OUT / 'gitleaks-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({'findingCount': len(triage), 'findings': triage}))
