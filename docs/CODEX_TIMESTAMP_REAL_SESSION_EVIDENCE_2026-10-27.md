# Codex CLI evidence — independent timestamp regression (27 October 2026)

> **Status:** Real Codex assistance verified; regression reproduced, patch proposed and externally tested. **Not** evidence that Codex completed a fully autonomous edit/test/commit workflow. No screen recording, GitHub Actions run or Production deployment was performed.

## Scope and source identity

- Public MIT source: [NEXUS DevOps Intelligence](https://github.com/senanurcetin/nexus-devops-intelligence)
- Independent baseline: `bb0500a75df5800fb6590d4398b0b7dc700eebf7` (original `main`).
- Tool/model: OpenAI Codex CLI `0.164.0`, ChatGPT account, `gpt-6.1-sol` model, local Windows MXC `workspace-write` sandbox.
- Codex was explicitly restricted to the local checkout, synthetic data and two files: `src/lib/nexus-panel-validation.ts` and `tests/nexus-panel-timestamp-regression.test.mjs`. No push, cloud deployment, CI, authenticated API fetch or credential access was requested.
- The original bug investigation and initial PR #90 source code were developed with ChatGPT/GPT-6, **not** Codex. The subsequent independent test and alternative source patch described below were Codex-generated.

## Observable workflow and result

| Stage | Actor | Actual evidence |
|---|---|---|
| Initial Codex CLI authentication and request | Codex CLI | Authenticated ChatGPT account; first independent run hit an account usage limit. No code changes were made then |
| First local execution attempt | Codex CLI | Legacy Windows sandbox initialization failed with `helper_sandbox_lock_failed` / Windows error 5. No source or test changes |
| Native sandbox recovery | External runner, official Codex configuration | One-command MXC compatibility test printed `MXC_OK`, exit 0, without disabling sandbox protection or changing global ACLs |
| Test creation | **Codex CLI** (MXC) | Codex wrote a synthetic Actions/PR regression test in the independent checkout, covering UTC, leap years, fractional seconds, invalid dates, offset forms and non-string payloads |
| Baseline regression | External local Node 24 runner | `node --experimental-strip-types --test tests/nexus-panel-timestamp-regression.test.mjs` returned **exit 1** on the original source. Invalid values including `1` and `2026-02-30T11:00:00Z` were accepted; the invalid-input test failed as expected |
| Source patch proposal | **Codex CLI** (MXC) | Codex proposed strict ISO UTC matching and a milliseconds-normalized `Date.parse` / `toISOString` calendar round-trip. Codex's built-in patch/write attempts could not modify the source because of the Windows execution sandbox constraints |
| Patch application | External local runner | The Codex-proposed predicate was applied manually in the isolated checkout and reviewed, retaining an exact-match guard against trailing characters |
| Post-patch regression | External local Node 24 runner | **2/2 PASS, exit 0**, using the unchanged Codex-generated test file |
| Repository integration | ChatGPT/GitHub tools | The Codex-proposed validator and expanded synthetic tests were placed into draft PR #90 after review; they supersede the initial narrower GPT-6 validator and test fixture |

**Codex did not itself execute a successful `node` test or commit/push code.** Its Windows child processes returned `0xC0000142`; the external local test runner executed the actual before/after commands. This distinction must remain visible in any educational content or talk.

## Immutable GitHub evidence

- PR: [#90 — timestamp regression and tutorial](https://github.com/senanurcetin/nexus-devops-intelligence/pull/90)
- Codex-proposed validator source blob SHA: `3efa57d1c0ec65c9829b8fb94d7be1f63a52a664`
- Codex-authored expanded test blob SHA: `cf41a9ff8225f8fcedd0b6ce470981d08de2fea1`
- The independent external regression test was run first against the original baseline source; only then was the proposed patch applied.
- All tests are synthetic and offline. No token, private repository data or real user identifiers are included.

## Reproduce independently

Check out the PR's exact head, install dependencies from its committed lockfile, and run:

```sh
npm ci --ignore-scripts --no-audit --no-fund
node --import tsx --test tests/nexus-panel-timestamps.test.mjs
npm test
npm run typecheck
npm run build
npm audit
```

To observe the original **FAIL** before the fix, use a separate temporary checkout at the baseline commit, copy only the synthetic timestamp test into it, and run:

```sh
node --experimental-strip-types --test tests/nexus-panel-timestamps.test.mjs
```

Do not change your production tree for the before-test demonstration. The exact test outputs, commits and vulnerability findings must be recorded afresh on any new environment.

## Publication and limitations

The code and written teaching material may be reviewed publicly, but this is not a recorded Codex screen demonstration or evidence of autonomous success. No LinkedIn publication or video is claimed. The production dependency security update is a separate verified and merged [PR #91](https://github.com/senanurcetin/nexus-devops-intelligence/pull/91); release issues #7, #49 and #81 require independent acceptance.
