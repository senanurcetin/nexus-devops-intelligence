#!/usr/bin/env python3
"""Resource-guarded, opt-in Windows build + loopback acceptance for NEXUS DevOps.

Default: read-only preflight. --execute: isolated Git worktree, offline-installed
dependencies, production build, HTTP negative probes and read-only JARVIS MCP.
Never changes main .next, enables tasks, deploys, pushes, or kills foreign PIDs.
"""
from __future__ import annotations

import argparse
import ctypes
import datetime as dt
import json
import os
from pathlib import Path
import shutil
import socket
import stat
import subprocess
import sys
import time
import urllib.error
import urllib.request

MIN_START_MB = 4096
MIN_RUNNING_MB = 1800
MIN_DISK_GB = 8
BUILD_SECONDS = 420
START_SECONDS = 150
TEST_SECONDS = 110


class ResourceGuard(Exception):
    pass


class MEMORYSTATUSEX(ctypes.Structure):
    _fields_ = [
        ("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong),
        ("ullTotalPhys", ctypes.c_ulonglong), ("ullAvailPhys", ctypes.c_ulonglong),
        ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong),
        ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong),
        ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
    ]


def free_ram_mb() -> int:
    data = MEMORYSTATUSEX()
    data.dwLength = ctypes.sizeof(data)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(data)):
        raise ResourceGuard("Windows memory query failed")
    return int(data.ullAvailPhys // 1048576)


def safe_junction(path: Path) -> bool:
    try:
        info = os.lstat(path)
        return bool(info.st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT
                    and info.st_reparse_tag == stat.IO_REPARSE_TAG_MOUNT_POINT)
    except (FileNotFoundError, AttributeError):
        return False


def checked_git(repo: Path, *args: str) -> str:
    result = subprocess.run(["git", "-C", str(repo), *args], capture_output=True,
                            text=True, timeout=25, check=True)
    return result.stdout.strip()


def preflight(repo: Path) -> dict:
    result = {"state": "blocked", "repo": str(repo), "head": None,
              "free_ram_mb": None, "free_disk_gb": None, "issues": []}
    if sys.platform != "win32":
        result["issues"].append("Windows-only runner")
        return result
    try:
        result["free_ram_mb"] = free_ram_mb()
        result["free_disk_gb"] = round(shutil.disk_usage(repo).free / (1024 ** 3), 1)
        if not (repo / ".git").is_dir():
            result["issues"].append("requires the primary Git checkout, not a worktree")
            return result
        result["head"] = checked_git(repo, "rev-parse", "HEAD")
        if checked_git(repo, "status", "--porcelain=v1"):
            result["issues"].append("primary checkout has changes")
        if not (repo / "node_modules" / "next" / "dist" / "bin" / "next").is_file():
            result["issues"].append("local Next.js dependencies are missing")
        if not shutil.which("node"):
            result["issues"].append("node is missing from PATH")
        if result["free_ram_mb"] < MIN_START_MB:
            result["issues"].append("available RAM below %d MB" % MIN_START_MB)
        if result["free_disk_gb"] < MIN_DISK_GB:
            result["issues"].append("available C: space below %d GB" % MIN_DISK_GB)
    except (OSError, subprocess.SubprocessError, ResourceGuard) as exc:
        result["issues"].append("preflight unavailable: " + type(exc).__name__)
    result["state"] = "ready" if not result["issues"] else "blocked"
    return result


def child_env() -> dict[str, str]:
    # Avoid passing secret-bearing application environment to Next.js or tests.
    keep = ("PATH", "PATHEXT", "SystemRoot", "WINDIR", "ComSpec", "TEMP", "TMP",
            "USERPROFILE", "LOCALAPPDATA", "APPDATA", "HOMEDRIVE", "HOMEPATH",
            "ProgramFiles", "ProgramFiles(x86)", "ProgramData")
    env = {key: os.environ[key] for key in keep if key in os.environ}
    env.update({"CI": "true", "NODE_ENV": "production",
                "NEXT_TELEMETRY_DISABLED": "1", "NEXUS_SELF_HOSTED_BUILD": "0",
                "NODE_OPTIONS": "--max-old-space-size=1152",
                "GIT_TERMINAL_PROMPT": "0", "GCM_INTERACTIVE": "never"})
    return env


def terminate_tree(process: subprocess.Popen) -> None:
    if process.poll() is None:
        subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                       timeout=25, check=False)
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired as exc:
        raise ResourceGuard("owned process tree did not exit") from exc


def monitored_process(args: list[str], cwd: Path, env: dict, log: Path,
                      timeout: int, min_ram: int = MIN_RUNNING_MB) -> dict:
    started = time.monotonic()
    lowest = free_ram_mb()
    with log.open("w", encoding="utf-8") as output:
        process = subprocess.Popen(args, cwd=str(cwd), env=env, stdout=output,
                                   stderr=subprocess.STDOUT,
                                   creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
        try:
            ctypes.windll.kernel32.SetPriorityClass(int(process._handle), 0x4000)
            low_ticks = 0
            while process.poll() is None:
                available = free_ram_mb()
                lowest = min(lowest, available)
                low_ticks = low_ticks + 1 if available < min_ram else 0
                if low_ticks >= 2:
                    raise ResourceGuard("free RAM dropped below %d MB" % min_ram)
                if time.monotonic() - started > timeout:
                    raise ResourceGuard("process exceeded %d seconds" % timeout)
                time.sleep(2)
            return {"exit_code": process.returncode,
                    "elapsed_seconds": round(time.monotonic() - started, 1),
                    "lowest_free_ram_mb": lowest, "log": str(log)}
        finally:
            terminate_tree(process)


def select_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def probe_root(base: str) -> bool:
    # Explicit no-proxy handler prevents environment proxy bypass of loopback.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        req = urllib.request.Request(base + "/", headers={"Accept": "text/html"})
        with opener.open(req, timeout=3) as response:
            if response.status != 200 or "text/html" not in response.headers.get("content-type", ""):
                return False
            html = response.read(1_000_001).decode("utf-8", "replace")
            return len(html) <= 1_000_000 and "<title>NEXUS DevOps Intelligence</title>" in html
    except (urllib.error.URLError, OSError, TimeoutError):
        return False


def run_acceptance(repo: Path, runtime: Path, readiness: dict) -> dict:
    head = readiness["head"]
    worktree = repo.parent / "wt" / ("devops-accept-" + head[:12])
    link = worktree / "node_modules"
    lock = runtime / "acceptance.lock"
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    report_path = runtime / ("acceptance-" + head[:12] + "-" + stamp + ".json")
    if worktree.exists() or lock.exists():
        raise ResourceGuard("existing worktree or acceptance lock; refusing to alter it")
    runtime.mkdir(parents=True, exist_ok=True)
    fd = os.open(str(lock), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    os.write(fd, str(os.getpid()).encode("ascii"))
    os.close(fd)
    evidence = {"head": head, "started_at": stamp, "state": "fail",
                "checks": {}, "worktree": str(worktree), "cleanup": {},
                "limitations": ["local Windows only", "no external GitHub or Redis evidence",
                                "does not approve a deployment"]}
    own_worktree = False
    own_junction = False
    server = None
    server_log = None
    try:
        if preflight(repo)["state"] != "ready":
            raise ResourceGuard("resources or source changed before execution")
        checked_git(repo, "worktree", "add", "--detach", str(worktree), head)
        own_worktree = True
        if checked_git(worktree, "rev-parse", "HEAD") != head:
            raise ResourceGuard("worktree SHA mismatch")
        ps_link = str(link).replace("'", "''")
        ps_target = str(repo / "node_modules").replace("'", "''")
        ps_command = ("$ErrorActionPreference='Stop'; New-Item -ItemType Junction "
                      "-Path '" + ps_link + "' -Target '" + ps_target + "' | Out-Null")
        junction = subprocess.run(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", ps_command],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=25)
        if junction.returncode != 0 or not safe_junction(link):
            raise ResourceGuard("isolated dependency junction could not be verified")
        own_junction = True
        env = child_env()
        node = shutil.which("node")
        if not node:
            raise ResourceGuard("node disappeared from PATH")
        cli = link / "next" / "dist" / "bin" / "next"
        evidence["checks"]["build"] = monitored_process(
            [node, str(cli), "build"], worktree, env, runtime / ("build-" + stamp + ".log"),
            BUILD_SECONDS)
        if evidence["checks"]["build"]["exit_code"] or not (worktree / ".next" / "BUILD_ID").is_file():
            raise ResourceGuard("production build failed")
        if free_ram_mb() < MIN_START_MB:
            raise ResourceGuard("RAM guard after build")
        port = select_port()
        base = "http://127.0.0.1:" + str(port)
        env.update({"NEXUS_BASE_URL": base, "NEXUS_DEVOPS_BASE_URL": base})
        server_log = (runtime / ("server-" + stamp + ".log")).open("w", encoding="utf-8")
        server = subprocess.Popen([node, str(cli), "start", "-H", "127.0.0.1", "-p", str(port)],
                                  cwd=str(worktree), env=env, stdout=server_log,
                                  stderr=subprocess.STDOUT,
                                  creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
        ctypes.windll.kernel32.SetPriorityClass(int(server._handle), 0x4000)
        start = time.monotonic()
        while time.monotonic() - start <= START_SECONDS:
            if server.poll() is not None:
                raise ResourceGuard("temporary Next.js process exited")
            if free_ram_mb() < MIN_RUNNING_MB:
                raise ResourceGuard("RAM guard during startup")
            if probe_root(base):
                evidence["checks"]["http_root"] = "pass"
                break
            time.sleep(3)
        else:
            raise ResourceGuard("temporary Next.js did not become ready")
        for label, command in (
            ("http_negative", [node, "scripts/smoke-http-offline.mjs"]),
            ("jarvis_mcp", [node, "scripts/verify-jarvis-mcp.mjs", "--base-url", base]),
        ):
            record = monitored_process(command, worktree, env,
                                       runtime / (label + "-" + stamp + ".log"), TEST_SECONDS)
            evidence["checks"][label] = record
            if record["exit_code"]:
                raise ResourceGuard(label + " check failed")
        evidence["state"] = "pass"
    except (OSError, subprocess.SubprocessError, ResourceGuard) as exc:
        evidence["error"] = str(exc)[:400]
    finally:
        cleanup = evidence["cleanup"]
        if server is not None:
            try:
                terminate_tree(server)
                cleanup["owned_server_stopped"] = True
            except Exception:
                cleanup["owned_server_stopped"] = False
        if server_log is not None:
            server_log.close()
        server_stopped = server is None or cleanup.get("owned_server_stopped", False)
        if own_junction:
            if not server_stopped:
                cleanup["junction_removed"] = False
            else:
                try:
                    if not safe_junction(link):
                        raise ResourceGuard("dependency link is not an owned junction")
                    os.rmdir(link)
                    cleanup["junction_removed"] = not link.exists()
                except (OSError, ResourceGuard):
                    cleanup["junction_removed"] = False
        if own_worktree and not link.exists() and server_stopped:
            try:
                removal = subprocess.run(
                    ["git", "-C", str(repo), "worktree", "remove", "--force", str(worktree)],
                    capture_output=True, text=True, timeout=45)
                cleanup["isolated_worktree_removed"] = removal.returncode == 0
            except (OSError, subprocess.SubprocessError):
                cleanup["isolated_worktree_removed"] = False
        else:
            cleanup["isolated_worktree_removed"] = not own_worktree
        cleanup_ok = ((server is None or cleanup.get("owned_server_stopped", False))
                      and (not own_junction or cleanup.get("junction_removed", False))
                      and cleanup["isolated_worktree_removed"])
        if not cleanup_ok:
            evidence["state"] = "fail"
            evidence.setdefault("error", "temporary resources could not be fully cleaned up")
        evidence["ended_at_utc"] = dt.datetime.now(dt.timezone.utc).isoformat()
        try:
            report_path.write_text(json.dumps(evidence, ensure_ascii=False, indent=2),
                                   encoding="utf-8")
        finally:
            lock.unlink(missing_ok=True)
    return evidence


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true",
                        help="explicitly opt into an isolated production build and loopback smoke")
    args = parser.parse_args()
    repo = Path(__file__).resolve().parent.parent
    readiness = preflight(repo)
    if not args.execute:
        print(json.dumps(readiness, indent=2))
        return 0 if readiness["state"] == "ready" else 2
    if readiness["state"] != "ready":
        print(json.dumps(readiness, indent=2))
        return 2
    runtime = repo.parent / "runtime" / "devops-automation" / "acceptance"
    try:
        report = run_acceptance(repo, runtime, readiness)
    except (OSError, subprocess.SubprocessError, ResourceGuard) as exc:
        print(json.dumps({"state": "blocked", "reason": str(exc)[:300]}))
        return 2
    print(json.dumps(report, indent=2))
    return 0 if report["state"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
