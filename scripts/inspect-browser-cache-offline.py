#!/usr/bin/env python3
"""Inspect cached Playwright browsers and the manual-runner dependencies offline.

Read-only. Neither a browser execution nor source-release evidence. Always
reports browser fixture tests NOT_RUN and release_authorized false.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import stat
import subprocess

REQUIRED = {
    "chromium": "chrome-win64/chrome.exe",
    "firefox": "firefox/firefox.exe",
    "webkit": "Playwright.exe",
}
MAX_JSON_BYTES = 256 * 1024
SHA = re.compile(r"[a-f0-9]{40}\Z")
VERSION = re.compile(r"\d+\.\d+\.\d+\Z")


def unique_pairs(pairs):
    obj = {}
    for key, value in pairs:
        if key in obj:
            raise ValueError("duplicate_metadata_key")
        obj[key] = value
    return obj


def load_metadata(path: Path) -> tuple[dict, str]:
    if path.is_symlink() or not path.is_file():
        raise ValueError("unsafe_metadata_path")
    meta = path.stat()
    if not stat.S_ISREG(meta.st_mode) or not 0 < meta.st_size <= MAX_JSON_BYTES:
        raise ValueError("invalid_metadata_size")
    raw = path.read_bytes()
    parsed = json.loads(raw, object_pairs_hook=unique_pairs)
    if not isinstance(parsed, dict):
        raise ValueError("invalid_metadata_format")
    return parsed, hashlib.sha256(raw).hexdigest()


def installed_file(path: Path) -> bool:
    try:
        return path.is_file() and not path.is_symlink() and path.stat().st_size > 0
    except OSError:
        return False


def examine_assets(
    driver_package: Path, browser_cache: Path, node_modules: Path, head: str
) -> dict:
    if not SHA.fullmatch(head):
        raise ValueError("invalid_source_sha")
    package, package_hash = load_metadata(driver_package / "package.json")
    browser_data, browser_hash = load_metadata(driver_package / "browsers.json")
    if package.get("name") != "playwright-core" or not VERSION.fullmatch(str(package.get("version"))):
        raise ValueError("unexpected_driver_package")
    records = browser_data.get("browsers")
    if not isinstance(records, list) or len(records) > 80:
        raise ValueError("invalid_browser_inventory")
    names = {}
    for entry in records:
        if isinstance(entry, dict) and isinstance(entry.get("name"), str):
            if entry["name"] in names:
                raise ValueError("duplicate_browser_entry")
            names[entry["name"]] = entry
    browsers = {}
    for engine, executable in REQUIRED.items():
        entry = names.get(engine)
        revision = entry.get("revision") if isinstance(entry, dict) else None
        if not isinstance(revision, str) or not revision.isdigit():
            browsers[engine] = {"available": False, "reason": "missing_expected_revision"}
            continue
        name = engine + "-" + revision
        path = browser_cache / name / executable
        browsers[engine] = {
            "revision": revision,
            "browser_version": entry.get("browserVersion"),
            "available": installed_file(path),
            "cache_directory": str(browser_cache / name),
            "expected_executable": str(path),
        }
    # Node runner imports playwright-core and uses require.resolve for axe-core.
    # The Python Playwright driver bundle does NOT satisfy those Node imports.
    node_playwright = installed_file(node_modules / "playwright-core" / "package.json")
    node_axe = installed_file(node_modules / "axe-core" / "axe.min.js")
    all_cached = all(x.get("available") is True for x in browsers.values())
    return {
        "schema_version": 1, "source_sha": head,
        "scope": "offline_windows_browser_asset_preflight",
        "python_driver_name": package["name"],
        "python_driver_version": package["version"],
        "driver_package_sha256": package_hash,
        "browser_manifest_sha256": browser_hash,
        "browsers": browsers,
        "all_expected_browser_executables_present": all_cached,
        "node_playwright_core_installed": node_playwright,
        "node_axe_core_installed": node_axe,
        "manual_node_browser_runner_dependencies_present": node_playwright and node_axe,
        "browser_processes_launched": False,
        "production_build_verified": False,
        "chromium_fixture": "NOT_RUN",
        "firefox_fixture": "NOT_RUN",
        "webkit_fixture": "NOT_RUN",
        "human_accessibility": "NOT_RUN",
        "release_authorized": False,
    }


def inspect(repo: Path, sha: str, driver_package: Path, cache: Path) -> dict:
    check = lambda *args: subprocess.run(
        ["git", "-C", str(repo), *args], capture_output=True, text=True,
        timeout=20, check=True,
    ).stdout.strip()
    if check("rev-parse", "HEAD") != sha or check("status", "--porcelain=v1"):
        raise ValueError("checkout_changed")
    if driver_package.is_symlink() or cache.is_symlink():
        raise ValueError("unsafe_asset_directory")
    return examine_assets(driver_package, cache, repo / "node_modules", sha)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--repo", required=True, type=Path)
    ap.add_argument("--expect-sha", required=True)
    ap.add_argument("--python-driver-package", required=True, type=Path)
    ap.add_argument("--browser-cache", required=True, type=Path)
    args = ap.parse_args()
    try:
        result = inspect(args.repo.resolve(), args.expect_sha,
                         args.python_driver_package, args.browser_cache)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        # Exit 0 means inventory read succeeded, not browser fixture accepted.
        return 0
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        print(json.dumps({
            "browser_inventory": "UNVERIFIED",
            "browser_fixtures": "NOT_RUN",
            "release_authorized": False,
            "issue": type(exc).__name__,
        }, indent=2))
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
