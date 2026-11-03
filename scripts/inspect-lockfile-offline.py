#!/usr/bin/env python3
"""Read-only local npm lockfile structure and provenance hygiene inspection.

Does not download packages, recompute tarball hashes or assess CVEs.
Never produces an npm-audit PASS or authorizes a release.
"""
from __future__ import annotations

import argparse
import base64
import binascii
import hashlib
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import urlsplit

MAX_JSON_BYTES = 4 * 1024 * 1024
MAX_ENTRIES = 20000
SEMVER = re.compile(r"\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?\Z")


def unique_pairs(pairs):
    out = {}
    for key, value in pairs:
        if key in out:
            raise ValueError("duplicate_json_key")
        out[key] = value
    return out


def read_bounded_json(path: Path) -> tuple[dict, bytes]:
    if path.is_symlink() or not path.is_file() or not 0 < path.stat().st_size <= MAX_JSON_BYTES:
        raise ValueError("unsafe_package_metadata")
    raw = path.read_bytes()
    parsed = json.loads(raw, object_pairs_hook=unique_pairs)
    if not isinstance(parsed, dict):
        raise ValueError("invalid_json_object")
    return parsed, raw


def integrity_ok(value: object) -> bool:
    if not isinstance(value, str) or not value.startswith("sha512-"):
        return False
    digest = value[len("sha512-"):]
    try:
        content = base64.b64decode(digest, validate=True)
    except (ValueError, binascii.Error):
        return False
    return len(content) == 64


def registry_url_ok(value: object) -> bool:
    if not isinstance(value, str):
        return False
    try:
        target = urlsplit(value)
        return (target.scheme == "https" and target.netloc == "registry.npmjs.org"
                and target.username is None and target.password is None
                and target.port is None and bool(target.path.strip("/"))
                and not target.query and not target.fragment)
    except ValueError:
        return False


def inspect(package: dict, lock: dict, source_sha: str, package_hash: str, lock_hash: str) -> dict:
    if not re.fullmatch("[0-9a-f]{40}", source_sha):
        raise ValueError("invalid_source_sha")
    risks = []
    if lock.get("lockfileVersion") != 3:
        risks.append("unsupported_lockfile_version")
    packages = lock.get("packages")
    if not isinstance(packages, dict) or not 1 < len(packages) <= MAX_ENTRIES:
        raise ValueError("invalid_lock_packages")
    root = packages.get("")
    if not isinstance(root, dict):
        raise ValueError("missing_lock_root")
    for group in ("dependencies", "devDependencies", "optionalDependencies"):
        actual = package.get(group, {})
        locked = root.get(group, {})
        if not isinstance(actual, dict) or not isinstance(locked, dict):
            raise ValueError("invalid_dependency_group")
        if actual != locked:
            risks.append("root_" + group + "_mismatch")

    entries = 0
    resolved = 0
    digest_count = 0
    invalid_names = []
    missing_fields = []
    untrusted_registry = []
    versions = []
    for name, data in sorted(packages.items()):
        if name == "":
            continue
        entries += 1
        if not name.startswith("node_modules/") or not isinstance(data, dict):
            invalid_names.append(name)
            continue
        version = data.get("version")
        if not isinstance(version, str) or not SEMVER.fullmatch(version):
            versions.append(name)
        if "resolved" not in data or "integrity" not in data:
            missing_fields.append(name)
        if registry_url_ok(data.get("resolved")):
            resolved += 1
        else:
            untrusted_registry.append(name)
        if integrity_ok(data.get("integrity")):
            digest_count += 1
        else:
            missing_fields.append(name)
    if invalid_names:
        risks.append("unexpected_package_entries")
    if missing_fields:
        risks.append("missing_or_unverifiable_sha512_integrity")
    if untrusted_registry:
        risks.append("unexpected_package_registry")
    if versions:
        risks.append("invalid_locked_versions")
    risks = sorted(set(risks))
    return {
        "schema_version": 1,
        "source_sha": source_sha,
        "package_json_sha256": package_hash,
        "package_lock_sha256": lock_hash,
        "locked_package_records": entries,
        "registry_https_records": resolved,
        "sha512_integrity_metadata_records": digest_count,
        "metadata_hygiene_status": "PASS" if not risks else "HOLD",
        "risks": risks,
        "untrusted_registry_samples": untrusted_registry[:8],
        "missing_integrity_samples": missing_fields[:8],
        "invalid_version_samples": versions[:8],
        "actual_tarball_bytes_verified": False,
        "npm_audit_status": "NOT_RUN",
        "cve_assessment_performed": False,
        "release_authorized": False,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--repo", required=True, type=Path)
    ap.add_argument("--expect-sha", required=True)
    args = ap.parse_args()
    try:
        repo = args.repo.resolve()
        subprocess.run(
            ["git", "-C", str(repo), "diff", "--quiet", "HEAD", "--",
             "package.json", "package-lock.json"],
            capture_output=True, timeout=20, check=True,
        )
        checked = subprocess.run(["git", "-C", str(repo), "rev-parse", "HEAD"],
                                 capture_output=True, text=True, timeout=20, check=True)
        dirty = subprocess.run(["git", "-C", str(repo), "status", "--porcelain=v1"],
                               capture_output=True, text=True, timeout=20, check=True)
        if checked.stdout.strip() != args.expect_sha or dirty.stdout.strip():
            raise ValueError("source_sha_or_cleanliness_mismatch")
        package, raw_package = read_bounded_json(repo / "package.json")
        lock, raw_lock = read_bounded_json(repo / "package-lock.json")
        result = inspect(package, lock, args.expect_sha,
                         hashlib.sha256(raw_package).hexdigest(),
                         hashlib.sha256(raw_lock).hexdigest())
        print(json.dumps(result, indent=2))
        return 0 if result["metadata_hygiene_status"] == "PASS" else 3
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        print(json.dumps({"metadata_hygiene_status": "HOLD",
                          "npm_audit_status": "NOT_RUN",
                          "release_authorized": False,
                          "issue": type(exc).__name__}, indent=2))
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
