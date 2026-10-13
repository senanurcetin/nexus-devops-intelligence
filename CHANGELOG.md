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
- No GitHub Actions or CircleCI jobs were configured or run.

**Not yet released:** Platform-wide rate limiting, final manual cross-browser/screen-reader review and public preview deployment remain pending.
