#!/usr/bin/env python3
"""Read-only consistency audit for self-reported local Windows acceptance.

This checks the saved report, local logs and cleanup markers. It is NOT a
signed attestation, an independent test execution or deployment permission.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import stat
import subprocess

SHA = re.compile(r"[0-9a-f]{40}\Z")
STAMP = re.compile(r"\d{8}T\d{12}Z\Z")
MAX_REPORT = 96 * 1024
MAX_LOG = 2 * 1024 * 1024
LOGS = ("build", "http_negative", "jarvis_mcp", "server")
REQUIRED_CLEANUP = (
    "owned_server_stopped", "server_log_closed",
    "source_unchanged_before_cleanup", "temporary_port_closed",
    "junction_removed", "isolated_worktree_removed",
)


class AuditError(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


def load_local_file(path: Path, limit: int, label: str) -> bytes:
    try:
        if path.parent.is_symlink():
            raise AuditError("unsafe_" + label + "_folder")
        metadata = path.lstat()
        if not stat.S_ISREG(metadata.st_mode) or not 0 < metadata.st_size <= limit:
            raise AuditError("unsafe_" + label + "_file")
        with path.open("rb") as reader:
            data = reader.read(limit + 1)
        if not 0 < len(data) <= limit:
            raise AuditError("unsafe_" + label + "_size")
        return data
    except (OSError, ValueError) as exc:
        raise AuditError("unreadable_" + label) from exc


def audit_acceptance(report_path: Path, current_sha: str, clean_checkout: bool = True) -> dict:
    result = {
        "schema_version": 1,
        "local_acceptance_gate": "HOLD",
        "evidence_consistent": False,
        "current_sha_matches": False,
        "release_authorized": False,
        "scope": "local_windows_only",
        "trust": "self_reported_local_artifacts_not_independently_attested",
        "issues": [],
        "sha256": {},
    }
    try:
        if not SHA.fullmatch(current_sha):
            raise AuditError("invalid_current_sha")
        raw = load_local_file(report_path, MAX_REPORT, "report")
        try:
            data = json.loads(raw)
        except (UnicodeError, ValueError) as exc:
            raise AuditError("invalid_report_json") from exc
        if not isinstance(data, dict):
            raise AuditError("invalid_report_format")
        head = data.get("head")
        stamp = data.get("started_at")
        if not isinstance(head, str) or not SHA.fullmatch(head):
            raise AuditError("invalid_report_sha")
        if not isinstance(stamp, str) or not STAMP.fullmatch(stamp):
            raise AuditError("invalid_started_at")
        if report_path.name != f"acceptance-{head[:12]}-{stamp}.json":
            raise AuditError("report_name_mismatch")
        try:
            started = dt.datetime.strptime(stamp, "%Y%m%dT%H%M%S%fZ").replace(tzinfo=dt.timezone.utc)
            ended = dt.datetime.fromisoformat(data["ended_at_utc"].replace("Z", "+00:00"))
            if ended.utcoffset() != dt.timedelta(0):
                raise ValueError("not UTC")
        except (ValueError, KeyError, AttributeError, TypeError) as exc:
            raise AuditError("invalid_end_time") from exc
        elapsed = (ended - started).total_seconds()
        if not 0 <= elapsed <= 1200:
            raise AuditError("invalid_acceptance_duration")
        if data.get("state") != "pass" or "error" in data:
            raise AuditError("acceptance_not_pass")
        checks = data.get("checks")
        if not isinstance(checks, dict) or checks.get("http_root") != "pass" or checks.get("source_consistency") != "pass":
            raise AuditError("missing_http_or_source_consistency")
        for check in ("build", "http_negative", "jarvis_mcp"):
            rec = checks.get(check)
            if (not isinstance(rec, dict) or type(rec.get("exit_code")) is not int
                    or rec["exit_code"] != 0 or not isinstance(rec.get("lowest_free_ram_mb"), (int, float))
                    or rec["lowest_free_ram_mb"] < 1800):
                raise AuditError("invalid_" + check + "_result")
        cleanup = data.get("cleanup")
        if not isinstance(cleanup, dict) or any(cleanup.get(k) is not True for k in REQUIRED_CLEANUP):
            raise AuditError("cleanup_not_verified")
        base = report_path.parent
        expected_worktree = base.parents[2] / "wt" / ("devops-accept-" + head[:12])
        if data.get("worktree") != str(expected_worktree):
            raise AuditError("worktree_reference_mismatch")
        if (base / "acceptance.lock").exists() or expected_worktree.exists():
            raise AuditError("temporary_resources_still_present")
        texts = {}
        result["sha256"]["report"] = hashlib.sha256(raw).hexdigest()
        for check in LOGS:
            name = f"{check}-{stamp}.log"
            expected = base / name
            if check == "server":
                path = expected
            else:
                ref = checks[check].get("log")
                if not isinstance(ref, str) or ref != str(expected):
                    raise AuditError("unsafe_" + check + "_log_reference")
                path = expected
            blob = load_local_file(path, MAX_LOG, check + "_log")
            result["sha256"][check] = hashlib.sha256(blob).hexdigest()
            texts[check] = blob.decode("utf-8", errors="replace")
        version = re.search(r"\bNext\.js (\d+\.\d+\.\d+)\b", texts["build"])
        if not (version and "Compiled successfully" in texts["build"]
                and "Route (app)" in texts["build"]):
            raise AuditError("build_log_inconsistent")
        http_lines = texts["http_negative"].splitlines()
        http_pass = [x for x in http_lines if x.startswith("PASS ")]
        if (len(http_pass) != 16 or "PASS 200 /" not in http_pass
                or sum(x.startswith("PASS 400 /api/") for x in http_pass) != 15
                or "PASS: sixteen loopback HTTP checks" not in texts["http_negative"]):
            raise AuditError("http_log_inconsistent")
        mcp_lines = texts["jarvis_mcp"].splitlines()
        if len([x for x in mcp_lines if x.startswith("PASS ")]) != 10:
            raise AuditError("mcp_check_count_mismatch")
        match = re.search(r"RESULT=PASS \(10 checks, base http://127\.0\.0\.1:(\d{1,5}), no GitHub request\)", texts["jarvis_mcp"])
        if not match or not 1 <= int(match.group(1)) <= 65535:
            raise AuditError("mcp_log_inconsistent")
        server_origin = "http://127.0.0.1:" + match.group(1)
        if ("Ready in " not in texts["server"] or server_origin not in texts["server"]
                or ("Next.js " + version.group(1)) not in texts["server"]):
            raise AuditError("server_log_inconsistent")
        result["evidence_consistent"] = True
        result["current_sha_matches"] = head == current_sha and clean_checkout
        result["local_acceptance_gate"] = "LOCAL_ACCEPTED" if result["current_sha_matches"] else "HOLD"
        if not result["current_sha_matches"]:
            result["issues"].append("historical_sha_or_dirty_checkout")
    except AuditError as exc:
        result["issues"].append(exc.reason)
    except (OSError, TypeError, ValueError, KeyError):
        result["issues"].append("unverifiable_local_evidence")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1],
                        help="existing clean repository whose current HEAD is being checked")
    args = parser.parse_args()
    repo = args.repo
    try:
        head = subprocess.run(
            ["git", "-C", str(repo), "rev-parse", "HEAD"],
            capture_output=True, text=True, timeout=15, check=True,
        ).stdout.strip()
        dirty = subprocess.run(
            ["git", "-C", str(repo), "status", "--porcelain=v1"],
            capture_output=True, text=True, timeout=15, check=True,
        ).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        head = ""
        dirty = "unverifiable"
    result = audit_acceptance(args.report, head, not bool(dirty))
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if result["local_acceptance_gate"] == "LOCAL_ACCEPTED" else 3


if __name__ == "__main__":
    raise SystemExit(main())
