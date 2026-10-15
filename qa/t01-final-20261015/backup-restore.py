"""Refresh a SUTRA-only private backup/restore using the reviewed existing recipe."""
import datetime
import json
from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent
source = (HERE.parents[1] / "qa/production-20261012/backup-restore-remote.py").read_text()
source += "\nrun_backup([])\n"
try:
    result = subprocess.run(["ssh", "-i", str(Path.home()/".ssh/purama_vps_ed25519"),
        "-o", "IdentitiesOnly=yes", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes",
        "root@144.217.14.210", "python3", "-"], input=source, capture_output=True,
        text=True, timeout=300)
    assert result.returncode == 0
    receipt = json.loads(result.stdout)
    assert set(receipt) <= {"directory", "database", "snapshotShared", "productionDdl", "artifacts",
        "migrations", "restoredTables", "rowCountsMatch", "restoredSchema", "limitations"}
    assert receipt["rowCountsMatch"] and all(receipt["restoredSchema"].values())
except BaseException:
    raise SystemExit("BACKUP_RESTORE_UNCONFIRMED_INSPECT_BEFORE_RETRY") from None
receipt["observedAt"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
with (HERE / "backup-restore.json").open("x") as output:
    json.dump(receipt, output, indent=2)
    output.write("\n")
print(json.dumps({k: receipt[k] for k in ["directory", "database", "restoredTables",
    "rowCountsMatch", "restoredSchema", "productionDdl", "observedAt"]}))
