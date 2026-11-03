# Local build and runtime acceptance (Windows)

This is an **opt-in** local QA workflow, not a deployment or persistent service.
It leaves the primary repository's existing `.next` build untouched, never
changes a scheduled task, and grants no merge or release authority.

## Read-only preflight (default)

From the primary checkout, with Python 3.11+:

```powershell
python -B scripts\verify-local-build-acceptance.py
```

It reports `ready` or `blocked` with exact Git SHA, RAM/disk and reasons.
Exit 0 = ready; exit 2 = blocked. Preflight launches no server or build.

## Explicit acceptance, only with enough headroom

```powershell
python -B scripts\verify-local-build-acceptance.py --execute
```

Before execution it requires a clean **primary** Git checkout, installed
Next.js dependencies, **at least 4096 MB free RAM and 8 GB free disk**.
Runtime free RAM must remain above 1800 MB. An existing worktree or lock
with the intended name causes a refusal, not a destructive overwrite.

The runner then:

1. Creates a detached Git worktree for the exact commit in
   `C:\NEXUS-AI\wt\devops-accept-<SHA>` and a temporary junction to
   already installed local `node_modules`. It never runs npm install.
2. Builds Next.js at BelowNormal priority with a bounded Node heap, without
   replacing the primary checkout's `.next`.
3. Temporarily starts that build on a free `127.0.0.1` port, verifying
   HTTP 200, HTML and the expected NEXUS page title.
4. Runs the 16 negative-input HTTP probes and JARVIS's read-only MCP protocol
   and health checks, without intentionally sending a valid GitHub/Redis
   repository query.
5. Stops its own process tree, removes its temporary junction and worktree,
   releases its lock and writes a local JSON report.

Evidence and logs are stored in
`C:\NEXUS-AI\runtime\devops-automation\acceptance\`.
The runner checks the primary Git SHA again after acquiring its lock and
after creating its worktree; an intervening source change blocks execution.
It also confirms the temporary TCP port is no longer listening after stopping
its own server. Reports use unique UTC timestamps and are never overwritten.
The report records the exact source SHA, each step and cleanup. Failed build,
time limit, low RAM, failed health, failed checks or incomplete cleanup are
not a PASS. If an interrupted attempt leaves a lock or worktree, inspect
its ownership before any manual removal.

**Limits:** This is Windows-local acceptance, not hosted Docker or Vercel
certification. It does not isolate the computer from the internet: Next.js
build-time code may still initiate requests, even though the acceptance
tests themselves are deliberately limited to loopback and negative API
inputs. Do not treat tests run as SYSTEM as standard-user acceptance.

## Regression tests

```powershell
python -B tests\test_verify_local_build_acceptance.py
node --test tests\local-build-acceptance.test.mjs
```

The Node wrapper runs the Python regressions when Python 3.11+ is on PATH
or `NEXUS_ACCEPTANCE_PYTHON` names an available interpreter; otherwise
the Python-dependent checks are reported as skipped.

The Windows local service entrypoint also refuses a stale or unverified
.next build. A missing build may be created only if Git application sources
are clean and Windows reports at least 4096 MB available RAM. The status
checker treats stale/unverifiable build recency as attention, not healthy.

Build freshness uses a conservative Git application-source timestamp check,
not cryptographic artifact provenance. A documentation-only change does not
require a new build. A false or unverifiable timestamp does not authorize
starting a stale binary.
