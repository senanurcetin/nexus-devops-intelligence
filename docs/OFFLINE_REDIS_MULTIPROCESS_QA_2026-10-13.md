# Zero-Upstash-command Redis integration check (13 October 2026)

**Why:** The user confirmed that Preview and Production share one Upstash Free Redis budget and requested proof **without using that quota**. This check **does not call** either Vercel deployment or Upstash. It uses a disposable cloud sandbox with a **real local Redis 6 server** and two independently initialized Node.js processes executing the real Next.js Actions and PR route handlers. It does not enable a paid service, touch account credentials, alter Vercel environments or create a GitHub CI job.

## Implementation

Run `scripts/verify-local-redis-multiprocess.mjs` in an approved, isolated **CI-free** cloud sandbox with Node 24, npm packages installed and `redis6-server` / `redis6-cli` available.

1. A disposable Redis 6 process starts on the loopback interface with persistence **disabled** (`--save '' --appendonly no`).
2. A temporary loopback-only HTTP adapter accepts just a synthetic bearer token and the real app's existing `EVAL` script. It forwards each EVAL to the locally running Redis binary using `redis6-cli --raw`. The **actual Redis server** performs atomic `INCR`, `EXPIRE`, `TTL`; the counter is **not** implemented as a JavaScript Map.
3. **Two separate Node.js processes** load the actual Next route handlers and consult one shared local Redis database. Their Upstash URL and bearer token are **fixed synthetic fixture values**, and the test's injected fetch transport redirects the exact fixture URL to the loopback-only adapter. Public GitHub responses are stubbed offline; no external GitHub/Redis calls are made by the integration test.
4. **20 concurrent origin GETs**, split between the Actions and PR routes, return 200 with `X-Nexus-Rate-Limit-Mode: shared-redis`. The **21st** from the same fixed test IP returns HTTP **429**, `X-Nexus-Rate-Limit-Source: shared-redis`, `Cache-Control: no-store` and a valid `Retry-After`.
5. A separate fixed test IP is allowed (HTTP 200), and Redis contains **two opaque HMAC-derived keys** with no plaintext IP.
6. The script stops both Node workers, closes the local adapter and terminates local Redis. It emits only aggregate test outcome, counts, and explicit non-claims.

## Manual run

In the **ephemeral test sandbox only**, for Amazon Linux 2023:

```bash
sudo dnf install -y redis6
npm ci --no-audit --no-fund
node --import tsx scripts/verify-local-redis-multiprocess.mjs
```

Other environments may supply `redis-server` and `redis-cli`; set `NEXUS_LOCAL_REDIS_BINARY` and `NEXUS_LOCAL_REDIS_CLI` to the local binary names. Never set real production Redis secrets; the test does not need them. **Do not** run this script inside a Production or Preview deployment. Run it only in a short-lived, isolated sandbox. No `REDIS_URL`, `UPSTASH_REDIS_REST_URL` or live Vercel URL is needed.

## Measured result

Manual Vercel Sandbox using real, ephemeral **Redis 6.2.20**:

| Measurement | Observed |
| --- | --- |
| Separate Node processes | **2**, different process IDs |
| Concurrent GETs against both real Next route handlers from one test IP | **20 × HTTP 200** |
| 21st GET from same IP | **HTTP 429, `shared-redis` source, no-store, bounded retry** |
| GET from second IP | **HTTP 200** |
| Local atomic EVAL commands | **22** |
| Real Upstash Redis commands | **0** |
| Live Production or Preview requests | **0** |
| External GitHub requests | **0** |
| Real Vercel multi-instance acceptance | **NOT VERIFIED** |

This is materially stronger than the earlier single-process JavaScript Map mock because two independent Node runtimes execute the **actual** app route code against real Redis atomic Lua operations. It proves portability of the quota algorithm and its cross-process state consistency **locally**.

**It does not prove** the live Vercel deployment has multiple active instances connected to the same Redis, the provider's authentication or network edge behavior under load, actual Upstash billing/usage totals, or an enforcing edge WAF. The preceding **one-request live Preview preflight** already returned `x-nexus-rate-limit-mode: shared-redis` and `x-vercel-cache: MISS`, independently establishing that the configured Preview can reach its backend. That live test consumed an origin request; the **new offline test did not consume any Upstash quota**.

Until a later owner-approved live multi-instance acceptance is feasible, keep issue [#7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7) open and explicitly label the verification as **local cross-process + one live Preview Redis preflight**, not complete production-grade enforcement.

## CI-free restrictions

No GitHub Actions/CircleCI, paid WAF, new Upstash database, plan upgrade, deployment, copied Preview/Production credentials, SSR/SSO bypass, or Production writes. Clean up disposable sandbox when done.
