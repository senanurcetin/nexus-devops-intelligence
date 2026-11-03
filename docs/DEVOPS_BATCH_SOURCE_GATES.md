# NEXUS DEVOPS — Batch source-gate work (local only)

This batch adds a resumable, resource-guarded Node test runner and a read-only
release-gate report. Both are **developer utilities**. Neither sends a message,
starts an ongoing service, triggers CI, modifies Git `main`, installs dependencies,
performs cloud deployment or authorizes a release.

## 1. Safe Node suite inventory (default read-only)

Run against the **accepted primary checkout** and specify its complete SHA,
even when the helper is being developed in a separate feature worktree.

```powershell
$accepted = "C:\NEXUS-AI\nexus-devops-intelligence"
$sha = "4d748e6178dee9b2875173976b31cae164198e7b"
python -B scripts\run-node-shards.py --repo $accepted --expect-sha $sha
```


The command lists completed and pending test files. It never starts tests
unless explicitly invoked with `--execute`. Run **under a non-admin
Windows user account**:

```powershell
python -B scripts\run-node-shards.py --repo $accepted --expect-sha $sha --execute --max-files 2
```


Each invocation runs at most `--max-files` tests sequentially. The default
startup guard is **2400 MB free RAM**, sampled three times over two
seconds (the lowest reading determines whether the next test can start).
The running-process guard is **1800 MB** (two consecutive low readings
trigger termination of the
runner-owned process tree). The process receives a secret-reduced environment
and a 768 MB V8 heap cap. Node's test summary and exit code must both match
a full pass: skipped, TODO, failed, duplicated or malformed TAP results cannot count as
passed. Default per-file limit is 90 seconds.

State and bounded logs are under
`C:\NEXUS-AI\runtime\devops-automation\node-shards-<sha12>` (outside
Git). Successful records are resumable only after each log's hash and TAP
summary are verified again. The runner uses exclusive lock creation, atomic
state writes, immutable numbered attempt log paths and never overwrites
prior runs.

To isolate a single exact file from the accepted 76-file test inventory,
use the following command when sufficient RAM is available; it never runs
any other test file or allows path traversal:

```powershell
python -B scripts\run-node-shards.py --repo $accepted --expect-sha $sha --execute --max-files 1 --only-file tests/check-annotations.test.mjs
```

To retry an explicitly incomplete test **without overwriting its evidence**:

```powershell
python -B scripts\run-node-shards.py --repo $accepted --expect-sha $sha --execute --retry-incomplete --max-files 1
```


An interrupted run, low memory, skipped assertion, different SHA, dirty tree,
changed test inventory, missing/modified log or existing lock fails closed.
Do not delete a stale lock, evidence or temporary resources without inspecting
ownership. A `LOCAL_COMPLETE` test inventory would mean only that all
discovered `.test.mjs` files locally passed without skips on this SHA,
**not** independent attestation or approval from the release evidence gate.

## 2. Read-only evidence-gap inventory

```powershell
python -B scripts\inspect-source-readiness.py --repo $accepted --expect-sha $sha --manifest C:\NEXUS-AI\runtime\devops-automation\release-candidate-4d748e6-source3-20261103\manifest.json
```


The script invokes the existing local release-evidence policy for `source`,
`self_hosted` and `production`, counts actual PASS/NOT_RUN/INVALID checks,
and returns actionable missing-source IDs. It always exits with status **3**
and always reports `release_authorized: false`. It does not promote
any Node shard record or untrusted result into a PASS receipt.

At the time of the initial evidence manifest, local-source status is
**3/9 PASS, 6/9 NOT_RUN** (Node suite, npm audit, JS budget and three browser
fixtures). Self-hosted is **3/13** and production **3/18**; all three remain
HOLD. Source claims are self-reported local records, not signed attestations.

## 3. Offline dependency lockfile metadata check

```powershell
python -B scripts\inspect-lockfile-offline.py --repo $accepted --expect-sha $sha
```

Reads only package metadata and Git status at the exact expected commit.
Checks lockfile v3, root dependencies and devDependencies consistency,
HTTPS npm registry URL identity, and SHA-512 *metadata* syntax for each
locked package. Rejects duplicate JSON keys, malformed lock entries and
unexpected registries. This performs **no** package download, digest
verification against package tarballs, npm vulnerability database lookup,
or external network access. A metadata PASS never promotes the independent
`npm_audit` release gate: it remains NOT_RUN until real vulnerability
evidence is available and independently checked. Always
`release_authorized: false`.

## 4. Regression tests

```powershell
python -B tests\test_run_node_shards.py
python -B tests\test_inspect_source_readiness.py
python -B tests\test_inspect_lockfile_offline.py
node --test tests\devops-source-gates-batch.test.mjs
```


The existing `docs/LOCAL_ACCEPTANCE_EVIDENCE_AUDIT.md` covers auditing
the 3 November 2026 local acceptance proof separately. It must be kept distinct from
future release approval. Creating a feature-branch code commit does **not**
invalidate the original 4d748e6 acceptance, but changes to the primary
accepted source would require a new exact-SHA build and smoke acceptance.
