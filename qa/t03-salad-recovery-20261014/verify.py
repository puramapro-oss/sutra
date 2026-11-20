"""Targeted T03 checks: synthetic configuration, no network or subprocess generation."""
import json
import hashlib
import os
from pathlib import Path
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
TARGET = "scripts/test-t03-salad-recovery.mts"
checks = {
    "recovery": ["node", "--import", "tsx", "--test", TARGET],
    "typecheck": ["node", "node_modules/typescript/bin/tsc", "--project", str(HERE / "tsconfig.json")],
    "lint": ["node", "node_modules/eslint/bin/eslint.js", TARGET, str(HERE / "adapter-recovery.test.mts"), str(HERE / "offline.cjs"), "--max-warnings", "0"],
    "adapter": ["node", "--import", "tsx", "--test", str(HERE / "adapter-recovery.test.mts")],
}
synthetic = {key: os.environ[key] for key in ("PATH", "HOME", "TMPDIR") if key in os.environ}
synthetic.update({
    "NODE_ENV": "test",
    "NODE_OPTIONS": "--require=" + str(HERE / "offline.cjs"),
    "NEXT_PUBLIC_SUPABASE_URL": "https://supabase.fixture.invalid",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "fixture-anon",
    "SUPABASE_SERVICE_ROLE_KEY": "fixture-service",
    "LOCAL_ENGINE_ENABLED": "true",
    "LOCAL_ENGINE_MODE": "auto",
    "LOCAL_VIDEO_API_URL": "https://worker.fixture.invalid/generate",
    "RUNPOD_API_KEY": "fixture-unused",
    "RUNPOD_ENDPOINT_ID": "fixture-unused",
    "LTX_API_KEY": "fixture-unused",
})
selected = sys.argv[1:] or ["recovery", "typecheck", "lint"]
if any(name not in checks for name in selected):
    raise SystemExit("Unknown check; choose recovery, typecheck, lint or adapter")
source = Path(os.environ.get("T03_SALAD_SOURCE", ROOT)).resolve()
if "adapter" in selected:
    if not (source / "src/lib/salad/client.ts").is_file():
        raise SystemExit("Adapter check requires T03_SALAD_SOURCE pointing to the T04 worktree; no copying/integration")
    synthetic["T03_SALAD_SOURCE"] = str(source)

def source_snapshot():
    paths = sorted((source / "src/lib/salad").glob("*.ts"))
    return {str(path.relative_to(source)): hashlib.sha256(path.read_bytes()).hexdigest() for path in paths}

failed = False
for name in selected:
    command = checks[name]
    before = source_snapshot() if name == "adapter" else None
    started = time.monotonic()
    result = subprocess.run(command, cwd=ROOT, env=synthetic, capture_output=True, text=True, timeout=120)
    (HERE / (name + ".log")).write_text(result.stdout + result.stderr)
    report = {
        "command": command, "exit_code": result.returncode,
        "duration_seconds": round(time.monotonic() - started, 3),
        "environment": "synthetic only; no master or .env read; all sockets/subprocess generation denied",
    }
    if name == "adapter":
        report["source_root"] = str(source)
        report["source_head"] = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=source, text=True).strip()
        report["source_files_sha256"] = before
        report["source_stable_during_check"] = before == source_snapshot()
        report["source_dirty"] = subprocess.check_output(["git", "status", "--porcelain", "--", "src/lib/salad"], cwd=source, text=True).splitlines()
        report["qualification"] = "WORKTREE_WIP_ONLY" if report["source_dirty"] else "COMMITTED_SOURCE_OFFLINE_ONLY"
        if not report["source_stable_during_check"]:
            report["exit_code"] = 1
    (HERE / (name + "-result.json")).write_text(json.dumps(report, indent=2) + "\n")
    print(name, "PASS" if report["exit_code"] == 0 else "FAIL", report["exit_code"])
    failed |= report["exit_code"] != 0
raise SystemExit(int(failed))
