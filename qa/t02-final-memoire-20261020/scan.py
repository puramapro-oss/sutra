"""Scan staged text and candidate delta, redact all findings, never read env files."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
report = json.loads((OUT / "verification.json").read_text())
staged = subprocess.check_output(["git", "diff", "--cached", "--name-only", "-z"], cwd=ROOT).decode().split("\0")
paths = set(path for path in staged if path)
paths.update(report["deltaSincePriorAck"])
paths.update(str(path.relative_to(ROOT)) for path in OUT.rglob("*")
             if path.is_file() and not path.name.startswith("gitleaks"))
parts, ranges = [], []
line = 1
for path in sorted(paths):
    assert not any(part.startswith(".env") for part in Path(path).parts)
    try:
        content = (ROOT / path).read_text()
    except UnicodeDecodeError:
        continue
    chunk = "\nFILE: " + path + "\n" + content + "\n"
    ranges.append((line + 2, line + chunk.count("\n"), path))
    line += chunk.count("\n")
    parts.append(chunk)
payload = "".join(parts)
command = ["gitleaks", "stdin", "--redact=100", "--report-format=json",
           "--report-path", str(OUT / "gitleaks.json"), "--no-banner"]
process = subprocess.run(command, input=payload, text=True, capture_output=True,
                         env={"PATH": "/opt/homebrew/bin:/usr/bin:/bin"}, timeout=120)
assert process.returncode in (0, 1)
findings = json.loads((OUT / "gitleaks.json").read_text())
locations = []
for finding in findings:
    start, path = next((start, path) for start, end, path in ranges if start <= finding["StartLine"] <= end)
    locations.append({"file": path, "line": finding["StartLine"] - start + 1,
                      "rule": finding["RuleID"], "fileSha256": hashlib.sha256((ROOT / path).read_bytes()).hexdigest()})
receipt = {"command": command, "exit": process.returncode, "redactionPercent": 100,
           "textFiles": len(ranges), "inputSha256": hashlib.sha256(payload.encode()).hexdigest(),
           "findings": locations, "scope": "staged delivery and 70 changed candidate inputs; env/history/remote excluded"}
(OUT / "gitleaks-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps({"textFiles": len(ranges), "findings": locations}))
