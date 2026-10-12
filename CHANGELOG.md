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
- No GitHub Actions or CircleCI jobs were configured or run.

**Not yet released:** Interactive browser accessibility checks, shared endpoint abuse controls and public deployment remain pending.
