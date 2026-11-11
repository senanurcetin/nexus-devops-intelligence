# Approval-gated write actions and daily health card (NG-19)

Status: implemented on branch `feat/devops-ng19`; **default OFF**; not deployed; no live GitHub write has been performed.

## 1. Write actions

| Action | GitHub call | Params |
|---|---|---|
| `rerun_workflow` | `POST /repos/{r}/actions/runs/{run_id}/rerun-failed-jobs` | `repository`, `run_id` (int) |
| `open_issue` | `POST /repos/{r}/issues` | `repository`, `title`, `body?`, `labels?` |
| `label_pr` | `POST /repos/{r}/issues/{n}/labels` | `repository`, `pr_number` (int), `labels` (1-10) |

No merge, release, deploy or delete action exists. Unknown params are refused.

### Gates (all must hold, checked in this order; every failure is a short refusal code and nothing is written)

1. `NEXUS_DEVOPS_WRITE_ACTIONS=1` (otherwise `writes_disabled`)
2. params valid (`invalid_params` / `unknown_action`)
3. `NEXUS_DEVOPS_WRITE_ALLOW` lists the action (`action_not_enabled`)
4. `NEXUS_DEVOPS_WRITE_REPOS` lists the repository (`repository_not_allowed`)
5. `NEXUS_DEVOPS_GITHUB_WRITE_TOKEN` set (`github_token_missing`) - fine-grained PAT, only Actions:write / Issues:write / Pull requests:write on that one repo
6. a valid approval token (below): `no_token`, `malformed_token`, `secret_missing`, `bad_signature`, `bad_claims`, `expired`, `not_yet_valid`, `ttl_too_long`, `wrong_action`, `payload_mismatch`
7. the token id is burned (`replayed` on a second use, `used_store_unavailable` if the marker cannot be written), **then** the one GitHub request is made. If GitHub fails afterwards the approval stays spent (burn-first, same rule as Jarvis `approval_spend`).

### Approval token contract `nxa1`

```
nxa1.<base64url(claims JSON)>.<hex HMAC-SHA256(secret, "nxa1.<base64url>")>
claims = { v:1, jti, rid, act, ph, iat, exp }
```

- `jti`: Jarvis approval **grant id** (unique, `[A-Za-z0-9_-]{8,64}`); this is what gets burned here.
- `rid`: Jarvis approval request id (audit only).
- `act`: action name; must equal the action being executed.
- `ph`: `sha256(canonical_json(payload))` where `payload = {"action": <name>, "params": <normalised params>}`. This is byte-identical to `nexus_jarvis.approvals.store.payload_hash(payload)` (sorted keys, compact separators, no ASCII escaping; floats are not allowed). Cross-language vectors are pinned in `tests/write-actions.test.mjs`.
- `iat`/`exp`: unix seconds; `exp - iat <= 900`; clock skew tolerance 60 s on `iat`.
- Secret: `NEXUS_DEVOPS_APPROVAL_SECRET` (>= 32 chars) or `NEXUS_DEVOPS_APPROVAL_SECRET_FILE`; shared only between Jarvis and this service, never stored under `C:\NEXUS-AI`.
- Replay store: one exclusively created marker file per `jti` under `$NEXUS_DEVOPS_STATE_DIR/used-approvals/` (survives restarts, race-safe).

### CLI

```bash
# 1. no token, no network: normalise params, get payload + payload_hash + Telegram summary
npm run devops:write-action -- plan rerun_workflow '{"repository":"owner/repo","run_id":123}'
# 2. after the owner's approval, Jarvis mints the token and calls (token via env or --token-stdin)
npm run devops:write-action -- run rerun_workflow '{"repository":"owner/repo","run_id":123}'
```

Output is one JSON line: `{"ok":true,...}` or `{"ok":false,"refused":"<code>"}` (exit 3). Secrets and the GitHub token are never printed.

## 2. Jarvis-side integration (not done here; jarvis-next was not edited)

1. `devops/component.py`: add `plan_action(action, params)` -> runs `plan` via the CLI, returns `payload`, `payload_hash`, `summary`.
2. `approvals.store.create_request(kind="other", summary=<summary>, payload=<payload>, ...)`; the owner presses Onayla in Telegram. (Optionally add a `devops_write` entry to `KINDS`.)
3. On approval: `approvals.gate.require_approval(request_id, payload)` -> grant id; mint `nxa1` token with `jti=<grant id>`, `rid`, `act`, `ph=payload_hash(payload)`, `iat=now`, `exp=now+300`, HMAC with the shared secret (reference minting code: `mintApprovalToken` in `src/lib/nexus-approval-token.ts`).
4. Run `run` with the token in `NEXUS_DEVOPS_APPROVAL_TOKEN` (or stdin); report the JSON result via Telegram.
5. Gateway tools `devops.rerun_workflow`, `devops.open_issue`, `devops.label_pr` must be registered only when the owner enables writes; keep `live_outbound_enabled()` False until then.
6. Daily card: schedule `npm run devops:health -- --repo owner/repo` (or `--text`) once a day and forward `text` to Telegram/voice.

## 3. Daily health card

`npm run devops:health [-- --repo owner/name] [--offline] [--text]` prints `nexus.devops.health-card/v1`.

Checks: GitHub Actions, open PRs, stale branches (older than 30 days; default and protected branches skipped; at most 10 commit lookups), Oracle A1 heartbeat, Kaggle quota, provider quotas, Neon usage. Each infrastructure source is optional; each is a file path **or** an http(s) URL; not configured / unreadable / malformed => `unknown` with a reason (never `ok`). Overall = worst known status, `unknown` if nothing is known.

| Env | Format |
|---|---|
| `NEXUS_DEVOPS_HEALTH_REPOSITORY` | `owner/name` (or `--repo`) |
| `NEXUS_DEVOPS_HEALTH_ORACLE_HEARTBEAT` | JSON `{"ts":"ISO"}`, a first-line ISO timestamp, or just a touched file (mtime). Older than 15 min warn, 60 min critical |
| `NEXUS_DEVOPS_HEALTH_KAGGLE_QUOTA` | `{"gpu_hours_used":12,"gpu_hours_limit":30}` |
| `NEXUS_DEVOPS_HEALTH_PROVIDER_QUOTA` | `{"providers":[{"name":"groq","used":10,"limit":100}]}` or `{"groq":{"used":..,"limit":..}}` |
| `NEXUS_DEVOPS_HEALTH_NEON_USAGE` | `{"storage_gb_used":0.2,"compute_hours_used":40}` (limits default 0.5 GB / 100 h) |

Ratios: >= 75% warn, >= 90% critical. Producers of these JSON files (A1 cron, Kaggle CLI wrapper, Jarvis router budgets, Neon API poller) are Jarvis-side work.

The existing read-only digest/MCP surfaces are unchanged.
