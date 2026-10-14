"""Run only T02 checks, with an empty inherited environment and offline transport.

All product modules are read-only. The target manifest records WIP content hashes;
a changed target during a test is reported as unstable, never as a fresh PASS.
"""
import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = Path(__file__).resolve().parent
PARSER = argparse.ArgumentParser()
PARSER.add_argument("--suite", choices=["base", "contract", "quality"], required=True)
PARSER.add_argument("--node", default=shutil.which("node"))
PARSER.add_argument("--target", type=Path)
ARGS = PARSER.parse_args()
if not ARGS.node:
    PARSER.error("Node is required")
if ARGS.suite == "contract" and not ARGS.target:
    PARSER.error("--target must name the real product checkout")

CHILD_CONFIG = {"PATH": "/usr/bin:/bin:/usr/sbin:/sbin", "LANG": "C.UTF-8"}
if ARGS.target:
    CHILD_CONFIG["T02_SALAD_TARGET"] = str(ARGS.target.resolve())
FLAGS = [ARGS.node, "--experimental-test-module-mocks", "--experimental-vm-modules",
         "--require", "./qa/t08/offline.cjs", "--import", "tsx", "--test"]
CONTRACT_TEST = "qa/t02-salad-security-20261014/test-t02-salad-security-contract.mts"
COMMANDS = {
    "base": [[*FLAGS, "scripts/test-t02-salad-security.mts"]],
    "contract": [[*FLAGS, CONTRACT_TEST]],
    "quality": [
        [ARGS.node, "node_modules/eslint/bin/eslint.js", "scripts/test-t02-salad-security.mts", CONTRACT_TEST],
        [ARGS.node, "node_modules/typescript/bin/tsc", "-p", "qa/t02-salad-security-20261014/tsconfig.json"],
    ],
}


def snapshot(root):
    paths = ["package-lock.json", "scripts/comfyui-engine-server.mjs", "src/lib/local-engine.ts",
             "src/lib/private-media.ts", "src/lib/storage.ts", "src/lib/media-probe.ts",
             "src/app/api/production/route.ts", "src/lib/utils.ts"]
    paths += [str(path.relative_to(root)) for path in sorted((root / "src/lib/salad").glob("*.ts"))]
    return {path: hashlib.sha256((root / path).read_bytes()).hexdigest() for path in paths if (root / path).is_file()}


target = ARGS.target.resolve() if ARGS.suite == "contract" else ROOT
before = snapshot(target)
records = []
for index, command in enumerate(COMMANDS[ARGS.suite]):
    name = ["lint", "types"][index] if ARGS.suite == "quality" else ARGS.suite + "-tests"
    with (EVIDENCE / (name + ".log")).open("w") as output:
        result = subprocess.run(command, cwd=ROOT, env=CHILD_CONFIG, stdout=output, stderr=subprocess.STDOUT, timeout=120)
    log = EVIDENCE / (name + ".log")
    content = log.read_text()
    if content:
        log.write_text("\n".join(line.rstrip() for line in content.splitlines()).rstrip() + "\n")
    records.append({"command": command, "exitCode": result.returncode, "log": name + ".log"})
    print(name + " exit=" + str(result.returncode), flush=True)
after = snapshot(target)
head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=target, env=CHILD_CONFIG, capture_output=True, text=True, check=True).stdout.strip()
manifest = {"utc": datetime.now(timezone.utc).isoformat(), "productRoot": str(target), "head": head,
            "suite": ARGS.suite, "productHashesBefore": before, "productHashesAfter": after,
            "stableDuringRun": before == after, "inheritedSecrets": False, "liveProviderCalls": 0,
            "mediaProbe": "mocked; not a media-validity proof", "commands": records}
(EVIDENCE / (ARGS.suite + "-manifest.json")).write_text(json.dumps(manifest, indent=2) + "\n")
if before != after:
    print("T02_TARGET_CHANGED_DURING_CHECK", file=sys.stderr)
sys.exit(1 if before != after or any(record["exitCode"] != 0 for record in records) else 0)
