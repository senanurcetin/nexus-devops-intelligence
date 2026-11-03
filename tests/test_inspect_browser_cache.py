"""Offline regression tests for cached browser engine readiness reporting."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

SOURCE = Path(__file__).resolve().parents[1] / "scripts" / "inspect-browser-cache-offline.py"
SPEC = importlib.util.spec_from_file_location("browser_readiness", SOURCE)
audit = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(audit)
SHA = "a" * 40


class BrowserCacheTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.driver = self.root / "driver" / "package"
        self.cache = self.root / "browsers"
        self.modules = self.root / "modules"
        self.driver.mkdir(parents=True)
        self.cache.mkdir()
        self.modules.mkdir()
        self.package = {"name": "playwright-core", "version": "1.63.0"}
        self.revisions = [
            {"name": "chromium", "revision": "1243", "browserVersion": "153.0"},
            {"name": "firefox", "revision": "1543", "browserVersion": "155.0"},
            {"name": "webkit", "revision": "2359", "browserVersion": "26.6"},
        ]
        self.save()
        for entry in self.revisions:
            exe = self.cache / (entry["name"] + "-" + entry["revision"]) / audit.REQUIRED[entry["name"]]
            exe.parent.mkdir(parents=True)
            exe.write_bytes(b"synthetic-browser-binary")
        self.expected = self.driver / "browsers.json"

    def save(self):
        (self.driver / "package.json").write_text(json.dumps(self.package), encoding="utf-8")
        (self.driver / "browsers.json").write_text(json.dumps({"browsers": self.revisions}), encoding="utf-8")

    def check(self):
        return audit.examine_assets(self.driver, self.cache, self.modules, SHA)

    def test_three_cached_engines_are_reported_without_false_fixture_pass(self):
        result = self.check()
        self.assertTrue(result["all_expected_browser_executables_present"])
        self.assertEqual(result["python_driver_version"], "1.63.0")
        self.assertFalse(result["manual_node_browser_runner_dependencies_present"])
        self.assertFalse(result["release_authorized"])
        self.assertFalse(result["browser_processes_launched"])
        for key in audit.REQUIRED:
            self.assertTrue(result["browsers"][key]["available"])
            self.assertEqual(result[key + "_fixture"], "NOT_RUN")

    def test_missing_browser_binary_is_a_blocker(self):
        (self.cache / "firefox-1543" / "firefox" / "firefox.exe").unlink()
        result = self.check()
        self.assertFalse(result["browsers"]["firefox"]["available"])
        self.assertFalse(result["all_expected_browser_executables_present"])

    def test_old_revision_cannot_satisfy_new_revision(self):
        self.revisions[0]["revision"] = "1244"
        self.save()
        self.assertFalse(self.check()["browsers"]["chromium"]["available"])

    def test_node_dependencies_do_not_prove_fixture_pass(self):
        for f in ("playwright-core/package.json", "axe-core/axe.min.js"):
            item = self.modules / f
            item.parent.mkdir(parents=True, exist_ok=True)
            item.write_bytes(b"sample")
        result = self.check()
        self.assertTrue(result["manual_node_browser_runner_dependencies_present"])
        self.assertEqual(result["webkit_fixture"], "NOT_RUN")
        self.assertFalse(result["release_authorized"])

    def test_partial_node_dependencies_are_incomplete(self):
        f = self.modules / "playwright-core" / "package.json"
        f.parent.mkdir(parents=True)
        f.write_text('{"name":"playwright-core"}')
        self.assertFalse(self.check()["manual_node_browser_runner_dependencies_present"])

    def test_driver_package_identity_must_be_exact(self):
        self.package["name"] = "fake-playwright"
        self.save()
        with self.assertRaisesRegex(ValueError, "unexpected_driver_package"):
            self.check()

    def test_malformed_version_is_rejected(self):
        self.package["version"] = "1.63.0-canary"
        self.save()
        with self.assertRaisesRegex(ValueError, "unexpected_driver_package"):
            self.check()

    def test_duplicate_browser_inventory_is_rejected(self):
        self.revisions.append(self.revisions[0].copy())
        self.save()
        with self.assertRaisesRegex(ValueError, "duplicate_browser_entry"):
            self.check()

    def test_duplicate_metadata_json_key_cannot_fake_revision(self):
        self.expected.write_text('{"browsers":[],"browsers":[]}', encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "duplicate_metadata_key"):
            self.check()

    def test_invalid_sha_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "invalid_source_sha"):
            audit.examine_assets(self.driver, self.cache, self.modules, "bad")

    def test_oversized_json_is_rejected(self):
        self.expected.write_bytes(b" " * (audit.MAX_JSON_BYTES + 1))
        with self.assertRaisesRegex(ValueError, "invalid_metadata_size"):
            self.check()

    def test_symlink_json_is_never_followed(self):
        original = self.driver / "original.json"
        self.expected.rename(original)
        try:
            self.expected.symlink_to(original)
        except OSError:
            self.skipTest("Windows account cannot create file symlink")
        with self.assertRaisesRegex(ValueError, "unsafe_metadata_path"):
            self.check()

    def test_missing_browser_revision_blocks_only_that_engine(self):
        self.revisions = self.revisions[1:]
        self.save()
        result = self.check()
        self.assertFalse(result["browsers"]["chromium"]["available"])
        self.assertTrue(result["browsers"]["firefox"]["available"])
        self.assertTrue(result["browsers"]["webkit"]["available"])


if __name__ == "__main__":
    unittest.main()
