# Q-01 / Q-02 — independent panel receipts and browser race verification

**Date:** 13 October 2026 · **Scope:** NEXUS read-only dashboard · **Manual CI-free testing only**

## Change

Before this change a single `lastApiResponseAt` timestamp was advanced when either Actions or PRs returned a valid sample. One successful panel could therefore imply that the *other* (including a failed source) was fresh.

- **Q-01:** The two panels now use **independent** `actionsReceivedAt` / `pullsReceivedAt` timestamps, shown as separate source receipts. Each new request clears only its **own** old receipt and verified sample; repository change clears both. Success updates only the corresponding source; errors leave the failed receipt explicitly unverified. Receipt time is labeled **browser-local successful API receipt**, not original GitHub event time or SLA freshness.
- **Q-02:** Existing independent request-generation / abort controls and failed-only retry were kept unchanged. An **actual controlled Chromium race** verified that rapid repository change, even while previous calls have not responded, never associates the older source with the newer selection. Full application is not refreshed, and retries do not touch the healthy sibling.

## Manual results

Disposable Node 24 Vercel Sandbox: clean `npm ci`; **121/121 Node tests**, TS check and production build passed, npm audit **0 reported vulnerabilities** at inspection, HTTP smoke passed with actual read-only public GitHub Actions and PR API responses.

Additional actual Chromium **375px** fixture test using intercepted API GETs:

| Scenario | Outcome |
| --- | --- |
| Two independent receipts after verified initial Actions and PR responses | Both show own receipt times |
| Refresh Actions only | Exactly **one** extra Actions request; PR receipt still present |
| Actions 503 after successful PR response | Partial-data banner; Actions receipt becomes unverified, PR receipt stays verified |
| Retry Actions only after 503 | Exactly **one** further Actions request, no PR re-fetch |
| Select `example/old` with delayed Actions/PR calls then immediately select `example/new` | New repository loads; late old responses cannot replace its verified records |
| Browser JS console exceptions | **0** |
| axe WCAG 2/2.1 A/AA violations | **0** |

These are **deterministic browser fixtures**, not statistics for `example/old`, `example/new` or the user's production repository. Fixture test observed **9 total controlled GETs** over the initial load, two manual Actions refresh/retry calls and two repository changes; there were **no unexpected extra calls**. No production/Preview requests were made by the browser fixture and no shared Upstash quota stress occurred.

## Not yet addressed

Q-03 origin HTTP error matrix and Q-04 long-label/zoom/cross-browser QA are separate backlog tasks. Human NVDA/VoiceOver and actual mobile-device signoff remain open under #5; real Vercel Redis independent-instance confirmation remains open under #7. This branch does **not** deploy or change env/secrets/quota/security policy.
