"""Delta-only provenance review: past evidence is retained, never relabelled as a fresh execution."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
CANDIDATE = "0f32bf0b84b51ad82e9ae5bf47d93f3e63442506"
PREVIOUS = "88b34f1fb063e8f6d90bba941814668e7735711b"
COMPONENT = "src/lib/legal/components/MaMemoirePage.tsx"
CI = Path("/Users/matissdornier/purama/.coord/handoffs/SUTRA-20261012/T01-POSTCOMMIT-0F32BF0-20261020/ci-artifacts/sutra-database-results/t03-closure-20261020/ci-r107")


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def blob(revision, path):
    return git("show", revision + ":" + path)


def sha(content):
    return hashlib.sha256(content).hexdigest()


prior = json.loads(blob(PREVIOUS, "qa/t02-recert-fcd-20261020/invariants.json"))
assert git("rev-parse", "HEAD").decode().strip() == CANDIDATE
tree = {entry.split(b"\t")[1].decode(): entry.split(b"\t")[0].split()[2].decode()
        for entry in git("ls-tree", "-rz", CANDIDATE).split(b"\0") if entry}
delta = [row["path"] for row in prior["sources"] if tree[row["path"]] != row["gitBlob"]]
assert len(delta) == 70
assert ".github/workflows/web-ci.yml" in delta
product_delta = [path for path in delta if path.startswith("src/")]
assert len(product_delta) == 69
assert all(path.startswith(("src/app/", "src/components/", "src/hooks/")) and
           (path.endswith((".tsx", ".css")) or path == "src/hooks/usePublish.ts") for path in product_delta)
assert not any(path.startswith("src/app/api/") for path in delta)
versions = []
for row in prior["dependencyVersionsUnchanged"]:
    current = json.loads((ROOT / row["path"] / "package.json").read_text())["version"]
    assert current == row["version"]
    versions.append(row)
for path in prior["configUnchanged"]:
    assert blob(CANDIDATE, path) == blob(PREVIOUS, path)
for evidence in prior["reusedEvidence"].values():
    revision, path = evidence["originalCommit"], evidence["receipt"]
    log = blob(revision, path.replace(".json", ".log"))
    assert sha(log) == evidence["logSha256"]
    for path in evidence["sourceTestBlobs"]:
        if path not in evidence["testsOnlyInHistoricalProofCommit"]:
            assert blob(CANDIDATE, path) == blob(revision, path)
assert blob(CANDIDATE, "qa/t02-recert-fcd-20261020/scheduler-isolation.test.mts") == blob(PREVIOUS, "qa/t02-recert-fcd-20261020/scheduler-isolation.test.mts")
receipt = json.loads((CI / "receipt.json").read_text())
assert receipt["candidate"] == CANDIDATE and receipt["stopped"] and receipt["external_calls"] == 0
assert all(command["exit_code"] == 0 for command in receipt["commands"])
assert git("diff", "--name-only", CANDIDATE, "--", "src").decode().splitlines() == [COMPONENT]
base_component = blob(CANDIDATE, COMPONENT)
assert all(sha(base_component if path == COMPONENT else (ROOT / path).read_bytes()) == digest
           for path, digest in receipt["source_sha256"].items())
log = (CI / "scheduler-isolation.log").read_text()
assert "tests 7" in log and "pass 7" in log and "fail 0" in log and "skipped 0" in log
copied = {}
for name in ["receipt.json", "scheduler-isolation.log", "pg-stop.log"]:
    content = (CI / name).read_bytes()
    (OUT / ("ci-" + name)).write_bytes(content)
    copied[name] = sha(content)
current = blob(CANDIDATE, COMPONENT)
patched = (ROOT / COMPONENT).read_bytes()
assert current.count(b"bg-primary") == 1
assert patched == current.replace(b"bg-primary", b"bg-purple-700")
report = {
    "candidate": CANDIDATE, "previousOwnerCommit": PREVIOUS, "previousTestedCandidate": prior["candidate"],
    "status": "PASS_DIFFERENTIAL", "previousSourcesCompared": len(prior["sources"]),
    "deltaSincePriorAck": delta, "deltaReview": "69 presentation/UI files plus CI wiring of T02/T07 scheduler countertests; usePublish failure reporting reviewed; no API/SQL/auth/application-config/dependency change",
    "ownProductDelta": [COMPONENT], "componentSha256": sha(patched), "componentBaseSha256": sha(current),
    "changeContract": "one button background utility only; event handler, labels, route and authorization unchanged",
    "securityReceiptsReused": prior["reusedEvidence"], "configUnchanged": prior["configUnchanged"],
    "installedDependencyVersionsVerified": versions,
    "cronRoutesUnchanged": prior["cronInventory"],
    "ciSQL": {"status": "PASS_REVIEWED_CI_EVIDENCE", "notLocalExecution": True,
              "candidate": CANDIDATE, "tests": 7, "pass": 7, "fail": 0, "skip": 0,
              "sourceHashesVerified": len(receipt["source_sha256"]), "sourceDirectory": str(CI),
              "copiedFilesSha256": copied, "previousMacIPCBlockerResolvedByCI": True},
    "sourceHashes": {row["path"]: sha((ROOT / row["path"]).read_bytes()) for row in prior["sources"]},
    "limits": ["GitNexus partial, exact component unresolved",
               "Two-user proof is not native organization proof; model absent",
               "WanGP connector/storage unavailable and owned by T09; no activation",
               "No live provider, production, real OAuth consent or remote RLS proof",
               "Previously triaged dependency alerts unchanged; no fresh advisory registry query",
               "Contact limiter remains per-process; proxy headers and secret rotation not certified",
               "Signed URLs may remain usable for their configured 300 second TTL"],
}
(OUT / "verification.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"status": report["status"], "delta": len(delta), "priorSources": len(prior["sources"]),
                  "reusedLogs": len(prior["reusedEvidence"]), "ciSources": len(receipt["source_sha256"]), "ciSQLPass": 7}))
