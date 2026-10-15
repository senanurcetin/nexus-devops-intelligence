# G06 — All five public API routes must fail closed on Redis

**Date:** 2026-10-15 · **Only project:** senanurcetin/nexus-devops-intelligence.
**Executable source SHA:** `3c7ad3e348d71cdea8bdf90b8cbc63bb2624c4f3`.
**Scope:** source-only endpoint safety regression, **NOT** actual two-Vercel-instance proof.

## Gap closed

The original offline HTTP error matrix covered shared Redis 429, unavailable Redis 503, malformed source and GitHub fanout for only `/api/public-actions` and `/api/public-prs`. Three user-triggered endpoints existed but were outside that runtime matrix: `/api/public-pr-verification`, `/api/public-workflow-evidence`, and `/api/public-workflow-trends`. All five have the same security obligation: reject malformed input before Redis, never reach GitHub when Redis admits 429 or returns unavailable, and use the same opaque per-client Redis bucket.

## Added regression cases

Three new Node integration tests call the **real Next.js GET route handlers** for all five routes with valid route-specific query fields (PR number, run ID and a completed UTC end date), but intercept `globalThis.fetch` to an in-memory synthetic Upstash response; **no external network requests**:

1. An invalid repository on all five handlers returns 400 with no Redis EVAL or upstream GitHub.
2. Synthetic atomic Redis EVAL result `[21,33]` makes all five handlers return 429, `Retry-After:33`, `Cache-Control:no-store`, `X-Nexus-Rate-Limit-Source:shared-redis`, one Redis EVAL per route and the same opaque Redis per-source key; GitHub is never contacted.
3. Redis 401, malformed TTL and thrown network error each make all five handlers return 503, `Retry-After:5`, `Cache-Control:no-store`, `X-Nexus-Rate-Limit-Source:shared-redis-unavailable`; no GitHub fallback or leaked internal errors.

The new assertions use the actual handlers, not a string-only lint heuristic. The test uses `node --import tsx` for the existing Next.js TypeScript import contract. A first ad hoc focused invocation without the repository's required tsx loader could not import Next; it was **an invocation issue, not a code failure**. The focused test passed with the same `--import tsx` setup as `npm test`.

## Exact-source local verification

| Check | Result |
| --- | --- |
| Full Node suite | **230/230 PASS** (previous 227 + three) |
| G06 offline HTTP error matrix | **11/11 PASS** |
| TypeScript / Next production build | **PASS** |
| Offline compiled Next HTTP smoke | **16/16 PASS** |
| Chromium fixture browser | **12/12 PASS** |
| Firefox fixture browser | **12/12 PASS** |
| JS bundle | **435,794 raw / 125,850 gzip bytes**, below 537,600 / 163,840 caps |
| npm audit | **0** vulnerabilities reported |
| WebKit twelfth scenario for this source | **NOT RUN** — authorized Windows WebKit host offline |

Browser regression uses localhost only and intercepts five API routes before they reach GitHub/Redis; zero external browser requests, page errors or detected automated axe violations. This is test hardening only; the source-facing NEXUS UI and runtime API behavior are unchanged by this PR.

## Unresolved release/security gate

**G06/#7 stays OPEN**: five handlers sharing a synthetic Redis bucket does not prove two distinct **real** Vercel Functions executed the same Upstash EVAL, nor real 429 under verified Free usage delta. Local two-process Redis6 EVAL proof is still local. A real live load/21-request test remains outside prior authorization and requires fresh quota review and explicit consent. Current protected Preview and Production run older SHAs; this source test PR does not deploy or promote anything. G04 authenticated Preview, G05 real human AT, and G07 separately authorized Production remain independent gates.