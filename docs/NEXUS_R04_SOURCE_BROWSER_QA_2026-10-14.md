# R-04 — protected Preview candidate source: browser-engine regression QA

**Recorded:** 14 Oct 2026 · **Status:** **CI-free local cross-browser verification PASSED in tested cases; actual authenticated Preview visual/runtime acceptance still OPEN.**

## Immutable release provenance

The manually authorized SSO-configured Preview deployment **`dpl_Beyxk5vGuDcvx5XDD4gVdsbUX9tg`** is **READY** at [the unique protected Preview URL](https://nexus-devops-intelligence-qwftzbzic-senanurs-projects-102fb36c.vercel.app). Its Vercel source SHA is exactly **`599ced76605c25161b182b2d5bfbadbd091bfb53`**, `target:null` (Preview). Project `ssoProtection.enabled:true`, `all_except_custom_domains`; **both actual public Production aliases still point to OLD `dpl_9fXGATNHhyhNVrN1i47k3BU4u5K5` (`74cd0e3`)**. No SSO bypass was created.

For this audit a short-lived, isolated Node 24 Vercel Sandbox checked out the **same immutable `599ced7` source**, compiled Next.js locally via `npm ci` and `npm run build`, and served the **local** `next start` production bundle on `127.0.0.1:3000`. Initial local homepage returned **HTTP 200** with `X-Content-Type-Options:nosniff`, `X-Frame-Options:DENY`, and restrictive Referrer/Permissions headers. These are local-build observations, **not live SSO URL response assertions**.

## Deterministic test data and network safety

All tests intercepted `/api/public-actions` and `/api/public-prs` **inside Playwright** with deliberately long, unbroken synthetic workflow and PR strings and representative source links. Positive populated fixture: **10** recent workflow entries, **5** open PR entries; five source-backed merge-state categories; sample-only, no fake full-repository score. Error and empty fixtures were tested separately.

**Each tested browser session issued two intercepted initial API GETs.** Navigation, filters, keyboard focus and audit produced **zero additional requests**. No Vercel Preview/Production API origin was contacted, no live shared Upstash Free Redis command was issued, no quota-consuming stress test was attempted. Fixture source links were not clicked to navigate external sites.

## Results, 14 Oct — actual browser engines (not screenshots of SSO Preview)

| Engine / scenario | Verified result |
| --- | --- |
| Firefox **157.0**, **320 / 375 / 768 / 1280 CSS px**, long unbroken source text | **PASS**: no document horizontal overflow; 15 source-linked sample tiles and 15 full source title elements; correct Actions/PR filters, native jump navigation, visible keyboard focus |
| Chromium **143.0.7499.0**, **320 / 375 / 1280 CSS px** | **PASS**: same component checks; long source labels remain available |
| Firefox 375px, **empty** and **both API 503 error** fixtures | **PASS**: no speculative PR chart or investigation entries; 2 intercepted GETs |
| Chromium 375px, **empty** and **both API 503 error** fixtures | **PASS**: same safe fallback state; 2 intercepted GETs |
| Firefox 320px **32px root font** (200% text-only stress) | **PASS**, no horizontal overflow, focus visible and automated axe A/AA 0 violations |
| Firefox 1280px **64px root font** (400% text-only stress) | **PASS**, no horizontal overflow, focus visible and automated axe A/AA 0 violations |
| Chromium 320px **32px root font** | **PASS**, no horizontal overflow, focus visible and automated axe A/AA 0 violations |
| axe-core **4.11.0**, WCAG 2 / 2.1 A/AA in populated cases | **0 reported violations** at tested widths; 27–28 rules passed per scenario |
| Uncaught page JavaScript errors | **0** across completed populated width tests |
| Extra browser API requests on filter/anchor interaction | **0** |

**Browser-testing accuracy:** Two early manual test attempts failed because the test itself used non-existent Actions section IDs (`actions-title` / `runs-title` instead of actual `workflow-title`). A programmatic `focus()` after mouse interaction did not trigger `:focus-visible`, so keyboard input was inserted into the test before refocusing to exercise keyboard modality. These were harness errors; corrected tests passed. In a long single-process Chromium test batch, Chromium closed unexpectedly; each viewport was rerun in **separate browser processes**, with passing results. This is not evidence of a production browser crash, but automated QA should use independent sessions for resource-intensive axe/long-text fixtures.

**WebKit / Safari NOT VERIFIED:** Playwright WebKit failed to launch in the disposable Amazon Linux 2023 host due to missing WebKit-native libraries including GTK4, Vulkan, ICU `74`, GStreamer codecs and Flite. This platform provides ICU 67 from its standard repository. **Do not claim a WebKit test passed.** Older WebKit test reports in the repo cover significantly older NEXUS code and do not transfer to this current source SHA.

**Excluded combinations:** true native browser zoom 400% (as distinct from CSS viewport and root-font stress); unusually extreme combined **320 CSS px + 400% root font** (previous Q-04 identified overflow); macOS Safari/iOS real-device QA; NVDA/VoiceOver; human visual/editorial acceptance; authenticated protected Preview network/API responses and real connected Redis admission behavior.

## Sign-in protected Preview: required human acceptance checklist

With the account owner's legitimate Vercel SSO session, open [this exact deployment URL](https://nexus-devops-intelligence-qwftzbzic-senanurs-projects-102fb36c.vercel.app) rather than a mutable git-main helper alias.

1. Confirm NEXUS brand, four summary cards, Actions/PR Intelligence panels, investigation queue and GitHub source links visually at **375px mobile** and **1280–1440px desktop**; capture ordinary screenshots *without secret values*. Check text/spacing/chart balance and focus.
2. Verify the security boundary: the unique generated deployment URL is SSO-protected for signed-out viewers; **do not create a public SSO bypass**. Production should continue serving legacy `74cd0e3`.
3. If the owner explicitly approves a **very small live shared-Upstash API budget**, inspect real Actions and PR panel statuses without automated repetitions or burst probes. A `READY` deployment does not establish API success; every cache MISS can consume shared Free Redis quota. **Never run the 21-request test** without new, separately scoped authorization.
4. Complete actual keyboard, NVDA/VoiceOver, physical-device and Safari/WebKit checks using [SR-01…SR-12](MANUAL_ACCESSIBILITY_ACCEPTANCE.md). Although GitHub issue #5 is **closed**, the human checklist is **still unchecked**, so R-05 is **not accepted**.
5. Reconfirm the open [origin Redis multi-instance issue #7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7) and unknown Free headroom (R-02). Do not conflate local two-process Redis proof with independent deployed Vercel instances.

## Conclusion

- **Complete now:** candidate-matched local Next build and **Chromium+Firefox** long-text, filters, keyboard/anchor, viewport, empty/error and selected text-zoom regression tests.
- **Open:** full R-04 acceptance on the actual authenticated SSO-protected Preview; WebKit/Safari, real devices and human screen-reader/visual approvals; Free Redis headroom and cross-instance origin decision. **No Production release is authorized.**
