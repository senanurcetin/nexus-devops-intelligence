import base64
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "inspect-lockfile-offline.py"
spec = importlib.util.spec_from_file_location("nexus_lock_audit", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

HEAD = "a" * 40
DIGEST = "sha512-" + base64.b64encode(bytes(range(64))).decode("ascii")
URL = "https://registry.npmjs.org/example/-/example-1.0.0.tgz"


class LockTests(unittest.TestCase):
    def setUp(self):
        self.package = {"dependencies": {"example": "1.0.0"}, "devDependencies": {}}
        self.lock = {"lockfileVersion": 3, "packages": {
            "": {"dependencies": {"example": "1.0.0"}, "devDependencies": {}},
            "node_modules/example": {"version": "1.0.0", "resolved": URL, "integrity": DIGEST},
        }}

    def inspect(self):
        return module.inspect(self.package, self.lock, HEAD, "b" * 64, "c" * 64)

    def test_consistent_registry_and_sha512_format(self):
        result = self.inspect()
        self.assertEqual(result["metadata_hygiene_status"], "PASS")
        self.assertEqual(result["registry_https_records"], 1)
        self.assertEqual(result["sha512_integrity_metadata_records"], 1)
        self.assertEqual(result["npm_audit_status"], "NOT_RUN")
        self.assertFalse(result["cve_assessment_performed"])
        self.assertFalse(result["release_authorized"])
        self.assertFalse(result["actual_tarball_bytes_verified"])

    def test_root_dependency_drift_fails_closed(self):
        self.package["dependencies"]["example"] = "^1.0.0"
        self.assertIn("root_dependencies_mismatch", self.inspect()["risks"])

    def test_missing_integrity_is_a_risk(self):
        self.lock["packages"]["node_modules/example"].pop("integrity")
        self.assertEqual(self.inspect()["metadata_hygiene_status"], "HOLD")

    def test_invalid_sha512_digest_is_a_risk(self):
        self.lock["packages"]["node_modules/example"]["integrity"] = "sha512-!!invalid"
        self.assertIn("missing_or_unverifiable_sha512_integrity", self.inspect()["risks"])

    def test_http_and_foreign_hosts_rejected(self):
        for resolved in ("http://registry.npmjs.org/x.tgz",
                         "https://registry.npmjs.org.evil.example/x.tgz",
                         "https://user@registry.npmjs.org/x.tgz",
                         "file:///tmp/x.tgz"):
            with self.subTest(resolved=resolved):
                self.lock["packages"]["node_modules/example"]["resolved"] = resolved
                self.assertIn("unexpected_package_registry", self.inspect()["risks"])

    def test_invalid_lockfile_version_does_not_pass(self):
        self.lock["lockfileVersion"] = 2
        self.assertIn("unsupported_lockfile_version", self.inspect()["risks"])

    def test_invalid_package_version_does_not_pass(self):
        self.lock["packages"]["node_modules/example"]["version"] = "something"
        self.assertIn("invalid_locked_versions", self.inspect()["risks"])

    def test_duplicate_json_key_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "package-lock.json"
            path.write_text('{"packages":{},"packages":{}}', encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "duplicate_json_key"):
                module.read_bounded_json(path)

    def test_oversized_input_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "package-lock.json"
            path.write_bytes(b" " * (module.MAX_JSON_BYTES + 1))
            with self.assertRaisesRegex(ValueError, "unsafe_package_metadata"):
                module.read_bounded_json(path)

    def test_invalid_source_sha_rejected(self):
        with self.assertRaisesRegex(ValueError, "invalid_source_sha"):
            module.inspect(self.package, self.lock, "short", "b" * 64, "c" * 64)


if __name__ == "__main__":
    unittest.main()
