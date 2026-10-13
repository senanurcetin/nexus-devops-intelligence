# Manual Firefox cross-browser and accessibility regression

**Date:** 13 October 2026  
**Project:** `senanurcetin/nexus-devops-intelligence`  
**Tested code:** Next.js security-header branch `d5409874db7d72d4e21ef356496bb1136ce81a1a`, subsequently squash merged in [PR #9](https://github.com/senanurcetin/nexus-devops-intelligence/pull/9).  
**Execution:** A short-lived Vercel Sandbox with Node.js 24, on a locally started `next start` HTTP server. No GitHub Actions, CircleCI or public Vercel deployment.

## Browser environment

- **Firefox 157.0**, Playwright's Firefox build 1555, from `playwright-core@1.64.0`.
- `axe-core@4.11.0` injected into the temporary test browser.
- Linux browser dependencies installed in the **temporary** Vercel Sandbox.
- Neither Playwright nor axe-core was added to `package.json` or `package-lock.json`.
- Both public API endpoints were intercepted with controlled HTTP 503 JSON errors for deterministic UI checks. **This is not a live GitHub API test.** Real API HTTP smoke results are recorded separately.

## Verified results

| Check | 375px | 768px | 1440px |
| --- | --- | --- | --- |
| Homepage HTTP status | 200 | 200 | 200 |
| Document horizontal overflow | None | None | None |
| Semantic landmarks | 1 `main`, 1 `h1` | 1 `main`, 1 `h1` | 1 `main`, 1 `h1` |
| Invalid GitHub repo form | Expected `owner/repository` warning | Pass | Pass |
| Tab navigation to Analyze button | Pass | Pass | Pass |
| Keyboard focus outline | Solid | Solid | Solid |
| Uncaught JavaScript page errors | 0 | 0 | 0 |
| axe-core WCAG 2/2.1 A/AA reported violations | **0** | **0** | **0** |
| axe-core rules passed | 24 | 24 | 24 |

The firewall's rate-limit behavior was not tested here; an HTML 429 browser interaction was already covered in [independent-panel QA](independent-panel-qa-2026-10-13.md) on Chromium.

## Limitations

- An automated axe scan is **not** a complete WCAG compliance audit.
- Human NVDA/VoiceOver screen-reader verification and a comprehensive keyboard-only journey are still open.
- Safari/WebKit was not tested in this run.
- No production or public preview URL exists yet, so deployment-level routing/protection/WAF behavior cannot be inferred.
- WAF rule activation and cost review remain blocked by [issue #7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7).

## Reproduction guidance

In an authorized temporary Linux cloud environment using an already-built checkout:

1. Install Firefox-compatible OS libraries for the Vercel image.
2. Install Playwright Core and axe-core only in the temporary sandbox (do not commit new runtime dependencies).
3. Download the Playwright-managed Firefox engine.
4. Start `npm run start` separately on localhost.
5. Use `firefox.launch({headless:true})`, simulate HTTP 503 at `**/api/public-*`, verify the three viewport sizes, keyboard Tab focus and run `axe.run(document)` with WCAG 2/2.1 A/AA tags.
6. Stop the sandbox promptly to avoid lingering cloud usage.

Do not run GitHub Actions or CircleCI for this procedure.
