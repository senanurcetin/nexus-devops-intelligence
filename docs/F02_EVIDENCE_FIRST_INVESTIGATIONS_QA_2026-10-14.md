# F-02 — evidence-first investigation workflow QA

**Date:** 14 October 2026 · **Status:** code and local manual checks completed; **not deployed** to current Preview or Production.

## Intended product behavior

Each item in the existing top-five deterministic investigation queue now shows separately:
- **Provenance:** `PR #number · GitHub REST` or `Actions run #id · GitHub REST` and the original canonical GitHub record link.
- **Reported signal:** original GitHub-sourced merge-state bucket or completed workflow conclusion (never a fabricated check or review outcome).
- **Reason for triage severity:** `high` only for reported conflict / completed workflow failure; `medium` for blocked, unstable or behind; `info` for an unverified status, explicitly **not** a confirmed blocker.
- **Next verification action:** inspect source PR discussion/branch rules/checks or original Actions run logs. No root-cause diagnosis, remediation commit or merge approval is implied.
- **Source actions:** keyboard-operable **Review source** in a new secure tab, plus **Copy link** via supported secure Clipboard API. On successful copy the UI confirms it; if clipboard access is unavailable or denied it displays an accurate fallback instructing the user to use the original source link. There is **no** legacy `execCommand` fallback, token access or extra network call.

The recommendation function also checks that each source link matches the canonical GitHub URL for the returned repository and record ID before producing an actionable recommendation. The existing stable high→medium→info, max-five ordering is retained, with no API schema changes or new dependencies.

## CI-free manual verification

Disposable Vercel Sandbox, exact feature branch checked out, Node 24.

| Check | Result |
| --- | --- |
| `npm ci` / `npm test` | **149/149** Node tests passed (5 new F-02 provenance/copy regression tests) |
| `npm run typecheck` / `npm run build` | Passed |
| `npm run inspect:budget` | Six page JS chunks; **412,006 raw / 120,368 gzip** bytes under **537,600 / 163,840** review caps |
| `npm audit --json` | **0 findings at check** |
| `npm run smoke:http` | Local production server security and invalid-input controls; bounded public GitHub read-only Actions/PR samples passed |
| Real Chromium **375px** | Four source-backed recommendations; priorities high/high/medium/info; evidence reason/next step visible; canonical PR GitHub link copied to **actual browser clipboard** and read back exactly |
| Chromium **375px**, clipboard permission rejected fixture | Accurate **Clipboard unavailable** message instead of a false success; original secure GitHub record link remains |
| Real Chromium **1280px** | Clipboard write/read, focus and queue checks passed |
| All three Chromium runs | Two intercepted initial NEXUS panel GETs; **zero additional** API calls for copying or reviewing the DOM, zero uncaught JS exceptions, zero page horizontal overflow, keyboard-visible focus, zero axe WCAG 2/2.1 A/AA violations (27–28 passed rules) |

Browser sources were **controlled fixtures**. They are not a claim about live GitHub PR status or the actual SSO-protected Preview. GitHub API smoke was separate local read-only public API access and **not** a live Vercel Redis quota test.

**Harness correction:** The first Node test failed solely because the structural assertion mistakenly expected a chained optional Clipboard API call. The production code correctly checks `navigator.clipboard?.writeText` before invoking `navigator.clipboard.writeText(url)`. The assertion was corrected, after which all 149 tests and the three Chromium scenarios passed.

## Release boundaries

No GitHub Actions/CircleCI, paid feature, dependency change, preview or production redeploy, WAF or SSO change, live shared Upstash quota load, secret access, browser SSO bypass or GitHub write API call. Current protected Preview deployment **`dpl_Beyxk5vGuDcvx5XDD4gVdsbUX9tg`** remains on immutable app source **`599ced7`**, and Production **`dpl_9fXGATNHhyhNVrN1i47k3BU4u5K5`** on old **`74cd0e3`**. Neither presently displays F-01/F-02 until independently approved, pinned-SHA redeployment.

Human authenticated Preview design acceptance (R-04), screen-reader/physical-device/Safari (R-05) and live independent Vercel multi-instance Redis acceptance ([issue #7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7)) remain unverified. Owner deferred further screenshot collection.
