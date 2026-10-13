# Q-05 — NEXUS API and page bundle budget audit (13 October 2026)

## Scope

This is a manual, **CI-free** performance and free-tier budget *regression* check, **not** a service benchmark, claim of actual Vercel billing, or browser Core Web Vitals measurement.

The owner requires Hobby/Upstash Free operation without quota-consuming load probes. The test suite therefore uses a **synthetic Upstash-style URL and token with complete fetch interception**: zero real Upstash calls. The two actual Next.js Actions/PR GET route handlers are invoked directly from isolated Node tests.

## Origin/API cost model

One manual repository selection in the browser asks for two independent read-only NEXUS routes:

| Component | Expected upper bound per fresh origin selection | Conditions |
| --- | ---: | --- |
| Browser requests to NEXUS `/api/public-*` | **2** | One Actions + one PR request; caching/CDN may avoid a Vercel origin execution; local filters/navigation generate **0** extra requests |
| Redis admission decisions on origin | **2** | With shared Redis configured; each origin request performs one atomic `EVAL`. This is **not** edge WAF admission |
| Upstream GitHub workflow API GETs | **1** | Up to ten sampled runs |
| Upstream GitHub PR list GETs | **1** | Six-item list to identify at most five sampled open PRs |
| Upstream GitHub PR detail GETs | **at most 5** | Drafts skip details, two details at most in flight, stop scheduling details after observed 429 |
| **Total GitHub upstream GETs** | **at most 7** | Same standard origin selection (can be fewer for empty/draft/cached/limited results) |

A deliberate **targeted retry** makes one additional NEXUS origin GET, which can cause a single extra Redis admission and, depending on panel, up to one Actions or six PR GitHub GETs; both original panels are **not** automatically retried. Concurrent same-repository Actions origin requests each consume their own Redis admission but share **one** in-process GitHub upstream GET when coalesced. Local process coalescing cannot prove cross-instance deduplication.

Tests added in `tests/nexus-q05-budget.test.mjs` use the real Next handlers, verify 2 synthetic Redis + 7 upstream GitHub requests with PR detail concurrency never beyond 2, prove identical concurrent Actions work coalesces one upstream GET, and prove an upstream PR-list 429 returns immediately with **zero detail fanout or automatic retry**. All network calls are intercepted and asserted against an exact approved fixture origin.

**Caveats:** actual Upstash command billing, Vercel Function invocations, edge-cache hit rate, anonymous GitHub rate limits and traffic patterns are **not** measured here. These upper bounds are a deterministic behavior model for a valid source selection, not a guarantee under all platform/traffic conditions.

## Client JS bundle guard

A post-build, no-network command is now available:

```bash
npm run build
npm run inspect:budget
```

`scripts/inspect-q05-bundle.mjs` reads the local `.next/app-build-manifest.json`, locates the `/page` JS assets, deduplicates chunk names, computes raw bytes and per-chunk gzip totals, and fails if either threshold is exceeded. It does not use third-party telemetry or add dependencies.

| Metric | Manual measurement | Review threshold |
| --- | ---: | ---: |
| Unique client JavaScript chunk files for `/page` | **6** | Not thresholded |
| Sum of raw `/page` JS chunks | **401,241 bytes** | **537,600 bytes** (525 KiB) |
| Sum of per-chunk gzip bytes | **117,432 bytes** | **163,840 bytes** (160 KiB) |

The margin is intentional: the guard warns via a failing command if a later build exceeds a **review budget**, not an assertion of acceptable runtime latency or UX. Next.js's build console separately reported **about 117 kB First Load JS**, which is a different measurement; do not conflate it with the manifest's gzip sum. Image, CSS, dynamic network timing and Core Web Vitals are **not** included.

## Manual verification

Temporary Node 24 Vercel Sandbox, no production/preview deployment:
- Clean `npm ci`, **135/135 Node tests**, `npm run typecheck`, Next production `npm run build` all passed.
- `npm run inspect:budget` passed on the actual build, producing the exact sizes above.
- `npm audit --json`: **0 findings at inspection time**.
- `npm run smoke:http` against the temporary local production server: homepage/security headers, invalid input both APIs, public GitHub Actions and PR read-only samples all passed.
- Existing manual Q-02 browser QA demonstrated a successful single-panel retry without sibling GET, delayed previous repository ignored. Existing Q-04 browser QA demonstrated exactly **two** initial fixture GETs, no extra focus/filter navigation calls and 0 JS exceptions. Those previous tests are **not** a new, real-traffic RUM performance benchmark.

## Unresolved acceptance

[#5](https://github.com/senanurcetin/nexus-devops-intelligence/issues/5) requires human screen-reader, physical-device and additional browser-engine acceptance; neither JS bundle guard nor axe proves it. [#7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7) requires actual independent live Vercel Redis cross-instance enforcement evidence or explicit owner risk acceptance. Production uses an older SHA; merging this documentation/test PR cannot publish the latest code. No GitHub Actions/CircleCI, paid upgrade, Upstash quota load, secret access, Preview/Production redeploy or WAF change occurred.
