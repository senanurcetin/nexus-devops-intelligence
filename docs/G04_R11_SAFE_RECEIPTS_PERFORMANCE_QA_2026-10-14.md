# G04 / R11 — Zero-new-request source receipts and local performance QA

**Date:** 14 October 2026 (Europe/Istanbul).  
**Project:** `senanurcetin/nexus-devops-intelligence`.  
**Exact application/source SHA last tested:** `8bb2e7c2fc664d051f4d34d0c02b8ee4cc7494c3`.  
**Status:** **DONE_OFFLINE for safe response diagnostics and reproducible lab metrics**. Protected SSO Preview deployment **NOT UPDATED** by this PR; G04 live end-to-end acceptance, G05 real Safari/AT, G06 cross-instance Redis and G07 Production remain **OPEN**.

## 1. User-observed problem and source-only fix

The authorized protected Preview deployed at `2b5fb7c379bd1f939f3b50f286edfb868ddb386a` is `READY` and actual user screenshots show readable sample data (10 recent Actions, four open PRs, guarded incomplete F05 trend), but **none included DevTools Network status/headers**. Users should not be required to open developer tools or send private authentication material to substantiate basic source responses.

The browser adapter now attaches a **strictly allowlisted, optional receipt** to each already-issued Actions/PRs panel result:

- Numeric HTTP status (such as `200`, `429`, `503`), only when a real `Response` exists.
- Normalized CDN class, **only** `MISS`, `BYPASS`, `HIT`, `STALE`, `REVALIDATED`; otherwise **`not reported`**.
- Public existing rate-limit-mode header, **only** `shared-redis`, `local-fallback`, `inactive`; otherwise **`not reported`**.
- Public existing limit-source header, **only** `shared-redis`, `shared-redis-unavailable`, `local-fallback`, `github-upstream`; otherwise **`not reported`**.

A native, keyboard-accessible **“Request diagnostics · no new requests”** disclosure in the NEXUS source-coverage panel displays two source-specific HTTP summaries and explicitly explains that CDN `MISS` / `BYPASS` and `shared-redis` **do not prove independent instances or SSO**. This UI uses existing client state; expanding/collapsing sends **ZERO** additional GETs. It never stores or displays IP, URL, raw headers, user cookies, credentials, `Authorization`, `Set-Cookie`, HTML error body or server stack.

Any aborted or network-failed panel has **no false HTTP receipt**. Repository switching resets previous receipts together with the panels and aborts stale in-flight requests. Non-JSON WAF 429 and Redis-unavailable 503 safely preserve the public status and allowlisted source tags while hiding private error bodies. If a CDN header is unknown or not visible, UI explicitly says `not reported`.

**Critical release caveat:** these new diagnostics are **NOT YET present** on already deployed Preview SHA `2b5fb7...`, since this work is source-only. A separate owner-controlled exact-SHA Preview release and a genuinely authenticated browser visit would be needed for live G04 completion.

## 2. Deterministic negative and browser tests

- Four new Node tests cover observed source metadata, hostile/spoofed response headers, 429/503/error-body non-disclosure and aborted/error responses; adjust one prior exact-equality contract test.
- `npm test`: **221/221 PASS** on current source (previous 217 + 4). The first test iteration uncovered a malformed Header mock and one exact-output fixture; both were corrected **before** the verified all-green runs.
- `npm run typecheck`, `npm run build`, `npm run inspect:budget`, `npm audit --json`: all **PASS**, no reported dependencies vulnerabilities at inspection.
- Page JavaScript: **6 chunks, 433,926 raw / 125,339 gzip bytes**, within caps 537,600 raw / 163,840 gzip. This is **not** total site network weight or measured field CWV.
- Compiled local Next HTTP suite: **16/16** PASS, no real GitHub or Upstash calls.
- Playwright browser: **11/11 Chromium**, **11/11 Firefox** fixture scenarios PASS, including 320px, 375px, 768px, 1280px, 1440px, simulated 200/400% text enlargement, source-switch race, partial/unavailable and incomplete F05 coverage. New mobile integration assertion opens the diagnostics, checks *both* allowlisted `HTTP 200 · CDN MISS · admission inactive · limit source not reported` fixture receipts and **strictly unchanged API GET count**. No unexpected external network, JS page errors or whole-document overflow in passing fixture sessions.
- All third-party API payloads in browser tests are **intercepted locally before Redis/GitHub**. Do not mistake simulated `CDN MISS` or `inactive` labels for live Vercel headers.

## 3. R11: reproducible, CI-free performance laboratory

New `npm run perf:local` runs only against a carefully validated **localhost** `NEXUS_BROWSER_BASE_URL`. It starts Chromium for 375px/1280px, three cold browser contexts each, intercepts and fulfills **exactly two** source-valid initial API requests per run without contacting any real GitHub/Redis/Preview, blocks all other origins, and rejects unrequested APIs. It observes browser Navigation, First Contentful Paint, Largest Contentful Paint, and Cumulative Layout Shift with the Performance APIs, plus elapsed time to both panels loaded.

**Three-run medians on executable SHA `8bb2e7c2fc664d051f4d34d0c02b8ee4cc7494c3`:**

| Lab measurement | 375px | 1280px |
| --- | ---: | ---: |
| Both panels visible | **253 ms** | **281 ms** |
| First Contentful Paint | **136 ms** | **200 ms** |
| Largest Contentful Paint | **136 ms** | **200 ms** |
| Cumulative Layout Shift | **0.01129** | **0.00325** |
| Browser runs | 3 | 3 |
| Origin API calls (intercepted fixtures) | 2 per run | 2 per run |
| Unexpected external network | 0 | 0 |

These are **source-local synthetic laboratory measurements**, NOT actual production user Core Web Vitals, live GitHub/Redis latency, authenticated SSO TTFB, INP or real-user field data. Vendor CDN timing, actual GitHub upstream, cross-region traffic, real iPhone Safari, human accessibility and P75 field CWV remain unmeasured. The script does not assert SLA or free-tier live headroom based on these numbers.

## 4. Next release gates and quota protection

- **G02:** owner supplied all six Upstash Free / whole-team Vercel Hobby usage metrics; 25-origin illustrative offline capacity review yielded `READY_FOR_OWNER_REVIEW`. Provider reset time alignment and actual authorized traffic remain distinct. No account quota spike in this source-only suite.
- **G03:** already deployed `READY` protected Preview `dpl_9sq98XLM2DZAgyBFZoFVUde2NucT` is app SHA `2b5fb7c379bd1f939f3b50f286edfb868ddb386a`. **This PR does not deploy its newer diagnostics**; automatic Git deploy remains disabled.
- **G04:** user screenshots prove UI, source states and partial F05 safeguard on old deployed SHA. Exact status, owner session, F01 export file, F03 history and F04 on-demand checks are not accepted by those screenshots. A later owner-authorized Preview deploying this change may let the user capture safe read-only response receipts without F12.
- **R3/G05:** WebKit cannot launch in current Amazon Linux host (ICU74/GStreamer/GTK missing); the Vercel Sandbox cannot directly launch third-party Microsoft Playwright images without a separately provisioned Vercel registry image. Real Safari/iPhone, NVDA/VoiceOver and human visual/editorial sign-off remain open.
- **G06/#7:** simulated/local Redis + one serverless process are **NOT** proof of shared-Redis quota across two independently identified Vercel instances. No unapproved 21-request live stress/paid monitoring.
- **G07:** Production alias and older `74cd0e344eb94255b4bc8db99e4a4dc7f3a5a0bf` SHA must remain unchanged without a **separate explicit Production go/no-go** and rollback record. Do not auto-deploy on GitHub merge.

**Outcome:** R11 laboratory instrumentation and a large portion of G04's **source-side diagnosability** are done. This does **not** falsely close the remaining live/human release gates.
