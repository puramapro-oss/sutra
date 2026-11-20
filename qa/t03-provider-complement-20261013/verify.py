"""Reproduce T03 checks with synthetic credentials and the existing offline guard."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
checks = {
    "music-recovery": ["node", "--import", "tsx", "--test", str(HERE / "music-recovery.test.mts")],
    "typecheck": ["node", "node_modules/typescript/bin/tsc", "--project", str(HERE / "tsconfig.json")],
    "lint": ["node", "node_modules/eslint/bin/eslint.js", str(HERE / "music-recovery.test.mts"), "--max-warnings", "0"],
}
synthetic = {key: os.environ[key] for key in ("PATH", "HOME", "TMPDIR") if key in os.environ}
synthetic.update({
    "NODE_ENV": "test",
    "NODE_OPTIONS": "--require=" + str(ROOT / "qa/t08/offline.cjs"),
    "NEXT_PUBLIC_SUPABASE_URL": "https://supabase.fixture.invalid",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "fixture-anon",
    "SUPABASE_SERVICE_ROLE_KEY": "fixture-service",
})
failed = False
selected = sys.argv[1:] or list(checks)
if any(name not in checks for name in selected):
    raise SystemExit("Unknown check; choose music-recovery, typecheck or lint")
for name in selected:
    command = checks[name]
    started = time.monotonic()
    result = subprocess.run(command, cwd=ROOT, env=synthetic, capture_output=True, text=True, timeout=120)
    (HERE / (name + ".log")).write_text(result.stdout + result.stderr)
    report = {
        "command": command,
        "exit_code": result.returncode,
        "duration_seconds": round(time.monotonic() - started, 3),
        "environment": "synthetic only; offline preload; no master credentials",
    }
    (HERE / (name + "-result.json")).write_text(json.dumps(report, indent=2) + "\n")
    print(name, "PASS" if result.returncode == 0 else "FAIL", result.returncode)
    failed |= result.returncode != 0
raise SystemExit(int(failed))
