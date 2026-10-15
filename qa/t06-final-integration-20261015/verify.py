"""Read-only reconciliation of the exact T01 candidate and existing mock receipts.

No provider, environment file, database, build, or application mutation is used.
The only writes are this directory's integration.json and selected CI assertions.
"""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
T01 = Path(sys.argv[1]).resolve()
CANDIDATE = sys.argv[2]
assert re.fullmatch(r"[0-9a-f]{40}", CANDIDATE)
assert subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=T01, text=True).strip() == CANDIDATE
PREVIOUS = ROOT / "qa/t06-integrated-retest-20261015"
ARTIFACTS = T01 / "qa/t01-closure-20261015/ci-cb3f893-contract-artifacts"
CONTRACTS = ARTIFACTS / "test-results/ci/contracts"
receipt = {
    "recordedAt": datetime.now(timezone.utc).isoformat(),
    "candidate": CANDIDATE,
    "ciRun": 38797929920,
    "previousDelivery": "3edae7ae1d3c13ed2b385a9602a9ad8da6ca5b6d",
    "mode": "read-only source and existing exact-candidate CI reconciliation, no test rerun",
    "files": [], "ciEvidence": [], "groups": {},
}
manifest = json.loads((PREVIOUS / "source-manifest.json").read_text())
for entry in manifest["files"]:
    path = entry["path"]
    content = subprocess.check_output(["git", "show", f"{CANDIDATE}:{path}"], cwd=ROOT)
    actual = hashlib.sha256(content).hexdigest()
    expected = entry["sha256"]
    origin = "previous T06 source manifest"
    if path == "migrations/20261015_social_authorization_history.sql":
        expected = hashlib.sha256((PREVIOUS / "t01-social-history.sql").read_bytes()).hexdigest()
        origin = "exact T01 SQL fixture already tested 9/9 locally"
    assert actual == expected, ("SOURCE_CHANGED", path)
    receipt["files"].append({"path": path, "sha256": actual, "status": "MATCH", "origin": origin})

# Include changed boundary route, its current tests, UI journey, and runner inputs.
for path in [
    "src/app/api/auto/config/route.ts", "qa/t01-closure-20261015/auto-config.test.mts",
    "src/app/(dashboard)/settings/social/page.tsx", "src/components/settings/social/PlatformGrid.tsx",
    "scripts/run-ci.mjs", ".github/workflows/web-ci.yml", "src/lib/account-access.ts",
]:
    content = subprocess.check_output(["git", "show", f"{CANDIDATE}:{path}"], cwd=ROOT)
    receipt["files"].append({"path": path, "sha256": hashlib.sha256(content).hexdigest(), "origin": "current candidate"})

counts = json.loads((T01 / "qa/t01-closure-20261015/ci-cb3f893-contract-counts.json").read_text())
assert counts["source"] == CANDIDATE and counts["ciRun"] == receipt["ciRun"]
for group in counts["groups"]:
    if not group["path"].startswith("test-results/ci/contracts/"):
        continue
    path = ARTIFACTS / group["path"]
    actual = hashlib.sha256(path.read_bytes()).hexdigest()
    assert actual == group["sha256"], ("CI_LOG_CHANGED", str(path))
    receipt["ciEvidence"].append({"path": str(path), "sha256": actual, "counts": group["counts"]})
results = json.loads((CONTRACTS / "results.json").read_text())
for result in results:
    assert result["status"] == "PASS" and result["exitCode"] == 0, result["name"]
receipt["commands"] = results
contract_result = next(item for item in results if item["name"] == "contracts")
for name in [
    "scripts/test-t06-final-social.mts", "scripts/test-t06-social-final.mts",
    "scripts/test-t06-social-routes.mts", "scripts/test-t02-oauth-boundaries.mts",
    "scripts/test-t06-social-autonomy.mts", "scripts/test-t06-social-validation.mts",
    "scripts/test-social-publication.mts", "qa/t01-closure-20261015/auto-config.test.mts",
]:
    assert name in contract_result["command"], ("CI_TEST_MISSING", name)
ci_log = (CONTRACTS / "contracts.log").read_text()
ci_passes = re.findall(r"^[✔✓] (.+) \([0-9.]+ms\)$", ci_log, re.M)
selected = []
for label, expected_count in [("oauth", 76), ("publication", 92)]:
    old_log = (PREVIOUS / f"{label}.log").read_text()
    names = re.findall(r"^# Subtest: (.+)$", old_log, re.M)
    assert len(names) == expected_count and len(set(names)) == expected_count
    for name in names:
        assert ci_passes.count(name) == 1, ("CI_PASS_MISSING_OR_AMBIGUOUS", label, name)
        selected.append(f"PASS [{label}] {name}")
    receipt["groups"][label] = {"pass": len(names), "fail": 0, "skip": 0, "names": names}

config_names = ci_passes[ci_passes.index("GET rejects anonymous before privileged access"):
                        ci_passes.index("unknown fields cannot trigger a write") + 1]
assert len(config_names) == 22
receipt["groups"]["auto-config"] = {"pass": 22, "fail": 0, "skip": 0, "names": config_names}
selected.extend(f"PASS [auto-config] {name}" for name in config_names)
for label in ["schedule", "publication"]:
    log = (CONTRACTS / f"{label}.log").read_text()
    lines = [line for line in log.splitlines() if line.startswith("PASS:")]
    assert lines and "FAIL" not in log
    receipt["groups"][f"{label}-non-tap"] = {"status": "PASS", "assertions": lines}
    selected.extend(lines)

db_path = T01 / "qa/t01-closure-20261015/ci-cb3f893-database.log"
db_counts = json.loads((T01 / "qa/t01-closure-20261015/ci-cb3f893-database-counts.json").read_text())
assert db_counts["source"] == CANDIDATE and db_counts["ciRun"] == receipt["ciRun"]
assert hashlib.sha256(db_path.read_bytes()).hexdigest() == db_counts["logSha256"]
db_log = db_path.read_text()
assert "PASS PostgreSQL T06 history" in db_log
assert db_counts["status"] == "PASS" and db_counts["t06History"] == "PASS"
assert db_counts["socialHistory"] == 27
receipt["database"] = db_counts
receipt["database"]["logPath"] = str(db_path)
receipt["database"]["t06HistoryCaseNames"] = re.findall(
    r"^# Subtest: (.+)$", (PREVIOUS / "postgres-t01.log").read_text(), re.M)
assert len(receipt["database"]["t06HistoryCaseNames"]) == 9
receipt["database"]["countQualification"] = "CI step PASS; nine cases from identical fixture and previous local TAP, not nine printed CI assertions"

receipt["status"] = "PASS_INTEGRATED_SOCIAL_MOCK_CONTRACTS"
receipt["limits"] = [
    "No production/OAuth consent/provider publication test or claim",
    "Remote token encryption, rotation, actual granted scopes, organization membership not proven by mocks",
    "Application tenant model is user UUID bound to unique Zernio profile, no native organization dimension",
    "Candidate acceptance/production status remain T01/T08, not inferred from social CI jobs",
    "No new functional test run; exact-candidate CI and immutable previous test names reconciled",
]
(OUT / "integration.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n")
(OUT / "selected-ci-assertions.txt").write_text("\n".join(selected) + "\n")
print(json.dumps({"status": receipt["status"], "candidate": CANDIDATE,
                  "sourceChecks": len(receipt["files"]), "oauth": 76, "publication": 92,
                  "autoConfig": 22, "historyStep": "PASS", "newFunctionalRuns": 0}))
