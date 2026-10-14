# R2 — Autonomous Upstash Free usage retrieval, safely gated

**Date:** 14 October 2026 (Europe/Istanbul).
**Scope:** `senanurcetin/nexus-devops-intelligence`, source-only.
**Executable source SHA:** `d234e9d4f62ec7ed0f97ed05462700b7aa0ef224`; following commits documentation-only.
**State:** **READ-ONLY AUTOMATION DONE_OFFLINE**, **actual Upstash account usage NOT YET VERIFIED**, **Vercel Hobby TEAM usage UNKNOWN**, **G02 still OPEN**.

## Why this is a practical alternative

The user does not have the aggregate monthly usage figures to hand. Instead of asking them to transcribe numbers, the repository can securely query Upstash's official **Management / Developer API**. This is different from the data-plane Redis REST API configured in Vercel. The connected Vercel project has no linked database Management connector and its Sensitive `UPSTASH_REDIS_REST_TOKEN` is not an Upstash Developer API key. **Never decrypt those production Redis secrets or send them to the management endpoint.**

Official provider endpoints:

- `GET https://api.upstash.com/v2/redis/database/{id}?credentials=hide`: verify **database_id**, **ACTIVE** state and **Free** plan, hide credentials.
- `GET https://api.upstash.com/v2/redis/stats/{id}`: exact Upstash reported `total_monthly_requests`, `total_monthly_bandwidth`, `total_monthly_storage`, `current_storage`. These measurements include the **shared database's other clients** (e.g. other products if using the same database).
- Authenticated by separate Upstash **Management API username (email) + API key**, not by a Redis bearer token. The two GETs read account management data and execute **no Redis commands**. These are not automatically available in this ChatGPT connection. References: [Get Database](https://upstash.com/docs/devops/developer-api/redis/get_database), [Get Database Stats](https://upstash.com/docs/devops/developer-api/redis/get_database_stats), [Management API Authentication](https://upstash.com/docs/devops/developer-api/authentication).

## One-time setup (account owner only; do not paste secrets into ChatGPT or GitHub)

On an authorized local machine, set the following **process environment variables privately** (interactive secret entry or secure local secret manager, never CLI flags or committed `.env`):

- `UPSTASH_MANAGEMENT_EMAIL` — Upstash Developer API account username.
- `UPSTASH_MANAGEMENT_API_KEY` — **separate Management API key** obtained through Upstash account security/management settings.
- `UPSTASH_MANAGEMENT_DATABASE_ID` — UUID of the actual existing shared Preview+Production Redis DB. Do not create a second free database or use a random DB ID.

Then explicitly opt in to the read-only request:

```sh
npm run capacity:upstash:read-only -- --authorized-readonly --json
```

Without `--authorized-readonly`, with missing/invalid auth or unsupported query options, the script **never makes an HTTP request**, reports `INCOMPLETE` and exits 2. It is not a scheduled automation or CI job. The script sends only the two **fixed** HTTPS Management API GETs; requires `credentials=hide`, disables redirects, uses short timeouts and prints neither keys nor raw remote errors. Source verification of the plan/active state happens **before** requesting stats. Upstash REST connection tokens are ignored entirely. Management credentials must **not** be stored in Vercel's public project environment, GitHub Actions, markdown files or build logs.

## Returned fields and limitations

Sanitized `UPSTASH_ONLY_VERIFIED` includes:

- `observedAtUtc`.
- `upstashUsage.upstash-monthly-commands` from reported `total_monthly_requests` (documented as requests, not necessarily a separately proven billable Redis Lua inner-command count).
- `upstashUsage.upstash-data-mb` = `max(total_monthly_storage,current_storage)` in **decimal MB** to avoid underestimating storage.
- `upstashUsage.upstash-bandwidth-gb` = `total_monthly_bandwidth` in **decimal GB**.
- `upstashPlan: free`, `releaseAuthorized: false`, `vercelTeamUsageVerified: false`.

The script **does not** auto-populate Vercel TEAM usage, override conservative headroom thresholds, inspect Redis runtime data, authorize a Preview, enable paid plans, or execute the 21-request probe. `UPSTASH_ONLY_VERIFIED` means only *Upstash Management API data collected*; **G02 must stay open until true Vercel Hobby whole-team totals are independently verified**.

Vercel billing-charge endpoint returned `404 costs_not_found`, not zero usage. The connected Vercel project has no available Upstash connector. Vercel advanced Observability Query requires Observability Plus/Pro; deliberately **not activated on Hobby**. For the Vercel usage portion, an authorized owner session in **Vercel Team > Usage** remains the supported non-paid data source. No actual usage value has been inferred from project count, deployment metadata or missing invoices.

## Source-local test evidence

In an ephemeral Node24 sandbox on exact source SHA `d234e9d4f62ec7ed0f97ed05462700b7aa0ef224`:
- Clean `npm ci`, **216/216 Node tests**, `npm run typecheck`, `npm run build`, `npm run inspect:budget` PASS.
- JS: 6 chunks, **432,228 raw / 124,819 gzip bytes**, within existing caps.
- `npm audit --json`: **0** vulnerabilities at the inspection date.
- **Eight new** tests verify missing authorization => 0 GET, two strictly scoped GETs, credentials=hide, Free/ACTIVE plan checks, unrelated DB guard, invalid/missing/unsafe fields, secret non-disclosure, network errors and command-line no-network default.
- Manual CLI invoked without owner authorization returned `INCOMPLETE` / exit 2 and made zero management/Redis calls.
- No live Upstash account API, no Redis commands, no Preview/Production requests/deployments, no CI or paid features.

## Release stop

**R2 remains BLOCKED on account-sourced evidence**, not on lack of a script. Once the account owner authorizes a one-time secure Management API session, the Upstash share of R2 can be collected **without manually entering figures**. The Vercel TEAM usage part still requires an authorized dashboard reading or another already-permitted account usage integration. No user-supplied fabricated zeros, guesses, sample numbers or historical screenshots may close the G02 release gate. The existing `npm run capacity:offline` can screen the resulting **combined** true Upstash and Vercel metrics under the separate 20% planning reserve.
