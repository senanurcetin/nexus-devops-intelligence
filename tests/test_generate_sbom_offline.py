"""Regression tests for deterministic, SHA-bound npm lockfile SBOM generation."""
from __future__ import annotations

import base64
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

SOURCE = Path(__file__).resolve().parents[1] / "scripts" / "generate-sbom-offline.py"
SPEC = importlib.util.spec_from_file_location("nexus_swbom", SOURCE)
sbom = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(sbom)

HEAD = "a" * 40
HASH = "b" * 64
INTEGRITY = "sha512-" + base64.b64encode(bytes(range(64))).decode("ascii")


class SbomTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.workspace = Path(self.temp.name)
        self.repo = self.workspace / "nexus-devops-intelligence"
        self.repo.mkdir()
        self.artifacts = self.workspace / "runtime" / "devops-automation"
        self.artifacts.mkdir(parents=True)
        self.package = {"name": "demo", "version": "1.0.0",
                        "dependencies": {"foo": "1.2.3"},
                        "devDependencies": {"@a/b": "2.3.4"}}
        self.lock = {"lockfileVersion": 3, "packages": {
            "": {"name": "demo", "version": "1.0.0",
                 "dependencies": {"foo": "1.2.3"},
                 "devDependencies": {"@a/b": "2.3.4"}},
            "node_modules/foo": {
                "version": "1.2.3",
                "resolved": "https://registry.npmjs.org/foo/-/foo-1.2.3.tgz",
                "integrity": INTEGRITY
            },
            "node_modules/@a/b": {
                "version": "2.3.4",
                "resolved": "https://registry.npmjs.org/@a/b/-/b-2.3.4.tgz",
                "integrity": INTEGRITY,
                "dev": True
            }
        }}
        self.write()

    def write(self):
        (self.repo / "package.json").write_text(json.dumps(self.package), encoding="utf-8")
        (self.repo / "package-lock.json").write_text(json.dumps(self.lock), encoding="utf-8")

    def compile(self):
        return sbom.compile_sbom(self.package, self.lock, HEAD, HASH, HASH)

    def test_valid_bundle_has_two_components_and_no_release_claim(self):
        bom, proof = self.compile()
        self.assertEqual(bom["specVersion"], "1.6")
        self.assertEqual(len(bom["components"]), 2)
        self.assertEqual(proof["packages"], 2)
        self.assertEqual(proof["dev_marked_entries"], 1)
        self.assertFalse(proof["release_authorized"])
        self.assertEqual(proof["npm_audit"], "NOT_RUN")
        self.assertFalse(proof["actual_package_integrity_recomputed"])

    def test_scoped_name_purl_and_group(self):
        bom, _ = self.compile()
        comp = next(c for c in bom["components"] if c["group"] == "@a")
        self.assertEqual(comp["name"], "b")
        self.assertEqual(comp["purl"], "pkg:npm/%40a/b@2.3.4")
        self.assertEqual(comp["hashes"][0]["content"], bytes(range(64)).hex())

    def test_same_source_produces_byte_identical_sbom(self):
        first = sbom.encode(self.compile()[0])
        second = sbom.encode(self.compile()[0])
        self.assertEqual(first, second)
        self.assertEqual(sbom.sha256(first), sbom.sha256(second))

    def test_mismatched_root_dependencies_fail_closed(self):
        self.package["dependencies"]["foo"] = "^1.2.3"
        with self.assertRaisesRegex(ValueError, "root_dependency_mismatch"):
            self.compile()

    def test_non_https_or_unexpected_registry_rejected(self):
        for address in ("http://registry.npmjs.org/foo",
                        "https://registry.npmjs.org.attacker.invalid/foo",
                        "https://name@registry.npmjs.org/foo",
                        "file:///tmp/foo", "https://registry.npmjs.org/foo?x=1"):
            with self.subTest(address=address):
                self.lock["packages"]["node_modules/foo"]["resolved"] = address
                with self.assertRaises(ValueError):
                    self.compile()

    def test_missing_or_corrupt_integrity_rejected(self):
        for integrity in (None, "sha256-QUJDRA==", "sha512-Invalid!", "sha512-YWJj"):
            with self.subTest(integrity=integrity):
                self.lock["packages"]["node_modules/foo"]["integrity"] = integrity
                with self.assertRaisesRegex(ValueError, "sha512"):
                    self.compile()

    def test_link_or_malformed_version_rejected(self):
        self.lock["packages"]["node_modules/foo"]["link"] = True
        with self.assertRaisesRegex(ValueError, "unsupported_lock_entry"):
            self.compile()
        self.lock["packages"]["node_modules/foo"]["link"] = False
        self.lock["packages"]["node_modules/foo"]["version"] = "../../secrets"
        with self.assertRaisesRegex(ValueError, "invalid_locked_version"):
            self.compile()

    def test_duplicate_json_fields_rejected(self):
        (self.repo / "package-lock.json").write_text('{"packages":{},"packages":{}}')
        with self.assertRaisesRegex(ValueError, "duplicate_json_key"):
            sbom.read_json(self.repo / "package-lock.json")

    def test_oversized_json_rejected_without_load(self):
        with mock.patch.object(sbom, "MAX_JSON_BYTES", 20):
            with self.assertRaisesRegex(ValueError, "unsafe_json_input"):
                sbom.read_json(self.repo / "package.json")

    def test_output_writes_are_immutable_and_only_outside_repo(self):
        target = self.artifacts / "sbom-test-01"
        with mock.patch.object(sbom, "verify_git", return_value=None):
            result = sbom.generate(self.repo, HEAD, target)
            self.assertEqual(result["packages"], 2)
            self.assertTrue((target / "SHA256SUMS.txt").exists())
            with self.assertRaises(FileExistsError):
                sbom.generate(self.repo, HEAD, target)
            with self.assertRaisesRegex(ValueError, "output_must_be_local_runtime"):
                sbom.generate(self.repo, HEAD, self.repo / "unwanted")

    def test_evidence_checksums_match_output_bytes(self):
        target = self.artifacts / "sbom-test-02"
        with mock.patch.object(sbom, "verify_git", return_value=None):
            result = sbom.generate(self.repo, HEAD, target)
        for name, expected in result["hashes"].items():
            self.assertEqual(hashlib.sha256((target / name).read_bytes()).hexdigest(), expected)
        proof = json.loads((target / "provenance.json").read_text())
        self.assertEqual(proof["source_sha"], HEAD)
        self.assertFalse(proof["network_requests_made"])
        self.assertEqual(proof["image_cve_scan"], "NOT_RUN")

    def test_full_source_sha_required(self):
        with self.assertRaisesRegex(ValueError, "expect_full_40_char"):
            sbom.verify_git(self.repo, "abc")

    def test_malformed_scoped_package_name_rejected(self):
        self.lock["packages"]["node_modules/@a/b"]["version"] = "2.3.4"
        self.lock["packages"]["node_modules/@a/b"] = self.lock["packages"].pop("node_modules/@a/b")
        item = self.lock["packages"].pop("node_modules/@a/b")
        self.lock["packages"]["node_modules/@a/"] = item
        with self.assertRaisesRegex(ValueError, "invalid_scoped_package_name"):
            self.compile()


if __name__ == "__main__":
    unittest.main()
