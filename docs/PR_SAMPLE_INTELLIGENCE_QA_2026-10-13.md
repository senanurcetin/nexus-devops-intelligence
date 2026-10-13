# PR Intelligence — five-state sampled merge evidence QA (13 October 2026)

## Scope and correctness

The NEXUS dashboard renders an **evidence-only open PR sample landscape** based exclusively on the existing validated `/api/public-prs` JSON. It does not infer a full repository risk score, CI success, merge approval or human review status.

- **Maximum sample size: 5 recently listed open PRs**. The `more_open_prs` signal is displayed; visual percentages use only `inspected_prs > 0`, never a full-repository denominator.
- Five mutually exclusive source-derived statuses: **reported conflicts** (`conflict`), **restrictions/checks** (`blocked`, `behind`, `unstable`), **unverified** (`unknown`), **clean reported by GitHub** (`clear`), and **draft** (`draft`). Unknown and draft do not become confirmed blockers; clean is **not** approval.
- Responsive segmented composition bar has a complete accessible `role=img` description with each count; adjacent number/percent labels provide a visible text alternative. Five source-linked ordered PR tiles open GitHub evidence, without an arbitrary trend timeline.
- The original PR evidence list has **All / Conflicts / Restrictions / Unverified / Clean / Drafts** buttons with `aria-pressed`, keyboard support, a live match count and a truthful no-match fallback. Filter changes do **not** issue additional GitHub or Redis calls, change the underlying validated source, or remove entries from the full-sample suggestion list.
- Error, loading and empty states do not show a misleading distribution.

## CI-free manual results

Temporary Vercel Sandbox, Node 24, no Preview or Production env secrets:

| Check | Result |
| --- | --- |
| `npm ci`, `npm test` | **117/117 successful**, including 6 new PR bucket/filter tests |
| `npm run typecheck`, `npm run build` | Successful |
| `npm audit --json` | 0 reported findings at test time |
| `npm run smoke:http` | Homepage and both invalid-input endpoint checks passed; read-only public GitHub sample endpoints passed |
| Chromium 375 / 768 / 1440px | Five distinct PR statuses; 5 source links; composition aria-label and counts; keyboard Enter for Conflicts; Restrictions / Clean / Drafts / All filter switching |
| Network behavior on filters | **2 initial intercepted GETs only**, zero additional requests on filter updates |
| 375px empty and PR API 503 fixtures | No distribution, no invented percentages; accurate empty/unavailable guidance |
| Horizontal overflow / JS exceptions | **None** in tested scenarios |
| axe-core WCAG 2/2.1 A/AA | **0 automated violations**; 27 passed checks in populated state per viewport, 25 in empty/error state |

The browser intercepts used deterministic **test fixtures** (1 conflict, 1 blocked, 1 unknown, 1 clean, 1 draft) solely for UI coverage. They are **not live GitHub repo PR statistics**. Manual browser screenshots were produced inside the temporary sandbox; screenshot generation is not a human visual or NVDA/VoiceOver signoff.

## Restrictions and remaining gates

- **No hosted CI** (no GitHub Actions/CircleCI), no new dependencies, no paid services, no Upstash quota/load probe, no Vercel Preview or Production deployment.
- The shared Redis Free database is **not** live-load-tested at the owner's request. Issue [#7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7) remains open; local two-process real-Redis testing and a single live Preview Redis-mode preflight are not proof of independent Vercel serverless instance enforcement.
- Human screen-reader, real-device and editorial visual acceptance remain open in issue [#5](https://github.com/senanurcetin/nexus-devops-intelligence/issues/5). A PR merge will not deploy the changes because Git deployment is disabled.
