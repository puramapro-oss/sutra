"""Explicit user-run Salad setup. Never source, echo or evaluate the master.

Only three authorized names may change, after two successful GET contracts.
No provisioning, GPU, model, publication, deployment or environment activation.
"""
import fcntl
import getpass
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import termios
import warnings
from datetime import datetime, timezone

NAMES = ("SALAD_API_KEY", "SALAD_ORGANIZATION", "SALAD_PROJECT")
ASSIGNMENT = re.compile(rb"^[ \t]*(?:export[ \t]+)?(SALAD_API_KEY|SALAD_ORGANIZATION|SALAD_PROJECT)[ \t]*=(.*)$")
HERE = Path(__file__).resolve().parent


class SetupBlocked(Exception):
    """Only constant, non-sensitive reason codes are permitted."""


def valid(name, value):
    pattern = r"[A-Za-z0-9._~-]{16,512}" if name == "SALAD_API_KEY" else r"[a-z][a-z0-9-]{0,61}[a-z0-9]"
    return name in NAMES and isinstance(value, str) and re.fullmatch(pattern, value) is not None


def selected(data):
    result = {}
    for line in data.splitlines():
        match = ASSIGNMENT.fullmatch(line)
        if not match:
            continue
        name = match[1].decode("ascii")
        if name in result:
            raise SetupBlocked("DUPLICATE_TARGET_VARIABLE")
        # Never replace just the first line of a quoted or continued value.
        # This is a boundary check, not shell evaluation or automatic unquoting.
        quote = None; escaped = False
        for character in match[2]:
            if escaped:
                escaped = False
            elif character == 92 and quote != 39:
                escaped = True
            elif character == quote:
                quote = None
            elif quote is None and character in (34, 39):
                quote = character
        if quote is not None or escaped:
            raise SetupBlocked("MULTILINE_TARGET_REQUIRES_MANUAL_REPAIR")
        result[name] = match[2].decode("utf-8", errors="strict")
    return result


def metadata(data):
    values = selected(data)
    return [{"name": name, "source": "master" if name in values else "absent",
             "present": name in values, "literalSyntax": valid(name, values.get(name)),
             "hasWhitespace": bool(re.search(r"\s", values.get(name, ""))),
             "hasQuote": any(c in values.get(name, "") for c in "\"'"),
             "hasShellSyntax": any(c in values.get(name, "") for c in "$`\\")}
            for name in NAMES]


def read_private(path):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, "rb") as handle:
        info = os.fstat(handle.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o600 or info.st_nlink != 1:
            raise SetupBlocked("MASTER_FILE_NOT_PRIVATE_REGULAR")
        data = handle.read(2 * 1024 * 1024 + 1)
        if len(data) > 2 * 1024 * 1024:
            raise SetupBlocked("MASTER_SIZE_LIMIT")
        selected(data)
        return data, (info.st_dev, info.st_ino)


def replace_selected(original, values):
    if set(values) != set(NAMES) or not all(valid(k, v) for k, v in values.items()):
        raise SetupBlocked("INVALID_LITERAL_VALUES")
    selected(original)  # Duplicate assignments are never silently resolved.
    output = []; found = set()
    newline = b"\r\n" if b"\r\n" in original else b"\n"
    for line in original.splitlines(keepends=True):
        match = ASSIGNMENT.fullmatch(line.rstrip(b"\r\n"))
        if match:
            name = match[1].decode("ascii"); found.add(name)
            output.append(name.encode() + b"=" + values[name].encode() + newline)
        else:
            output.append(line)
    result = b"".join(output)
    for name in NAMES:
        if name not in found:
            if result and not result.endswith(b"\n"):
                result += newline
            result += name.encode() + b"=" + values[name].encode() + newline
    return result


def persist(path, snapshot, identity, values):
    """Cooperative lock + compare before atomic replacement; abort concurrent edit."""
    lock_fd = os.open(str(path) + ".salad.lock", os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW | os.O_NONBLOCK, 0o600)
    temporary = None
    try:
        lock_info = os.fstat(lock_fd)
        if not stat.S_ISREG(lock_info.st_mode) or lock_info.st_uid != os.getuid() or stat.S_IMODE(lock_info.st_mode) != 0o600 or lock_info.st_nlink != 1:
            raise SetupBlocked("LOCK_NOT_PRIVATE_REGULAR")
        try:
            fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SetupBlocked("ANOTHER_SETUP_RUNNING") from None
        current, current_identity = read_private(path)
        if current != snapshot or current_identity != identity:
            raise SetupBlocked("MASTER_CHANGED_RESTART_REQUIRED")
        replacement = replace_selected(snapshot, values)
        fd, temporary = tempfile.mkstemp(prefix=".salad-write-", dir=path.parent)
        with os.fdopen(fd, "wb") as output:
            os.fchmod(output.fileno(), 0o600)
            output.write(replacement); output.flush(); os.fsync(output.fileno())
        current, current_identity = read_private(path)
        if current != snapshot or current_identity != identity:
            raise SetupBlocked("MASTER_CHANGED_RESTART_REQUIRED")
        os.replace(temporary, path); temporary = None
    finally:
        if temporary is not None:
            os.unlink(temporary)
        os.close(lock_fd)


def hidden(prompt):
    if not sys.stdin.isatty() or not sys.stderr.isatty():
        raise SetupBlocked("SECURE_TTY_REQUIRED")
    with warnings.catch_warnings():
        warnings.simplefilter("error", getpass.GetPassWarning)
        return getpass.getpass(prompt)


def validate_remote(values):
    node = shutil.which("node", path="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin")
    if not node:
        raise SetupBlocked("NODE_REQUIRED")
    result = subprocess.run([node, str(HERE / "validate-access.mjs")],
                            input=json.dumps(values), capture_output=True, text=True,
                            timeout=40, check=False, env={"PATH": os.defpath})
    if result.returncode != 0 or len(result.stdout) > 8192:
        raise SetupBlocked("READ_ONLY_VALIDATION_FAILED")
    proof = json.loads(result.stdout)
    if not isinstance(proof, dict):
        raise SetupBlocked("READ_ONLY_VALIDATION_FAILED")
    return proof


def configure(path, ask=hidden, verify=validate_remote, report=lambda value: None):
    snapshot, identity = read_private(path)
    report({"status": "INPUT_REQUIRED", "variables": metadata(snapshot)})
    previous = selected(snapshot); values = {}
    for name in NAMES:
        value = previous.get(name)
        if not valid(name, value):
            value = ask(name + " (saisie masquee; Ctrl-C annule) : ")
        if not valid(name, value):
            raise SetupBlocked("INVALID_LITERAL_INPUT")
        values[name] = value
    proof = verify(values)
    report({"status": "READS_COMPLETED", "proof": proof})
    if proof.get("status") != "PASS_READ_ONLY" or proof.get("organization", {}).get("authentication") != "ORGANIZATION_READ_CONFIRMED" or proof.get("project", {}).get("authentication") != "PROJECT_READ_CONFIRMED":
        raise SetupBlocked("ACCESS_UNPROVEN_MASTER_UNCHANGED")
    persist(path, snapshot, identity, values)
    report({"status": "PASS_READ_ONLY", "proof": proof, "changedNames": list(NAMES),
            "source": "~/.env.purama.master", "permissions": "0600", "generation": "NON_TESTE"})


def main():
    if sys.argv[1:] != ["--interactive"]:
        print("Usage: python3 secure_setup.py --interactive (aucun secret en argument)")
        return 2
    print("SUTRA — saisie locale masquee Salad. Deux GET gratuits uniquement.")
    print("Portail https://portal.salad.com : API Access > Current API Key (pas AI Gateway).")
    print("Organisation et projet : noms techniques dans le portail, pas leurs libelles affiches.")
    print("Aucune modification du master avant les deux lectures authentifiees valides.")
    receipt = {}
    def report(value):
        receipt.update(value)
        receipt["observedAt"] = datetime.now(timezone.utc).isoformat()
        # Redacted status only; this file is ignored by git and may be read by T04.
        path = HERE / "live-status.json"
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, "w") as output:
            os.fchmod(output.fileno(), 0o600)
            json.dump(receipt, output, indent=2); output.write("\n")
    try:
        configure(Path.home() / ".env.purama.master", report=report)
        print("PASS lectures organisation/projet; master mis a jour (trois noms seulement). GPU NON TESTE.")
        return 0
    except (KeyboardInterrupt, EOFError):
        report({"status": "BLOQUE", "reason": "INPUT_CANCELLED"})
    except SetupBlocked as error:
        report({"status": "BLOQUE", "reason": str(error)})
    except Exception:
        report({"status": "BLOQUE", "reason": "SETUP_FAILED_REDACTED"})
    finally:
        if sys.stdin.isatty():
            termios.tcflush(sys.stdin.fileno(), termios.TCIFLUSH)
    print("BLOQUE — consulter live-status.json expurge; aucune relance automatique.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
