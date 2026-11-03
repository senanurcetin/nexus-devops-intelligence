#!/usr/bin/env python3
"""Read-only source/self-hosted/production evidence gap inventory.

Calls the existing local Node evidence policy for all phases and summarizes
its bounded result. Neither this script nor its output grants release approval.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

MODES = ("source", "self_hosted", "production")


def plan_from_results(results: dict, manifest: Path, original_sha: str) -> dict:
    phases = {}
    for mode in MODES:
        data = results[mode]
        if (data.get("mode") != mode or data.get("source_sha") != original_sha
                or data.get("release_authorized") is not False):
            raise ValueError("invalid_phase_verification")
        checks = data.get("checks")
        if not isinstance(checks, list) or len({x.get("id") for x in checks}) != len(checks):
            raise ValueError("invalid_check_inventory")
        passed = sorted(x["id"] for x in checks if x.get("status") == "PASS")
        pending = sorted(x["id"] for x in checks if x.get("status") == "NOT_RUN")
        rejected = sorted(x["id"] for x in checks if x.get("status") in ("FAIL", "INVALID"))
        if len(passed) + len(pending) + len(rejected) != len(checks):
            raise ValueError("unknown_check_status")
        phases[mode] = {
            "gate": data["evidence_gate"],
            "total": len(checks), "pass_count": len(passed), "pending_count": len(pending),
            "rejected_count": len(rejected), "passed": passed,
            "pending": pending, "rejected": rejected,
        }
    return {
        "schema_version": 1, "source_sha": original_sha,
        "manifest_sha256": hashlib.sha256(manifest.read_bytes()).hexdigest(),
        "phases": phases, "release_authorized": False,
        "scope": "local_self_reported_evidence_not_attestation",
        "source_actionable_next": [
            "Finish RAM-guarded Node suite for exact SHA",
            "Run offline-safe security dependency evaluation with explicit coverage",
            "Verify JS asset budget against an exact-source build artifact",
            "Run real Chromium, Firefox and WebKit fixtures on an exact-source loopback runtime",
        ],
    }


def inspect(repo: Path, manifest: Path, expected_sha: str) -> dict:
    if manifest.is_symlink() or not manifest.is_file() or manifest.stat().st_size > 96 * 1024:
        raise ValueError("unsafe_manifest")
    git = lambda *args: subprocess.run(
        ["git", "-C", str(repo), *args], capture_output=True,
        text=True, timeout=20, check=True
    ).stdout.strip()
    if git("rev-parse", "HEAD") != expected_sha or git("status", "--porcelain=v1"):
        raise ValueError("dirty_or_wrong_source_sha")
    node = repo / "scripts" / "verify-release-evidence.mjs"
    phases = {}
    for mode in MODES:
        run = subprocess.run(["node", str(node), "--mode", mode,
                              "--manifest", str(manifest)], cwd=str(repo),
                             capture_output=True, text=True, timeout=30)
        if run.returncode not in (0, 3):
            raise ValueError("verifier_execution_failed")
        try:
            data = json.loads(run.stdout)
        except ValueError as exc:
            raise ValueError("verifier_report_missing") from exc
        if data.get("evidence_gate") not in ("EVIDENCE_COMPLETE", "HOLD", "FAIL"):
            raise ValueError("unrecognized_evidence_gate")
        phases[mode] = data
    return plan_from_results(phases, manifest, expected_sha)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--expect-sha", required=True)
    args = parser.parse_args()
    try:
        report = inspect(args.repo.resolve(), args.manifest, args.expect_sha)
        print(json.dumps(report, indent=2, ensure_ascii=False))
        # A summary never silently becomes release authorization.
        return 3
    except (OSError, ValueError, subprocess.SubprocessError, KeyError) as exc:
        print(json.dumps({"gate": "HOLD", "release_authorized": False,
                          "issue": type(exc).__name__}, ensure_ascii=False))
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
