# Local automation (personal edition)

This project runs locally, not on hosted CI. Three scheduled tasks replace what a hosted pipeline would do.
They are read-only: no GitHub writes, no deployments, no process control, no model calls, no secrets.

| Task | Schedule | What it does |
| --- | --- | --- |
| `NEXUS-DevOps-Health` | every 5 minutes | Verifies loopback-only listeners and HTTP 200 with the expected NEXUS page title at `127.0.0.1:3000`, reads the Jarvis gateway lease (`lease_id` and `expires_at` only), records free RAM and disk. |
| `NEXUS-DevOps-Watch` | every 4 hours | Reading order for a short list of public repositories (`scripts/jarvis-watchlist.mjs`, anonymous GitHub reads) and a static check of each folder in the incoming-projects folder (`scripts/jarvis-localcheck.mjs`). |
| `NEXUS-DevOps-Gate` | daily 03:40 | Local gate: `tsc --noEmit`, all `tests/*.test.mjs`, then `ruff` and `pytest` on the Jarvis DevOps tests. Skipped when free RAM is below 1500 MB. |

Gate states: `pass`, `fail`, `skipped` (low RAM) and `pass_env_limited`. The last one is used only when every failing node test
is a Windows symlink-privilege error (`EPERM` on `fs.symlink`, non-elevated account without Developer Mode); the counts stay in
`gate-latest.json`. Any other failure keeps the gate `fail`.

## Install / remove

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ops\windows\Install-DevopsAutomation.ps1            # idempotent
powershell -NoProfile -ExecutionPolicy Bypass -File ops\windows\Install-DevopsAutomation.ps1 -Uninstall
```

Tasks run as the current user, non-elevated, hidden, with `MultipleInstances=IgnoreNew`. Run a single tick by hand with
`ops\windows\Invoke-DevopsAutomation.ps1 -Task Health|Watch|Gate`.

## Output

Everything is written to `C:\NEXUS-AI\runtime\devops-automation\` (override with `-RuntimeDir`):
`STATUS.md` (human summary), `health.json`, `watch-latest.json`, `gate-latest.json`, the `*-history.jsonl` files (capped), `alerts.jsonl`
and `localcheck\<folder>.json`. `watchlist.json` is created on first run; edit it to change the repositories (max 10, `owner/name`).

Alerts are appended once per state change (service down/recovered, lease expiring/expired/renewed, gate failed/recovered, findings increased).
Nothing is sent anywhere; read `STATUS.md` or `alerts.jsonl`.

## Boundaries

- Lease renewal is an explicit owner action (`New-DevopsLease.ps1`, at most 24 h). The Health task only warns.
- The Gate is local evidence. It is not a production deployment check.
- Child processes run at BelowNormal priority with a hard timeout and only the process started by the script is ever stopped.

## Manual, resource-guarded production acceptance

For a fresh production build and JARVIS MCP loopback acceptance, use the
**opt-in** [local build acceptance runner](LOCAL_BUILD_ACCEPTANCE.md). Its
default mode is a read-only resource/commit preflight; it never schedules a
task, and requires at least 4 GB free RAM before any isolated build.
This manual acceptance is separate from the Health/Watch/Gate schedules.

## Service restart safety

The local Windows service re-checks production-build freshness before every
Next.js restart and refuses to launch the next child when free RAM is below
2048 MB. A fresh initial build still requires 4096 MB. The read-only
status script reports ATTENTION when the local service task is disabled or
otherwise not eligible to supervise the service; an HTTP 200 alone does not
prove local runtime readiness. Neither check re-enables a task.
