# F-03 — shareable public repository link QA

**Date:** 14 October 2026 · **Scope:** NEXUS DevOps Intelligence · **Release state: GitHub development only; NOT deployed**.

## Behavior contract

A public NEXUS page can be shared as `https://<nexus-host>/?repo=owner%2Frepository`. This is a **selection**, not a saved dataset, a snapshot, a private GitHub credential, or a guarantee of current repository availability. The recipient's browser requests a **fresh bounded read-only public sample** through the existing Actions and PR NEXUS API routes, not any new endpoint.

- On `/` with **no `repo`** parameter: preserve the existing default public source `senanurcetin/ot-sentinel`.
- On exactly **one valid** `repo` parameter: use existing `parsePublicRepository` validation and request exactly **one Actions and one PR panel**.
- On empty, malformed, whitespace-bearing, overlong or **duplicate** `repo` parameters: **do not fetch any API**; clear/abort previous source results; show a visible, safe validation error and allow the user to enter a corrected repository. No untrusted URL is ever passed as a destination or GitHub REST origin.
- Explicit Analyze of a **different** valid public repository records a browser history entry and starts exactly the existing two panel reads. Clicking Analyze again for the **same already selected** repository normalizes the share URL without another API call; per-panel Refresh remains available to request fresh data deliberately.
- Browser **Back/Forward** reconstitutes valid repository selections; navigating to the *same selection* does not repeat GETs. Navigating to an invalid shared link aborts old work and clears verified data without a new GET. The existing independent AbortController sources protect against stale responses.
- **Copy repository link** copies a canonical same-origin URL containing **only** `repo=owner%2Frepository`, removing unrelated query keys, hash anchors, and anything that might accidentally look like a token. If the Clipboard API is unavailable/denied, it displays a readonly selectable input instead of claiming a copy succeeded. Share links do **not** embed source samples, timestamps, filters or tokens.
- No local/session storage, new backend route, new runtime dependency or polling.

## CI-free manual acceptance

Disposable Node 24 Vercel Sandbox using the feature branch and `npm ci`, with a locally built Next production server. Chromium tests used **fully intercepted source fixtures** before each mock GET; **zero actual Preview/Production or Upstash Redis origin reads**.

| Test | Verified outcome |
| --- | --- |
| `npm test` | **155/155 passed**, including **6 new** URL validation/canonical link tests |
| `npm run typecheck`, `npm run build` | Both passed |
| `npm run inspect:budget` | 6 unique app page JS chunks, **414,823 raw / 121,117 gzip** bytes; below review caps **537,600 raw / 163,840 gzip** |
| `npm audit --json` | **0 vulnerabilities at inspection time** |
| `npm run smoke:http` | Local production homepage security headers, invalid 400/no-store API cases and bounded real **public GitHub read-only** workflow/PR samples passed |
| Chromium 143 **375px**, direct valid URL and history | Initial `owner/repo`: **2** requests; explicit `other/project`: **2**; same-repo Analyze: **0**; Back to original: **2**; Forward to second: **2**. Total **8** in correct repository order. Canonical URL and clipboard content matched exactly. |
| Chromium 143 **375px**, invalid duplicate link | Initial duplicate `repo` rejected with **0** calls, disabled copy and validation alert; manual recovery fetched **2** calls; history Back to invalid link fetched **0**, cleared prior content. |
| Chromium 143 **1280px**, no repo parameter | Loaded original default `senanurcetin/ot-sentinel` in **2** calls; copied canonical public share URL with **0** extra requests |
| Chromium 143 **375px**, clipboard denied | Accurate failure message plus readonly selectable link for manual copy; **0** extra API calls |
| All four Chromium cases | **0** horizontal document overflow, uncaught JS exceptions, or automated axe WCAG 2/2.1 A/AA violations (25–26 passing rules depending on state) |

### Scope and risk

- Two origin API GETs are the expected behavior **only when served without a cache hit**; this is an offline behavioral assertion, **not** an actual billable Upstash command count or live edge WAF proof. Repeated changes to different repositories intentionally request fresh bounded samples. Browser history is not a server-side cache.
- Browser tests operated against localhost with fixtures. They do **not** establish logged-in actual protected Preview visual acceptance, Firefox/WebKit parity, human NVDA/VoiceOver/real-device review or independent live Redis origin rate limiting.
- The release baseline remains **old SSO-protected Preview** deployment `dpl_Beyxk5vGuDcvx5XDD4gVdsbUX9tg`, app SHA `599ced76605c25161b182b2d5bfbadbd091bfb53`; Production still serves old app SHA `74cd0e344eb94255b4bc8db99e4a4dc7f3a5a0bf`. **F-01/F-02/F-03 are not in either deployed version** until a separate authorized pinned-SHA Preview/Production deployment. Do not confuse a merged PR with publication.
- No GitHub Actions/CircleCI, paid service, changes to Vercel SSO/env/WAF, GitHub repository writes by the application, real 21-request shared-Upstash load test, credential inspection, SSO bypass or deployment performed. Owner deferred remaining screenshots and human acceptance.
