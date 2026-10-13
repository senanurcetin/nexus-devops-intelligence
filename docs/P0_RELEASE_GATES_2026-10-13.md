# NEXUS DevOps Intelligence — P0 verification and release gates

**Recorded:** 2026-10-13  
**Repository:** `senanurcetin/nexus-devops-intelligence`  
**UI PR:** #18, squash-merged to `main` at `97f2ebb08047d297cde94b63da3893123d19c2fe`.  
**Scope:** Public GitHub repositories; read-only anonymous API. No hosted CI was invoked.

## Verified (manual temporary sandbox, not public Vercel deployment)

- PR #18 (including its later receipt-timestamp fix) was tested together with the latest `main`: **79/79 tests**, zero failures.
- `npm run typecheck`, `npm run build`: successful with Node 24 and Next.js 15.5.27.
- `npm run smoke:http`: homepage 200 with security headers, both invalid API repository inputs return 400/no-store, live GitHub API returned **10 sampled Actions runs** and **5 sampled open PRs**.
- Chromium responsive testing on **375 / 768 / 1440 px**: HTTP 200, no document horizontal overflow, no captured page exceptions, **0 automated axe-core WCAG A/AA violations**, **26 passes per viewport**.
- Real mobile and desktop screenshots were generated and inspected in the temporary sandbox. Screenshot files are not committed; do not present these results as human screen-reader certification.
- Keyboard-only traversal at 375px visited **24 focusable controls**: no invisible element or absent outline detected.
- Controlled 503 Actions + HTML 429 PR response showed an honest both-panels-unavailable state, no server HTML leakage, and **no fabricated successful API sample timestamp**.
- API receipt timestamp is updated **only** on a successful parsed sample and reset on repository selection. It does not claim GitHub event freshness.
- Full `npm audit --json` on the previous integrated version returned 0 vulnerabilities at check time. Recheck before release; this is not a permanent security guarantee.

## Unresolved release gates — do not call this production-ready

1. **Vercel firewall (issue #7):** Project `prj_sbU4ylt4OV4fLkcog3VpSr2fEXYe` returned HTTP **404 `Seawall Config not found`** for project-scoped GET and PUT. Therefore **no shared enforcement rule is confirmed**. Existing 20 requests/minute throttle is local to one function process; it is **not** distributed WAF protection.
2. **Vercel preview (issue #7):** One manual preview creation attempt returned HTTP **402 `api-deployments-free-per-day`**, with a 86400-second retry hint. Provider reported daily API deployment quota exhaustion. No deployment was created; avoid repeated immediate attempts or an unapproved paid upgrade. A CLI fallback was not usable inside the sandbox because Vercel CLI and credentials were not provided there.
3. **Human accessibility (issue #5):** Automated Chromium and keyboard checks passed, but **human NVDA/VoiceOver and real-device visual acceptance have not occurred**.
4. **Release verification:** When the provider permits deployment, create an **SSO-protected manual preview** tied to an explicit verified commit and inspect its URL, headers, public REST behavior, quota/WAF enforcement and billing terms. Do not enable Git-based auto-deploy or launch production until #7 and #5 are resolved.

## CI-free policy

Do not add GitHub Actions / CircleCI workflows, create paid resources without the account owner's explicit approval, expose tokens, or report CI minutes or root-cause diagnoses from these sampled data.

## Provider diagnostics update — 2026-10-13, Vercel Hobby team scope

**Scope verified:** team `team_sAoC03UJqqXy36NhZWBesgdg`, project `prj_sbU4ylt4OV4fLkcog3VpSr2fEXYe`. Vercel's documented Hobby limit is **100 deployments per 86,400 seconds**; scope is the deployment owner (team/account), not this one project alone: https://vercel.com/docs/limits .

The **two paged, non-overlapping, team-wide deployment-list queries** for the last ~24 hours returned **143 unique deployment IDs**. The target NEXUS DevOps project still had **0 deployments**.

| Project | Total deployments | Production | Preview / other target |
| --- | ---: | ---: | ---: |
| `nexus-web-v2` | 82 | 63 | 19 |
| `vocab-master-olive` | 40 | 19 | 21 |
| `ops-copilot-developer-demo` | 11 | 3 | 8 |
| `visual-qc-project` | 7 | 0 | 7 |
| `excel-csv-reporting-automation` | 3 | 0 | 3 |
| **Team total** | **143** | **85** | **58** |
| `nexus-devops-intelligence` | **0** | 0 | 0 |

**Diagnosis:** the combined team volume is above the Hobby 100/day limit and explains why an otherwise new NEXUS project encounters `402 api-deployments-free-per-day`. The last 24-hour listing is observational, not an authoritative remaining-quota counter; blocked/unlisted attempts can make the provider's internal counter differ. Do **not** continuously retry `create_deployment`; count the rolling-window inventory until below the ceiling, preferably with a margin (e.g. 90 or fewer). An earlier 402 returned a 86400-second wait hint, not a verified reset timestamp. Community examples: https://community.vercel.com/t/vercel-deployment-failures/6146 and https://github.com/vercel/vercel/issues/17426 .

**Prevent recurrence:** request owner's approval before changing other projects. Disabling preview deployments *only* on `nexus-web-v2` and `vocab-master-olive` would have removed 40 historical preview entries, leaving **103** of these 143 requests, **still above 100** (assuming an otherwise identical day). Limiting small commits/merges to batch releases or selectively suppressing previews across more projects is required. Production deployments remain essential for other live apps; do not disable them without explicit authorization. Vercel git controls: https://vercel.com/docs/project-configuration/git-configuration .

**WAF evidence:** GET active WAF configuration on **three projects** (`nexus-devops-intelligence`, deployed `nexus-web-v2`, and `vocab-master-olive`) returned the same `404 Seawall Config not found`. Therefore there is **no evidence that creating a first deployment alone will provision the missing WAF configuration**. This may require the team's Firewall dashboard initialization or provider intervention; the actual root cause is unconfirmed. Use the dashboard project Firewall → Configure → New Rule → inspect the mandatory Rate Limiting Pricing dialog → choose one OR-matched API-path rule. Publishing must follow explicit account-owner pricing review and testing. If the dashboard also fails, present these project-scoped errors/request IDs to Vercel Community Support or the eligible official support channel: https://vercel.com/docs/support-center . Hobby technical issues are generally directed to the community: https://vercel.com/legal/support-terms .

**Current action status:** source merged and verified; no WAF rule was confirmed active; no manual preview was deployed; no settings of the other projects were changed and no paid features were enabled.
