# Actions Intelligence — sample-aware visual QC (13 October 2026)

## Change and evidence boundary

The NEXUS dashboard now displays a **sample outcome distribution**, a **recently listed run sequence** with ten-or-fewer GitHub evidence links, and local run filters (`All`, `Success`, `Failed`, `Pending`, `Other`). All components consume the **already validated** anonymous `/api/public-actions` response, with **no extra GitHub, Redis or paid-service calls** when changing filters.

- The server returns at most **10 recent workflow runs**; `total_matching_runs` describes GitHub's upstream reported scope but is **not** a percentage denominator, billing history, population-wide pass rate, or basis for a longitudinal trend. Visual bar percentages use only `inspected_runs > 0`.
- The four classifications reuse the server's evidence policy: `completed+success` is successful; `completed+failure/timed_out/startup_failure` is confirmed failed; queued/in-progress/requested/waiting/pending is pending; cancelled/skipped/neutral/unknown conclusions are **other**, not failed or pending.
- The ten-or-fewer ordered tiles are clickable links to canonical run evidence. Their position is the list order given by GitHub's API, **not** equal-time spacing or evidence of velocity or historical performance.
- The existing Actions evidence panel is filterable **only in browser state**; the original validated sample and the PR panel remain unchanged. Filtering does not remove confirmed high-severity suggestions from the investigations panel.
- No percentage or empty graph is fabricated when there are **zero runs**, incomplete input, errors or loading states. Evidence cards still explicitly say that the data is a public sampled preview, not an AI diagnosis or historical reliability rating.

## Manual CI-free validation

An ephemeral Node 24 Vercel Sandbox was used with the PR's pinned SHA, no Vercel deployment and no Upstash/Preview environment credentials imported.

| Check | Observation |
| --- | --- |
| `npm ci`, `npm test` | **111/111 tests passed**, including 6 new pure classification/filter regressions |
| `npm run typecheck`, `npm run build` | Both passed; Next.js production bundle built successfully |
| `npm audit --json` | **0 reported vulnerabilities** at inspection |
| `npm run smoke:http` | Homepage and invalid-input protection passed; live read-only public GitHub workflow and PR samples passed (ordinary smoke requests, not Redis live load) |
| Chromium 375px | 10-run mixture, pure local filter, keyboard Enter activation, 10 evidence links, zero horizontal overflow/JS errors |
| Chromium 768px | Same outcomes |
| Chromium 1440px | Same outcomes |
| Empty sample (375px) | No percent distribution or misleading bar; truthful empty message |
| HTTP 503 Actions error (375px) | No distribution; informative unavailable message |
| Axe-core WCAG 2/2.1 A/AA automated | **0 detected violations**, 27 passed rules at 375/768/1440 mixed sample; 25 passed rules on empty/error state |

The browser scenarios intentionally intercepted API calls with **controlled deterministic fixtures**: 1 success, 3 confirmed failures, 2 pending, 4 other. This is **NOT** a claim that `senanurcetin/ot-sentinel` actually has those results. In the browser scenarios only **2** initial requests were observed (one for Actions, one for PRs); changing filters did not cause new network calls. Mobile/tablet/desktop screenshots were taken in the disposable sandbox as QA artifacts, but **they are not a public Preview link**.

## Remaining acceptance gates

- **Issue #5**: human NVDA/VoiceOver and physical-device browser/accessibility acceptance still open. Automated axe/Chromium checks do not replace it.
- **Issue #7**: production Redis/edge security is not signed off; the previously completed **zero-Upstash-command two-local-process real Redis** test and one live Preview admission check do not prove live cross-instance Vercel enforcement. The shared Upstash Free quota is intentionally not load-tested.
- No GitHub Actions/CircleCI, paid upgrade, Git auto-deploy, Preview or Production redeploy. Merging this PR **does not publish its visual changes**.
