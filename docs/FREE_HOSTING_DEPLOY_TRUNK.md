# Deploying current trunk on free hosting (instructions only, NG-19)

**Nothing here was executed.** No Vercel/Cloudflare deploy, project change, env var or DNS change was made while writing this. Each step below needs Sena's explicit go-ahead at the moment it is run. The production Vercel project is stale (last deploy `74cd0e3`); the repo sets `"git": {"deploymentEnabled": false}` in `vercel.json`, so **pushing never auto-deploys** - deploys are manual on purpose.

## 0. Pre-flight (local, free)

```bash
git switch live/trunk-20261031   # or the merged main once QA has merged feat/devops-ng19
npm ci
npm run typecheck && npm test
npm run build
npm run smoke:http:offline       # local-only, no real upstream requests
npm run capacity:offline         # offline free-tier capacity preflight
```

Record the commit SHA you deploy; the release evidence gate (`npm run verify:release:evidence`) and `docs/NEXUS_MANUAL_RELEASE_RUNBOOK_2026-10-14.md` describe what must be written down.

Runtime environment variables of the app (all optional; none are secrets in git):

| Variable | Purpose |
|---|---|
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | shared rate limit (free Upstash database) - see `docs/FREE_SHARED_RATE_LIMIT.md` |
| `NEXUS_GITHUB_TOKEN` + `NEXUS_DEVOPS_ALLOW_GITHUB_TOKEN=1` | read-only token for higher GitHub limits; omit for anonymous public reads |

**Do not set the write-action variables (`NEXUS_DEVOPS_WRITE_*`, `NEXUS_DEVOPS_GITHUB_WRITE_TOKEN`, `NEXUS_DEVOPS_APPROVAL_SECRET`) on any public host.** Write actions run from the CLI on Sena's own machine / the Oracle A1 node next to Jarvis, never from the public web app.

## Option A - Vercel Hobby (personal, non-commercial) - recommended

Hobby is non-commercial: fine for Sena's personal ops dashboard, not for selling the product.

1. Confirm the target is the existing project `prj_sbU4ylt4OV4fLkcog3VpSr2fEXYe` (Hobby team) and that Git auto-deploy stays disabled.
2. Add env vars in the Vercel dashboard (Project -> Settings -> Environment Variables), Preview first, Production only after the preview passes.
3. Deploy a **Preview** of the exact SHA with the Vercel CLI from a clean checkout (`npx vercel deploy` after `npx vercel link`), not Production. Check the preview URL (it is protected by Vercel auth by default; see `docs/NEXUS_PROTECTED_PREVIEW_DEPLOYMENT_2026-10-14.md`).
4. Run `npm run smoke:http` against the preview with its bypass header/URL, and the 5 public API routes' admission checks (`docs/G06_FIVE_PUBLIC_ROUTES_FAILCLOSED_QA_2026-10-15.md`).
5. Rate limiting: Hobby allows **one** WAF rate-limit rule; follow `docs/vercel-hobby-waf-release-runbook.md` and read Vercel's "Rate Limiting Pricing" dialog yourself before activating (do not bypass it via API).
6. Promote to Production only with Sena's explicit approval (`vercel promote <preview-url>`). Rollback = promote the previous deployment.
7. Free-tier limits to watch (Hobby, as verified 2026-11-06): function invocations / bandwidth caps pause the project rather than bill; check the Usage tab weekly (feeds the Daily health card manually until a poller exists).

## Option B - Cloudflare (Workers with static assets / Pages)

Next.js 15 on Cloudflare uses the OpenNext adapter (`@opennextjs/cloudflare`) on the free Workers plan (100K requests/day; fails at the limit, never bills). This path is **not validated for this repo**: the app uses `next/server` route handlers with Node APIs and an in-process request limiter, so expect adjustments.

1. In a scratch branch (not trunk): `npm i -D @opennextjs/cloudflare wrangler`, add `wrangler.jsonc` with `compatibility_flags: ["nodejs_compat"]`, and the `open-next.config.ts` the adapter documents.
2. `npx opennextjs-cloudflare build` then `npx opennextjs-cloudflare preview` (local, free) and run the same smoke checks.
3. Set the same optional env vars with `wrangler secret put` (secrets) / `[vars]` (non-secret).
4. `npx wrangler deploy` only after Sena approves; the first deploy creates a `*.workers.dev` URL (no card required).
5. The process-local rate limiter does not share state across isolates; keep the Upstash limiter enabled on Cloudflare.

Choose Option A unless Vercel Hobby's non-commercial restriction becomes a problem; Option B is the fallback and needs its own QA pass.

## Option C - no hosting at all

The dashboard and MCP server are designed to run loopback-only next to Jarvis (`docs/JARVIS_INTEGRATION.md`, `docs/COMMUNITY_SELF_HOSTED.md`). The daily health card does not need the web app: `npm run devops:health` works from the CLI.
