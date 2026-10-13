# NEXUS — CI-free manual Vercel preview and WAF rollout

**Prepared:** 13 October 2026  
**Target:** independent Vercel project `prj_sbU4ylt4OV4fLkcog3VpSr2fEXYe` on Hobby plan  
**GitHub repository:** `senanurcetin/nexus-devops-intelligence`  
**Release state:** NOT deployed. This document is a procedure, not an applied firewall configuration.

## Proven baseline

- Next.js 15.5.27, Tailwind CSS 4.3.3.
- Clean `npm ci`; 33/33 unit/route tests; TypeScript; production build.
- Full dependency `npm audit --json` showed zero findings at verification time.
- CI-free HTTP smoke passed with real public GitHub API responses.
- Chromium: 375px, 768px, 1440px without horizontal overflow; invalid repo and valid repo switching worked.
- axe-core WCAG 2/2.1 A/AA automation: no violations at 375px and 1440px after correcting slate text contrast.
- Remaining: manual cross-browser/screen-reader review, global API rate limits, safe preview and release QA.

## Verified Hobby feature and cost boundaries

- The connected Vercel team is on the **Hobby** plan; the standalone NEXUS Vercel project has **no live deployment**.
- Vercel's rate-limiting docs list **one rule per Hobby project**, fixed windows from 10 seconds to 10 minutes, and IP or JA4 counting.
- Vercel's pricing documentation lists **1,000,000 allowed WAF rate-limit requests per month included** for Hobby, with pricing listed for additional allowed requests; plan-specific billing behavior and actual account usage must still be confirmed in Vercel.
- Vercel's May 2026 change states traffic denied/challenged/rate-limited by WAF is not billed as CDN requests or data transfer. This **does not mean allowed traffic or Vercel Functions are free**.
- The first rate-limit rule requires reviewing a **Rate Limiting Pricing** dialog in Vercel's dashboard before activation. Do not bypass this step via API.
- Current project has no active publicly verified WAF rate limit. **No WAF setting was changed in this review.**

References:
- https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting
- https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing
- https://vercel.com/changelog/web-application-firewall-mitigated-traffic-is-free-on-vercel
- https://vercel.com/pricing

## Preflight — avoid accidental costs or CI

1. Confirm team/project IDs and account plan; ensure NEXUS remains separate from Ops-Copilot.
2. Confirm **no automatic GitHub/Vercel push deployment** and **no GitHub Actions/CircleCI** workflows. Prefer a reviewed manual deployment of an exact GitHub SHA.
3. In the Vercel dashboard, review the mandatory **Rate Limiting Pricing** dialog before enabling the first rule. Documentation updated 28 August 2026 lists **one** rule per Hobby project, **1,000,000 included allowed WAF rate-limit requests**, per-region counters and fixed-window IP/JA4 counting. The published unit price is **$0.50 per million allowed requests** where overage pricing applies; do not assume Hobby overages or other function/CDN usage are free. Confirm the account-specific cost and limit behavior.
4. Review current Hobby usage and whether the quota is exhausted; if the account cannot safely run a preview, leave the application undeployed.
5. Keep sensitive tokens out of repository source, browser bundles, command output, and screenshots.

Official references:
- https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting
- https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules
- https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing

## Suggested single WAF rule (do not apply blindly)

- **Name:** `nexus-public-github-api-limit`
- **Condition:** request path starts with `/api/public-`; this prefix covers both `/api/public-actions` and `/api/public-prs`. Do not use two path-equality conditions combined with AND.
- **Counting key:** client IP (subject to shared-network false positives).
- **Strategy:** fixed window, starting proposal **20 requests / 60 seconds / IP**. Review actual traffic before choosing the enforced threshold; each dashboard lookup normally fetches both endpoints.
- **Staging action:** log/observe if supported. Confirm routes and legitimate-client traffic match expectations.
- **Enforcement:** return HTTP **429 Too Many Requests** after threshold. Retest both endpoints, not just one.
- **Scope:** The rule protects all matching traffic for this project across serverless instances, unlike the existing per-process `nexus-public-gate`. **WAF rate-limit counters are tracked per region**; the 20-per-minute threshold can be exceeded by the same source across regions.
- **Release:** apply only after pricing, team permission, false-positive impact and rollback instructions are checked.

### Manual verification after publishing

1. A normal public repo lookup produces both dashboard panels and traceable evidence links.
2. Invalid repo gives HTTP 400, never a GitHub upstream request.
3. Repeated requests from the **same** source eventually produce 429; requests from other normal clients remain functional.
4. Rate-limited and other error responses should not be cached (`Cache-Control: no-store`).
5. Confirm the WAF rule covers both APIs and does not unexpectedly block the homepage, static assets or unrelated routes.
6. Monitor Vercel usage and anonymous GitHub API failures under normal load.

## Rollback

If the rule blocks legitimate users or costs exceed acceptable limits, revert/disable the **specific** WAF rule from Vercel Firewall configuration and verify the prior configuration is restored. For a defective preview, stop or remove that specific preview without modifying Ops-Copilot or enabling automated deployments.

## Cloud-verified HTTP security headers

[Manual security-header work](https://github.com/senanurcetin/nexus-devops-intelligence/blob/main/next.config.mjs) adds `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, camera/mic/geolocation disabling and a **limited** CSP protecting `frame-ancestors`, `base-uri` and `object-src`. This is not a full JavaScript CSP.

- [x] Fresh cloud `npm ci`, 41/41 tests, TypeScript check, Next.js production build and `npm audit --json` (0 observed findings).
- [x] Manual production server smoke: security headers on homepage and both API routes, invalid repository returns 400/no-store, 10 real workflow runs and 5 public PRs sampled.
- [ ] Vercel WAF rate limit **not enabled**. Dashboard pricing acknowledgment and traffic review are required before a rule is applied.

## Release gate

**Do not announce a publicly released MVP** until WAF rule coverage, browser accessibility, manual deployment and an actual preview-URL smoke test are verified. If Vercel quotas or pricing prevent release, the verified GitHub source remains the deliverable.

Tracking: [issue #7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7) for global abuse protection and [issue #5](https://github.com/senanurcetin/nexus-devops-intelligence/issues/5) for remaining human accessibility checks.
