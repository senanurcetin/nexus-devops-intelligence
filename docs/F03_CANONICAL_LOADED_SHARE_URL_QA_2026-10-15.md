# F03 — Canonicalize loaded repository share URLs

**Date:** 2026-10-15 · **Repository:** `senanurcetin/nexus-devops-intelligence` only.
**Executable source SHA tested:** `4c41eb7c2ab601916fe7707fce510012ed0f3a5a`.
**Outcome:** SOURCE/OFFLINE PASS; protected Preview G04 and real G05/G06 release acceptance remain OPEN.

## Real source-level issue

F03 created clean share links (`?repo=owner%2Frepo`) when copied or manually submitted, but on initial hydration and Back/Forward the existing `readRepositoryLink` deliberately accepted extra URL query parameters. Opening `/?repo=owner%2Frepo&api_token=PRIVATE#fragment` selected the correct public repo **while leaving unrelated parameters in the current address/history entry**. Invalid shared links could also retain untrusted query fields. Such fields are unnecessary for the NEXUS public-repo-only UI and retaining credential-shaped text is a privacy/copying risk. This does **not** establish credential exfiltration or indicate that previously served URLs/remote server logs can be retroactively scrubbed.

## Implemented safely

- Added pure `canonicalRepositoryPageUrl(currentUrl, parsedSelection)` accepting only an HTTP(S) URL without userinfo and preserving only one canonical public `repo` for a validated selection; for invalid/absent selection, remove query and fragment entirely.
- During existing `syncLocation`, compare the canonical URL to `window.location.href` and call `window.history.replaceState` **only if different**, before continuing normal repo validation/hydration. No navigation, reload, additional API GET, new GitHub or Redis admission, analytics or dependencies.
- An invalid duplicate repo remains INVALID in UI state (and is not automatically default-selected), even after URL cleanup; absence of repo retains the existing default selection logic.
- Canonicalization is idempotent; URL query keys and fragment are scrubbed from the current browser history entry. This cannot erase an already received HTTP request's server log or rewrite older history entries, and is not evidence of live SSO protection.

## Exact-source QA

| QA | Result |
| --- | --- |
| `npm test` | **232/232 PASS** (two new F03 pure helper tests) |
| Focused F03 link tests | **8/8 PASS** |
| TypeScript, Next.js production build, JS bundle budget | **PASS** |
| Compiled localhost HTTP invalid-input smoke | **16/16 PASS** |
| Real Chromium with local intercepted fixture API | **14/14 PASS** |
| Real Firefox with local intercepted fixture API | **14/14 PASS** |
| npm audit | **0** reported vulnerabilities |
| Current-source 14th WebKit scenario | **NOT RUN** on this SHA; prior 11/11 belongs to earlier code |

Three new browser paths: (a) a valid `repo` with extra `api_token`, query fields and fragment is reduced to **only** `?repo=owner%2Fone` and incurs exactly 2 intercepted initial panel GETs; (b) absent repo with untrusted `token` selects the existing default repository, strips the query completely and makes only 2 expected initial panel GETs; (c) invalid duplicate repo with token and fragment keeps the invalid UI alert while cleaning the URL and makes **zero** API GETs. All browsers report 0 external origins, 0 page errors and 0 automated axe violations. These are localhost/fixture tests only, not real Safari, GitHub or Upstash traffic.

## Release boundary

Previous SSO-protected Preview deployment remains on application SHA `2b5fb7c379bd1f939f3b50f286edfb868ddb386a`; Production remains `74cd0e344eb94255b4bc8db99e4a4dc7f3a5a0bf`. This source change is not deployed. G04 authenticated F01–F05 latest-source Preview remains blocked by previous platform safety control; G05 human VoiceOver/NVDA and current WebKit full suite OPEN; G06 two real independent Vercel Redis instance provenance and authentic Redis 429 OPEN; G07 Production separately authorized only after relevant acceptance gates. No SSO bypass, hosted CI, paid usage, Redis stress or live traffic.

**Result:** current-entry URL retention/canonicalization issue solved for repository share hydration. Not a full release-G04 PASS.