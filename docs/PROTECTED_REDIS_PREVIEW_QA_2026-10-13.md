# P0.2 — protected Preview Redis acceptance probe

> **STATUS UPDATE — 14 October 2026 (supersedes the historical opening below):**
> Both Upstash REST variable **names** are now confirmed by Vercel as `Sensitive`,
> scoped to **Preview + Production**. The owner confirmed they point to the **same
> Upstash Free Redis instance**, so any real Preview origin GET can consume the
> Production-shared quota. A single older protected Preview cache-MISS response
> was already **200 with `shared-redis` mode**: connection reachability is established,
> but Redis `429` on the current exact app SHA and independent Vercel multi-instance
> enforcement are **NOT** established. The owner **declined** the optional
> 21-request live test. **DO NOT run `--confirm-21-request-test` without NEW
> specific consent and an agreed Free quota strategy.** The protected Preview
> currently serves older commit `e745c61`; Production serves `74cd0e3`.
> For current actions read [R-01 manifest](NEXUS_RELEASE_CANDIDATE_MANIFEST_2026-10-14.md)
> and [manual owner-gated release plan](NEXUS_MANUAL_RELEASE_RUNBOOK_2026-10-14.md).



**Status:** CI-free release test is implemented. **Not yet executed against a real Vercel Preview.** As of 13 October 2026, the NEXUS project has two server-only Upstash Redis variables scoped to **Production only**; Preview does not have them. The database owner confirmed **Upstash Free Tier / EU-CENTRAL-1**; command use and storage consumption have not been verified. The latest known production deployment is an older commit, so production cannot stand in for preview acceptance.

## Safety prerequisites (do not skip)

1. Account owner ensures the Vercel Preview deployment remains **SSO/deployment-protected**. Do not disable protection or publish an unreviewed release.
2. Configure **Preview-scoped Sensitive** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` securely; prefer an **isolated free test Redis** or obtain explicit account-owner consent before using a production database in Preview. No secret values are needed in this repository, chat or issue.
3. Confirm Preview build source SHA matches the reviewed `main` release candidate that includes the **Redis-first** and **X-Nexus-Rate-Limit-Source** fixes; the deployment must use the *specific verified commit*, not an implicit moving branch.
4. Keep Vercel Git auto-deploy **disabled**, Hobby rate-limit WAF **Log only**, and the project on free plans. A manual, protected Preview needs explicit release approval.
5. Only after confirmation, run the script from a controlled **single-client Vercel Sandbox**. This is a read-only test, but it intentionally consumes origin quota and (at most) 21 Upstash requests when the optional full test flag is supplied.

## Commands (CI-free; *run only when prerequisites hold*)

One-request preflight first:

```sh
node scripts/verify-protected-redis-preview.mjs \
  --preview-url 'https://nexus-devops-intelligence-<preview-id>-senanurs-projects-102fb36c.vercel.app/'
```

The test's output is a small JSON summary. Expect `"state":"ready"` and `"reason":"redis-mode-preflight-passed"`. A protected Preview requiring a login may return `preview-authentication-required`; do not disable protection to bypass that gate.

If the owner has **separately** provisioned an authorized *Preview-only* Vercel protection-bypass token, it can be passed to a temporary sandbox as the masked **`NEXUS_PREVIEW_PROTECTION_BYPASS` environment variable** (never on the command line, in a commit, in a screenshot or in a chat). The script sends it **only** to the exact NEXUS team Preview hostname and never follows redirects. This is optional and must not be borrowed from Production Redis credentials.

After preflight, account-owner review and confirmation to consume **21** origin requests, run:

```sh
node scripts/verify-protected-redis-preview.mjs \
  --preview-url 'https://nexus-devops-intelligence-<preview-id>-senanurs-projects-102fb36c.vercel.app/' \
  --confirm-21-request-test
```

The helper alternates **Actions** and **PRs** to demonstrate a shared quota (11/10), targets only the fixed public GitHub repository `senanurcetin/nexus-devops-intelligence`, sends fresh cache-busted query strings, and stops at 21 GET requests or within 55 seconds. If 20 calls admit and the 21st returns **HTTP 429**, **`X-Nexus-Rate-Limit-Source: shared-redis`**, **`Cache-Control: no-store`** and a bounded **`Retry-After`**, the result is `"state":"passed"` and `"crossInstanceVerified":false`. The script never displays IPs, hostnames, source response bodies, Redis URLs, keys, counters or tokens.

The fail-closed responses `blocked` and `inconclusive` are *not* success: they include missing authentication, wrong SHA/Redis mode, cache HIT, quota already consumed by other traffic, request errors, invalid response headers and test-window expiration. Do **not** auto-retry or increase the 21-request bound; investigate and request a new authorized window if necessary.

## What this proves — and what remains open

- A correct `passed` result demonstrates **one preview-deployed app instance made an origin-level 429 decision attributed to the Redis backend**, shared across Actions and PR routes for a single client IP in the same 60-second window.
- **It does not prove multiple independent instances enforce the same bucket**, nor that Vercel's paid edge WAF is enabled. This tool deliberately returns `crossInstanceVerified: false` on success.
- To close issue #7, additionally verify the test-specific Upstash command count in the database dashboard (aggregates only), and compare **two independently initialized instances** or provider-confirmed multi-instance test sources. The owner must verify Free Tier quota headroom, CDN bypass vs origin admission, and the release SHA.
- Human NVDA/VoiceOver and physical device sign-off remains a separate issue #5 gate. No claim of completed production release is implied.

**Tests:** `node --import tsx --test tests/protected-redis-preview-probe.test.mjs`, then the full `npm test`, TS/build, audit, and smoke. No GitHub Actions/CircleCI.
