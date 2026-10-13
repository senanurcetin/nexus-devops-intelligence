# Q-04 — long-source-label reflow and zoom QA

**Date:** 13 October 2026 · **Scope:** NEXUS DevOps Intelligence's local Next.js production dashboard, no Vercel Preview/Production deployment.

## Concrete defect

Real Chromium reproduced a serious horizontal overflow with *valid-looking, bounded source fixtures*: PR title (up to 300 characters, unbroken), workflow run names (up to 2,000 characters) and recommendation explanations could introduce **over 2,000 px** of unwanted document width on 320/375/768/1280 CSS-pixel viewports. The Actions evidence list additionally used `truncate` on important workflow names without an expanded visible alternative.

## Code changes

- Preserve the **complete visible** Actions run name (remove ellipsis/clipped `truncate`) and apply `overflow-wrap:anywhere` only as necessary to source-derived titles, recommendations, cards and narrow evidence wrappers.
- Permit Action row status/source controls and evidence header links to wrap rather than insisting on an inflexible width.
- Replace five/ten fixed-column source tile layouts with **auto-fit** responsive columns based on available width and text-size-driven `3rem` minimum, preserving all source-linked run and PR tiles.
- Bound small-screen inner padding under text-only zoom, and prevent the investigation heading, status pills and hero content from forcing an intrinsic page width. Preserve sticky navigation as an **independently scrollable** strip where its links exceed narrow width; horizontal scrolling of the navigation **is intentional** and is not document overflow.
- Keep existing native link behavior, GitHub source URLs, legend/counter truth, reduced-motion semantics, and high-contrast keyboard focus.

## Reproducible manual QA

Ran in two short-lived **CI-free, disposable Vercel Sandboxes** with Node 24 and locally served Next.js production builds. Fixtures were intercepted in the Chromium browser before any NEXUS API request reached its server. All 10 workflow rows, five PR rows and investigation cards used deliberately long/unbroken text. They are **synthetic QA stress text**, **not real GitHub activity data**. Actual GitHub HTTP smoke was a separate, read-only validation.

| Check | Observed result |
| --- | --- |
| Chromium **320, 375, 768, 1280, 1440 CSS px**, regular text | **0 document horizontal overflow**, 15 source-linked tiles, all 15 source titles present, 0 uncorrected clipping, 0 browser errors |
| Chromium **320 CSS px with 32px root font** (200% text-only stress) | **0 horizontal overflow**, same 15 links, visible keyboard focus, 0 axe WCAG A/AA issues |
| Chromium **1280 CSS px with 64px root font** (400% text-only stress) | **0 horizontal overflow**, same 15 links, visible keyboard focus, 0 axe WCAG A/AA issues |
| **320 CSS px** layout, normal font | Serves as a layout-width proxy for 400% browser zoom from 1280 physical px; does **not** prove identical native browser zoom behavior |
| Native keyboard focus | `focus-visible` and solid outline on in-page navigation; no JS navigation handler required |
| Reduced motion | Browser `prefers-reduced-motion:reduce` respected; link transition measured at practically zero duration |
| API cost | Exactly **2 initial intercepted API fixture GETs**, **0** extra calls for focus, scrolling or DOM inspection |
| axe-core automated WCAG 2/2.1 A/AA | **0 violations** in the above tested scenarios (27–28 passed rules depending on viewport) |
| `npm test` | **132/132 passed**, including 3 new source/zoom regression guards |
| TypeScript/build/audit | Typecheck and Next production build passed; `npm audit` reported **0 findings** at inspection |
| `npm run smoke:http` | Local security headers and invalid inputs passed, actual public GitHub Actions/PR sample read-only checks passed |

**Additional extreme combination remains unaccepted:** 320 CSS px **plus** 64px root font (400% text-only zoom **on top of** an already 320 CSS-px page) still showed overflow in stress testing; this is a substantially more severe setup than a standard 400% desktop browser zoom and is **not** claimed as passing. The very large full-page rendering also exhausted a temporary Chromium test session; normal-width browser testing was subsequently repeated successfully in a new sandbox. Track this and physical-device visual acceptance rather than marking universal zoom support complete.

**Not tested:** Firefox / WebKit engine behavior, NVDA/VoiceOver and a real iOS/Android device. Automated Chromium and axe do not substitute for independent human acceptance. Keep [#5](https://github.com/senanurcetin/nexus-devops-intelligence/issues/5) open.

## Restrictions

No hosted GitHub Actions/CircleCI, Git auto-deploy, paid feature, Upstash quota stress, real Preview/Production requests or changes to Redis/SSO/production security. A GitHub merge does not publish the fix. [Issue #7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7) remains open independently.
