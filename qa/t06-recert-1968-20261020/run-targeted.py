"""Targeted, offline candidate checks with a secret-free child environment."""
import json
import os
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
NODE = "/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node"
environment = {key: os.environ[key] for key in ("PATH", "HOME", "TMPDIR") if key in os.environ}
environment.update({"NODE_OPTIONS": f"--require={ROOT}/qa/t08/offline.cjs",
                    "NEXT_TELEMETRY_DISABLED": "1", "CI": "1"})
commands = [
    ("callback-feedback", ["--import", "tsx", "--test",
                          "qa/t06-closure-79cd95b-20261020/callback-errors.mjs",
                          "qa/final-delta-20261014/social-feedback.test.mts"]),
    ("social-integration", ["--experimental-test-module-mocks", "--import", "tsx", "--test",
                            "scripts/test-t06-final-social.mts",
                            "scripts/test-t06-social-final.mts"]),
]
results = []
for name, args in commands:
    started = time.monotonic()
    with (OUT / f"{name}.log").open("w") as log:
        process = subprocess.run([NODE, *args], cwd=ROOT, env=environment,
                                 stdout=log, stderr=subprocess.STDOUT, timeout=180)
    results.append({"name": name, "command": [NODE, *args], "exit": process.returncode,
                    "seconds": round(time.monotonic() - started, 2)})
    print(name, "PASS" if process.returncode == 0 else "FAIL", flush=True)
(OUT / "targeted.json").write_text(json.dumps(results, indent=2) + "\n")
raise SystemExit(int(any(row["exit"] != 0 for row in results)))
