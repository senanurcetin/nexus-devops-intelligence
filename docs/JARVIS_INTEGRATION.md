# NEXUS DevOps Intelligence - Jarvis integration (read-only, local)

**Status (29 Oct 2026): local development branch `feature/jarvis-integration-v1`. Not pushed, not released, no CI, no deployment.**
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

## Registering it in Jarvis (NOT done here)

The Jarvis gateway uses signed lease manifests and a connector capability matrix (`automations/connectors.py`). Registering
this adapter means a change in `jarvis-next` core (a new internal read connector, a gateway tool mapping and a lease
`allowed_tools` entry for the DevOps role). That landing belongs to ANA CORE's gate and is requested in
`LIVE/REQUESTS_TO_ANA_CORE.md`; no Jarvis core file was edited. Suggested shape, to be confirmed against the gateway code:

- connector `devops_intelligence`, kind `internal`, capabilities `health_probe` and `repo_digest`, both read-only, no action tier;
- lease for role `INF-04` (DevOps), `data_class: public`, tools limited to the two above, `max_tool_calls` small;
- MCP server entry launching `npm run jarvis:mcp` with `cwd` = this repository (exact config keys must be taken from the
  OpenJarvis version Jarvis pins; they were not verified here).

## Verification recorded for this change

- `npm run typecheck`: pass (Windows, Node 24.13).
- `tests/jarvis-integration.test.mjs`: 10/10 pass (loopback validation, tool surface, evidence classification, argument
  refusal, error/rate-limit/oversize handling, cache and budget, sanitisation, and a real stdio server over a real loopback
  HTTP service).
- `npm run build`: pass. Live run against the locally started service on 29 Oct 2026 with real public GitHub data:
  `senanurcetin/nexus-devops-intelligence` (0 runs, 0 open PRs: `no_confirmed_signal`) and `vercel/next.js`
  (10 runs, 5 PRs inspected; both sources `verified`).
- Full suite on this Windows host excluding `release-evidence-policy.test.mjs`: 302 tests, 300 pass, 2 fail before this change.
  The failures (and a crash of the excluded file) are `EPERM` on `fs.symlink` (no symlink privilege on this host), not
  product defects; they are NOT RUN-equivalent here and need Developer Mode/admin or Linux.

## Not done / limits

- Jarvis-side registration and any Jarvis-driven schedule (see above).
- Auto-start after reboot: the local service and the MCP server run only while their processes run.
- Private repositories, write actions, AI diagnosis and anything commercial are out of scope; see the commercial readiness note.
