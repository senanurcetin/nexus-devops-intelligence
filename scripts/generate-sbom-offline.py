#!/usr/bin/env python3
"""Generate an exact-Git-SHA, reproducible CycloneDX npm lockfile inventory.

Standard-library-only. No npm, network, install, build, CI, deploy, credential
access or vulnerability scanning. Exit zero means inventory generated, never
that the software is free of CVEs or authorized for release.
"""
from __future__ import annotations

import argparse
import base64
import binascii
import datetime as dt
import hashlib
import json
import re
import subprocess
import uuid
from pathlib import Path
from urllib.parse import quote, urlsplit

MAX_JSON_BYTES = 4_000_000
MAX_LOCK_ENTRIES = 20_000
SHA_RE = re.compile(r"[a-f0-9]{40}\Z")
VERSION_RE = re.compile(r"[0-9]+\.[0-9]+\.[0-9]+(?:[-+][a-zA-Z0-9.-]+)?\Z")


def unique_pairs(pairs: list[tuple[str, object]]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate_json_key")
        result[key] = value
    return result


def read_json(path: Path) -> tuple[dict, str]:
    if path.is_symlink() or not path.is_file() or not 0 < path.stat().st_size <= MAX_JSON_BYTES:
        raise ValueError("unsafe_json_input")
    raw = path.read_bytes()
    parsed = json.loads(raw, object_pairs_hook=unique_pairs)
    if not isinstance(parsed, dict):
        raise ValueError("invalid_json_object")
    return parsed, hashlib.sha256(raw).hexdigest()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git(repo: Path, *args: str) -> str:
    return subprocess.run(["git", "-C", str(repo), *args], check=True,
                          capture_output=True, text=True, timeout=20).stdout.strip()


def verify_git(repo: Path, expect_sha: str) -> None:
    if not SHA_RE.fullmatch(expect_sha):
        raise ValueError("expect_full_40_char_source_sha")
    if git(repo, "rev-parse", "HEAD") != expect_sha or git(repo, "status", "--porcelain=v1"):
        raise ValueError("checkout_changed_or_dirty")


def parse_integrity(text: object) -> str:
    if not isinstance(text, str) or not text.startswith("sha512-"):
        raise ValueError("missing_sha512_metadata")
    try:
        result = base64.b64decode(text[7:], validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError("bad_sha512_metadata") from exc
    if len(result) != 64:
        raise ValueError("wrong_sha512_metadata_length")
    return result.hex()


def package_identity(location: str) -> tuple[str, str, str]:
    if not location.startswith("node_modules/"):
        raise ValueError("unexpected_package_install_path")
    tail = location.split("node_modules/")[-1]
    if not tail or tail.startswith("."):
        raise ValueError("invalid_npm_package_name")
    if tail.startswith("@"):
        fragments = tail.split("/")
        if len(fragments) != 2 or not fragments[0][1:] or not fragments[1]:
            raise ValueError("invalid_scoped_package_name")
        group, name = fragments
    else:
        if "/" in tail:
            raise ValueError("invalid_package_name")
        group, name = None, tail
    if any(part in (".", "..") for part in (name, group or "")):
        raise ValueError("invalid_package_name_segment")
    canonical = (group + "/" if group else "") + name
    return group or "", name, canonical


def inspect_registry(uri: object) -> None:
    if not isinstance(uri, str):
        raise ValueError("missing_registry_url")
    try:
        u = urlsplit(uri)
        valid = (u.scheme == "https" and u.netloc == "registry.npmjs.org"
                 and u.username is None and u.password is None
                 and u.port is None and bool(u.path.strip("/"))
                 and not u.query and not u.fragment)
    except ValueError as exc:
        raise ValueError("invalid_registry_url") from exc
    if not valid:
        raise ValueError("unexpected_registry_origin")


def compile_sbom(package: dict, lock: dict, source_sha: str,
                 package_hash: str, lock_hash: str) -> tuple[dict, dict]:
    if not SHA_RE.fullmatch(source_sha):
        raise ValueError("invalid_sha")
    if lock.get("lockfileVersion") != 3:
        raise ValueError("unsupported_lockfile_format")
    packages = lock.get("packages")
    if not isinstance(packages, dict) or not 1 < len(packages) <= MAX_LOCK_ENTRIES:
        raise ValueError("invalid_lock_inventory")
    root = packages.get("")
    if not isinstance(root, dict):
        raise ValueError("missing_lockfile_root")
    for key in ("name", "version"):
        if root.get(key) != package.get(key) or not isinstance(package.get(key), str):
            raise ValueError("root_identity_mismatch")
    for key in ("dependencies", "devDependencies", "optionalDependencies"):
        if root.get(key, {}) != package.get(key, {}):
            raise ValueError("root_dependency_mismatch")

    components = []
    names = set()
    dev_count = optional_count = 0
    for location, value in sorted(packages.items()):
        if location == "":
            continue
        if not isinstance(value, dict) or value.get("link"):
            raise ValueError("unsupported_lock_entry")
        group, name, canonical = package_identity(location)
        version = value.get("version")
        if not isinstance(version, str) or not VERSION_RE.fullmatch(version):
            raise ValueError("invalid_locked_version")
        url = value.get("resolved")
        inspect_registry(url)
        digest = parse_integrity(value.get("integrity"))
        names.add(canonical)
        if value.get("dev"):
            dev_count += 1
        if value.get("optional"):
            optional_count += 1
        props = [
            {"name": "nexus:npm-lockfile:install-path", "value": location},
            {"name": "nexus:npm-lockfile:dev", "value": str(value.get("dev", False)).lower()},
            {"name": "nexus:npm-lockfile:optional", "value": str(value.get("optional", False)).lower()},
        ]
        if value.get("os"):
            props.append({"name": "nexus:npm-lockfile:os",
                          "value": json.dumps(value["os"], separators=(",", ":"))})
        if value.get("cpu"):
            props.append({"name": "nexus:npm-lockfile:cpu",
                          "value": json.dumps(value["cpu"], separators=(",", ":"))})
        c = {
            "type": "library", "bom-ref": "npm-lock:" + location,
            "name": name, "version": version,
            "purl": "pkg:npm/" + quote(canonical, safe="/") + "@" + quote(version, safe=""),
            "hashes": [{"alg": "SHA-512", "content": digest}],
            "externalReferences": [{"type": "distribution", "url": url}],
            "properties": props,
        }
        if group:
            c["group"] = group
        components.append(c)

    serial = str(uuid.uuid5(uuid.NAMESPACE_URL,
                            "nexus-devops-intelligence|" + source_sha + "|" + lock_hash))
    sbom = {
        "bomFormat": "CycloneDX", "specVersion": "1.6",
        "serialNumber": "urn:uuid:" + serial, "version": 1,
        "metadata": {
            "component": {
                "type": "application", "name": package["name"],
                "version": package["version"],
                "bom-ref": "application:" + package["name"] + "@" + package["version"],
            },
            "properties": [
                {"name": "nexus:evidence:source-sha", "value": source_sha},
                {"name": "nexus:evidence:package-lock-sha256", "value": lock_hash},
                {"name": "nexus:evidence:package-json-sha256", "value": package_hash},
                {"name": "nexus:evidence:method", "value": "npm-lockfile-v3-metadata-only"},
                {"name": "nexus:evidence:tarball-bytes-verified", "value": "false"},
                {"name": "nexus:evidence:cve-advisories-checked", "value": "false"},
            ],
        },
        "components": components,
    }
    prov = {
        "schema_version": 1,
        "source_sha": source_sha,
        "scope": "local_npm_lockfile_v3_component_inventory",
        "cyclonedx_specVersion": "1.6",
        "schema_conformance_independently_validated": False,
        "packages": len(components),
        "distinct_package_names": len(names),
        "dev_marked_entries": dev_count,
        "optional_marked_entries": optional_count,
        "source_package_lock_sha256": lock_hash,
        "source_package_json_sha256": package_hash,
        "tarball_downloaded": False,
        "actual_package_integrity_recomputed": False,
        "network_requests_made": False,
        "cve_assessment": "NOT_RUN",
        "npm_audit": "NOT_RUN",
        "image_cve_scan": "NOT_RUN",
        "release_authorized": False,
    }
    return sbom, prov


def encode(data: dict) -> bytes:
    return (json.dumps(data, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def generate(repo: Path, sha: str, out_dir: Path) -> dict:
    verify_git(repo, sha)
    package, pkg_hash = read_json(repo / "package.json")
    lock, lock_hash = read_json(repo / "package-lock.json")
    sbom, prov = compile_sbom(package, lock, sha, pkg_hash, lock_hash)
    verify_git(repo, sha)
    # Only write outside Git, under the project's fixed local evidence folder.
    permitted = (repo.parent / "runtime" / "devops-automation").resolve()
    absolute = out_dir.absolute()
    if out_dir.is_symlink() or absolute.parent.resolve() != permitted:
        raise ValueError("output_must_be_local_runtime_evidence_directory")
    if out_dir.exists():
        raise FileExistsError("refusing_to_overwrite_evidence")
    out_dir.mkdir(parents=False, exist_ok=False)
    result = {}
    for name, doc in (("sbom.cdx.json", sbom), ("provenance.json", prov)):
        path = out_dir / name
        raw = encode(doc)
        with path.open("xb") as handle:
            handle.write(raw)
        result[name] = sha256(raw)
    sums = out_dir / "SHA256SUMS.txt"
    with sums.open("x", encoding="ascii") as handle:
        for name, value in result.items():
            handle.write(value + "  " + name + "\n")
    return {
        "sbom_dir": str(out_dir), "source_sha": sha,
        "packages": prov["packages"], "hashes": result,
        "npm_audit": "NOT_RUN", "release_authorized": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, required=True)
    parser.add_argument("--expect-sha", required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = generate(args.repo.resolve(), args.expect_sha, args.out_dir)
        print(json.dumps(result, indent=2))
        return 0
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        print(json.dumps({"sbom_status": "BLOCKED", "release_authorized": False,
                          "npm_audit": "NOT_RUN", "reason": type(exc).__name__}))
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
