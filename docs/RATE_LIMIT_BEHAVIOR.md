# NEXUS public API rate-limit behavior

**Verified:** 13 October 2026 · Manual cloud verification, no CI  
**Scope:** The independent read-only GitHub Actions and public PR endpoints.

## Current request flow

1. The browser requests `/api/public-actions` and `/api/public-prs` independently with no-store request settings.
2. Each route checks its **process-local** shared request gate: duplicate concurrent requests share an upstream lookup; only 12 distinct keys can be in flight **per server instance**.
3. The GitHub adapter issues bounded, fixed-host read-only calls using a 10s request abort signal and Next.js's 120s revalidation hint.
4. GitHub primary or secondary rate-limit responses (403/429, including recognized GitHub secondary-limit messages) are mapped to HTTP **429**. Ordinary 401/403 remains a restricted-access response.
5. When GitHub provides a **numeric** `Retry-After` between **1 and 3600 seconds**, the API echoes only that validated value. Malformed, very large or HTTP-date values are **omitted**, not parsed as trusted instructions.
6. The browser displays the bounded wait hint, including for an HTML 429 response from an edge-level WAF. If no safe hint is present, it shows a general retry-later message.
7. **No automatic retries, retry timers or additional GitHub calls** are launched after a 429. The user may manually submit a new request later.

## PR-detail quota correctness

- A successful PR **list** response is not enough to claim that the PR analysis succeeded.
- The list can require up to **five** additional, bounded detail requests for non-draft PRs. If **any** detail request returns a GitHub primary/secondary rate-limit indication (403/429), the **whole PR endpoint returns 429/no-store** instead of silently treating that quota failure as an ordinary unknown merge status.
- If several details report valid numerical `Retry-After` values, the API exposes the **largest** safe 1–3600-second wait, never arbitrary GitHub error text or invalid headers.
- Individual **non-rate-limit** detail errors (503, timeout, invalid payload) stay **unknown**. A failed detail must never be reported as merge-ready.
- Non-draft detail requests now use a **two-worker pool**; no more than **two** are active at once, and there are **at most five** total when no limit is reported. Once any worker observes a quota result, it stops taking new PRs. The other request already in flight is allowed to finish so its safe `Retry-After` value can be considered. The pool does not cancel an already-started GET or prevent requests that began **before** the quota response was observed.
- This conservative approach can add latency for slow upstream responses (up to three waves of detail requests) and is **not** a cross-instance rate limiter or a replacement for Vercel WAF.

## Cache and privacy

- Successful sample responses are public and may use `Cache-Control: public, max-age=60, stale-while-revalidate=120`.
- Error and rate-limited responses use `Cache-Control: no-store`, including responses with a validated Retry-After.
- Never pass GitHub/WAF HTML error bodies, tokens, private information or unvalidated headers into user-visible errors.
- The current GitHub REST API integration is **public read-only**. It does not trigger GitHub Actions or CircleCI workflows.

## Manual verification

- `npm ci --no-audit --no-fund` — passed
- `npm test` — **67/67 passed**, including three new deterministic tests for the maximum two concurrent detail GETs, stopping unscheduled work after an observed quota response, and choosing the longest safe wait from already in-flight responses
- `npm run typecheck`, `npm run build` — passed
- Full `npm audit --json` — **0 findings at verification time**
- Production localhost `npm run smoke:http` — passed using live public GitHub samples

## Release boundary

**This is application behavior, not a global limiter.** Process-local in-flight gating cannot block traffic across Vercel serverless instances, and WAF rate counters are per region. Cross-instance WAF configuration, Hobby pricing/usage approval and the manual preview verification remain **open** in [issue #7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7).

No WAF rule, Git-based auto-deployment, public deployment, GitHub Actions or CircleCI was activated during this work.
