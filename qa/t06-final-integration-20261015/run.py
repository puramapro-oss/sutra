"""Targeted mocks with synthetic environment and the existing network/env-file guard."""
from pathlib import Path
import json
import os
import subprocess
import sys

root = Path(__file__).resolve().parents[2]
out = Path(__file__).resolve().parent
label = sys.argv[1]
assert label in {"before", "after", "gate"}
runtime = "/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node"
child_environment = {key: os.environ[key] for key in ["PATH", "HOME", "TMPDIR"] if key in os.environ}
child_environment.update({"CI": "1", "NODE_ENV": "test", "NEXT_TELEMETRY_DISABLED": "1",
                          "NODE_OPTIONS": "--require=" + str(root / "qa/t08/offline.cjs")})
commands = [("autopilot", [runtime, "--experimental-test-module-mocks", "--import", "tsx", "--test", "--test-reporter=tap",
                          "qa/t06-final-integration-20261015/autopilot.test.mts"])]
if label == "gate":
    commands += [("typecheck", [runtime, "node_modules/typescript/bin/tsc", "--noEmit", "--project", "qa/t06-final-integration-20261015/tsconfig.json"]),
                 ("lint", [runtime, "node_modules/eslint/bin/eslint.js", "--max-warnings=0", "src/app/api/social/autopilot/route.ts", "qa/t06-final-integration-20261015/autopilot.test.mts"])]
results = []
for name, command in commands:
    run = subprocess.run(command, cwd=root, env=child_environment, capture_output=True, text=True, timeout=120)
    (out / f"{label}-{name}.log").write_text(run.stdout + run.stderr)
    results.append({"command": command, "exitCode": run.returncode, "name": name, "status": "PASS" if run.returncode == 0 else "FAIL"})
    print(name, results[-1]["status"])
(out / f"{label}-results.json").write_text(json.dumps(results, indent=2) + "\n")
sys.exit(int(any(item["exitCode"] for item in results)))
