# R5 — Public source/data and failure-response matrix, source-local closure

**Date:** 14 October 2026 (Europe/Istanbul).  
**Exact application SHA:** `2df2ea635fd57b0d9f4d852818f6de55e0f1e3ce`.  
**Outcome:** **DONE_OFFLINE** for source integrity and simulated negative tests; **real signed-in protected Preview / G04 remains OPEN**. All data in browser tests comes from explicit local fixtures, never presented as production GitHub information.

## Tested functional contract

| Domain | Verified source-local assertion | Relevant regression evidence |
| --- | --- | --- |
| F01 client export | Source-matched selected repository CSV/JSON, formula injection neutralized, missing panel omitted, export causes no extra GET | `tests/nexus-public-sample-export.test.mjs`, `tests/nexus-f01-f05-integrated-contract.test.mjs`, 11 Chromium + 11 Firefox fixture journeys |
| F02 recommendations | Source-backed evidence and safe GitHub links; no unsupported diagnosis | `tests/nexus-f02-investigation-provenance.test.mjs`, `tests/nexus-recommendations.test.mjs` |
| F03 state/share/back | Canonical source identity; duplicate shared repo and stale response handled; source change invalidates detail state | `tests/nexus-f03-share-links.test.mjs`, `tests/nexus-panel-request.test.mjs`, 11 browser journeys |
| F04 opted-in PR and run checks | No automatic detail fanout; invalid PR/run numbers 400 before Redis; only named GitHub links; check/review/job results bounded, unverified state kept unknown | `tests/nexus-f04-pr-verification.test.mjs`, `tests/nexus-f04-workflow-evidence.test.mjs` |
| F05 seven completed UTC days | One opt-in additional source call, complete-coverage gate; incomplete data suppresses daily matrix and does not imply a reliability/SLA conclusion | `tests/nexus-f05-seven-day-trends.test.mjs`, 11 browser journeys |
| Five-route strict input | Missing/duplicate `repository`, unknown keys and invalid special values => **400/no-store before Redis or GitHub** | `tests/five-public-route-admission-contract.test.mjs`, 16 built Next loopback HTTP negatives |
| Shared Redis simulated | Five routes same hashed source quota; injected count 21 => **429/no-store/Retry-After:17/source shared-redis**, backend failure/partial credentials => **503/no-store/Retry-After:5** with no GitHub GET | `tests/five-public-route-admission-contract.test.mjs`; tests intercept Redis fake response |
| GitHub errors (mocked) | Fixed HTTPS api.github.com source URL, no raw diagnostic leak, 403 with rate-limit evidence and 429 mapped to bounded hint; not-found 404; malformed/invalid 502; timeout 504; denied/network 503; no auto-retries | `tests/github-public-client.test.mjs`, `tests/nexus-offline-http-error-matrix.test.mjs`, F04/F05 specific tests |
| Browser/intermediary safety | Non-JSON WAF errors not printed; untrusted arbitrary error strings hidden; Retry-After bounded; stale source replies do not overwrite current | `tests/nexus-panel-request.test.mjs`, `tests/nexus-retry-after.test.mjs`, real local Chromium/Firefox fixture journeys |
| Operating budget | Default first source selection issues only two API panel GETs; F04/F05 opt-in, not automatic; successful API responses may be cached but error responses no-store | 11 Chromium + 11 Firefox fixture journeys; 16 compiled HTTP negatives |

**Do not infer that every status has been observed against live GitHub, Redis or Vercel.** Above status outcomes come from a combination of pure adapter/NextRequest tests, mocked GitHub/Upstash responses and loopback compiled HTTP checks.

## Latest exact-source verification

See [R1 exact current-main QA](R1_EXACT_MAIN_SOURCE_QA_2026-10-14.md): **208/208 Node**, **16/16 loopback HTTP**, **11/11 Chromium**, **11/11 Firefox**, TypeScript, Next production build and JS budget all PASS at SHA `2df2ea635fd57b0d9f4d852818f6de55e0f1e3ce`, npm audit 0. Neither current-source live Preview, real Redis rate-limit data nor human acceptance was used.

## Required G04 live acceptance — explicitly open

- Owner-approved, exact-SHA and SSO-protected **Preview only**, after R2 actual Free account headroom, source identity, env name/scope and permitted origin traffic budget.
- Check precise public Actions and PR source identity, sample caps, source safe GitHub links, F01 and F03 client behavior and F04/F05 opt-in without uncontrolled fan-out; only spend approved origin GETs.
- Record real 200/400 and any naturally encountered error; **do not manufacture a 21-request real Redis limit test** merely to complete a matrix. Cache/hit versus origin decision must be distinguished.
- Real Safari/mobile/VoiceOver and independent Vercel-instance Redis proofs are distinct G05/G06 gates, still open.

**Decision:** R5 engineering source-data contract verified **OFFLINE**. G04 and other owner-dependent release requirements not accepted.