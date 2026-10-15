"""Verify existing exact-candidate evidence; never rebuild, contact providers or read secrets."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
SOURCE = Path(os.environ.get("T08_T01_WORKTREE", str(ROOT.parent / "sutra-final-providers-20261013")))
QA = SOURCE / "qa/t01-consolidation-20261014"
SHA = "3855665fa79e3cc2171124d864a834214d6ac617"
checks = []
errors = []


def check(label, passed, **details):
    checks.append({"check": label, "status": "PASS" if passed else "FAIL", **details})
    if not passed:
        errors.append(label)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def document(path):
    return json.loads(path.read_text())


receipt = document(QA / "ci-3855665-final.json")
check("CI exact SHA and successful jobs", receipt["headSha"] == SHA
      and receipt["conclusion"] == "success" and len(receipt["jobs"]) == 3
      and all(job["conclusion"] == "success" for job in receipt["jobs"]),
      receiptSha256=digest(QA / "ci-3855665-final.json"))

# Compare all tracked application/SQL/test inputs, including working tree edits.
# New QA evidence and append-only docs are outside the frozen application input.
paths = ["src", "migrations", "package.json", "package-lock.json", "scripts", ".github",
         "next.config.ts", "tsconfig.json", "eslint.config.mjs", "deploy"]
for repo, label in [(ROOT, "T08"), (SOURCE, "T01")]:
    delta = subprocess.check_output(["git", "diff", "--name-only", SHA, "--", *paths], cwd=repo, text=True)
    check(label + " frozen application inputs equal candidate", not delta.strip(), changedPaths=delta.splitlines())

for group in ["ci-3855665-contract-artifacts", "ci-3855665-quality-artifacts"]:
    manifest = document(QA / group / "artifact-provenance.json")
    check(group + " source", manifest["source"] == SHA,
          manifestSha256=digest(QA / group / "artifact-provenance.json"))
    for item in manifest["files"]:
        path = QA / group / item["path"]
        actual = digest(path) if path.is_file() else None
        check(group + "/" + item["path"], actual == item["sha256"], sha256=actual)

tests = document(QA / "ci-3855665-tests.json")
check("CI test inventory source", tests["source"] == SHA and tests["ciConclusion"] == "success")
for family in tests["families"]:
    check("family " + family["receipt"], digest(QA / family["receipt"]) == family["sha256"],
          counts=family["counts"])
for name, expected in [("ci-3855665-database.log", tests["database"]["logSha256"]),
                       ("ci-3855665-quality.log", tests["qualityLogSha256"])]:
    check(name, digest(QA / name) == expected, sha256=expected)

media = document(SOURCE / "qa/t08-closure-20261014/t05-proof-verification.json")
for item in media["exports"]:
    path = SOURCE / "qa/t05-real-export-20261014" / item["file"]
    check("retained CPU " + item["file"], path.is_file() and digest(path) == item["sha256"]
          and path.stat().st_size == item["bytes"], sha256=item["sha256"], bytes=item["bytes"])

# Copy only compact receipts; full logs and media remain in their owned dossier.
# Their digests above are the independent proof, not assertions from a prior report.
receipts = ["ci-3855665-final.json", "ci-3855665-tests.json", "backup-restore.json", "checkpoint-concurrency.json"]
for name in receipts:
    dest = OUT / "receipts" / name
    dest.parent.mkdir(exist_ok=True)
    dest.write_bytes((QA / name).read_bytes())
    check("receipt copy " + name, digest(dest) == digest(QA / name), sha256=digest(dest))

result = {"utc": datetime.now(timezone.utc).isoformat(), "candidate": SHA,
          "sourceWorktree": str(SOURCE), "ciRun": 38598361267,
          "checks": checks, "pass": sum(c["status"] == "PASS" for c in checks), "fail": len(errors),
          "limitations": ["Verifies local CI receipts and artifact identity; does not query GitHub again.",
                          "CPU exports are retained synthetic media, not paid or GPU output.",
                          "Backup receipt is historical and not a fresh promotion backup.",
                          "A later integrated candidate requires changed-input retests."]}
(OUT / "provenance.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps({"candidate": SHA, "pass": result["pass"], "fail": len(errors), "failures": errors}))
raise SystemExit(bool(errors))
