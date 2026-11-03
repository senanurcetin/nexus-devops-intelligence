#!/usr/bin/env python3
"""Resource-guarded, resumable Windows Node test inventory (no CI/deploy).

By default reports a read-only plan. --execute runs at most --max-files
owned, short-lived Node test processes, with conservative free RAM checks.
All evidence is self-reported; a completed inventory is NOT release approval.
"""
from __future__ import annotations

import argparse
import ctypes
import datetime as dt
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

SHA_RE = re.compile(r"[0-9a-f]{40}\Z")
MAX_TEST_FILES = 250
MAX_LOG_BYTES = 4 * 1024 * 1024


def is_elevated() -> bool:
    # Lower privilege execution is mandatory for this local runner.
    return sys.platform == "win32" and bool(ctypes.windll.shell32.IsUserAnAdmin())


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git(repo: Path, *args: str) -> str:
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True,
                          text=True, check=True, timeout=25).stdout.strip()


def source_clean(repo: Path, sha: str) -> bool:
    return git(repo, "rev-parse", "HEAD") == sha and not git(repo, "status", "--porcelain=v1")


def inventory(repo: Path) -> dict[str, str]:
    tests = sorted((repo / "tests").glob("*.test.mjs"))
    if not tests or len(tests) > MAX_TEST_FILES:
        raise RuntimeError("invalid_test_inventory")
    result = {}
    for file in tests:
        if file.is_symlink() or not file.is_file() or file.stat().st_size > 1024 * 1024:
            raise RuntimeError("unsafe_test_file")
        relative = "tests/" + file.name
        result[relative] = sha256(file.read_bytes())
    return result


def load_guard(repo: Path):
    path = repo / "scripts" / "verify-local-build-acceptance.py"
    spec = importlib.util.spec_from_file_location("nexus_source_guard", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("resource_guard_missing")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def expected_log_name(relative: str, attempt: int) -> str:
    if not 1 <= attempt <= 9999:
        raise RuntimeError("invalid_attempt_number")
    return sha256(relative.encode("utf-8"))[:16] + "-attempt-" + str(attempt) + ".log"


def validate_completed_logs(state_path: Path, state: dict) -> None:
    for relative, record in state["results"].items():
        if not isinstance(record, dict):
            raise RuntimeError("invalid_test_result")
        if record.get("status") != "PASS":
            continue
        attempt = record.get("attempt")
        if type(attempt) is not int or record.get("log") != expected_log_name(relative, attempt):
            raise RuntimeError("invalid_completed_log_reference")
        log = state_path.parent / record["log"]
        if log.is_symlink() or not log.is_file() or not 0 < log.stat().st_size <= MAX_LOG_BYTES:
            raise RuntimeError("unsafe_completed_log")
        data = log.read_bytes()
        if sha256(data) != record.get("log_sha256"):
            raise RuntimeError("completed_log_hash_mismatch")
        classification, counts = classify_log(data, record.get("exit_code"))
        if classification != "PASS" or counts != record.get("counts"):
            raise RuntimeError("completed_log_not_verified")


def read_state(path: Path, sha: str, tests: dict[str, str]) -> dict:
    if path.parent.is_symlink():
        raise RuntimeError("unsafe_state_directory")
    if not path.exists():
        return {
            "schema_version": 1, "source_sha": sha, "test_files_sha256": tests,
            "results": {}, "release_authorized": False
        }
    if path.is_symlink() or path.stat().st_size > 1024 * 1024:
        raise RuntimeError("unsafe_existing_state")
    data = json.loads(path.read_text(encoding="utf-8"))
    if (not isinstance(data, dict) or data.get("schema_version") != 1
            or data.get("source_sha") != sha or data.get("test_files_sha256") != tests
            or not isinstance(data.get("results"), dict)
            or set(data["results"]) - set(tests)
            or data.get("release_authorized") is not False):
        raise RuntimeError("state_mismatch_refusing_resume")
    validate_completed_logs(path, data)
    return data


def classify_log(raw: bytes, exit_code: int) -> tuple[str, dict]:
    # Node v24 TAP summary may use Unicode ℹ prefixes or ASCII # prefixes.
    text = raw.decode("utf-8", "replace")
    numbers = {}
    for key in ("tests", "pass", "fail", "cancelled", "skipped", "todo"):
        match = re.search(r"(?m)^\s*(?:ℹ|#)\s*" + key + r"\s+(\d+)\s*$", text)
        if match is None:
            return "UNVERIFIED", numbers
        numbers[key] = int(match.group(1))
    if exit_code != 0 or numbers["fail"] or numbers["cancelled"]:
        return "FAIL", numbers
    if numbers["tests"] <= 0 or numbers["pass"] + numbers["skipped"] + numbers["todo"] != numbers["tests"]:
        return "UNVERIFIED", numbers
    if numbers["skipped"] or numbers["todo"]:
        return "PARTIAL", numbers
    return "PASS", numbers


def evaluate(state: dict) -> dict:
    results = state["results"]
    expected = set(state["test_files_sha256"])
    approved = {p for p, v in results.items() if isinstance(v, dict) and v.get("status") == "PASS"}
    blocked = sorted(p for p, v in results.items() if v.get("status") in ("BLOCKED", "FAIL", "UNVERIFIED", "PARTIAL"))
    # All tests must pass, without skipped assertions or TODOs.
    finished = len(expected) > 0 and expected == approved and not blocked
    return {
        "source_sha": state["source_sha"],
        "files_total": len(expected), "files_passed": len(approved),
        "files_pending": len(expected - approved), "exceptions": blocked,
        "node_tests_gate": "LOCAL_COMPLETE" if finished else "HOLD",
        "release_authorized": False,
    }


def save_state(path: Path, state: dict) -> None:
    # State is written atomically, without modifying the project checkout.
    stage = path.with_suffix(".pending")
    if stage.exists():
        raise RuntimeError("existing_incomplete_state_write")
    with stage.open("x", encoding="utf-8") as f:
        json.dump(state, f, indent=2, ensure_ascii=False)
        f.write("\n")
    os.replace(stage, path)


def execute(repo: Path, sha: str, state_dir: Path, files_limit: int,
            min_start: int, min_running: int, seconds: int, guard,
            retry_incomplete: bool = False) -> dict:
    if sys.platform != "win32":
        raise RuntimeError("Windows_only")
    if is_elevated():
        raise RuntimeError("elevated_account_not_allowed")
    if not source_clean(repo, sha):
        raise RuntimeError("source_changed")
    tests = inventory(repo)
    if state_dir.is_symlink():
        raise RuntimeError("unsafe_state_directory")
    state_dir.mkdir(parents=True, exist_ok=True)
    lock = state_dir / "runner.lock"
    fd = os.open(str(lock), os.O_WRONLY | os.O_CREAT | os.O_EXCL)
    os.close(fd)
    try:
        state_path = state_dir / "state.json"
        state = read_state(state_path, sha, tests)
        planned = [p for p in tests if p not in state["results"]
                   or (retry_incomplete and state["results"][p].get("status") != "PASS")]
        node = shutil.which("node")
        if not node:
            raise RuntimeError("node_unavailable")
        env = guard.child_env()
        env.update({"NODE_ENV": "test", "NODE_OPTIONS": "--max-old-space-size=768", "CI": "true"})
        user_python = shutil.which("python")
        if user_python:
            env["NEXUS_ACCEPTANCE_PYTHON"] = user_python
        attempted = 0
        for rel in planned:
            if attempted >= files_limit:
                break
            if not source_clean(repo, sha) or inventory(repo) != tests:
                raise RuntimeError("source_or_test_inventory_changed")
            free = guard.free_ram_mb()
            if free < min_start:
                state["last_pause"] = {"reason": "insufficient_ram", "free_ram_mb": free}
                save_state(state_path, state)
                break
            previous = state["results"].get(rel, {})
            attempt = previous.get("attempt", 0) + 1
            target = state_dir / expected_log_name(rel, attempt)
            if target.exists():
                raise RuntimeError("existing_test_log_refusing_overwrite")
            # The resource monitor opens the log itself. The lock prevents
            # two copies of the runner writing a shared session.
            attempted += 1
            try:
                run = guard.monitored_process(
                    [node, "--import", "tsx", "--test", "--test-concurrency=1", rel],
                    repo, env, target, seconds, min_ram=min_running
                )
                raw = target.read_bytes()
                if len(raw) > MAX_LOG_BYTES:
                    raise RuntimeError("test_log_exceeds_limit")
                status, counts = classify_log(raw, run["exit_code"])
                entry = {
                    "attempt": attempt, "status": status, "exit_code": run["exit_code"],
                    "log": target.name, "log_sha256": sha256(raw),
                    "counts": counts, "elapsed_seconds": run["elapsed_seconds"],
                    "lowest_free_ram_mb": run["lowest_free_ram_mb"],
                }
            except (OSError, ValueError, RuntimeError, guard.ResourceGuard) as exc:
                raw = target.read_bytes() if target.exists() else b""
                entry = {
                    "attempt": attempt, "status": "BLOCKED", "reason": type(exc).__name__,
                    "log": target.name if target.exists() else None,
                    "log_sha256": sha256(raw) if raw else None,
                }
            # No PASS may be recorded if another source changes during a test.
            if not source_clean(repo, sha) or inventory(repo) != tests:
                entry["status"] = "BLOCKED"
                entry["reason"] = "source_changed_during_test"
            state["results"][rel] = entry
            state.pop("last_pause", None)
            save_state(state_path, state)
            if entry["status"] != "PASS":
                break
        summary = evaluate(state)
        summary["attempted_this_invocation"] = attempted
        summary["state_path"] = str(state_path)
        return summary
    finally:
        lock.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--expect-sha", required=True)
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--retry-incomplete", action="store_true")
    parser.add_argument("--max-files", type=int, default=3)
    parser.add_argument("--min-start-mb", type=int, default=2400)
    parser.add_argument("--min-running-mb", type=int, default=1800)
    parser.add_argument("--seconds-per-file", type=int, default=90)
    args = parser.parse_args()
    if not SHA_RE.fullmatch(args.expect_sha):
        parser.error("a full 40-character source SHA is required")
    if not (1 <= args.max_files <= 30 and 2200 <= args.min_start_mb <= 8192
            and 1800 <= args.min_running_mb <= args.min_start_mb
            and 15 <= args.seconds_per_file <= 240):
        parser.error("unsafe resource limits")
    repo = args.repo.resolve()
    state_dir = repo.parent / "runtime" / "devops-automation" / ("node-shards-" + args.expect_sha[:12])
    try:
        if not source_clean(repo, args.expect_sha):
            raise RuntimeError("checkout_sha_or_cleanliness_mismatch")
        files = inventory(repo)
        path = state_dir / "state.json"
        state = read_state(path, args.expect_sha, files)
        if not args.execute:
            summary = evaluate(state)
            summary.update({"mode": "read_only", "state_path": str(path), "issues": []})
        else:
            guard = load_guard(repo)
            summary = execute(
                repo, args.expect_sha, state_dir, args.max_files,
                args.min_start_mb, args.min_running_mb, args.seconds_per_file, guard,
                retry_incomplete=args.retry_incomplete
            )
            summary["mode"] = "execute"
        print(json.dumps(summary, indent=2, ensure_ascii=False))
        return 0 if summary["node_tests_gate"] == "LOCAL_COMPLETE" else 3
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as exc:
        print(json.dumps({"node_tests_gate": "HOLD", "release_authorized": False,
                          "issue": str(exc)[:200]}, ensure_ascii=False))
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
