# F-04 phase 1 — on-demand GitHub PR checks/reviews, budget and QA

**Date:** 14 Oct 2026 · **Status:** GitHub development / offline QA only. **No Preview or Production deployment.**

## API rate limit and cost rationale

GitHub's [REST rate limit documentation](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) states anonymous public requests are primarily limited to **60 per hour per originating IP**, with additional secondary/abuse limits. [Public check runs](https://docs.github.com/en/rest/checks/runs) and [PR review events](https://docs.github.com/en/rest/pulls/reviews) are available without an authenticated token. This is **not** account-level access and not permission to query private repositories.

| Operation | NEXUS origin requests | Shared Redis admission (if configured) | Anonymous GitHub REST GETs, worst case without upstream cache |
| --- | ---: | ---: | ---: |
| Fresh ordinary repository analysis (unchanged Q-05 contract) | **2** | **2** | **at most 7** |
| Render dashboard, filters, share link or CSV/JSON export | **0 additional** | **0 additional** | **0 additional** |
| Explicit **Inspect check & review events** click for one already listed public PR | **1** | **1** | **at most 3**, sequential |
| Open/hide same successfully inspected PR without requesting a new sample | **0 additional** | **0 additional** | **0 additional** |

The new endpoint `GET /api/public-pr-verification?repository=owner%2Frepo&number=21` accepts a strict single `repository` and `number`, rejects duplicate, malformed, unknown parameter names, zero/negative/oversized PR IDs **before Redis or GitHub**, and uses the existing Vercel **shared Redis per-IP origin gate** (fail-closed 503 when Redis is configured but unavailable; 429 with bounded Retry-After on quota exhaustion). Process-local admission only applies if shared Redis is not configured. Concurrent identical detail requests coalesce per Node instance via the existing public in-flight gate; each origin request still has its own shared admission.

When triggered, the endpoint sequentially obtains **(1)** the open PR detail and its current immutable **head commit SHA**, **(2)** at most **30** check runs for that SHA, and **(3)** at most **30** chronological PR review events. Invalid GitHub PR identity, head, check-run response or GitHub 404/403/429/503 immediately stops the sequence and prevents unnecessary later upstream calls. There are **no automatic retries or background checks**; the source is always fixed `https://api.github.com/repos/<validated-owner>/<validated-repo>/...`. The existing GitHub request timeout and cache policy are reused, with all raw upstream errors hidden from the user.

**Important interpretive constraints:** individual check-run `success` is not an overall protected-branch/merge approval. Review events can be **superseded, dismissed or pending**, so an `APPROVED` event does not establish currently required review approval. An empty check page is **not** evidence that checks succeeded; the first 30 checks or reviews are only **bounded samples**, not exhaustive. The check-run endpoint may not find some fork or external-service checks; PR owners must verify current requirements in GitHub. Actual cached origin/Upstash/GitHub billing and private repository behavior were **not** measured. Dedicated workflow failure/root-cause context remains **deferred** pending separate GitHub budget review; phase 1 does not claim it.

## Security and correctness details

- New client button appears **only on a PR in the already verified current sample** and only invokes the detail API on an explicit click. Global default/dashboard load, filter, F-01 export and F-03 URL hydration never call it.
- Browser-side payload validator re-verifies canonical `https://github.com/<repo>/pull/<number>`, head SHA, counts, unique check/review IDs, bounded strings/timestamps and sample limits. A stale/aborted request cannot populate the newly selected repository.
- Source text is escaped by React. No check-run external detail URLs, raw review bodies, unvalidated links, credentials, tokens, cookies or GitHub writes are included in the response. Only the canonical GitHub PR link is provided for a definitive latest-state inspection.
- Successful detail response is reused when collapsed/reopened; PR refresh or repository switch clears the state. No hidden polling, retry loops, third-party telemetry, paid API, stored snapshot or automatic five-PR fanout.

## CI-free offline test record

Disposable Node24 Vercel Sandbox, feature branch `cee9be3d3406963923e5b34c4e069294741ca28d`, verified locally:

| Check | Result |
| --- | --- |
| `npm test` | **163/163 passed** (8 new PR check/review/gate tests) |
| `npm run typecheck`; Next production build | **Passed**; a new dynamic `/api/public-pr-verification` route built successfully |
| `npm run inspect:budget` | 6 page JS chunks, **420,386 raw / 122,441 gzip** bytes, under 537,600 / 163,840 review thresholds |
| `npm audit --json` | **0 vulnerabilities reported at inspection** |
| GitHub GET cost contract | **0 before explicit click**, **3 maximum per click**, early stop on bad PR/checks, 403/429 behavior verified with intercepted fixtures |
| Redis budget contract | Synthetic Upstash-like REST endpoint fully intercepted: **one** atomic Redis admission for allowed request, next denied 429 with **0 new GitHub GETs**; **0 real Upstash traffic** |
| Chromium 143 **375px**, populated fixture | Initial two intercepted panel GETs, exactly **one** new explicit PR detail GET; check/review evidence rendered, including distinct historical `APPROVED` and `DISMISSED`; collapse/reopen **0** new requests; keyboard focus and axe WCAG A/AA **0 violations** |
| Chromium 143 **1280px**, synthetic upstream 429 | One explicitly requested detail GET; safe bounded 47-second delay hint, no partial/claimed approval, **0** axe A/AA violations |
| Browser exception / document overflow | **0** observed in both browser runs |
| Local `npm run smoke:http` (unmocked public GitHub access) | **NOT fully completed**: local homepage and both invalid-input security checks passed, but anonymous upstream GitHub workflow sample returned **HTTP 429**. **No repeated live requests** were made to exhaust or bypass the quota; this does not invalidate passing mock-based tests or establish live PR endpoint success |

The new GitHub REST calls were **never sent to live GitHub** in the F-04 tests. Browser source requests used deterministic intercepted fixtures. The earlier live read-only smoke failure was on the **existing Actions route**, not on the new F-04 route. Any later live test needs a separate owner-reviewed tiny request budget, mindful that shared Upstash Free quota is also used by Production.

## Release and acceptance limits

No GitHub Actions/CircleCI, Git auto-deploy, paid service, SSO or WAF changes, Upstash secret reads, shared Redis load test, actual protected Preview API calls or Production deployment. The last verified protected Preview **`dpl_Beyxk5vGuDcvx5XDD4gVdsbUX9tg`** continues serving older source **`599ced7`**; Production remains **`74cd0e3`**. F-01–F-04 are **code only** until a new immutable SHA is reviewed and manually deployed with owner approval. Signed-in real Preview visual acceptance (R-04), human Safari/NVDA/VoiceOver/device checks (R-05), shared Free Redis account headroom (R-02) and live independent Vercel Redis instance issue [#7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7) remain unresolved.
