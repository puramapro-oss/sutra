"""Targeted local checks with an allowlisted environment and existing offline guard."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
NODE = "/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node"
COMMANDS = {
    "browser-after": [NODE, str(OUT / "browser.mjs"), "after"],
    "security": [NODE, "--experimental-test-module-mocks", "--import", "tsx", "--test",
                 "--test-concurrency=1", "--test-timeout=30000",
                 "qa/t02-final-memoire-20261020/export-security.test.mts",
                 "scripts/test-auth-session.mts", "scripts/test-security-account.mts"],
    "lint": [NODE, "node_modules/eslint/bin/eslint.js", "--max-warnings=0",
             "src/lib/legal/components/MaMemoirePage.tsx",
             "qa/t02-final-memoire-20261020/browser.mjs",
             "qa/t02-final-memoire-20261020/export-security.test.mts"],
    "typecheck": [NODE, "node_modules/typescript/bin/tsc", "--noEmit", "--incremental", "false", "--pretty", "false"],
}
name = sys.argv[1]
command = COMMANDS[name]
safe = {key: os.environ[key] for key in ["PATH", "HOME", "TMPDIR"] if key in os.environ}
safe.update(NODE_OPTIONS="--require=" + str(ROOT / "qa/t08/offline.cjs"), NEXT_TELEMETRY_DISABLED="1")
started = time.monotonic()
process = subprocess.run(command, cwd=ROOT, env=safe, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
log = process.stdout
(OUT / (name + ".log")).write_bytes(log)
receipt = {
    "candidate": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
    "componentSha256": hashlib.sha256((ROOT / "src/lib/legal/components/MaMemoirePage.tsx").read_bytes()).hexdigest(),
    "command": command, "exit": process.returncode, "status": "PASS" if process.returncode == 0 else "FAIL",
    "durationSeconds": round(time.monotonic() - started, 3), "logSha256": hashlib.sha256(log).hexdigest(),
    "environment": "allowlisted OS paths + offline preload; fixture variables only; .env reads denied",
}
(OUT / (name + ".json")).write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps({"check": name, "status": receipt["status"], "exit": process.returncode}))
sys.exit(process.returncode)
