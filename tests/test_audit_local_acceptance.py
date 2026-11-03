"""Offline regression checks for local acceptance evidence audit."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[1] / "scripts" / "audit-local-acceptance.py"
SPEC = importlib.util.spec_from_file_location("local_acceptance_audit", SOURCE)
audit = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(audit)

HEAD = "a" * 40
STAMP = "20261103T192000292363Z"


class AuditTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.base = self.root / "runtime" / "devops-automation" / "acceptance"
        self.base.mkdir(parents=True)
        self.report = self.base / f"acceptance-{HEAD[:12]}-{STAMP}.json"
        self.logs = {
            "build": "Next.js 15.5.28\nCompiled successfully\nRoute (app)\n",
            "http_negative": "\n".join(
                ["PASS 200 /"] +
                [f"PASS 400 /api/test?id={i}" for i in range(15)] +
                ["PASS: sixteen loopback HTTP checks; zero intentionally valid GitHub/Upstash API requests."]
            ),
            "jarvis_mcp": "\n".join(
                [f"PASS check {i}" for i in range(10)] +
                ["RESULT=PASS (10 checks, base http://127.0.0.1:52425, no GitHub request)"]
            ),
            "server": "Next.js 15.5.28\nLocal: http://127.0.0.1:52425\nReady in 3.2s\n",
        }
        for label, value in self.logs.items():
            (self.base / f"{label}-{STAMP}.log").write_text(value, encoding="utf-8")
        check = lambda label: {
            "exit_code": 0,
            "elapsed_seconds": 2.0,
            "lowest_free_ram_mb": 3494,
            "log": str(self.base / f"{label}-{STAMP}.log"),
        }
        self.payload = {
            "head": HEAD,
            "started_at": STAMP,
            "ended_at_utc": "2026-11-03T19:21:51.393880+00:00",
            "state": "pass",
            "checks": {
                "build": check("build"),
                "http_root": "pass",
                "http_negative": check("http_negative"),
                "jarvis_mcp": check("jarvis_mcp"),
                "source_consistency": "pass",
            },
            "worktree": str(self.root / "wt" / f"devops-accept-{HEAD[:12]}"),
            "cleanup": {key: True for key in audit.REQUIRED_CLEANUP},
        }
        self.save()

    def save(self):
        self.report.write_text(json.dumps(self.payload), encoding="utf-8")

    def result(self, sha=HEAD, clean=True):
        return audit.audit_acceptance(self.report, sha, clean)

    def test_consistent_five_artifact_chain_accepts_current_local_sha(self):
        result = self.result()
        self.assertEqual(result["local_acceptance_gate"], "LOCAL_ACCEPTED")
        self.assertTrue(result["evidence_consistent"])
        self.assertFalse(result["release_authorized"])
        self.assertEqual(set(result["sha256"]), {"report", "build", "http_negative", "jarvis_mcp", "server"})
        self.assertTrue(all(len(value) == 64 for value in result["sha256"].values()))

    def test_historical_sha_is_consistent_but_cannot_approve_new_commit(self):
        result = self.result("b" * 40)
        self.assertTrue(result["evidence_consistent"])
        self.assertEqual(result["local_acceptance_gate"], "HOLD")
        self.assertIn("historical_sha_or_dirty_checkout", result["issues"])

    def test_dirty_checkout_is_hold(self):
        self.assertEqual(self.result(clean=False)["local_acceptance_gate"], "HOLD")

    def test_missing_or_changed_log_is_rejected(self):
        log = self.base / f"http_negative-{STAMP}.log"
        log.write_text("PASS 200 /\n", encoding="utf-8")
        result = self.result()
        self.assertFalse(result["evidence_consistent"])
        self.assertIn("http_log_inconsistent", result["issues"])

    def test_missing_log_is_rejected(self):
        (self.base / f"build-{STAMP}.log").unlink()
        self.assertIn("unreadable_build_log", self.result()["issues"])

    def test_mcp_port_must_match_started_local_server(self):
        log = self.base / f"server-{STAMP}.log"
        log.write_text("Next.js 15.5.28\nLocal: http://127.0.0.1:52426\nReady in 3.2s", encoding="utf-8")
        self.assertIn("server_log_inconsistent", self.result()["issues"])

    def test_server_version_must_match_successful_build_version(self):
        server = self.base / f"server-{STAMP}.log"
        server.write_text("Next.js 15.5.29\nLocal: http://127.0.0.1:52425\nReady in 3.2s", encoding="utf-8")
        self.assertIn("server_log_inconsistent", self.result()["issues"])

    def test_cleanup_claims_must_all_be_true(self):
        self.payload["cleanup"]["temporary_port_closed"] = False
        self.save()
        self.assertIn("cleanup_not_verified", self.result()["issues"])

    def test_remaining_temporary_resources_are_not_accepted(self):
        worktree = Path(self.payload["worktree"])
        worktree.mkdir(parents=True)
        self.assertIn("temporary_resources_still_present", self.result()["issues"])

    def test_lock_present_is_not_clean_acceptance(self):
        (self.base / "acceptance.lock").write_text("busy")
        self.assertIn("temporary_resources_still_present", self.result()["issues"])

    def test_log_reference_must_be_exact_expected_filename(self):
        self.payload["checks"]["jarvis_mcp"]["log"] = str(self.root / "private.txt")
        self.save()
        self.assertIn("unsafe_jarvis_mcp_log_reference", self.result()["issues"])

    def test_report_filename_must_match_sha_and_timestamp(self):
        moved = self.base / "acceptance-other.json"
        self.report.rename(moved)
        self.report = moved
        self.assertIn("report_name_mismatch", self.result()["issues"])

    def test_false_pass_does_not_override_check_exit_code(self):
        self.payload["checks"]["build"]["exit_code"] = 1
        self.save()
        self.assertIn("invalid_build_result", self.result()["issues"])

    def test_oversized_report_is_rejected(self):
        self.report.write_bytes(b" " * (audit.MAX_REPORT + 1))
        self.assertIn("unsafe_report_file", self.result()["issues"])

    def test_symlink_report_is_not_followed(self):
        real = self.base / "original.json"
        self.report.rename(real)
        try:
            os.symlink(real, self.report)
        except (OSError, NotImplementedError):
            self.skipTest("file symlink unavailable under current account")
        self.assertIn("unsafe_report_file", self.result()["issues"])


if __name__ == "__main__":
    unittest.main()
