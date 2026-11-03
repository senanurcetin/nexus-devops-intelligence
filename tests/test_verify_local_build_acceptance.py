"""Offline checks for safe, opt-in DevOps acceptance."""
import contextlib
import datetime as dt
import importlib.util
import io
import os
import socket
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

    def setup_ready(self, ram=5000, changed=""):
        context = contextlib.ExitStack()
        self.addCleanup(context.close)
        context.enter_context(mock.patch.object(runner.sys, "platform", "win32"))
        context.enter_context(mock.patch.object(runner, "free_ram_mb", return_value=ram))
        context.enter_context(mock.patch.object(runner.shutil, "disk_usage",
                               return_value=types.SimpleNamespace(free=14 * 1024 ** 3)))
        context.enter_context(mock.patch.object(runner.shutil, "which", return_value="node.exe"))
        context.enter_context(mock.patch.object(runner, "checked_git",
            side_effect=lambda _repo, *args: "abc123" if args[0] == "rev-parse" else changed))

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
