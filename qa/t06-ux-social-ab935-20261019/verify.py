"""Reconcile social proof from the exact T01 candidate; no functional rerun.

Reads Git blobs and already downloaded CI evidence. No application, database,
provider, secret, environment file, or deployment access. Writes only local QA.
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
CANDIDATE = "ab935e59ca4e39776630f05b2ba6c0422c74ec62"
CI_RUN = 38827288351
PREVIOUS = ROOT / "qa/t06-integrated-retest-20261015"
LAST = ROOT / "qa/t06-final-integration-20261015"
CI = T01 / "qa/t01-browser-readiness-20261016"
ARTIFACTS = CI / "ci-contracts"
CONTRACTS = ARTIFACTS / "test-results/ci/contracts"
QUALITY = CI / "ci-quality"
receipt = {
    "recordedAt": datetime.now(timezone.utc).isoformat(),
    "candidate": CANDIDATE, "ciRun": CI_RUN,
    "mode": "exact-candidate CI reconciliation, no new functional test run",
    "files": [], "ciEvidence": [], "groups": {}, "deliveries": [],
}
ci_run = json.loads((OUT / "ci-run.json").read_text())
assert ci_run["headSha"] == CANDIDATE and ci_run["status"] == "completed"
assert ci_run["url"].endswith(str(CI_RUN))
jobs = {job["name"]: job for job in ci_run["jobs"]}
assert jobs["contracts"]["conclusion"] == "success"
assert jobs["disposable-database"]["conclusion"] == "success"
receipt["ciConclusion"] = ci_run["conclusion"]
receipt["jobs"] = {name: job["conclusion"] for name, job in jobs.items()}
receipt["ciMetadataSha256"] = hashlib.sha256((OUT / "ci-run.json").read_bytes()).hexdigest()

manifest = json.loads((PREVIOUS / "source-manifest.json").read_text())
for entry in manifest["files"]:
    path = entry["path"]
    content = subprocess.check_output(["git", "show", f"{CANDIDATE}:{path}"], cwd=ROOT)
    actual = hashlib.sha256(content).hexdigest()
    expected = entry["sha256"]
    origin = "previous T06 source manifest"
    if path == "migrations/20261015_social_authorization_history.sql":
        expected = hashlib.sha256((PREVIOUS / "t01-social-history.sql").read_bytes()).hexdigest()
        origin = "canonical T01 SQL fixture already tested with real private PostgreSQL"
    assert actual == expected, ("SOURCE_CHANGED", path)
    receipt["files"].append({"path": path, "sha256": actual, "status": "MATCH", "origin": origin})

for sha, paths in [
    ("3edae7ae1d3c13ed2b385a9602a9ad8da6ca5b6d", ["src/lib/social-account-revocation.ts"]),
    ("b8a5a3b91f56219ffffb61c134e10b03e732abcc", [
        "src/app/api/social/autopilot/route.ts",
        "qa/t06-final-integration-20261015/autopilot.test.mts",
    ]),
]:
    for path in paths:
        delivered = subprocess.check_output(["git", "show", f"{sha}:{path}"], cwd=ROOT)
        integrated = subprocess.check_output(["git", "show", f"{CANDIDATE}:{path}"], cwd=ROOT)
        assert delivered == integrated, ("DELIVERY_CHANGED", path)
        receipt["deliveries"].append({"sha": sha, "path": path, "sha256": hashlib.sha256(integrated).hexdigest(), "status": "EXACT"})

for path in [
    "src/app/api/social/autopilot/route.ts", "qa/t06-final-integration-20261015/autopilot.test.mts",
    "src/app/api/auto/config/route.ts", "qa/t01-closure-20261015/auto-config.test.mts",
    "qa/t01-closure-20261015/schedule-cas.test.mts", "qa/t01-closure-20261015/schedule-postgres.test.mts",
    "src/app/(dashboard)/settings/social/page.tsx", "src/components/settings/social/PlatformGrid.tsx",
    "qa/t01-closure-20261015/social-reload-checks.mjs", "qa/final-delta-20261014/social-browser.mjs",
    "scripts/run-ci.mjs", ".github/workflows/web-ci.yml", "src/lib/account-access.ts",
]:
    content = subprocess.check_output(["git", "show", f"{CANDIDATE}:{path}"], cwd=ROOT)
    receipt["files"].append({"path": path, "sha256": hashlib.sha256(content).hexdigest(), "origin": "current candidate boundary"})

counts = json.loads((CI / "contracts-counts.json").read_text())
for group in counts:
    if not group["path"].startswith("test-results/ci/contracts/"):
        continue
    path = ARTIFACTS / group["path"]
    actual = hashlib.sha256(path.read_bytes()).hexdigest()
    receipt["ciEvidence"].append({"path": str(path), "sha256": actual, "counts": group["counts"]})
results = json.loads((CONTRACTS / "results.json").read_text())
assert all(result["status"] == "PASS" and result["exitCode"] == 0 for result in results)
receipt["commands"] = results
contract_result = next(item for item in results if item["name"] == "contracts")
for name in [
    "scripts/test-t06-final-social.mts", "scripts/test-t06-social-final.mts",
    "scripts/test-t06-social-routes.mts", "scripts/test-t02-oauth-boundaries.mts",
    "scripts/test-t06-social-autonomy.mts", "scripts/test-t06-social-validation.mts",
    "scripts/test-social-publication.mts", "qa/t01-closure-20261015/auto-config.test.mts",
    "qa/t06-final-integration-20261015/autopilot.test.mts", "qa/t01-closure-20261015/schedule-cas.test.mts",
]:
    assert name in contract_result["command"], ("CI_TEST_MISSING", name)
ci_log = (CONTRACTS / "contracts.log").read_text()
ci_passes = re.findall(r"^[✔✓] (.+) \([0-9.]+ms\)$", ci_log, re.M)
selected = []
old_groups = json.loads((LAST / "integration.json").read_text())["groups"]
for label, expected_count, names in [
    ("oauth", 76, re.findall(r"^# Subtest: (.+)$", (PREVIOUS / "oauth.log").read_text(), re.M)),
    ("publication", 92, re.findall(r"^# Subtest: (.+)$", (PREVIOUS / "publication.log").read_text(), re.M)),
    ("auto-config", 22, old_groups["auto-config"]["names"]),
    ("autopilot", 23, re.findall(r"^# Subtest: (.+)$", (LAST / "gate-autopilot.log").read_text(), re.M)),
]:
    assert len(names) == expected_count and len(set(names)) == expected_count
    for name in names:
        assert ci_passes.count(name) == 1, ("CI_PASS_MISSING_OR_AMBIGUOUS", label, name)
        selected.append(f"PASS [{label}] {name}")
    receipt["groups"][label] = {"pass": len(names), "fail": 0, "skip": 0, "names": names}
assert len(selected) == 213
for label in ["schedule", "publication"]:
    log = (CONTRACTS / f"{label}.log").read_text()
    lines = [line for line in log.splitlines() if line.startswith("PASS:")]
    assert lines and "FAIL" not in log
    receipt["groups"][f"{label}-non-tap"] = {"status": "PASS", "assertions": lines}
    selected.extend(lines)

db_path = CI / "database-job.log"
db_counts = json.loads((CI / "database-counts.json").read_text())
assert db_counts["source"] == CANDIDATE
assert "PASS PostgreSQL T06 history" in db_path.read_text()
assert not re.search(r"ℹ fail [1-9]", db_path.read_text())
receipt["database"] = {"logPath": str(db_path), "sha256": hashlib.sha256(db_path.read_bytes()).hexdigest(), "records": db_counts["records"]}
receipt["database"]["steps"] = [
    {"name": step["name"], "conclusion": step["conclusion"]}
    for step in jobs["disposable-database"]["steps"]
    if any(word in step["name"].lower() for word in ["social", "oauth", "schedule"])
]
assert all(step["conclusion"] == "success" for step in receipt["database"]["steps"])
receipt["database"]["countQualification"] = "Groups overlap; do not add their totals. Private CI PostgreSQL, not production."

receipt["browser"] = []
for engine in ["chromium", "webkit"]:
    for result_file in sorted((QUALITY / f"qa/t01-final-20261015/browser-final/{engine}").glob("*/results.json")):
        family = result_file.parent.name
        path = QUALITY / f"qa/t01-final-20261015/browser-final/{engine}/{family}/results.json"
        data = json.loads(path.read_text())
        assert data["finalIntegrated"] is True and data["productionSuite"] is True
        assertions = [{"name": item["name"], "status": item["status"]} for item in data["results"]]
        receipt["browser"].append({
            "engine": engine, "family": family, "path": str(path),
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "assertions": assertions,
            "pass": sum(item["status"] == "PASS" for item in assertions),
            "fail": sum(item["status"] == "FAIL" for item in assertions),
        })
receipt["qualitySteps"] = [{"name": s["name"], "conclusion": s["conclusion"]} for s in jobs["quality"]["steps"]]
assert next(s for s in receipt["qualitySteps"] if s["name"] == "Run npm run check")["conclusion"] == "success"
assert all(job["conclusion"] == "success" for job in jobs.values())
assert all(item["fail"] == 0 for item in receipt["browser"])
receipt["status"] = "PASS_EXACT_CANDIDATE_CI_RECONCILIATION"
receipt["limits"] = [
    "213 named CI tests passed on this SHA; no second local functional rerun.",
    "No real OAuth consent, provider account, paid generation, or publication.",
    "Zernio token encryption, refresh rotation, actual granted scopes and organization membership are NOT TESTED.",
    "Tenant binding is user UUID to unique Zernio profile; no native organization dimension.",
    "Product source hashes preserved; new UI findings are reported separately, not hidden by CI PASS.",
]
(OUT / "integration.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n")
(OUT / "selected-ci-assertions.txt").write_text("\n".join(selected) + "\n")
print(json.dumps({"status": receipt["status"], "candidate": CANDIDATE,
    "sourceChecks": len(receipt["files"]), "deliveryChecks": len(receipt["deliveries"]),
    "namedContractPasses": 213, "socialBrowserPass": sum(x["pass"] for x in receipt["browser"]),
    "socialBrowserFail": sum(x["fail"] for x in receipt["browser"]), "newFunctionalRuns": 0}))
