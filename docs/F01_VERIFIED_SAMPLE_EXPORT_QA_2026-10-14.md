# F-01 — verified sample CSV/JSON export QA

**Date:** 14 October 2026 · **Scope:** NEXUS DevOps Intelligence. **GitHub code-only**; no protected Preview or Production redeployment.

## Feature and data contract

Two accessible browser-only actions — **Export CSV** and **Export JSON** — download the currently visible, filtered results of the validated public GitHub samples. No new endpoint or backend API was added.

- Actions sample: **maximum 10** recently inspected public workflow runs. PR sample: **maximum 5** recently inspected open PRs. The export identifies the repository, public GitHub REST source, sample limits, source receipt timestamps (**UTC ISO 8601**) and the currently applied Actions/PR filters. It records separately how many items were *inspected* and how many are *exported*. A full-history audit, CI conclusion, or merge approval is **not** inferred.
- Each source must already pass `isPublicActionsSample` / `isPublicPullSample` for the currently selected repository. If one panel fails, it is omitted **entirely** (represented as `null` in JSON), while the verified sibling can still export. If both fail or have not loaded, the download controls are disabled. A verified zero-row sample remains exportable with accurate **zero-row metadata**.
- The browser receipt timestamps are stored as UTC instants (instead of locale-only display strings); UI continues rendering local clock time for the user. The file includes separate `actions.received_at_utc`, `pull_requests.received_at_utc`, and `exported_at_utc`; these are **response/download times**, not original GitHub event timestamps.
- JSON contains only explicit, verified public fields and does not spread arbitrary unknown response properties. CSV has a fixed column schema, source metadata rows (including zero-record selections), and precisely the **filtered** records; it is UTF-8 BOM-prefixed for common spreadsheet import support.
- CSV rows are always quoted, inner quotes doubled; C0/C1 control characters and bidi formatting controls are neutralized. Strings with leading spreadsheet formula characters (`=`, `+`, `-`, `@`), even after leading spaces, are prefixed with a literal apostrophe to prevent formula interpretation. Filenames use only validated `owner/repo` plus UTC seconds and the requested extension.
- Controls work entirely on existing React state via `Blob`, `URL.createObjectURL` and a temporary download anchor; object URLs are later revoked. Selecting a filter or downloading **does not** contact either NEXUS API, GitHub, Redis, or Vercel.

## Manual CI-free validation (disposable Vercel Sandbox)

| Check | Actual result |
| --- | --- |
| `npm ci` and `npm test` | **144/144 passed** (9 new export safety/metadata tests) |
| `npm run typecheck` | Passed |
| `npm run build` | Passed |
| `npm run inspect:budget` | `/page` 6 JS chunks, **407,837 raw / 119,283 gzip** bytes. Below existing caps **537,600 raw / 163,840 gzip**. Difference vs Q-05 baseline: **+6,596 raw / +1,851 gzip** bytes |
| `npm audit --json` | **0 vulnerabilities at inspection time** |
| `npm run smoke:http` | Local production server security/invalid-input tests passed, public GitHub Actions/PR read-only samples passed |
| Chromium 143, **375px**, populated fixture | Native download events produced real .json and .csv files; JSON had one failed workflow and one conflict PR matching applied filters, exact metadata and sample limits; CSV contained sanitized `+cmd` title and excluded filtered-out `=HYPERLINK` item |
| Chromium 143, **375px**, partial API 503 fixture | JSON omits failed Actions source (`null`), exports validated PR source; CSV has PR metadata but no Actions metadata |
| Chromium 143, **375px**, verified empty fixture | JSON has two empty record arrays with inspected=0; CSV has header + two zero-row metadata lines |
| Chromium 143, **375px**, both sources HTTP 503 | Both export buttons disabled and no download emitted |
| All four browser scenarios | Exactly **2 intercepted initial local API GETs**, **0 extra calls** for filtering/downloading; **0 JS exceptions**, **0 document overflow**, **0 automated axe WCAG 2/2.1 A/AA violations** (26–28 passing automated checks per fixture) |

Browser fixtures were deterministic, client-intercepted data; their fake titles, run statuses and PR conflicts are **not** live statistics about the default GitHub repository. Browser scenarios used separate Chromium processes after a multi-scenario shared process closed following the first test; that shutdown is not evidence of an application error. Two additional harness corrections (GitHub `clear` source state vs `clean` visual bucket, and ISO fixture timestamp pinned to a local date) were made during testing before reporting the passing runs.

## Safety and remaining acceptance

- No GitHub Actions, CircleCI, auto-deployment, paid service, new runtime dependency, server route, credential access, live shared Upstash command/load, actual protected Preview GET, or Production deployment.
- This feature is merged to GitHub only once reviewed; **the existing READY protected Preview at `599ced7` and older Production at `74cd0e3` do not contain the new export feature**. Deployments remain subject to separate exact-SHA owner authorization.
- Real protected Preview UI/functional acceptance remains open under R-04 (previous legacy screenshot is **not** acceptance of the current protected Preview), and human Safari/VoiceOver/NVDA/device acceptance is not proven. Redis independent Vercel cross-instance issue [#7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7) stays OPEN; user specifically declined stressing the shared Upstash Free quota.
