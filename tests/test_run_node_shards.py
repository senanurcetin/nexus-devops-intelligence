"""Regression tests for resumable, fail-closed source test shards."""
import importlib.util
import json
from pathlib import Path
import tempfile
import types
import unittest
from unittest import mock

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "run-node-shards.py"
SPEC = importlib.util.spec_from_file_location("nexus_test_shards", SCRIPT)
runner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runner)

HEAD = "a" * 40
TAP_OK = ("TAP version 13\n"
          "✔ fixture succeeds (3ms)\n"
          "ℹ tests 1\nℹ suites 0\nℹ pass 1\nℹ fail 0\n"
          "ℹ cancelled 0\nℹ skipped 0\nℹ todo 0\n")
TAP_SKIP = TAP_OK.replace("ℹ pass 1", "ℹ pass 0").replace("ℹ skipped 0", "ℹ skipped 1")


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.repo = self.root / "repo"
        (self.repo / "tests").mkdir(parents=True)
        self.one = self.repo / "tests" / "a.test.mjs"
        self.two = self.repo / "tests" / "b.test.mjs"
        self.one.write_text("test('a',()=>{})\n", encoding="utf-8")
        self.two.write_text("test('b',()=>{})\n", encoding="utf-8")
        self.tests = runner.inventory(self.repo)
        self.dir = self.root / "runtime"

    def test_elevated_account_cannot_start_any_tests(self):
        with mock.patch.object(runner, "is_elevated", return_value=True):
            with self.assertRaisesRegex(RuntimeError, "elevated_account_not_allowed"):
                runner.execute(self.repo, HEAD, self.dir, 1, 2400, 1800, 90, self.guard())
        self.assertFalse(self.dir.exists())

    def test_inventory_deterministic_and_bounded(self):
        self.assertEqual(len(self.tests), 2)
        self.assertEqual(list(self.tests), ["tests/a.test.mjs", "tests/b.test.mjs"])
        self.assertTrue(all(len(s) == 64 for s in self.tests.values()))

    def test_tap_summary_cannot_be_fooled_by_process_exit_code(self):
        self.assertEqual(runner.classify_log(TAP_OK.encode(), 0)[0], "PASS")
        self.assertEqual(runner.classify_log(TAP_OK.encode(), 2)[0], "FAIL")
        self.assertEqual(runner.classify_log(TAP_SKIP.encode(), 0)[0], "PARTIAL")
        self.assertEqual(runner.classify_log(b"PASS arbitrary text", 0)[0], "UNVERIFIED")

    def test_absent_state_is_hold_with_full_inventory(self):
        state = runner.read_state(self.dir / "state.json", HEAD, self.tests)
        report = runner.evaluate(state)
        self.assertEqual(report["node_tests_gate"], "HOLD")
        self.assertEqual(report["files_pending"], 2)
        self.assertFalse(report["release_authorized"])

    def test_resume_rejects_any_changed_test_inventory(self):
        self.dir.mkdir()
        state_path = self.dir / "state.json"
        runner.save_state(state_path, runner.read_state(state_path, HEAD, self.tests))
        with self.assertRaisesRegex(RuntimeError, "state_mismatch"):
            runner.read_state(state_path, "b" * 40, self.tests)
        self.one.write_text("changed test\n")
        with self.assertRaisesRegex(RuntimeError, "state_mismatch"):
            runner.read_state(state_path, HEAD, runner.inventory(self.repo))

    def test_previous_pass_requires_real_untampered_log(self):
        self.dir.mkdir()
        relative = "tests/a.test.mjs"
        filename = runner.expected_log_name(relative, 1)
        logfile = self.dir / filename
        logfile.write_bytes(TAP_OK.encode())
        results = {
            relative: {
                "attempt": 1, "status": "PASS", "exit_code": 0,
                "log": filename, "log_sha256": runner.sha256(TAP_OK.encode()),
                "counts": runner.classify_log(TAP_OK.encode(), 0)[1],
            }
        }
        state = runner.read_state(self.dir / "state.json", HEAD, self.tests)
        state["results"] = results
        runner.save_state(self.dir / "state.json", state)
        self.assertEqual(
            runner.read_state(self.dir / "state.json", HEAD, self.tests)["results"],
            results
        )
        logfile.write_text("forged pass\n", encoding="utf-8")
        with self.assertRaisesRegex(RuntimeError, "hash_mismatch"):
            runner.read_state(self.dir / "state.json", HEAD, self.tests)

    def test_symlink_state_rejected_where_supported(self):
        self.dir.mkdir()
        private = self.dir / "elsewhere.json"
        private.write_text("{}")
        link = self.dir / "state.json"
        try:
            link.symlink_to(private)
        except OSError:
            self.skipTest("file symlink permission unavailable on this host")
        with self.assertRaisesRegex(RuntimeError, "unsafe_existing_state"):
            runner.read_state(link, HEAD, self.tests)

    def test_existing_lock_is_never_deleted_or_overridden(self):
        self.dir.mkdir()
        lock = self.dir / "runner.lock"
        lock.write_text("someone else owns this lock")
        with mock.patch.object(runner, "source_clean", return_value=True), \
             mock.patch.object(runner, "is_elevated", return_value=False):
            with self.assertRaises(FileExistsError):
                runner.execute(self.repo, HEAD, self.dir, 1, 2400, 1800, 90,
                               self.guard())
        self.assertEqual(lock.read_text(), "someone else owns this lock")

    @staticmethod
    def guard():
        class Guard:
            ResourceGuard = RuntimeError
            @staticmethod
            def free_ram_mb():
                return 4000
            @staticmethod
            def child_env():
                return {"PATH": "test"}
            @staticmethod
            def monitored_process(args, repo, env, logfile, seconds, min_ram):
                logfile.write_bytes(TAP_OK.encode("utf-8"))
                return {
                    "exit_code": 0,
                    "elapsed_seconds": 1,
                    "lowest_free_ram_mb": 3500
                }
        return Guard

    def run_fake(self, *, available=4000, max_files=1, retry=False):
        guard = self.guard()
        guard.free_ram_mb = lambda: available
        with mock.patch.object(runner, "source_clean", return_value=True), \
             mock.patch.object(runner, "is_elevated", return_value=False), \
             mock.patch.object(runner.shutil, "which", return_value="node.exe"):
            return runner.execute(self.repo, HEAD, self.dir, max_files,
                                  2400, 1800, 90, guard, retry_incomplete=retry)

    def test_one_file_per_call_then_resume_to_full_pass(self):
        first = self.run_fake()
        self.assertEqual(first["files_passed"], 1)
        self.assertEqual(first["files_pending"], 1)
        self.assertEqual(first["node_tests_gate"], "HOLD")
        second = self.run_fake()
        self.assertEqual(second["files_passed"], 2)
        self.assertEqual(second["files_pending"], 0)
        self.assertEqual(second["node_tests_gate"], "LOCAL_COMPLETE")
        self.assertFalse(second["release_authorized"])
        self.assertFalse((self.dir / "runner.lock").exists())

    def test_low_ram_does_not_start_foreign_or_owned_test(self):
        with mock.patch.object(runner, "source_clean", return_value=True), \
             mock.patch.object(runner, "is_elevated", return_value=False), \
             mock.patch.object(runner.shutil, "which", return_value="node.exe"):
            guard = self.guard()
            guard.free_ram_mb = lambda: 2130
            guard.monitored_process = mock.Mock(side_effect=AssertionError("should not start"))
            result = runner.execute(self.repo, HEAD, self.dir, 2, 2400, 1800, 90, guard)
        self.assertEqual(result["attempted_this_invocation"], 0)
        self.assertEqual(result["files_passed"], 0)
        self.assertEqual(json.loads((self.dir / "state.json").read_text())["last_pause"]["reason"],
                         "insufficient_ram")

    def test_retry_incomplete_uses_new_log_and_preserves_original(self):
        self.dir.mkdir()
        existing = runner.read_state(self.dir / "state.json", HEAD, self.tests)
        rel = "tests/a.test.mjs"
        old_name = runner.expected_log_name(rel, 1)
        old_log = self.dir / old_name
        old_log.write_text("incomplete\n")
        existing["results"][rel] = {"attempt": 1, "status": "BLOCKED",
                                    "log": old_name, "log_sha256": runner.sha256(old_log.read_bytes())}
        runner.save_state(self.dir / "state.json", existing)
        result = self.run_fake(retry=True, max_files=1)
        self.assertEqual(result["files_passed"], 1)
        self.assertEqual(old_log.read_text(), "incomplete\n")
        self.assertTrue((self.dir / runner.expected_log_name(rel, 2)).is_file())

    def test_failed_tap_never_promotes_entire_inventory(self):
        self.dir.mkdir()
        guard = self.guard()
        def failing(args, repo, env, logfile, seconds, min_ram):
            logfile.write_text(TAP_SKIP, encoding="utf-8")
            return {"exit_code": 0, "elapsed_seconds": 1,
                    "lowest_free_ram_mb": 3300}
        guard.monitored_process = failing
        with mock.patch.object(runner, "source_clean", return_value=True), \
             mock.patch.object(runner, "is_elevated", return_value=False), \
             mock.patch.object(runner.shutil, "which", return_value="node.exe"):
            result = runner.execute(self.repo, HEAD, self.dir, 2, 2400, 1800, 90, guard)
        self.assertEqual(result["files_passed"], 0)
        self.assertEqual(result["node_tests_gate"], "HOLD")
        self.assertIn("tests/a.test.mjs", result["exceptions"])


if __name__ == "__main__":
    unittest.main()
