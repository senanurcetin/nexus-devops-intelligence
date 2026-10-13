# Changelog

## Unreleased — 13 October 2026

- Established a standalone public Next.js repository independent from Ops-Copilot.
- Implemented bounded anonymous read-only GitHub Actions and PR APIs, and evidence-linked investigation recommendations.
- Committed `package-lock.json`; verified a clean cloud installation using `npm ci`.
- Passed 24 unit tests, the full TypeScript check and Next.js 15.5.9 production build in a temporary Vercel sandbox.
- Added `npm run smoke:http`; the homepage, malformed repository errors and live public GitHub samples passed.
- GitHub HTTP 403 with `x-ratelimit-remaining: 0` is correctly categorized as rate-limited.
- Added Next.js route-handler integration tests and process-local request deduplication/limiting; manually verified 33 tests and production build.
- Upgraded Next.js to 15.5.27, overrode PostCSS 8.5.30 and Sharp 0.35.5, and committed the exact npm-generated lockfile.
- Clean `npm ci` and `npm audit --omit=dev --json` passed; **zero production audit findings** on 13 October 2026.
- Resolved security tracking issue #2 in PR #3.
- Migrated dashboard to Tailwind CSS 4.3.3 and `@tailwindcss/postcss`, removed legacy Tailwind 3 config and Autoprefixer.
- Full npm audit (production + development) found zero vulnerabilities at time checked; 33 tests, typecheck and build passed with the committed lockfile.
- Raised secondary-text contrast: axe-core WCAG 2/2.1 A/AA automated checks reported zero violations at 375px and 1440px after correction; Chromium mobile/tablet/desktop responsive checks passed.
- Manually checked rapid repository switching, stale responses, independent API error panels, keyboard search focus and the public read-only HTTP endpoints.
- **Remaining release gates:** platform-wide rate limiting via Vercel WAF and final preview/manual accessibility review. This repository has not been publicly deployed.
- In [PR #8](https://github.com/senanurcetin/nexus-devops-intelligence/pull/8), independently settled Actions and PR panels, added accessible loading status announcements and safe non-JSON WAF 429 handling.
- Six new regression tests: **39/39 total passed**. Full manual npm audit: 0 findings. Chromium at 375/768/1440 and axe-core WCAG A/AA: 0 reported automated violations in tested error states.
- In [PR #9](https://github.com/senanurcetin/nexus-devops-intelligence/pull/9), added Next.js response security headers and corresponding HTTP/Node regression checks.
- **41/41 tests**, full TypeScript check, production build and manual live API smoke passed with the new headers. Full npm audit showed 0 findings at verification time.
- The limited CSP prevents framing, objects and unsafe base URLs; it is not a full script/style CSP and does not replace Vercel WAF rate limiting.
- Added a second browser-engine validation using Firefox 157.0 at 375/768/1440px; no horizontal overflow, failed forms or page JS errors. axe-core WCAG A/AA: 0 automated violations in the controlled error-state flow. Human screen-reader and WebKit coverage remain open.
- [PR #10](https://github.com/senanurcetin/nexus-devops-intelligence/pull/10) corrected workflow outcome classification and evidence-based failed-run suggestions; four new tests bring the manually verified suite to **45/45**. TypeScript, Next production build and real public API smoke passed.
- Added a third browser engine, **Playwright WebKit 27.2**, at 375/768/1440 px. No overflow, uncaught JS errors, failed invalid-repo validation or keyboard focus issues; axe-core WCAG A/AA: 0 automated violations in controlled API-error states.
- Browser testing does not substitute for human screen-reader and real-device review. Platform-wide WAF protection and public preview remain outstanding.
- [PR #11](https://github.com/senanurcetin/nexus-devops-intelligence/pull/11) handles GitHub secondary rate-limit 403 responses, including Retry-After and documented error messages, without retries; ordinary access-denied responses stay restricted.
- Three offline API regressions bring the manual suite to **48/48**; production build, TypeScript, full npm audit and real GitHub HTTP smoke passed in a temporary cloud sandbox.
- Added [human screen-reader acceptance checklist](docs/MANUAL_ACCESSIBILITY_ACCEPTANCE.md). Actual NVDA/VoiceOver verification and real screenshot artifact upload remain pending; the latter was blocked by secure file-transfer controls.
- [PR #12](https://github.com/senanurcetin/nexus-devops-intelligence/pull/12) forwards safely validated 1–3600s Retry-After hints through both public APIs and the dashboard. Invalid/oversized headers are discarded, 429s remain no-store, and no automatic retries are introduced.
- Nine offline regressions bring the suite to **57/57 passed**; manual clean install, TypeScript, production build, full npm audit (0 findings), and real-data localhost HTTP smoke passed.
- [PR #13](https://github.com/senanurcetin/nexus-devops-intelligence/pull/13) validates repository inputs before the process-local request gate, preserving 400/no-store under saturation and 503/no-store for legitimate overload.
- Two new Next.js route regression tests: **59/59 manually verified**, TypeScript/build/audit and production HTTP checks passed.
- [PR #14](https://github.com/senanurcetin/nexus-devops-intelligence/pull/14) adds accessible independent refresh for read-only Actions and PR panels, per-panel loading states and stale repository response cancellation. Manual Chromium 375/1440px mock-error/regression checks and axe WCAG A/AA scans passed with zero automated violations; full 59-test suite, build, typecheck and npm audit passed.
- [PR #15](https://github.com/senanurcetin/nexus-devops-intelligence/pull/15) fixes hidden GitHub rate limiting on PR detail fetches: any detail 403/429 rate limit returns 429/no-store instead of misleading HTTP 200, using the longest validated Retry-After across affected details. Non-rate-limit failures remain unknown.
- **64/64 manually verified tests**, full TypeScript check and production build passed; full npm audit showed 0 findings at the time checked. Real public Actions/PR localhost HTTP smoke passed. No CI or deployment.
- [PR #16](https://github.com/senanurcetin/nexus-devops-intelligence/pull/16) limits PR-detail GETs to two concurrent calls, skips unscheduled detail requests once any quota failure is observed, and keeps the longest safe Retry-After from requests already in flight. Three new regression tests bring the manually verified suite to **67/67**; TypeScript, build, full audit and live HTTP smoke passed.
- [PR #17](https://github.com/senanurcetin/nexus-devops-intelligence/pull/17) adds accessible, request-scoped slow PR feedback after 2.5 seconds, clearing on completion or repository switches with no extra GitHub requests. Manual Chromium 375/1440px slow-response/race QA, axe A/AA (0 violations), 67/67 tests, full build/audit and real HTTP smoke passed. Controlled five-PR fixture measured 243ms/482ms at simulated 80ms/160ms detail delays.
- [PR #19](https://github.com/senanurcetin/nexus-devops-intelligence/pull/19) adds a zero-dependency, Vercel-only **per-instance** 20/60s public API throttle, secure edge-IP source selection, bounded hashed bucket storage and safe local 429 responses before GitHub calls. Six new regressions; **73/73** tests, TypeScript, production build, full npm audit (0 findings) and real HTTP smoke manually passed. This is not a cross-instance limiter and does not close the WAF gate.
- [PR #20](https://github.com/senanurcetin/nexus-devops-intelligence/pull/20) unifies equivalent expanded/compressed IPv6 and IPv4-mapped IPv6 source addresses in the existing Hobby local rate-limiter key. Three new tests bring the manually verified suite to **76/76**; TypeScript, production build, npm audit (0 findings), and real GitHub HTTP smoke passed. Platform-wide edge WAF is still not enforced.
- No GitHub Actions or CircleCI jobs were configured or run.

**Not yet released:** Platform-wide rate limiting, final manual cross-browser/screen-reader review and public preview deployment remain pending.
