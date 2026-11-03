"""Offline checks for safe, opt-in DevOps acceptance."""
import contextlib
import datetime as dt
import importlib.util
import io
import json
import os
import shutil
import socket
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest import mock

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "verify-local-build-acceptance.py"
SPEC = importlib.util.spec_from_file_location("local_acceptance_runner", SCRIPT)
runner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runner)


class AcceptanceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name) / "repo"
        (self.repo / ".git").mkdir(parents=True)
        binary = self.repo / "node_modules" / "next" / "dist" / "bin" / "next"
        binary.parent.mkdir(parents=True)
        binary.write_text("", encoding="utf-8")
        self.package = self.repo / "package.json"
        self.lock = self.repo / "package-lock.json"
        self.installed_next = self.repo / "node_modules" / "next" / "package.json"
        self.write_json(self.package, {
            "dependencies": {"next": "15.5.28"}, "engines": {"node": ">=22.16.0"}
        })
        self.write_json(self.lock, {
            "lockfileVersion": 3,
            "packages": {
                "": {"dependencies": {"next": "15.5.28"}},
                "node_modules/next": {"version": "15.5.28"},
            }
        })
        self.write_json(self.installed_next, {"version": "15.5.28"})

    def write_json(self, file: Path, payload: dict):
        file.write_text(json.dumps(payload), encoding="utf-8")

    def setup_ready(self, ram=5000, changed=""):
        context = contextlib.ExitStack()
        self.addCleanup(context.close)
        context.enter_context(mock.patch.object(runner.sys, "platform", "win32"))
        context.enter_context(mock.patch.object(runner, "free_ram_mb", return_value=ram))
        context.enter_context(mock.patch.object(runner.time, "sleep"))
        context.enter_context(mock.patch.object(runner.shutil, "disk_usage",
                               return_value=types.SimpleNamespace(free=14 * 1024 ** 3)))
        context.enter_context(mock.patch.object(runner.shutil, "which", return_value="node.exe"))
        context.enter_context(mock.patch.object(runner, "node_version", return_value=(24, 13, 0)))
        context.enter_context(mock.patch.object(runner, "checked_git",
            side_effect=lambda _repo, *args: "abc123" if args[0] == "rev-parse" else changed))

    def test_ram_spike_does_not_authorize_a_build(self):
        with mock.patch.object(runner, "free_ram_mb", side_effect=[4500, 3400]) as measure, \
             mock.patch.object(runner.time, "sleep") as pause:
            self.assertEqual(runner.stable_starting_ram_mb(), 3400)
        self.assertEqual(measure.call_count, 2)
        pause.assert_called_once_with(2)

    def test_stable_ram_requires_three_measurements(self):
        with mock.patch.object(runner, "free_ram_mb",
                               side_effect=[4800, 4600, 4350]) as measure, \
             mock.patch.object(runner.time, "sleep") as pause:
            self.assertEqual(runner.stable_starting_ram_mb(), 4350)
        self.assertEqual(measure.call_count, 3)
        self.assertEqual(pause.call_count, 2)

    def test_already_low_ram_exits_without_delay(self):
        with mock.patch.object(runner, "free_ram_mb", return_value=1800) as measure, \
             mock.patch.object(runner.time, "sleep") as pause:
            self.assertEqual(runner.stable_starting_ram_mb(), 1800)
        measure.assert_called_once()
        pause.assert_not_called()

    def test_low_ram_fails_preflight(self):
        self.setup_ready(ram=1800)
        result = runner.preflight(self.repo)
        self.assertEqual(result["state"], "blocked")
        self.assertTrue(any("RAM" in issue for issue in result["issues"]))

    def test_adequate_resources_are_ready(self):
        self.setup_ready()
        result = runner.preflight(self.repo)
        self.assertEqual(result["state"], "ready")
        self.assertEqual(result["head"], "abc123")

    def test_dirty_checkout_is_blocked(self):
        self.setup_ready(changed=" M file")
        self.assertIn("primary checkout has changes", runner.preflight(self.repo)["issues"])

    def test_secondary_worktree_is_blocked(self):
        self.setup_ready()
        (self.repo / ".git").rmdir()
        (self.repo / ".git").write_text("gitdir: sample", encoding="utf-8")
        self.assertEqual(runner.preflight(self.repo)["state"], "blocked")

    def test_installed_next_mismatch_blocks_preflight(self):
        self.setup_ready()
        self.write_json(self.installed_next, {"version": "15.5.27"})
        issues = runner.preflight(self.repo)["issues"]
        self.assertIn("installed Next.js differs from package and lockfile", issues)

    def test_missing_lockfile_blocks_preflight(self):
        self.setup_ready()
        self.lock.unlink()
        self.assertEqual(runner.preflight(self.repo)["state"], "blocked")
        self.assertIn("local dependency metadata unavailable or invalid",
                      runner.preflight(self.repo)["issues"])

    def test_lockfile_next_mismatch_blocks_preflight(self):
        self.setup_ready()
        self.write_json(self.lock, {
            "lockfileVersion": 3,
            "packages": {
                "": {"dependencies": {"next": "15.5.28"}},
                "node_modules/next": {"version": "15.5.26"},
            },
        })
        self.assertEqual(runner.preflight(self.repo)["state"], "blocked")

    def test_unpinned_next_version_fails_closed(self):
        self.setup_ready()
        self.write_json(self.package, {
            "dependencies": {"next": "^15.5.28"}, "engines": {"node": ">=22.16.0"}
        })
        issues = runner.preflight(self.repo)["issues"]
        self.assertIn("Next.js version metadata is not pinned", issues)

    def test_unsupported_lockfile_schema_is_blocked(self):
        self.setup_ready()
        self.write_json(self.lock, {"lockfileVersion": 2, "packages": {
            "": {"dependencies": {"next": "15.5.28"}},
            "node_modules/next": {"version": "15.5.28"},
        }})
        self.assertIn("unsupported package-lock version", runner.preflight(self.repo)["issues"])

    def test_node_below_engine_requirement_blocks_preflight(self):
        self.setup_ready()
        with mock.patch.object(runner, "node_version", return_value=(20, 19, 0)):
            issues = runner.preflight(self.repo)["issues"]
        self.assertIn("installed Node.js is below project engine requirement", issues)

    def test_unverifiable_engine_requirement_blocks_preflight(self):
        self.setup_ready()
        self.write_json(self.package, {
            "dependencies": {"next": "15.5.28"}, "engines": {"node": "^22.16.0"}
        })
        self.assertIn("Node.js engine requirement is not verifiable", runner.preflight(self.repo)["issues"])

    def test_node_cli_invalid_version_is_rejected(self):
        fake = types.SimpleNamespace(stdout="node missing", returncode=0)
        with mock.patch.object(runner.subprocess, "run", return_value=fake):
            with self.assertRaises(runner.ResourceGuard):
                runner.node_version("node.exe")

    def test_missing_dependency_is_blocked(self):
        self.setup_ready()
        (self.repo / "node_modules" / "next" / "dist" / "bin" / "next").unlink()
        self.assertEqual(runner.preflight(self.repo)["state"], "blocked")

    def test_existing_worktree_is_never_replaced(self):
        existing = self.repo.parent / "wt" / "devops-accept-abc123"
        existing.mkdir(parents=True)
        with self.assertRaises(runner.ResourceGuard):
            runner.run_acceptance(self.repo, self.repo.parent / "runtime", {"head": "abc123"})

    def test_existing_lock_is_never_replaced(self):
        folder = self.repo.parent / "runtime"
        folder.mkdir()
        (folder / "acceptance.lock").write_text("busy", encoding="utf-8")
        with self.assertRaises(runner.ResourceGuard):
            runner.run_acceptance(self.repo, folder, {"head": "abc123"})
        self.assertEqual((folder / "acceptance.lock").read_text(), "busy")

    def test_second_preflight_blocks_without_starting_a_build(self):
        with mock.patch.object(runner, "preflight", return_value={"state": "blocked"}), \
             mock.patch.object(runner.subprocess, "Popen") as spawn:
            runtime = self.repo.parent / "runtime"
            report = runner.run_acceptance(self.repo, runtime, {"head": "abc123"})
            self.assertEqual(report["state"], "fail")
            self.assertIn("resources or source changed", report["error"])
            self.assertFalse((runtime / "acceptance.lock").exists())
            self.assertFalse((self.repo.parent / "wt" / "devops-accept-abc123").exists())
            spawn.assert_not_called()

    def test_changed_sha_after_preflight_is_refused_before_build(self):
        with mock.patch.object(
            runner, "preflight",
            return_value={"state": "ready", "head": "different-commit"},
        ), mock.patch.object(runner, "checked_git") as git, mock.patch.object(
            runner.subprocess, "Popen"
        ) as spawn:
            runtime = self.repo.parent / "runtime"
            result = runner.run_acceptance(self.repo, runtime, {"head": "abc123"})
            self.assertEqual(result["state"], "fail")
            self.assertIn("source changed", result["error"])
            self.assertFalse((runtime / "acceptance.lock").exists())
            git.assert_not_called()
            spawn.assert_not_called()

    def test_primary_sha_changing_after_checkout_blocks_build(self):
        def checked(_repo, *args):
            if args[:2] == ("worktree", "add"):
                return ""
            if args == ("rev-parse", "HEAD"):
                return "abc123" if _repo != self.repo else "changed-since-lock"
            return ""
        with mock.patch.object(runner, "preflight",
                               return_value={"state": "ready", "head": "abc123"}), \
             mock.patch.object(runner, "checked_git", side_effect=checked), \
             mock.patch.object(runner.subprocess, "run",
                               return_value=types.SimpleNamespace(returncode=0)), \
             mock.patch.object(runner.subprocess, "Popen") as spawn:
            runtime = self.repo.parent / "runtime"
            result = runner.run_acceptance(self.repo, runtime, {"head": "abc123"})
            self.assertEqual(result["state"], "fail")
            self.assertIn("primary source changed after checkout", result["error"])
            self.assertTrue(result["cleanup"]["isolated_worktree_removed"])
            self.assertFalse((runtime / "acceptance.lock").exists())
            spawn.assert_not_called()

    def test_source_consistency_checks_both_shas_and_both_dirty_trees(self):
        isolated = self.repo.parent / "wt" / "acceptance"
        expected = "abc123"
        def status_checker(repo, *args):
            if args == ("rev-parse", "HEAD"):
                return expected
            if args == ("status", "--porcelain=v1"):
                return ""
            raise AssertionError(args)
        with mock.patch.object(runner, "checked_git", side_effect=status_checker) as git:
            self.assertTrue(runner.source_unchanged(self.repo, isolated, expected))
            self.assertEqual(git.call_count, 4)

    def test_source_consistency_detects_dirty_isolated_tree(self):
        isolated = self.repo.parent / "wt" / "acceptance"
        def status_checker(repo, *args):
            if args == ("rev-parse", "HEAD"):
                return "abc123"
            if args == ("status", "--porcelain=v1"):
                return " M src/index.ts" if repo == isolated else ""
            raise AssertionError(args)
        with mock.patch.object(runner, "checked_git", side_effect=status_checker):
            self.assertFalse(runner.source_unchanged(self.repo, isolated, "abc123"))

    def test_source_consistency_detects_late_commit_change(self):
        isolated = self.repo.parent / "wt" / "acceptance"
        def status_checker(repo, *args):
            if args == ("rev-parse", "HEAD"):
                return "changed-late" if repo == self.repo else "abc123"
            return ""
        with mock.patch.object(runner, "checked_git", side_effect=status_checker):
            self.assertFalse(runner.source_unchanged(self.repo, isolated, "abc123"))

    def test_git_remove_exit_zero_is_not_proof_of_directory_removal(self):
        # Simulate a Git remove that claims success but leaves the directory.
        # The acceptance must fail and must not report clean cleanup.
        worktree = self.repo.parent / "wt" / "devops-accept-abc123"
        def checked(repo, *args):
            if args[:2] == ("worktree", "add"):
                worktree.mkdir(parents=True)
                return ""
            if args == ("rev-parse", "HEAD"):
                return "abc123"
            if args == ("status", "--porcelain=v1"):
                return ""
            return ""
        with mock.patch.object(runner, "preflight",
                               return_value={"state": "ready", "head": "abc123"}), \
             mock.patch.object(runner, "checked_git", side_effect=checked), \
             mock.patch.object(runner.subprocess, "run",
                               return_value=types.SimpleNamespace(returncode=0)), \
             mock.patch.object(runner, "safe_junction", return_value=False), \
             mock.patch.object(runner.subprocess, "Popen") as spawn:
            runtime = self.repo.parent / "runtime"
            report = runner.run_acceptance(self.repo, runtime, {"head": "abc123"})
        self.assertEqual(report["state"], "fail")
        self.assertFalse(report["cleanup"]["isolated_worktree_removed"])
        self.assertTrue(report["cleanup"]["source_unchanged_before_cleanup"])
        self.assertTrue(worktree.exists())
        self.assertFalse((runtime / "acceptance.lock").exists())
        spawn.assert_not_called()

    def simulate_full_acceptance(self, change_after_checks=False):
        # Run the complete acceptance state machine with synthetic Git,
        # build and server adapters. Nothing gets built or listens on TCP.
        head = "abc123"
        runtime = self.repo.parent / "runtime"
        isolated = self.repo.parent / "wt" / ("devops-accept-" + head[:12])
        isolated.parent.mkdir()
        link = isolated / "node_modules"
        calls = {"run": [], "monitored": [], "spawned": 0, "stopped": 0}
        class SimulatedServer:
            pid = 12456
            _handle = 0
            def poll(self):
                return None

        def git(repo, *args):
            if args[:2] == ("worktree", "add"):
                isolated.mkdir()
                return ""
            if args == ("rev-parse", "HEAD"):
                return head
            if args == ("status", "--porcelain=v1"):
                return ""
            raise AssertionError("unexpected Git operation: " + repr(args))

        def system(args, **kwargs):
            calls["run"].append(list(args))
            if args[0].lower().startswith("powershell"):
                link.mkdir()
                return types.SimpleNamespace(returncode=0)
            if args[0] == "git" and "remove" in args:
                shutil.rmtree(isolated)
                return types.SimpleNamespace(returncode=0)
            raise AssertionError("unexpected process: " + repr(args))

        def monitored(args, cwd, env, log, timeout, min_ram=runner.MIN_RUNNING_MB):
            calls["monitored"].append(args[-1])
            if args[-1] == "build":
                (isolated / ".next").mkdir()
                (isolated / ".next" / "BUILD_ID").write_text("synthetic", encoding="ascii")
            log.write_text("synthetic non-network command", encoding="utf-8")
            return {"exit_code": 0, "lowest_free_ram_mb": 5000, "log": str(log)}

        def spawn(args, **kwargs):
            calls["spawned"] += 1
            self.assertEqual(args[-4:], ["-H", "127.0.0.1", "-p", "49152"])
            return SimulatedServer()

        def stopped(process):
            calls["stopped"] += 1
        # If sources change after all protocol checks, the final consistency
        # check and cleanup proof both fail, despite synthetic checks passing.
        consistency = (lambda *_: not change_after_checks)
        with mock.patch.object(runner, "preflight", return_value={"state": "ready", "head": head}), \
             mock.patch.object(runner, "checked_git", side_effect=git), \
             mock.patch.object(runner.subprocess, "run", side_effect=system), \
             mock.patch.object(runner.subprocess, "Popen", side_effect=spawn), \
             mock.patch.object(runner, "safe_junction", side_effect=lambda path: path == link and link.is_dir()), \
             mock.patch.object(runner, "monitored_process", side_effect=monitored), \
             mock.patch.object(runner, "free_ram_mb", return_value=5000), \
             mock.patch.object(runner.shutil, "which", return_value="node.exe"), \
             mock.patch.object(runner, "select_port", return_value=49152), \
             mock.patch.object(runner, "probe_root", return_value=True), \
             mock.patch.object(runner, "temporary_port_closed", return_value=True), \
             mock.patch.object(runner, "terminate_tree", side_effect=stopped), \
             mock.patch.object(runner, "source_unchanged", side_effect=consistency):
            result = runner.run_acceptance(self.repo, runtime, {"head": head})
        return result, runtime, isolated, calls

    def test_simulated_complete_acceptance_passes_and_cleans_every_owned_resource(self):
        result, runtime, isolated, calls = self.simulate_full_acceptance()
        self.assertEqual(result["state"], "pass")
        self.assertEqual(result["checks"]["source_consistency"], "pass")
        self.assertEqual(result["checks"]["http_root"], "pass")
        self.assertEqual(result["checks"]["build"]["exit_code"], 0)
        self.assertEqual(result["checks"]["http_negative"]["exit_code"], 0)
        self.assertEqual(result["checks"]["jarvis_mcp"]["exit_code"], 0)
        self.assertEqual(result["cleanup"]["source_unchanged_before_cleanup"], True)
        self.assertEqual(result["cleanup"]["isolated_worktree_removed"], True)
        self.assertEqual(result["cleanup"]["server_log_closed"], True)
        self.assertEqual(result["cleanup"]["temporary_port_closed"], True)
        self.assertEqual(calls["spawned"], 1)
        self.assertEqual(calls["stopped"], 1)
        self.assertEqual(len(calls["monitored"]), 3)
        self.assertFalse(isolated.exists())
        self.assertFalse((runtime / "acceptance.lock").exists())
        reports = list(runtime.glob("acceptance-*.json"))
        self.assertEqual(len(reports), 1)
        self.assertEqual(json.loads(reports[0].read_text(encoding="utf-8")), result)

    def test_simulated_successful_protocol_tests_cannot_override_late_source_change(self):
        result, runtime, isolated, calls = self.simulate_full_acceptance(change_after_checks=True)
        self.assertEqual(result["state"], "fail")
        self.assertIn("source changed", result["error"])
        self.assertFalse(result["cleanup"]["source_unchanged_before_cleanup"])
        self.assertTrue(result["cleanup"]["isolated_worktree_removed"])
        self.assertEqual(calls["spawned"], 1)
        self.assertEqual(calls["stopped"], 1)
        self.assertFalse(isolated.exists())
        self.assertFalse((runtime / "acceptance.lock").exists())

    def test_preexisting_evidence_is_never_overwritten(self):
        runtime = self.repo.parent / "runtime"
        runtime.mkdir()
        now = dt.datetime(2026, 11, 3, 18, 31, tzinfo=dt.timezone.utc)
        report = runtime / "acceptance-abc123-20261103T183100000000Z.json"
        report.write_text("previous evidence", encoding="utf-8")
        with mock.patch.object(runner.dt, "datetime") as clock, \
             mock.patch.object(runner, "preflight", return_value={"state": "blocked"}):
            clock.now.return_value = now
            with self.assertRaises(FileExistsError):
                runner.run_acceptance(self.repo, runtime, {"head": "abc123"})
        self.assertEqual(report.read_text(encoding="utf-8"), "previous evidence")
        self.assertFalse((runtime / "acceptance.lock").exists())

    def test_port_release_check_is_tied_to_actual_loopback_listener(self):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
            server.bind(("127.0.0.1", 0))
            server.listen(1)
            port = server.getsockname()[1]
            self.assertFalse(runner.temporary_port_closed(port, retries=1))
        self.assertTrue(runner.temporary_port_closed(port, retries=2))

    def test_uncheckable_port_is_not_treated_as_released(self):
        with mock.patch.object(runner.socket, "socket", side_effect=OSError("unavailable")):
            self.assertFalse(runner.temporary_port_closed(45321, retries=1))

    def test_real_directory_junction_can_be_recognized_and_removed(self):
        if sys.platform != "win32":
            self.skipTest("Windows directory junction")
        import subprocess
        source = self.repo.parent / "original"
        junction = self.repo.parent / "temporary-junction"
        source.mkdir()
        command = ("$ErrorActionPreference='Stop'; New-Item -ItemType Junction "
                   "-Path '" + str(junction) + "' -Target '" + str(source) + "' | Out-Null")
        output = subprocess.run(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15)
        self.assertEqual(output.returncode, 0, "directory junction creation must succeed on Windows")
        try:
            self.assertTrue(runner.safe_junction(junction))
        finally:
            junction.rmdir()
        self.assertTrue(source.exists())
        self.assertFalse(junction.exists())

    def local_http(self):
        class LocalHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                mode = self.server.mode
                self.server.requests.append(self.path)
                if self.path != "/":
                    self.send_response(200)
                    self.end_headers()
                    self.wfile.write(b"other path")
                    return
                if mode.startswith("redirect-"):
                    self.send_response(302)
                    if mode == "redirect-local":
                        target = "/other"
                    else:
                        target = "https://example.invalid/not-the-service"
                    self.send_header("Location", target)
                    self.end_headers()
                    return
                self.send_response(200)
                content_type = "text/plain" if mode == "wrong-mime" else "text/html; charset=utf-8"
                self.send_header("Content-Type", content_type)
                self.end_headers()
                valid = b"<html><head><title>NEXUS DevOps Intelligence</title></head></html>"
                if mode == "wrong-title":
                    valid = b"<html><title>Foreign application</title></html>"
                if mode == "oversize":
                    valid = valid + b"X" * 1_000_100
                self.wfile.write(valid)

            def log_message(self, *_):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), LocalHandler)
        server.mode = "valid"
        server.requests = []
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        def cleanup():
            server.shutdown()
            worker.join(timeout=5)
            server.server_close()
        self.addCleanup(cleanup)
        return server, "http://127.0.0.1:" + str(server.server_address[1])

    def test_local_probe_accepts_only_expected_page(self):
        server, base = self.local_http()
        self.assertTrue(runner.probe_root(base))
        self.assertEqual(server.requests, ["/"])

    def test_local_probe_rejects_redirects_without_following_them(self):
        server, base = self.local_http()
        server.mode = "redirect-local"
        self.assertFalse(runner.probe_root(base))
        self.assertEqual(server.requests, ["/"], "redirect target must not be requested")
        server.requests.clear()
        server.mode = "redirect-external"
        self.assertFalse(runner.probe_root(base))
        self.assertEqual(server.requests, ["/"], "redirect to external host must never be followed")

    def test_local_probe_rejects_wrong_mime_and_foreign_title(self):
        server, base = self.local_http()
        for mode in ("wrong-mime", "wrong-title"):
            with self.subTest(mode=mode):
                server.mode = mode
                self.assertFalse(runner.probe_root(base))

    def test_local_probe_caps_raw_http_body_not_decoded_characters(self):
        server, base = self.local_http()
        server.mode = "oversize"
        self.assertFalse(runner.probe_root(base))

    def test_local_probe_rejects_nonliteral_loopback_before_network(self):
        server, base = self.local_http()
        urls = [
            base.replace("127.0.0.1", "localhost"),
            base.replace("http://", "https://"),
            base + "/other",
            base + "?debug=true",
            base.replace("http://", "http://login@"),
            "http://127.0.0.1:invalid",
            "http://127.0.0.1",
        ]
        for url in urls:
            with self.subTest(url=url):
                self.assertFalse(runner.probe_root(url))
        self.assertEqual(server.requests, [], "invalid origins must not be requested")

    def test_default_mode_is_read_only(self):
        with mock.patch.object(runner, "preflight", return_value={"state": "blocked"}), \
             mock.patch.object(runner, "run_acceptance") as execute, \
             mock.patch.object(sys, "argv", ["verify-local-build-acceptance.py"]):
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(runner.main(), 2)
            execute.assert_not_called()

    def test_explicit_mode_still_honors_safety_preflight(self):
        with mock.patch.object(runner, "preflight", return_value={"state": "blocked"}), \
             mock.patch.object(runner, "run_acceptance") as execute, \
             mock.patch.object(sys, "argv", ["verify-local-build-acceptance.py", "--execute"]):
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(runner.main(), 2)
            execute.assert_not_called()

    def test_program_environment_replaces_inherited_configuration(self):
        with mock.patch.dict(os.environ, {"PATH": "C:/bin", "CI": "false",
                                          "NODE_OPTIONS": "--trace-warnings"}, clear=True):
            env = runner.child_env()
        self.assertEqual(env["CI"], "true")
        self.assertEqual(env["NODE_OPTIONS"], "--max-old-space-size=1152")


if __name__ == "__main__":
    unittest.main()
