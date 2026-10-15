"""Independent acceptance: exact frozen candidate, existing assertions, isolated I/O."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
CANDIDATE = "72f406b940b7e3cdfb27873751a4059375646f25"
NODE = "/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node"
TESTS = {
    "harness": ["qa/t08-acceptance-72f406b-20261015/harness-boundaries.test.mjs"],
    "rpc": ["scripts/test-t02-rpc-security-production.mts"],
    "history-routes": ["qa/t06-integrated-retest-20261015/history-routes.test.mts"],
    "history-sql": ["scripts/test-final-social-history.mjs"],
    "cancellation": ["qa/t08-final-candidate-20261015/cancellation.test.mts"],
    "capabilities": ["scripts/test-t02-final-security-grants.mts"],
    "social-authority": ["scripts/test-t06-final-social.mts"],
    "journey": ["scripts/test-t08-integration-journey.mts"],
}
manifest = json.loads((ROOT / "qa/t01-final-20261015/tested-source-manifest.json").read_text())
for row in manifest["files"]:
    assert hashlib.sha256((ROOT / row["path"]).read_bytes()).hexdigest() == row["sha256"], row["path"]
assert subprocess.check_output(["git", "merge-base", CANDIDATE, "HEAD"], cwd=ROOT, text=True).strip() == CANDIDATE
config = {key: os.environ[key] for key in ("PATH", "HOME", "TMPDIR", "LANG") if key in os.environ}
config.update(NODE_OPTIONS="--require=" + str(ROOT / "qa/t08/offline.cjs"), NODE_ENV="test",
              NEXT_TELEMETRY_DISABLED="1", LTX_TRACK_DB="0", OTS_NETWORK="0",
              NEXT_PUBLIC_SUPABASE_URL="https://sutra.fixture.invalid", NEXT_PUBLIC_APP_SCHEMA="sutra",
              NEXT_PUBLIC_SUPABASE_ANON_KEY="fixture-anon", SUPABASE_SERVICE_ROLE_KEY="fixture-service",
              ZERNIO_API_KEY="fixture-only")
failed = False
for phase in sys.argv[1:] or TESTS:
    selected = dict(config)
    if phase == "social-authority":
        selected["NEXT_PUBLIC_SUPABASE_URL"] = "https://sutra-test.invalid"
    command = [NODE, "--experimental-test-module-mocks", "--experimental-vm-modules", "--import", "tsx",
               "--test", "--test-reporter=tap", "--test-concurrency=1", *TESTS[phase]]
    if phase == "history-routes":
        command = [NODE, str(OUT / "run-postgres.mjs")]
    elif phase == "history-sql":
        command = [NODE, "--require", str(OUT / "evidence-output.cjs"), "scripts/test-final-social-history.mjs"]
    start = datetime.now(timezone.utc)
    run = subprocess.run(command, cwd=ROOT, env=selected, capture_output=True, text=True, timeout=180)
    output = run.stdout + run.stderr
    (OUT / (phase + ".log")).write_text(output)
    counts = {key: int(value) for key, value in re.findall(r"# (tests|pass|fail|skipped) (\d+)", output)}
    if phase == "history-routes":
        raw = (OUT / "postgres.log").read_text()
        counts = {key: int(value) for key, value in re.findall(r"# (tests|pass|fail|skipped) (\d+)", raw)}
    elif phase == "history-sql":
        data = json.loads((OUT / "pg-social-history-result.json").read_text())
        counts = {"tests": len(data["checks"]), "pass": len(data["checks"]), "fail": data["failures"], "skipped": data["skips"]}
    record = {"candidate": CANDIDATE, "startedAt": start.isoformat(), "finishedAt": datetime.now(timezone.utc).isoformat(),
              "command": command, "exitCode": run.returncode, "counts": counts,
              "environment": "allowlisted synthetic values; offline preload denies external I/O and env files",
              "testFilesSHA256": {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in TESTS[phase]},
              "log": phase + ".log"}
    (OUT / (phase + ".json")).write_text(json.dumps(record, indent=2) + "\n")
    print(phase, run.returncode, counts, flush=True)
    failed |= run.returncode != 0 or counts.get("fail", 1) != 0 or counts.get("skipped", 1) != 0
raise SystemExit(int(failed))
