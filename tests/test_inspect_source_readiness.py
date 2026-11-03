"""Evidence readiness summarizer remains read-only, explicit and fail-closed."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "inspect-source-readiness.py"
SPEC = importlib.util.spec_from_file_location("nexus_readiness", SCRIPT)
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)

HEAD = "a" * 40
SOURCE = [
    "node_tests", "typecheck", "production_build", "npm_audit",
    "local_http_smoke", "js_bundle_budget", "chromium_fixture",
    "firefox_fixture", "webkit_fixture",
]
DOCKER = ["windows_docker_runtime", "native_ubuntu_docker_runtime",
          "os_image_cve_scan", "container_security"]
PRODUCTION = ["exact_sha_protected_preview", "human_accessibility",
              "independent_redis_instances", "owner_release_approval",
              "rollback_rehearsal"]


class ReadinessTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.manifest = Path(self.temp.name) / "manifest.json"
        self.manifest.write_text(json.dumps({"schema_version": 1, "source_sha": HEAD}),
                                 encoding="utf-8")

    def phases(self):
        def phase(name, ids):
            return {"mode": name, "source_sha": HEAD, "release_authorized": False,
                    "evidence_gate": "HOLD",
                    "checks": [
                        {"id": x, "status": "PASS" if x in
                         ("production_build", "typecheck", "local_http_smoke") else "NOT_RUN"}
                        for x in ids]}
        return {
            "source": phase("source", SOURCE),
            "self_hosted": phase("self_hosted", SOURCE + DOCKER),
            "production": phase("production", SOURCE + DOCKER + PRODUCTION),
        }

    def test_all_three_phases_and_six_open_source_checks(self):
        result = module.plan_from_results(self.phases(), self.manifest, HEAD)
        self.assertFalse(result["release_authorized"])
        self.assertEqual(result["phases"]["source"]["pass_count"], 3)
        self.assertEqual(result["phases"]["source"]["pending_count"], 6)
        self.assertEqual(result["phases"]["self_hosted"]["pending_count"], 10)
        self.assertEqual(result["phases"]["production"]["pending_count"], 15)
        self.assertIn("node_tests", result["phases"]["source"]["pending"])
        self.assertIn("webkit_fixture", result["phases"]["source"]["pending"])

    def test_wrong_source_sha_rejected(self):
        phases = self.phases()
        phases["production"]["source_sha"] = "b" * 40
        with self.assertRaisesRegex(ValueError, "invalid_phase_verification"):
            module.plan_from_results(phases, self.manifest, HEAD)

    def test_fake_authorization_is_rejected(self):
        phases = self.phases()
        phases["source"]["release_authorized"] = True
        with self.assertRaisesRegex(ValueError, "invalid_phase_verification"):
            module.plan_from_results(phases, self.manifest, HEAD)

    def test_duplicate_check_id_is_rejected(self):
        phases = self.phases()
        phases["source"]["checks"].append(phases["source"]["checks"][0].copy())
        with self.assertRaisesRegex(ValueError, "invalid_check_inventory"):
            module.plan_from_results(phases, self.manifest, HEAD)

    def test_unknown_check_state_rejected(self):
        phases = self.phases()
        phases["source"]["checks"][0]["status"] = "MAGIC_PASS"
        with self.assertRaisesRegex(ValueError, "unknown_check_status"):
            module.plan_from_results(phases, self.manifest, HEAD)

    def test_rejected_checks_never_count_as_pass(self):
        phases = self.phases()
        phases["source"]["checks"][0]["status"] = "INVALID"
        result = module.plan_from_results(phases, self.manifest, HEAD)
        self.assertIn("node_tests", result["phases"]["source"]["rejected"])
        self.assertEqual(result["phases"]["source"]["pass_count"], 3)

    def test_manifest_hash_matches_bytes(self):
        import hashlib
        result = module.plan_from_results(self.phases(), self.manifest, HEAD)
        self.assertEqual(result["manifest_sha256"],
                         hashlib.sha256(self.manifest.read_bytes()).hexdigest())


if __name__ == "__main__":
    unittest.main()
