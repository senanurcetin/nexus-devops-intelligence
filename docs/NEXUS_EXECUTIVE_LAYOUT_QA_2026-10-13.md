# NEXUS executive dashboard redesign — manual QC (13 October 2026)

## Design rationale

The prior dashboard presented **two full-width analysis sections** followed by a long source-record list, with the actionable investigation suggestions below everything. Readers could not jump between analysis, source evidence and investigation queue without manually scrolling. Four equal-looking KPIs and unstructured section separators weakened visual priority.

This design package **changes information hierarchy, not source truth or API policy**:

1. The top executive masthead now explains the sampled, public, read-only product clearly: source-backed engineering signals and a compact visible scope ribbon. No fake trends, live status claims, private account access, reliability scores, or AI diagnoses.
2. A sticky **four-anchor, JavaScript-free dashboard index** (Overview / Intelligence / Investigations / Source records) provides native keyboard and screen-reader navigation without GitHub or Redis requests. The selected repository label is shown on larger viewports. Horizontal navigation scrolls within its own bar on narrow viewports, with no document overflow; motion reduction and anchor scroll offsets are respected.
3. Four KPIs receive intentional typography, numbering and consistent evidence colors. The warning KPI is visually distinct but still tied solely to `needs_attention`, not a speculative severity score.
4. Actions and PR source-backed composition panels form **one dual-column intelligence bay** on desktops at 1100px+ and a full-width vertical sequence on tablets and phones. The previous independently verified charts, exact links, filters, loading/error messages and capped sample constraints are unchanged.
5. The **prioritized suggested investigations** queue now appears immediately after the intelligence bay and **before** the longer source-record lists. Items are visibly labeled `high` / `medium` / `info` based exclusively on the existing deterministic evidence recommendation engine; high priority does not mean GitHub has confirmed an exploit or root cause.
6. Source record panels and native per-panel refresh controls remain accessible below, along with the honest source/sample limitations. No new API calls, dependencies, features requiring payment or changes to Redis/SSO/deployment configuration.

## CI-free test evidence

The PR head was manually checked in a temporary, disposable **Vercel Sandbox** with a production build served locally:

| Check | Result |
| --- | --- |
| `npm ci`, `npm test` | **121 / 121 passed**, including **4 new hierarchy/navigation regression tests** |
| `npm run typecheck`, `npm run build` | Both succeeded, production bundle built |
| `npm audit --json` | **0 vulnerabilities reported at test time** |
| `npm run smoke:http` | Home security headers, both invalid-input guards and real public GitHub Actions/PR read-only samples passed |
| Chromium fixture responsive geometry | **320 / 375 / 768 / 1280 / 1440 / 1920px** passed |
| Paired intelligence layout | Actions/PR panels **stack at 320/375/768**, align in **two columns at 1280/1440/1920** |
| Section order | Overview → Intelligence → Investigations → Source records at every tested viewport |
| Keyboard/native navigation | In-page Investigations anchor sets URL fragment and scrolls to target below the sticky navigation (target top approx **70px mobile**, **95px tablet/desktop**) |
| Interactions and API conservation | Exactly **2 browser-intercepted initial source GETs**, navigation and PR filtering cause **0 additional GETs** |
| Provenance and prioritization | Controlled sample produces 2 high-priority and 2 other investigation suggestions, correctly placed before full raw record lists |
| Empty and total-source-error states | Tested at 375px; no fabricated source metrics or recommendations; error messaging and recovery retained |
| JS exceptions/document horizontal overflow | **None**, including the 320px narrow viewport |
| axe-core automated WCAG 2/2.1 A/AA | **0 automated violations**; 28 passed checks at 320/375px populated case, 27 at 768px+, 26 at 375px empty/error |

The browser provided **controlled, local fixture JSON** representing five workflow runs and five open PRs. These invented fixture outcomes were **not** claimed to describe the actual default repository; independent `npm run smoke:http` used live read-only GitHub data. Browser screenshots were recorded in the disposable sandbox; DOM geometry, interaction and automated accessibility were checked. **Neither screenshots nor axe replace human visual review, real-device verification or NVDA/VoiceOver acceptance.**

## Delivery and release boundaries

- No GitHub Actions, CircleCI, automatic deployment, paid features or shared Upstash Free quota load test.
- The user confirmed Preview and Production share the same Redis Free budget. This package **did not contact either deployed NEXUS environment** and accessed no protected credentials.
- Merging the PR **does not deploy** a new Vercel Preview or Production build (`git.deploymentEnabled: false` remains unchanged).
- **Issue #5** remains open for human screen-reader and device acceptance; **issue #7** remains open for live Vercel cross-instance Redis origin proof under a separately authorized, quota-conscious strategy.
