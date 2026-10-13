# NEXUS release candidate inventory — R-01

**Read-only audit:** 14 October 2026 (Europe/Istanbul). **Status: inventory and exact-candidate offline verification complete; release NOT approved or deployed.** This is a snapshot, not a release authorization or a promise that a moving `main` branch will still point here. Re-check immediately before any manual deployment.

## Exact GitHub / deployment references

| Surface | Immutable source SHA | External ID / state | Interpretation |
| --- | --- | --- | --- |
| GitHub `main` at audit time | `599ced76605c25161b182b2d5bfbadbd091bfb53` | [source snapshot](https://github.com/senanurcetin/nexus-devops-intelligence/commit/599ced76605c25161b182b2d5bfbadbd091bfb53) | **Proposed candidate; exact SHA compiled/tested in a disposable Vercel Sandbox (not a Preview/Production deployment).** Contains docs changes after code PR |
| Last application feature change | `8ebcbea05a2386a351b040ed743adca596f38b8e` | [PR #37](https://github.com/senanurcetin/nexus-devops-intelligence/pull/37) | Q-05 budget tests/manual command. Previous Q-04 fix [PR #36](https://github.com/senanurcetin/nexus-devops-intelligence/pull/36), squash `a49275a1bb1e324859c66b68ef50b7849821b1b9` |
| **Currently deployed Production** | `74cd0e344eb94255b4bc8db99e4a4dc7f3a5a0bf` | `dpl_9fXGATNHhyhNVrN1i47k3BU4u5K5`, **READY** | [Primary domain](https://nexus-devops-intelligence.vercel.app). **Older than app PR #25–37. Do not equate Production behavior with newer Redis/UX code.** |
| **Currently deployed protected Preview** | `e745c6188f47942ffe8405aa195d7584e2d395da` | `dpl_DxFyywkhBrMe3hzooikmqCpKAuyx`, **READY** | Branch `test/protected-redis-preview-gate-20261013`; [unique Preview URL](https://nexus-devops-intelligence-r43tbr0yu-senanurs-projects-102fb36c.vercel.app). **Also older than current app source.** |
| Previous Production (candidate rollback reference) | `74cd0e344eb94255b4bc8db99e4a4dc7f3a5a0bf` | `dpl_23cYA6n7AU6eEtxRNqw3oJQFnnWs`, **READY** | Same old application SHA; not an independent replacement for current Production security acceptance |

**Vercel scope:** team `team_sAoC03UJqqXy36NhZWBesgdg` / slug `senanurs-projects-102fb36c`; project `prj_sbU4ylt4OV4fLkcog3VpSr2fEXYe`, `nexus-devops-intelligence`. The main/production domain is `nexus-devops-intelligence.vercel.app`; additional configured domains are `nexus-devops-intelligence-senanurs-projects-102fb36c.vercel.app` and `nexus-devops-intelligence-git-main-senanurs-projects-102fb36c.vercel.app`. Never assume that a URL containing "git-main" is necessarily SSO-protected.

## Security and free-tier boundary observed

- `vercel.json` in GitHub `main` contains `"git":{"deploymentEnabled":false}`. Neither merging this inventory nor a future PR creates an authorized Git auto-deploy.
- Vercel project currently reports `ssoProtection.enabled: true`, `deploymentType: all_except_custom_domains`. This protects applicable generated deployment URLs, **not custom/production domains under the exception**. Do not disable it to run tests.
- Both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` variable **names** exist with `type: sensitive`, scoped to `production` **and** `preview`. **No value was decrypted, read, copied or logged.**
- Owner previously confirmed **Upstash Free / EU-CENTRAL-1**, and that Preview and Production share the **same** Redis instance/free command allowance. Current commands remaining/used and storage headroom are **UNKNOWN**: owner checks aggregate usage in Upstash UI (R-02), not secret material.
- Only one earlier protected Preview GET with `x-nexus-rate-limit-mode:shared-redis` and `x-vercel-cache:MISS` showed connection reachability. The Redis 20/60s algorithm was independently tested using real **local** Redis and separate Node processes with **0 Upstash commands**. Neither is live multi-Vercel-instance acceptance.
- Vercel Hobby WAF currently has **Log-only** enforcement and cannot be called an active paid `429` edge rate limiter. Origin Redis quota is distinct from edge/CDN DDoS protection.

## Candidate and rollback status

**Provisional candidate:** `599ced76605c25161b182b2d5bfbadbd091bfb53`, **NOT approved for publication**. **Exact-SHA offline preflight completed on 14 Oct**: a disposable Node **v24.14.1** Vercel Sandbox checked out exactly this immutable Git SHA, then passed `npm ci`, **135/135 Node tests**, `npm run typecheck`, Next production `npm run build`, `npm run inspect:budget` (**401,241 raw / 117,432 gzip page JS bytes**, under thresholds), `npm audit` (**0 reported findings**) and local production-server `npm run smoke:http` (valid public GitHub read-only samples, invalid-input 400/no-store, security headers). **Sandbox stopped. No protected Preview or Production deployment was created and no Upstash credentials or live shared Redis requests were used.** This verifies the pinned candidate's local build/API smoke, **not its actual Vercel deployment or human accessibility**. If `main` advances, require a new manifest or explicit owner choice of the pinned old candidate.

**Production fallback:** record existing READY `dpl_9fXGATNHhyhNVrN1i47k3BU4u5K5` as the known current deployed version. A rollback means an **explicit owner-authorized Vercel operation** returning the production alias to a *previous known acceptable production deployment*, followed by bounded read-only verification. Do not silently promote a Preview deployment, point public aliases to protected Preview, rerun unknown source code, or confuse reverting GitHub files with changing Vercel's served deployment. The previously READY status does not independently guarantee safe rollback at a later time.

## Release gate decisions — none implied

| Gate | Current determination | Required before Production |
| --- | --- | --- |
| R-01 inventory / exact SHA offline tests | **Done at audit time**; exact `599ced7` passed 135/135 + TS/build/budget/audit/smoke in disposable Sandbox. Candidate is still **not approved** | Reconfirm source and IDs immediately before release |
| R-02 Free Redis capacity | **Unknown** | Account owner checks real aggregate command/storage headroom; no token/URL values |
| R-03 exact-SHA SSO Preview | **Not done** for current app | Explicit Preview authorization; verify selected SHA and SSO protection |
| R-04 current Preview functional/visual QA | **Not done** | Inspect actual latest Preview and recorded images; strictly bounded request budget |
| R-05 human accessibility | **Unverified** | Human NVDA/VoiceOver, physical mobile and editorial signoff. [Issue #5](https://github.com/senanurcetin/nexus-devops-intelligence/issues/5) is currently **CLOSED with state reason completed**, but [human checklist](MANUAL_ACCESSIBILITY_ACCEPTANCE.md) still has SR-01…SR-12 **unchecked**. Closure does **not** itself prove human execution. Do not reopen user-closed issue without agreement |
| R-06 Redis live cross-instance protection | **Not established** | [Issue #7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7) remains **OPEN**; do not run forbidden shared Free 21-request probe |
| R-07 Production release | **Not authorized** | Explicit separate Production approval, safe rollback candidate and bounded smoke |

**Next document:** [manual no-CI release and rollback runbook](NEXUS_MANUAL_RELEASE_RUNBOOK_2026-10-14.md). This manifest is a historical, timestamped snapshot; it is not a deploy button, approval or security attestation.
