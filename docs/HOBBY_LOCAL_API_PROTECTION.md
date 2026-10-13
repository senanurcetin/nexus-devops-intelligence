# NEXUS Hobby — Local API protection (not a global WAF)

**Verified:** 13 October 2026  
**Scope:** Vercel-hosted `/api/public-actions` and `/api/public-prs`; no account upgrade, new database, Redis store, scheduled job, or GitHub Actions.

## What is actually implemented

The two read-only route handlers retain repository validation and then apply a **process-local, per-request-source fixed-window budget** before entering the existing in-flight request deduplication gate.

| Property | Verified behavior |
| --- | --- |
| Budget | **20 incoming requests in 60 seconds** |
| Routes | Both public Actions and PR endpoints **share** the same per-source budget **within one function instance** |
| Key | Source IP from Vercel's documented `x-vercel-forwarded-for` request header; untrusted client `x-forwarded-for` values are **not** used as alternate identity |
| Missing/invalid Vercel source header | All unattributed requests share a conservative per-instance budget |
| When 21st request arrives | **429** JSON with `Cache-Control: no-store` and bounded `Retry-After`; upstream GitHub is **not** contacted |
| Key lifecycle | Hashed with a random per-process salt; no raw IP retained in buckets |
| Canonicalization | Equivalent expanded/compressed IPv6 forms and IPv4-mapped IPv6 forms share the same hashed source bucket as their canonical IP |
| Memory control | At most **1,024** distinct source buckets per process; expired buckets are pruned at capacity; on full capacity an unknown source receives a conservative 429 |
| Development / non-Vercel hosts | The Vercel-only guard is disabled; the existing 12 distinct in-flight per-process gate remains |
| Libraries or paid infrastructure | None added |

Invalid repository names still return **400/no-store** before any quota is consumed. The existing GitHub adapter, upstream quota recognition, two-worker PR detail fanout, user-visible wait guidance, and per-process deduplication remain unchanged. A source can refresh either panel without bypassing the **combined** local allowance.

## Address-normalization hardening

The same remote client may otherwise appear as `192.0.2.78`, `::ffff:192.0.2.78`, or `0:0:0:0:0:ffff:c000:24e`. All three now consume **one** local quota. Expanded and compressed IPv6 spellings are similarly unified using standard URL IP canonicalization. Invalid or multiple-address forwarding header values remain in the conservative shared `unattributed` bucket.

Only the **hashed canonical source** enters the in-memory map; no IP is persisted or logged by this limiter. The existing strict 1,024-key capacity, expiration behavior and process-local limitations are retained. The code does not claim cryptographic identity verification of the original client; it relies on Vercel's ingress-provided header contract. Official reference: https://vercel.com/docs/headers/request-headers.

## Security boundaries

This is **defense in depth**, not a reliable service-wide or globally distributed limit:

- Each serverless instance has its own counter. Multiple instances, regions, cold starts or restarts **do not share state**. Even a single Vercel region can have multiple instances.
- Successful responses have their own public HTTP cache behavior, so some cache-hit requests do not execute this local guard. This is acceptable for conserving upstream reads but not reliable for metering every ingress request.
- The guard does not prevent an adversary rotating through many real IPs. Shared IP addresses (e.g. corporate NAT) may receive 429 after combined legitimate requests.
- A public deployment **still requires** a verified, enforced edge/global rate-limiting strategy and account usage agreement; the user's `nexus-public-api-limit` WAF rule currently reported in **Log** mode is only observational. Its saved scope/status could not be verified via the connector API.
- Do not present a Vercel-protected preview as public availability and do not silently disable Vercel Authentication.

## Manual evidence, no CI

- `npm ci --no-audit --no-fund`: passed in disposable cloud sandbox
- `npm test`: **76/76 passed**; three additional regressions verify equivalent IPv6/IPv4-mapped identities, the 1,024-bucket cap, and expired-key reclamation, on top of the previously tested request-budget/Next.js route behavior
- `npm run typecheck`, `npm run build`: passed on Next.js 15.5.27
- Full `npm audit --json`: **0 findings** at verification time
- `npm run smoke:http`: passed against local production server and actual public GitHub workflow/PR samples (10 Actions runs, 5 PRs), HTTP headers and invalid repository responses

## Next release gates

1. Confirm a **true enforced 429** at the platform edge that covers both exact API paths, not just `Log`; verify price and allow low-volume diagnostic checks without generating abusive traffic. Follow [WAF issue #7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7).
2. Finish human NVDA/VoiceOver and keyboard acceptance, plus a protected preview verification. Follow [a11y issue #5](https://github.com/senanurcetin/nexus-devops-intelligence/issues/5).
3. **Only if an eligible free shared-state provider is explicitly connected and its quotas approved**, a true cross-instance storage-backed limiter can be designed and independently validated. No external account or paid plan is provisioned as part of this change.
