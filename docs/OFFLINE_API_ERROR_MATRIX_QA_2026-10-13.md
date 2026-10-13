# Q-03 — offline API error-contract and no-leak regression matrix

**Date:** 13 October 2026 · **Scope:** NEXUS DevOps Intelligence public read-only Actions and PR routes, plus browser API adapter.

## Design change

The browser previously copied any server JSON `error` string of length 1–300 into the visible UI. NEXUS's own route responses are curated, but an unexpected reverse-proxy payload, future upstream code regression, or test intermediary could carry internal diagnostics in a short string.

Now the browser displays **only recognized literal public NEXUS/GitHub error-contract messages**. An unfamiliar or unsafe message is replaced with the generic public fallback `GitHub data is temporarily unavailable.`. The existing known-public 404, 429, 503, timeout, JSON-malformed and invalid-sample semantics remain; no raw intermediary HTML, credentials, upstream diagnostics, or arbitrary error details are displayed. Rate-limiting always remains explicit and handles numeric bounded `Retry-After` without automatic replay.

**No server-side endpoint behavior or Redis thresholds changed.** No dependency was added.

## Manual CI-free acceptance

Tested in a short-lived Vercel Sandbox with **fixture-only** Redis and GitHub fetch intercepts. The Upstash-style `https://fixture-only.upstash.io` is a **synthetic URL intercepted before outbound network**, and the bearer value is an artificial non-secret fixture. No actual Redis request is emitted by the matrix.

| Test | Actual outcome |
| --- | --- |
| Invalid repository | Both real Next GET handlers return **400/no-store**, before any Redis or GitHub call |
| Redis `EVAL` count 21 / TTL 33 (fixture) | Both return **429/no-store**, source `shared-redis`, `Retry-After:33`; **zero GitHub calls** |
| Redis auth error 401 and backend 500 | Both return **503/no-store**, source `shared-redis-unavailable`, bounded `Retry-After:5`; no GitHub |
| Redis malformed JSON, wrong result shape, invalid count/TTL | Both fail closed **503**; no GitHub |
| Redis timeout, thrown network error | Both fail closed **503**; no raw error or GitHub |
| Unsafe Redis endpoint host | Both fail closed **503**; outbound fetch not called, no bearer transmission |
| Valid Redis admission then GitHub upstream 429 | Both return **429/no-store**, source `github-upstream`, `Retry-After:72` and no private response body |
| Valid Redis admission then malformed GitHub JSON | Both return **502/no-store**, no leaked response |
| Valid Redis admission then GitHub timeout | Both return **504/no-store**, no leaked response |
| Valid Redis admission then GitHub 503 | Both return **503/no-store**, no leaked response |
| Browser adapter known public 404/503 messages | Preserved |
| Browser adapter arbitrary short error/secret/HTML | Converted into safe generic message |
| WAF HTML 429, retry 7 vs 70000 vs invalid | Displays bounded guidance or generic wait, never parses/shows HTML, never auto-retries |
| `npm test` | **129/129 pass**, including 8 new offline matrix tests |
| `npm run typecheck` and production `npm run build` | Pass |
| `npm audit --json` | **0 reported vulnerabilities at check time** |
| `npm run smoke:http` | Local production app: security-header homepage, invalid 400 requests, and read-only public GitHub Actions/PR samples all pass |

The matrix used offline mocked upstream responses but imported and invoked the **actual Next.js GET route handlers**, preserving attribution and no-fanout assertions. The separate HTTP smoke contacted public GitHub under the normal **non-Vercel local route mode**, **not** shared Upstash. No actual Preview or Production endpoints were probed.

## Explicit limitations

- No shared Redis *live* 21-request quota probe, Upstash command consumption, or Vercel multi-instance acceptance; the user explicitly declined stressing the shared Production/Preview Free Redis budget. [Issue #7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7) remains open.
- Browser automation and human NVDA/VoiceOver / physical-device acceptance are different. [Issue #5](https://github.com/senanurcetin/nexus-devops-intelligence/issues/5) remains open.
- Q-04 long-text, zoom and cross-browser visual QC is the next independent task. Existing monitored public origin may still have only WAF Log action, not edge-enforced 429.
- Do not interpret GitHub PR merge as a Vercel deployment: Git auto-deploy remains disabled. No CI/purchase/secret read/deployment is authorized by this report.
