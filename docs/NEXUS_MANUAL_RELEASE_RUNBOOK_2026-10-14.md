# NEXUS — manual Preview/Production release and rollback runbook

**Version:** 14 Oct 2026. **Execution state: owner authorized and manually created a SSO-configured, exact-SHA Preview only. No Production approval has been given.** [Deployment record](NEXUS_PROTECTED_PREVIEW_DEPLOYMENT_2026-10-14.md). Future deployments/tests require separate approval. Applies exclusively to `senanurcetin/nexus-devops-intelligence` Vercel project `prj_sbU4ylt4OV4fLkcog3VpSr2fEXYe`, team `team_sAoC03UJqqXy36NhZWBesgdg`. The [R-01 immutable inventory](NEXUS_RELEASE_CANDIDATE_MANIFEST_2026-10-14.md) captures a proposed source SHA and the actual older deployed sources.

**Manual Redis probe R10 compatibility (14 Oct, source-only):** Earlier versions of `scripts/verify-protected-redis-preview.mjs` attached `_nexus_rate_check` to API queries. Since strict parameter validation landed in PR #57, that parameter would produce **400/no-store before Redis**. [R10 correction and offline QA](R10_PROTECTED_PREVIEW_PROBE_QA_2026-10-14.md) remove it. A CDN `HIT`, `STALE`, `REVALIDATED`, unknown or missing cache-status header cannot prove origin execution. **No current Preview test or Redis traffic is authorized by this note; do not run even the default single-request probe before owner usage approval and a bounded Preview scope.**

**Latest owner-authorized G03 Preview (14 Oct):** [exact-SHA deployment and remaining G04 evidence](G03_PROTECTED_PREVIEW_ACCEPTANCE_2026-10-14.md) — unique URL `https://nexus-devops-intelligence-jknosakps-senanurs-projects-102fb36c.vercel.app`, deployment `dpl_9sq98XLM2DZAgyBFZoFVUde2NucT`, `READY`, `target:null` (Preview) and GitHub source SHA `2b5fb7c379bd1f939f3b50f286edfb868ddb386a`. **Owner authorized at most 25 Preview-origin functional requests, NO real Redis stress and NO Production**. SSO enabled at project config level, but authenticated browser acceptance G04 **NOT VERIFIED** because external fetchers could not access the URL. Production alias remains linked to the older SHA `74cd0e3` and known READY rollback deployment. Older date-specific examples below must not be mistaken for this current deployed Preview.

## 0. Hard stop rules

1. **No GitHub Actions, CircleCI, git auto-deploy, cron-based requests, paid WAF, paid Vercel/Upstash service or Production publication without explicit owner approval.** Keep `git.deploymentEnabled:false`. GitHub PR merge is not a deployment.
2. **No real 21-request Redis quota test** because Production + Preview currently share the same Upstash Free database. Do not simulate that test against real endpoint, even via different user agents, clients or IPs. Real local Redis / offline fixtures are the approved free alternative; live cross-instance proof remains open.
3. **Do not decrypt, read, print, export, copy, commit or ask the owner to paste credentials**, especially the Upstash REST URL/token and Preview bypass tokens. Environment *names*, scopes, and Sensitive classification may be checked.
4. **No forced unlock of Preview SSO**, broadening Preview to public URLs, promoting unreviewed Preview to a custom domain, changing WAF, altering Vercel env scopes or enabling paid features.
5. **Stop** for any ambiguous source SHA, unexpected deployment target, missing SSO protection, wrong domain, unverifiable env scope, unexpected extra origin consumption, failed security gate or owner disagreement. Never quietly substitute a Production deployment for Preview testing.

## 1. Pre-release evidence packet — safe to prepare without publishing

- Identify current GitHub `main` SHA and record selected **immutable** candidate SHA. As of inventory: provisional candidate `599ced76605c25161b182b2d5bfbadbd091bfb53`; most recent application feature merge `8ebcbea05a2386a351b040ed743adca596f38b8e`. Subsequent docs commits do not automatically become approved release candidates.
- Record current READY Production deployment ID and SHA: `dpl_9fXGATNHhyhNVrN1i47k3BU4u5K5`, `74cd0e344eb94255b4bc8db99e4a4dc7f3a5a0bf`. Record older protected Preview: `dpl_DxFyywkhBrMe3hzooikmqCpKAuyx`, `e745c6188f47942ffe8405aa195d7584e2d395da`. Do not mistake either for the newer application.
- Compare `vercel.json` (`git.deploymentEnabled:false`), current SSO `enabled:true` / `all_except_custom_domains`, Preview branch target and deployed source commit. List only `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` variable **names/scopes**, never values.
- **DONE for provisional `599ced76605c25161b182b2d5bfbadbd091bfb53` on 14 Oct:** exact checked-out SHA was verified in an isolated, disposable Node 24 Sandbox; 135/135 tests, typecheck/build, budget and audit passed; local production HTTP smoke passed; the Sandbox was stopped. If choosing a **different** SHA or after material changes, repeat this step. Reproducible commands:
  ```sh
  npm ci
  npm test
  npm run typecheck
  npm run build
  npm run inspect:budget
  npm audit
  ```
  For HTTP smoke use only a **local** production server and the existing bounded public GitHub reads (as in `npm run smoke:http`), not protected Preview or live Redis quota probes. Record pass/fail, exact SHA, Node version and time. If any step fails, **do not advance**.
- The account owner checks **aggregate Upstash Free** database statistics (command usage/remaining, storage/remaining, period, chosen alert threshold) in the vendor dashboard. Record only counts and date: **never connection string/token**. Check that the owner does not have an unintended paid commitment. If unknown, mark R-02 not accepted.
- Resolve/update the [human acceptance checklist](MANUAL_ACCESSIBILITY_ACCEPTANCE.md). Issue #5's closure alone is **not** evidence of SR-01…SR-12 being performed by a person. Owner must confirm how signoff is tracked; do not silently reopen/close issues.

## 2. Explicit protected Preview handoff — owner authorization required

An authorization must name **Preview (not Production)**, exact source SHA, protected Vercel NEXUS project/team, acceptable number of **real Upstash-connected** origin reads (including `0`), and whether a new Preview deployment is allowed. Without these details, **stop** and ask the owner. No hidden bypass of a missing permission.

Only after authorization, use a supported **manual exact-SHA Vercel Preview** operation; **do not rely on deploying the mutable branch tip**. Confirm the resulting deployment `target` is Preview, `READY`, source SHA equals the authorized commit, and generated Preview URL is covered by SSO. Avoid Production aliases/custom domains and ensure env metadata still shows Sensitive vars scoped Preview+Production; do not inspect values. If the tool cannot pin the reviewed source SHA, stop instead of deploying a different commit.

Perform the **smallest pre-approved** protected Preview checks: HTML 200 after legitimate SSO, header/security posture, exact source domain and panel status (if permitted). Record number of real `/api/public-*` origin requests. Avoid cache-busting unless specifically authorized since a cache MISS can use one Upstash command per origin GET. **No full 21-request test**, no automatic retries, and no WAF bypass.

## 3. Visual, data and human accessibility acceptance

Review actual (new exact-SHA) Preview at 320/375/768/1280/1440/1920 CSS px when practical, plus long titles, zoom, reduced motion, invalid-input, one-source failure and empty samples (mocked **locally** where appropriate). Verify the source labels mean **up to ten workflow runs and five open PRs**, not historical reliability, billing spend, full CI truth or review approval. Check console and broken/hydration errors. Store screenshots only through approved file channels; avoid treating fixture screenshots as real GitHub metrics.

Manually test keyboard Tab/Shift+Tab focus, section anchor behavior, external links, input errors and live regions. Obtain NVDA/VoiceOver, physical device, Firefox/WebKit and editorial review against the [12-step human checklist](MANUAL_ACCESSIBILITY_ACCEPTANCE.md). An automated axe score of 0 does not count as human signoff. Keep incomplete cases **NOT VERIFIED** with responsible owner, not "passed".

For origin protection, document the known local **real Redis multi-process** test, the one earlier connected Preview admission proof, and the absent live independent Vercel instance proof. Vercel Hobby firewall action stays **Log-only**; do not describe it as active edge 429 protection. R-06 remains **open** unless independently proven without stressing shared Free quota or a specifically documented owner residual-risk acceptance is provided.

## 4. Explicit separate Production approval — never infer from Preview

Only after independent authorization for **Production**, exact candidate SHA and acceptable origin/smoke usage budget:

- Recheck immutable SHA and latest release gates; reconfirm the operator knows the current public domain is reachable even if generated URLs have SSO.
- Before changing any alias, record Production deployment ID/SHA and rollback target in a release log. **Current old Production is the potential rollback deployment**; do not discard it.
- Manually publish the specifically approved and tested artifact/SHA. If Vercel cannot prove the selected immutable source or the target is unexpectedly Preview/public, stop rather than guessing.
- Observe Vercel `READY`, actual Production alias resolution, security headers, no unexpected runtime errors and strictly pre-approved API calls. Do not infer end-user uptime from one smoke test. A failed service/schema/Redis/security check **blocks acceptance**.
- **No CI build trigger, automatic redeploy, bulk live Redis 429 stress or surprise paid monitoring.**

## 5. Rollback / incident response (owner decision)

**Trigger:** wrong SHA, unsafe public exposure, missing SSO on intended Preview, severe application runtime errors, misleading sampled data, unexpected Redis 503, security/regression failure, or budget/usage risk.

1. **Stop new source traffic/tests** and freeze further release operations. Record timestamp, observed symptom, affected URL, deployment ID, SHA, request count and whether Production was affected — **no secrets or customer IPs**.
2. Inform owner and request **explicit rollback authorization**. Identify the **previous known acceptable Production deployment**: at inventory time `dpl_9fXGATNHhyhNVrN1i47k3BU4u5K5` (SHA `74cd0e3`). Reconfirm it still exists and is READY; do not assume it's safe if the root cause also affects that version.
3. Only with authorization, use the supported manual **restore/promote of previous Production deployment**. Moving git `main` backwards **does not** restore public aliases when Git deployment is disabled. Do not roll back Production to a protected Preview.
4. Confirm resolved Production alias points to the intended rollback artifact and perform bounded approved read-only health checks. Record outcome; if not restored, keep incident open.
5. Create a technical incident/follow-up PR (no CI auto-run) describing source diffs, test gap and preventive regression. Do not re-attempt release before a new owner-approved plan.

## 6. Operator sign-off record — fill only from actual evidence

| Field | Value at document creation |
| --- | --- |
| Reviewed exact source SHA / build log | **`599ced76605c25161b182b2d5bfbadbd091bfb53` offline validated 14 Oct** in disposable Node 24 Sandbox: 135/135 tests, TS/build, 401,241 raw / 117,432 gzip JS within review caps, audit 0, public GitHub/local HTTP smoke. **No deployment approval.** |
| Free Redis command headroom | **UNKNOWN** |
| Protected updated Preview ID/SHA | **READY** `dpl_Beyxk5vGuDcvx5XDD4gVdsbUX9tg`, `599ced76605c25161b182b2d5bfbadbd091bfb53`, target Preview, SSO project metadata enabled |
| Preview real request budget and outcomes | **No real API requests/probes performed in this deployment step**; further Upstash-connected acceptance checks require explicit small budget and authorization |
| Human NVDA/VoiceOver + real device + editorial QA | **UNVERIFIED** (issue #5 closed, checklist unchecked) |
| Independent Vercel Redis origin proof / risk disposition | **OPEN** ([issue #7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7)) |
| Approved Production source/deploy time | **NOT AUTHORIZED** |
| Previous Production fallback | `dpl_9fXGATNHhyhNVrN1i47k3BU4u5K5`, subject to live recheck |
| Actual rollback performed | **NO** |

**This runbook did not initiate an additional deployment:** its documented owner-approved manual **Preview** deployment is recorded separately. No Production rollout/rollback or live shared Upstash quota test was performed.
