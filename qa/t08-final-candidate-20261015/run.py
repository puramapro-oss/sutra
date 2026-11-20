"""Independent, bounded acceptance on the exact T01 candidate; owner tests reused."""
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
CANDIDATE = "3855665fa79e3cc2171124d864a834214d6ac617"
NODE = os.environ.get("T08_NODE", "/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node")
CONFIG = {key: os.environ[key] for key in ("PATH", "HOME", "TMPDIR", "LANG") if key in os.environ}
CONFIG.update(NODE_OPTIONS="--require=" + str(ROOT / "qa/t08/offline.cjs"),
              NODE_ENV="test", NEXT_TELEMETRY_DISABLED="1", LTX_TRACK_DB="0", OTS_NETWORK="0",
              NEXT_PUBLIC_SUPABASE_URL="https://sutra.fixture.invalid",
              NEXT_PUBLIC_SUPABASE_ANON_KEY="fixture-anon",
              SUPABASE_SERVICE_ROLE_KEY="fixture-service", ZERNIO_API_KEY="fixture-only")
TESTS = {
    "production-error": ["qa/t02-final-validation-20261014/production-error.test.mts"],
    "durable": ["scripts/test-t03-durable-reliability.mts", "qa/t03-durable-reliability-20261014/submission.test.mts"],
    "social-authority": ["scripts/test-t06-social-validation.mts"],
    "modes": ["scripts/test-t08-final-modes.mts"],
    "cancellation": ["qa/t08-final-candidate-20261015/cancellation.test.mts"],
    "journey": ["scripts/test-t08-integration-journey.mts"],
}
FLAGS = [NODE, "--experimental-test-module-mocks", "--experimental-vm-modules", "--import", "tsx", "--test", "--test-concurrency=1"]
# A documentation-only successor is permitted; never test changed product as this candidate.
scope = ["src", "migrations", "package.json", "package-lock.json", "scripts", "qa/t08/offline.cjs",
         "qa/t08-integration-journey-20261014/database.mts",
         "qa/t02-final-validation-20261014/production-error.test.mts",
         "qa/t03-durable-reliability-20261014/submission.test.mts"]
assert not subprocess.check_output(["git", "diff", CANDIDATE, "--", *scope], cwd=ROOT), "candidate or harness changed"
failed = False
for phase in sys.argv[1:] or TESTS:
    command = [*FLAGS, *TESTS[phase]]
    config = dict(CONFIG)
    if phase == "durable":
        config["NEXT_PUBLIC_SUPABASE_URL"] = "https://db.fixture.invalid"
    result = subprocess.run(command, cwd=ROOT, env=config, text=True, capture_output=True, timeout=120)
    output = result.stdout + result.stderr
    (OUT / (phase + ".log")).write_text(output)
    counts = {key: int(value) for key, value in re.findall(r"(?:#|ℹ) (tests|pass|fail|skipped) (\d+)", output)}
    record = {"phase": phase, "candidate": CANDIDATE, "utc": datetime.now(timezone.utc).isoformat(),
              "command": command, "exitCode": result.returncode, "counts": counts,
              "testFilesSHA256": {path: hashlib.sha256((ROOT / path).read_bytes()).hexdigest() for path in TESTS[phase]},
              "environment": "allowlist; synthetic configuration; offline preload; env files denied",
              "databaseFixtureURL": config["NEXT_PUBLIC_SUPABASE_URL"], "log": phase + ".log"}
    (OUT / (phase + ".json")).write_text(json.dumps(record, indent=2) + "\n")
    print(phase, result.returncode, counts, flush=True)
    failed |= result.returncode != 0 or counts.get("fail", 1) != 0 or counts.get("skipped", 1) != 0
sys.exit(int(failed))
