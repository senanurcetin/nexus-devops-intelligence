# G03 — Owner-authorized immutable SSO Preview deployment (14 October 2026)

**Project:** `senanurcetin/nexus-devops-intelligence`; Vercel Hobby project `prj_sbU4ylt4OV4fLkcog3VpSr2fEXYe`; team `team_sAoC03UJqqXy36NhZWBesgdg`.  
**Owner authorization in the active conversation:** deploy **the then-current `main` SHA only** to **SSO-protected Preview**, perform **at most 25 application origin requests** for functional acceptance. Explicit exclusions: Production, live Redis 21-request stress, paid services, CI, SSO bypass.  
**Selected SHA:** `2b5fb7c379bd1f939f3b50f286edfb868ddb386a`, confirmed with GitHub `commits/main` immediately before deployment.  
**Deployment ID:** `dpl_9sq98XLM2DZAgyBFZoFVUde2NucT`.  
**Unique deployment URL:** `https://nexus-devops-intelligence-jknosakps-senanurs-projects-102fb36c.vercel.app`.  
**Target:** Preview (`target: null` in Vercel API, not `production`).  
**Observed deployment state:** `READY`; Vercel deployment `meta.githubCommitSha` matches the complete source SHA above.

## Pre-deployment checks and evidence

- Vercel project SSO metadata: `ssoProtection.enabled = true`, `deploymentType = all_except_custom_domains`. This covers generated Preview URLs **at the project configuration level**; a real browser SSO authentication and actual unauthenticated HTTP challenge have **not** been confirmed by these metadata fields alone.
- Preview + Production environment **names only** confirmed: `UPSTASH_REDIS_REST_TOKEN` and `UPSTASH_REDIS_REST_URL`, both type **sensitive**, scope `preview` and `production`. Their values were not decrypted, transmitted, copied or logged.
- Git source includes `vercel.json` with `git.deploymentEnabled: false`; GitHub PR merges do not auto-deploy this project.
- Protected previous Preview deployment: `dpl_Beyxk5vGuDcvx5XDD4gVdsbUX9tg` on `599ced76605c25161b182b2d5bfbadbd091bfb53`.
- Production rollback reference: `dpl_9fXGATNHhyhNVrN1i47k3BU4u5K5`, `READY`, full SHA `74cd0e344eb94255b4bc8db99e4a4dc7f3a5a0bf`. Existing Production aliases `nexus-devops-intelligence-senanurs-projects-102fb36c.vercel.app` and `nexus-devops-intelligence.vercel.app` remained associated with that Production deployment when checked **after** Preview creation.
- Build created **five** `/api/public-*` dynamic Next.js routes. Logs show `Next.js 15.5.27`, optimized build and `Deployment completed`; several nonfatal npm engine/config/install-script warnings are logged, not test failures. Application bundle displayed ~125 KB first-load JS for `/` in the build output. This is not an R11 field CWV measurement.

## Manual deployment operation

The Vercel deployment API does **not** accept `target:"preview"` on `POST /v13/deployments`; an initial request with that body was rejected 400 before creating a deployment. Reissue omitted `target` (provider documented default Preview), used explicit `type:github`, `org:senanurcetin`, `repo:nexus-devops-intelligence`, `ref:main`, pinned complete `sha`, and the exact NEXUS Vercel project/team. Vercel returned `INITIALIZING`, then `BUILDING`, then `READY`, confirmed by a follow-up `get_deployment` call showing `target:null` and the approved full SHA.

No paid build machine, SSO exception, custom domain, Production target, Redis configuration or security variable was changed. Manual Git deployment is distinct from GitHub Actions/CI.

## User-journey verification — NOT completed

**Explicit approved application-origin traffic limit: 25.** No tool verified **any successful** `/api/public-*` application-origin request or any Redis command against this Preview during this operation.

- A single attempted unauthenticated GET to the unique Preview URL from disposable sandbox failed **before HTTP** at DNS resolution (`getaddrinfo ENOTFOUND`), so did **not** return application HTTP 200, 302, 401 or 403. This proves nothing about the deployed application, SSO challenge or Redis.
- Independent web retrieval of the generated Preview URL reported **not accessible**; no response headers or authenticated HTML were obtained.
- No SSO session, bypass token, Upstash secret or user password was accessed. No `--confirm-21-request-test` was executed.
- **G03 deployment existence/READY/exact-SHA and SSO configuration accepted**; **live SSO behavior and G04 authenticated UI/API source acceptance remain UNVERIFIED**.

### Bounded owner-browser G04 acceptance plan

Use the **unique generated Preview URL**, in a normal browser legitimately signed into the matching Vercel team (do **not** disable SSO). Do not use the public Production domain. With browser Developer Tools → Network enabled and Preserve log:

1. Open generated Preview once and report whether Vercel SSO prompts or authorizes, then whether the actual NEXUS dashboard loads. A returned login page is **not** evidence the app loaded.
2. Filter Network by `/api/public-`; on initial real source selection expect only Actions + PR requests. Distinguish `200` GitHub sample, `503` shared limiter, or other actual status. Capture **status, path, `x-vercel-cache`, `cache-control`, `retry-after` and `x-nexus-rate-limit-*` response headers where visible**; redact credentials, cookies, query details if private.
3. Only if the first experience succeeds, verify F01 export requires no new API origin, F03 canonical source/history, F04 one opt-in PR/workflow evidence request, F05 one opt-in trend request. Source references must be original GitHub URLs and sample boundaries visible; never present local fixtures as live.
4. Count each attempted `/api/public-*` client GET as one potential application origin GET even if CDN-hit; **stop by 25 total**. Avoid auto refresh, multi-tab repeated loads, query-based cache busting, Redis 21-request test, malicious probes, credential sharing, Production alias or paid upgrades.
5. Share only redacted UI + selected Network status/response-header screenshots. Do not expose session headers, cookies, SSO/bypass tokens, Redis REST credentials or private data. Record browser/OS/device and full deployment SHA.

A finished G04 requires independently observed real protected Preview behavior under the agreed 25-origin cap, with actual successful authentication/expected source statuses. If the owner cannot produce that evidence, it **remains OPEN**; do not infer acceptance from build success or screenshot-free metadata.

## Remaining gates and stop policy

- G02: six real owner usage metrics were collected and a 25-request **illustrative** local capacity calculation was within 80% caps, but vendor reset-period precision and this actual authorized Preview scope need dated review; the operator did not run a live 21-request proof.
- G05: compatible WebKit and human iOS/macOS Safari, NVDA/VoiceOver and visual/editorial signoff open.
- G06 / #7: real Redis admission across distinct Vercel instance IDs still not proven.
- G07: **Production NOT authorized**, alias unchanged. Rollback target recorded. Do not deploy Production, promote Preview or retry Preview deployment without separate owner instruction.
