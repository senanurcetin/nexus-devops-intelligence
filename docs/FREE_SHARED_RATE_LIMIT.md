# Free, cross-instance public API admission control (optional)

**Purpose:** provide a shared `429 Too Many Requests` response **inside the app**, without purchasing the Vercel Firewall `Default (429)` action. Keep the existing Vercel WAF rule in **Log** mode for visibility; a `Log` action does not mitigate traffic.

## Activation status

- The code is **available but not enabled** until both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set as **server-only Vercel project environment variables**.
- No independent NEXUS Redis instance was provisioned by this change. Do **not** reuse VocabMaster's Supabase data or any other application's database.
- An existing **per-instance** 20 requests per 60 seconds/IP limiter operates as a **fallback only when Redis is not configured**. When Redis is configured, Redis makes the per-IP admission decision across all instances; the local limiter must not shadow its decision.
- The shared limiter uses a single **atomic Redis EVAL script** for `INCR`, `EXPIRE`, and `TTL`; both `/api/public-actions` and `/api/public-prs` use the **same key** (20 origin requests per 60s, per canonical client IP, counted from the first admitted request).
- Requests rejected by the configured shared guard (or the local fallback when Redis is disabled) return `429` with `Retry-After` and `Cache-Control: no-store`. If Redis is explicitly configured but unavailable, both APIs **fail closed with HTTP 503** and `Retry-After: 5` rather than sending uncontrolled upstream GitHub requests.
- An absent pair of Redis variables means the shared check is disabled; **do not claim cross-instance enforcement is active**.

## Free-tier setup (requires account owner action)

1. Open [Upstash](https://console.upstash.com/redis), create a **separate Free Redis database** for `nexus-devops-intelligence`. Verify that the selected plan is **Free** and auto-upgrade is not enabled. Do not enter a billing card or choose Pay as You Go for this implementation.
2. Copy the database's **REST URL** (HTTPS host ending in `.upstash.io`) and **REST token**. The token has write access; **never** paste it into GitHub, chat, a PR, browser/client environment, screenshot or logs.
3. In Vercel project `nexus-devops-intelligence` → **Settings → Environment Variables**, add **server-only** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for the desired environment. Never use `NEXT_PUBLIC_` prefixes or assign these values to a different project.
4. **Manually** deploy an explicitly reviewed NEXUS commit after confirming the user wishes to roll out the feature. The repository uses `vercel.json` with `git.deploymentEnabled: false`; ordinary Git commits must not trigger deploys.
5. Keep the existing WAF `nexus-public-api-limit` in **Log** mode if the enforcing action requires a paid plan. Log is observability only. Do not create a second paid WAF rule or describe this app-level guard as an edge WAF.

## Non-sensitive HTTP evidence markers

Both public API routes expose only **categorical, non-secret** response headers for release diagnostics:

| HTTP response | Diagnostic header | Meaning |
| --- | --- | --- |
| Application Redis rejection (`429`) | `X-Nexus-Rate-Limit-Source: shared-redis` | The Redis EVAL response, **not** the old local process counter, triggered the origin rejection. |
| Application local fallback rejection (`429`) | `X-Nexus-Rate-Limit-Source: local-fallback` | Redis was **not configured**; the per-instance fallback triggered the rejection. |
| Explicitly configured Redis unavailable (`503`) | `X-Nexus-Rate-Limit-Source: shared-redis-unavailable` | Redis failed closed, with no GitHub API fanout. |
| Upstream GitHub rejection (`429`) | `X-Nexus-Rate-Limit-Source: github-upstream` | GitHub returned a limit error after origin admission was allowed. |
| Origin success or other upstream response | `X-Nexus-Rate-Limit-Mode: shared-redis`, `local-fallback`, or `inactive` | The source of the **admission check**. `inactive` is used in non-Vercel local development. |

This data **never** includes IPs, Redis tokens, keys, counters, usage totals, or database addresses. A `shared-redis` marker establishes attribution for **that origin response**, not that multiple instances were exercised or that a Vercel edge WAF exists. Inspect only **cache-MISS** responses; cached HTTP 200 responses can carry previously cached headers without triggering a fresh Redis EVAL. Errors remain `Cache-Control: no-store`.

## Validation after setup

- A normal two-panel GitHub lookup remains functional and returns 200 where the public repository exists.
- Use a **single controlled client IP in a known Vercel region** with permission and a short verification window. Request only a few times to check connection and logs; when explicitly authorized for a bounded rate-limit check, confirm the 21st *uncached, valid* API request in a 60s interval yields 429. Both routes use the same bucket. Cached CDN responses do **not** invoke the function, so they cannot prove the shared quota by themselves.
- Confirm `Cache-Control: no-store` on 429/503 and a bounded `Retry-After`. Check public GitHub still gets **no request fanout** when Redis rejects/has an outage.
- Observe Upstash command quota and Vercel Function usage. Current published Upstash Free plan lists **500,000 commands/month**, **256 MB**, and **10 GB bandwidth**, subject to the vendor's current terms. **Every valid origin API request checks the shared Redis counter first**, including rate-limited requests; one atomic EVAL command is issued per request. There is **no longer a 20/min local short-circuit when Redis is configured**. Normal CDN cache hits consume no Redis call. If quota is exhausted, configured APIs return 503 to protect upstream costs.

## Boundaries and rollback

- This is **not WAF traffic blocking at the CDN edge**. Requests served from an existing CDN cache bypass the origin guard; they also bypass upstream GitHub fetches. It is therefore accurate to claim a **cross-instance origin limiter**, not an edge-level WAF.
- Limits are **per canonical IP**. People behind a shared NAT share a quota and can see false positives. A determined attacker with many IPs can still consume the free Redis allowance. No zero-cost limiter is proof of unlimited DDoS protection.
- Client IPs are normalized and HMAC-hashed using the REST token as the secret; raw IPs and credentials are not sent in the Redis key. No request body is stored.
- On Redis service failure, the application deliberately returns 503. To roll back, remove **both** server-only Redis variables and manually deploy/roll back a known-good application version after reviewing the risk. If the shared guard is disabled, the per-instance guard alone does **not** close global-abuse issue #7.
- Continue human NVDA/VoiceOver and real-device verification tracked in issue #5.

**References:** [Upstash Redis REST API](https://upstash.com/docs/redis/features/restapi), [Upstash Free pricing](https://upstash.com/pricing/redis), [Vercel Firewall Rate Limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting).

## Verified release context (13 October 2026)

- The account owner subsequently configured both server-only Upstash variables as **Sensitive / production** on the dedicated NEXUS Vercel project. Never print or retrieve their values for troubleshooting.
- A previous production deployment returned a genuine `429` on a bounded one-client test, but the old local limiter was checked **before** Redis; therefore that result could not identify the Redis decision. This change removes that ambiguity in **future manually deployed versions**. Do not claim the change is already live after a GitHub merge.
- This commit was checked against an in-memory mocked atomic Redis response with **90/90 tests**, TypeScript and Next.js build. Real Upstash cross-instance request accounting must be measured after a separate, reviewed manual deployment. Prefer a maximum of **21 uncached, valid** requests using one known test IP/region, checking that the 21st response is 429 and the other client is not blocked. The Vercel Git auto-deployment policy remains disabled.
- Never confuse a rate-limited **origin** request with an edge WAF rule: Vercel Firewall stays `Log` on the user's available plan.
