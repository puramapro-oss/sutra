"""Only new/affected tests; no ambient secrets, sockets or generation processes."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
TARGET = "scripts/test-t03-orchestration-fixes.mts"
FILES = ["src/lib/video-queue.ts", "src/lib/video-worker.ts", "src/lib/video-pipeline.ts", "src/lib/production-pipeline.ts", "src/lib/sutra-auto.ts", "src/lib/music-checkpoint.ts"]
TESTS = [TARGET, "scripts/test-t03-suno-recovery.mts", "scripts/test-t03-salad-recovery.mts", "qa/t03-orchestration-fixes-20261014/finish-postgres.test.mts"]
checks = {
    "regression": ["node", "--experimental-test-module-mocks", "--import", "tsx", "--test", TARGET],
    "suno": ["node", "--experimental-test-module-mocks", "--import", "tsx", "--test", "scripts/test-t03-suno-recovery.mts"],
    "affected": ["node", "--import", "tsx", "--test", "scripts/test-t03-salad-recovery.mts", "scripts/test-production-queue.mts"],
    "auto": ["node", "--import", "tsx", "--test", "scripts/test-auto-export-queue.mts"],
    "typecheck": ["node", "node_modules/typescript/bin/tsc", "--project", str(HERE / "tsconfig.json")],
    "lint": ["node", "node_modules/eslint/bin/eslint.js", *TESTS, *FILES, "--max-warnings", "0"],
}
config = {key: os.environ[key] for key in ("PATH", "HOME", "TMPDIR") if key in os.environ}
config.update({"NODE_ENV": "test", "NODE_OPTIONS": "--require=" + str(ROOT / "qa/t03-salad-recovery-20261014/offline.cjs"),
    "NEXT_PUBLIC_SUPABASE_URL": "https://db.fixture.invalid", "NEXT_PUBLIC_SUPABASE_ANON_KEY": "fixture-anon",
    "SUPABASE_SERVICE_ROLE_KEY": "fixture-service", "LOCAL_ENGINE_ENABLED": "true", "LOCAL_ENGINE_MODE": "auto",
    "LOCAL_VIDEO_API_URL": "https://worker.fixture.invalid/generate", "RUNPOD_API_KEY": "fixture-unused",
    "RUNPOD_ENDPOINT_ID": "fixture-unused", "LTX_API_KEY": "fixture-unused"})
selected = sys.argv[1:] or list(checks)
label = "before" if selected[0] == "before" else "after"
if selected[0] == "before":
    selected = selected[1:] or ["regression"]
failed = False
for name in selected:
    command = checks[name]
    started = time.monotonic()
    result = subprocess.run(command, cwd=ROOT, env=config, capture_output=True, text=True, timeout=180)
    stem = label + "-" + name
    (HERE / (stem + ".log")).write_text(result.stdout + result.stderr)
    report = {"command": command, "exit_code": result.returncode, "duration_seconds": round(time.monotonic() - started, 3),
        "source_head": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "source_sha256": {path: hashlib.sha256((ROOT / path).read_bytes()).hexdigest() for path in [*FILES, *TESTS]},
        "environment": "synthetic only, .env denied, sockets and media/generation processes denied"}
    (HERE / (stem + ".json")).write_text(json.dumps(report, indent=2) + "\n")
    print(stem, "PASS" if result.returncode == 0 else "FAIL", result.returncode)
    failed |= result.returncode != 0
raise SystemExit(int(failed))
