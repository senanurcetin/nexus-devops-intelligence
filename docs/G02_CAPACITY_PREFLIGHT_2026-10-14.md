# G-02 — Free capacity, account visibility and offline release-screen evidence

**Inspection:** 14 October 2026, Europe/Istanbul.  
**Project:** `senanurcetin/nexus-devops-intelligence`.  
**Exact tested source SHA:** `31b6306ca0eb7b554e7697be1f025e3a6bf46f50` (before later documentation-only changes).  
**G-02 outcome: NOT ACCEPTED — actual aggregate Upstash and Vercel usage cannot be read from the available integration.**

## Confirmed from connected Vercel metadata (read-only)

- The Vercel team containing `nexus-devops-intelligence` is on **Hobby** (confirmed by the connected Git deployment/team context).
- The project has **two** Sensitive environment-variable names: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Both have **Preview and Production** targets. Their contents were **neither decrypted nor accessed**.
- The project metadata reports Vercel SSO protection `enabled: true` with `deploymentType: all_except_custom_domains`. This is an account configuration observation, **not a fresh authenticated Preview test**. Custom domains are specifically outside that SSO setting; do not infer that Production aliases are protected.
- The Vercel **billing charges API returned 404 `costs_not_found`**. It did **not** show invoice/usage totals; a missing cost ledger does not mean usage or billing is zero. The currently connected actions expose no Upstash account statistics.
- The Vercel firewall configuration read returned **404 `not_found`**, so no current effective edge rule was independently confirmed. Existing historical release records describe a Hobby WAF **Log** (observation-only) setting; it must **not** be represented as active Redis/global 429 enforcement.
- Preview and Production deployments remained on older GitHub source SHAs at last inspected release state; **no deployment** and **no live Redis/Upstash probe** was executed for G-02.

## Vendor allowances (public source, NOT observed remaining quota)

| Shared resource | Published Free/Hobby inclusion | Conservative G-02 review ceiling (80% of allowance) |
| --- | ---: | ---: |
| Upstash Free commands, all consumers on shared DB | 500,000 per month | 400,000 |
| Upstash Free data size | **250 MB shown in owner Usage tab on 2026-10-14** | **200 MB** |
| Upstash Free outbound bandwidth | 10 GB/month | 8 GB |
| Vercel Hobby aggregate function invocations | 1,000,000 | 800,000 |
| Vercel Hobby aggregate active CPU | 4 CPU-hours | 3.2 hours |
| Vercel Hobby aggregate provisioned memory | 360 GB-hours | 288 GB-hours |

**Owner screenshot evidence (14 October):** [R2 actual Usage-tab snapshot](R2_OWNER_USAGE_SNAPSHOT_2026-10-14.md) reports Upstash 118/500K monthly commands, 10 KB/10 GB bandwidth, displayed 0 B/250 MB storage and $0.00 at capture. The older **256 MB** static estimate has been lowered to the account's **250 MB** UI allotment; this does not alter the command/bandwidth caps. Vercel whole-team 30-day transfer and CDN/ISR were also observed, but **Vercel Functions invocations/active CPU/provisioned memory were NOT shown**. The combined G02 gate is therefore **INCOMPLETE** until those exact metrics and a bounded origin request plan are obtained. No plausible substitutes (CDN requests or CDN CPU) should be inserted as Functions usage. No new Preview/Production permission follows from usage screenshots.

**Sources and date-conditional terms:** [Upstash official Redis pricing](https://upstash.com/pricing/redis), [Upstash dashboard usage metrics](https://upstash.com/docs/redis/howto/metrics-and-charts), [Upstash rate limiter command cost examples](https://upstash.com/docs/redis/sdks/ratelimit-ts/costs), [Vercel Hobby resource inclusion](https://vercel.com/docs/plans/hobby), [Vercel Usage dashboard guidance](https://vercel.com/docs/pricing/manage-and-optimize-usage). Limits should be reconfirmed before the owner accepts a release. The **80% threshold is an NEXUS engineering proposal**, not a provider-enforced threshold or a guarantee of continuous free service. Other team bandwidth/compute limits may be relevant outside this conservative screen.

## Zero-network decision aid

The repository now includes `npm run capacity:offline` (`scripts/check-free-capacity-offline.mjs`) and ten isolated contract tests in `tests/g02-free-capacity-offline.test.mjs`.

- The script has no network, Redis library, environment-variable access or credential handling. It requires owner-observed **aggregate** usage for the **shared** Upstash DB and **entire** Vercel Hobby team, each with a UTC observation timestamp newer than 48 hours and within the current UTC month.
- It *also* requires the exact number of **planned additional origin GETs**. 20% reserved headroom is required against each listed allowance.
- The project's current server-side Redis gate issues one `EVAL` REST API call per admitted or Redis-limited origin request. Its Lua script runs `INCR`, `TTL`, and on first use `EXPIRE`. Billing **may count multiple Redis operations inside an EVAL**. The screen **assumes four billed Redis commands per origin** for planning; this is intentionally cautious relative to three operations for ordinary existing keys and four including `EVAL` or expiry, **but actual Upstash billing for this custom script has not been independently measured**. This is **not** a proven upper bound under retries, account-wide mixed workloads or changed provider accounting.
- A typical first repository selection requests up to **two** source panel origin routes. Three separately clicked F-04/F-05 evidence paths can make **five** origin routes total. Under the **four-command planning assumption**, these represent **8** or **20 planning commands**, respectively — *not* observed usage. CDN cache hits may not call the origin at all. A 21-request stress test would also consume real commands and is **not authorized**.
- Missing fields, impossible input, stale snapshots, forecast overflow => **`INCOMPLETE`** / exit code 2. Any observed+projected value above the 80% safety threshold => **`HOLD`** / exit code 2. If all numbers fit, the result is **`READY_FOR_OWNER_REVIEW`** / exit code 0; this **does not** certify G-02 or authorize a deployment, live Redis probe, Production change or paid upgrade.

**Manual input template — replace placeholders with actual dashboard figures (never with passwords, REST URLs or tokens):**

```bash
npm run capacity:offline -- \
  --observed-at-utc "YYYY-MM-DDTHH:MM:SSZ" \
  --upstash-monthly-commands "ACTUAL_MONTHLY_COMMANDS" \
  --upstash-data-mb "ACTUAL_MB" \
  --upstash-bandwidth-gb "ACTUAL_CURRENT_MONTH_GB" \
  --vercel-invocations "ACTUAL_TEAM_INVOCATIONS" \
  --vercel-active-cpu-hours "ACTUAL_TEAM_CPU_HOURS" \
  --vercel-provisioned-memory-gb-hours "ACTUAL_TEAM_MEMORY_GB_HOURS" \
  --planned-origin-requests "OWNER_APPROVED_EXPECTED_ORIGIN_GETS"
```

Find Upstash's database usage statistics from the **selected database's** Console usage/limits and monthly usage view. Use the **team-wide** Vercel Usage page, including other projects under the same Hobby team, and its last-30-days/current allotment indicators. The owner should record the exact **observation time, vendor billing period, total commands, storage, bandwidth, Vercel aggregate invocations, CPU and memory**; no environment variable values.

## Exact-source verification (no hosted CI, no secrets)

Disposable Node.js 24 Vercel sandbox downloaded **public GitHub source only**, checked out exactly `31b6306ca0eb7b554e7697be1f025e3a6bf46f50`, and ran:

- `node --check scripts/check-free-capacity-offline.mjs`: PASS.
- `node scripts/check-free-capacity-offline.mjs --json` without data: **INCOMPLETE** and exit 2, as designed.
- `npm ci --no-audit --no-fund`: PASS.
- `npm test`: **199/199 PASS** (ten new G-02 no-network tests including missing/future/stale data, 80%-boundary thresholds, malformed/secret-looking inputs and CLI environment-secret non-disclosure).
- `npm run typecheck`, `npm run build`, `npm run inspect:budget`: PASS.
- JS budget: **six chunks, 432,115 raw / 124,819 gzip bytes**, unchanged product client code.
- `npm audit --json`: **zero** info/low/moderate/high/critical vulnerabilities at this inspection.

This sandbox was used only for source/build checks; it was not given or used any live Upstash token or URL and **no NEXUS Preview, Production or live Redis HTTP requests were performed**. Sandbox execution is not a substitute for the Vercel Hobby aggregate usage page.

## Remaining owner-dependent hard gates

1. **G-02 open:** The account owner must supply or otherwise authorize read-only verification of the **actual aggregate** Upstash and Vercel usage figures, checked against the snapshot/date and the planned Preview-only traffic budget. Lack of real account data is an **explicit STOP**, not consent.
2. **G-03/G-04 open:** Only on separately approved exact-SHA, SSO-protected Preview; do not run live checks first to *discover* quota usage.
3. **G-06 open:** Independent Vercel-serverless Redis shared-admission proof is still absent; existing local tests are **not** sufficient. See [#7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7).
4. **G-05/G-07 open:** Real Safari/mobile/NVDA and explicit *separate* Production owner approval remain required.
