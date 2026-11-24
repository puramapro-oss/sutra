"""Read-only reconciliation of committed inputs; no provider or secret access."""
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
CANDIDATE = "fcd0559f611831a57909c693694b92ccb81eba45"
DELIVERY = "773fafef461776c30da81b8bb64832be0419a1bf"


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def digest(value):
    return hashlib.sha256(value).hexdigest()


assert git("rev-parse", "HEAD").decode().strip() == CANDIDATE
manifest = json.loads(git("show", f"{CANDIDATE}:qa/t01-closure-20261020/tested-source-manifest.json"))
entries = manifest["files"]
verified = []
for entry in entries:
    path = entry["path"]
    assert not Path(path).name.startswith(".env"), path
    content = git("show", f"{CANDIDATE}:{path}")
    assert digest(content) == entry["sha256"], path
    assert content == (ROOT / path).read_bytes(), path
    verified.append(entry)
page = "src/app/(dashboard)/settings/social/page.tsx"
assert git("show", f"{DELIVERY}:{page}") == git("show", f"{CANDIDATE}:{page}")
product_delta = git("diff", "--name-only", "1d63ade0", CANDIDATE, "--",
                    "src", "migrations", "package.json", "package-lock.json").decode()
assert not product_delta
previous = json.loads((ROOT / "qa/t06-closure-79cd95b-20261020/integration.json").read_text())
invariants = []
for entry in previous["invariants"]:
    path = entry["path"]
    invariants.append({"path": path, "sha256": digest(git("show", f"{CANDIDATE}:{path}")),
                       "unchanged": entry["sha256"] == digest(git("show", f"{CANDIDATE}:{path}"))})
proofs = []
for path in [
    "qa/t06-closure-79cd95b-20261020/t01-integrated-production-v2/results.json",
    "qa/t01-closure-20261020/browser-production-v2-execution.json",
    "qa/t01-closure-20261020/ci-social-locator/after/results.json",
    "qa/t01-closure-20261020/ci-social-harness/result.json",
    "qa/t01-closure-20261020/ci-journey-locator/native-results.json",
    "qa/t01-closure-20261020/quality.json",
]:
    raw = git("show", f"{CANDIDATE}:{path}")
    proofs.append({"path": path, "sha256": digest(raw), "receipt": json.loads(raw)})
journey = proofs[0]["receipt"]
assert journey["production"] and all(
    check["status"] == "PASS" for engine in journey["engineResults"] for check in engine["checks"])
assert len(journey["engineResults"]) == 2
receipt = {
    "candidate": CANDIDATE, "recordedAt": datetime.now(timezone.utc).isoformat(),
    "status": "PASS", "manifest": verified, "manifestCount": len(verified),
    "deliveredSocialPage": {"commit": DELIVERY, "path": page, "exact": True},
    "productSqlDependenciesIdenticalSince": "1d63ade0aa97222ebbaceb484b5f11319912db9b",
    "historicalInputs": invariants, "reusedProofs": proofs,
    "limitations": [
        "Precommit production receipt retains base label79cd; candidate attribution uses T01 manifest.",
        "Reconciliation is not a new production run, CI success or deployment.",
        "Graph is behind; direct committed input reconciliation is bounded.",
    ],
}
(OUT / "reconciliation.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n")
print(f"PASS {len(verified)} candidate inputs; exact T06 page; 30 production checks reconciled.")
