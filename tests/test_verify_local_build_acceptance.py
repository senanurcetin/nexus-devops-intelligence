"""Offline checks for safe, opt-in DevOps acceptance."""
import contextlib
import importlib.util
import io
import os
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
