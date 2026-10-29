# NEXUS DevOps Intelligence - Jarvis integration (read-only, local)

**Status (30 Oct 2026): local development branch `feature/jarvis-integration-v1`. Not pushed, not released, no CI, no deployment.**
The architecture plan previously marked Jarvis integration as deferred; this document records the first bounded step.
DevOps stays an independent service: Jarvis talks to it through a read-only MCP adapter, never the other way round.

## What it is

A zero-dependency MCP (JSON-RPC 2.0, one JSON object per line) stdio server, `scripts/jarvis-mcp-server.mjs`, that lets the
Jarvis orchestrator query a **local** NEXUS DevOps service (default `http://127.0.0.1:3000`). It reuses the dashboard's own
validators, risk posture and investigation queue (`src/lib/nexus-jarvis-digest.ts`, `src/lib/nexus-jarvis-mcp.ts`).
It adds no data source, no write path, no AI diagnosis and no authority to merge or release.

| Tool | Purpose | Network |
| --- | --- | --- |
| `devops_health` | Does the local service answer? | one GET to the loopback service |
| `devops_repo_digest` `{repository: "owner/name"}` | Evidence-bounded digest of ONE public repository (10 runs, 5 open PRs) | two GETs to the loopback service (`/api/public-actions`, `/api/public-prs`) |

Both tools carry `readOnlyHint: true`, `destructiveHint: false`. A one-shot CLI for schedulers/n8n exists too:
`npm run jarvis:digest -- owner/name` (exit 0 evidence, 2 bad arguments/config, 3 no verified source).

## Digest contract (`nexus.devops.jarvis-digest/v1`)

`schema`, `generated_at_utc`, `repository`, `data_source`, `access` (always `read_only`, `write_actions: []`,
`release_authorized: false`, `merge_approval: false`), `handling`, `sources.{actions,pull_requests}`
(`verified | rate_limited | unavailable | invalid` with HTTP status and receipt time), `posture` (the dashboard's risk posture),
`investigations[]` (max 5, each with a canonical `github.com` source URL), `handoff_markdown`, `limitations[]`.
A source is `verified` only if HTTP 200, JSON content type, a valid UTC receipt and the dashboard's own sample validator pass.
With no verified source the tool result has `isError: true` and the posture is `await_evidence`: nothing is guessed.

## Running it (Windows PowerShell, host Node >= 22.16)

```powershell
cd C:\NEXUS-AI\nexus-devops-intelligence
npm ci --ignore-scripts          # once
npm run build
node node_modules\next\dist\bin\next start -H 127.0.0.1 -p 3000    # the local service (keep it loopback-only)
$env:NEXUS_DEVOPS_BASE_URL = 'http://127.0.0.1:3000'               # optional; this is the default
npm run jarvis:mcp                                                  # MCP stdio server for Jarvis
```

`NEXUS_DEVOPS_BASE_URL` must be a literal-loopback `http` origin (`127.0.0.1` or `[::1]`, no credentials, path or query);
anything else makes the server exit with code 2 before it reads a single request.

## Security model

- Loopback only; `redirect: 'error'`; 15 s deadline (max 30 s); 1 MB response cap; JSON content type required.
- No tokens, no secrets, no environment credentials are read or sent. No GitHub token is involved.
- Anonymous GitHub quota (60/hour) is protected: results are cached 60 s per repository and at most 6 uncached digests
  per rolling hour are allowed (hard cap 8); a refused call makes no request.
- Strings that originate from public third-party data (for example workflow names) have control/bidi characters replaced and
  are length-capped, and the digest states that they are data, never instructions. This reduces, but does not eliminate,
  prompt-injection risk: the consuming agent must still treat every string as untrusted.
- Argument validation uses the existing `owner/name` parser; exactly one argument is accepted.

## Jarvis-side bridge (prototype, not registered)

`jarvis-next/src/nexus_jarvis/integration/devops_intelligence_status.py` (new file, with `tests/test_devops_intelligence_bridge.py`,
28 tests) follows the existing read-only bridge pattern: it runs `scripts/jarvis-digest.mjs` without a shell and with a
minimal environment (no API keys or tokens), refuses anything but a valid `owner/name`, and accepts the result only if the
digest proves its own contract (`read_only`, no write actions, `release_authorized: false`, `merge_approval: false`,
canonical `github.com/<repo>/` source URLs, at most five investigations). Anything else fails closed and error text from
Node or GitHub is never returned. CLI: `python -m nexus_jarvis.integration.devops_intelligence_status owner/name
--devops-root C:\NEXUS-AI\nexus-devops-intelligence`. Like the Outreach bridge it is deliberately **not** a gateway tool.

## Registering it in Jarvis

Done as a separate branch of the Jarvis repository, `feat/devops-registry-20261030` (worktree `C:\NEXUS-AI\wt\devops-reg-20261030`,
local only, landing is ANA CORE's gate; the shared primary tree was not touched):

- `gateway/devops_digest.py`: opt-in tool `devops.repo_digest`, capability `public.read` (R0), `egress=True`, so a `private` or
  `restricted` lease is refused. `devops_registry(devops_root)` returns the default registry plus this tool. Like the other
  fixture tools it is deliberately **not** part of `default_registry()`, because several tests pin that tool set.
- The connector capability matrix (`automations/connectors.py`) was deliberately **not** changed: it is pinned by a committed export and several
  tests (adding a connector broke 4 of them), so a matrix entry needs ANA CORE to regenerate the export. The gateway tool does not need it.
- Behaviour comes from the bridge `integration/devops_intelligence_status.py`. Leases are issued per task with
  `lease_raw(..., tools=("devops.repo_digest",))`; no role definition was changed.

To use it in a Jarvis process: build the gateway with `registry=devops_registry(Path(r"C:\NEXUS-AI\nexus-devops-intelligence"))`.

## Auto-start (Windows, per user, no admin)

`ops/windows/` holds four scripts. `Install-NexusDevopsAutostart.ps1 -StartNow` registers the scheduled task `NEXUS-DevOps-Local`:
current user, `Limited` run level, hidden, triggers = logon plus a 10-minute repetition safety net, `MultipleInstances=IgnoreNew`.
`Start-NexusDevops.ps1` binds `127.0.0.1` only (no parameter changes that), builds once if needed, refuses to start when the port is held
by something else, exits at once when the service is already healthy, and supervises `next start` itself (restart after 5 s, at most
8 starts per 10 minutes). The supervision lives in the script because Task Scheduler's "restart on failure" did **not** restart the task
when the action merely exited non-zero (observed here: the task went back to `Ready` with result `0xFFFFFFFF`). `Test-NexusDevops.ps1`
is a read-only status check (`-Repository owner/name` also runs one digest). `Uninstall-NexusDevopsAutostart.ps1` removes the task and
stops the service. Logs: `%LOCALAPPDATA%\NEXUS\devops\logs\service.log` (UTF-8, rotated at 5 MB). Not tested: an actual reboot/logon.

## MCP details (checked against the MCP specification, 2025-06-18 and later)

- Successful tool results carry `structuredContent` plus the same JSON as text (spec: SHOULD, for older clients); error results stay
  text-only. Tools declare `outputSchema`, `title` and read-only annotations (clients must treat annotations as untrusted hints; the
  real enforcement is the loopback-only client and the Jarvis lease policy).
- `initialize` negotiates `2025-06-18` or `2025-03-26` and answers with the highest supported version otherwise.

## Verification recorded for this change

- `npm run typecheck`: pass (Windows, Node 24.13).
- `tests/jarvis-integration.test.mjs`: 11/11 pass (loopback validation, tool surface, evidence classification, argument
  refusal, error/rate-limit/oversize handling, cache and budget, sanitisation, protocol negotiation and structured content, and a
  real stdio server over a real loopback HTTP service).
- `npm run build`: pass. Live run against the locally started service on 29 Oct 2026 with real public GitHub data:
  `senanurcetin/nexus-devops-intelligence` (0 runs, 0 open PRs: `no_confirmed_signal`) and `vercel/next.js`
  (10 runs, 5 PRs inspected; both sources `verified`).
- Full suite on this Windows host excluding `release-evidence-policy.test.mjs`: 302 tests, 300 pass, 2 fail before the Jarvis work (312/310/2 after the first commit).
  The failures (and a crash of the excluded file) are `EPERM` on `fs.symlink` (no symlink privilege on this host), not
  product defects; they are NOT RUN-equivalent here and need Developer Mode/admin or Linux.

## Not done / limits

- Landing of the Jarvis branch, and any Jarvis-driven schedule (not requested yet).
- A real reboot test of the logon task, and any change to the 3000 port if another program needs it.
- Private repositories, write actions, AI diagnosis and anything commercial are out of scope; see the commercial readiness note.
