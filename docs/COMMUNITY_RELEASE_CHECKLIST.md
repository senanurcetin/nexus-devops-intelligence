# NEXUS Community — first external release gate

**Date:** 2026-10-15. **State: NO-GO / release not published.** **Owner-first decision:** zero outside users and zero revenue are valid. External pilot recruitment is NOT a Community or personal-use gate. This checklist applies only to `senanurcetin/nexus-devops-intelligence` and is separate from any Vercel/Cloud launch approval.

## Zero-spend boundaries

- Keep MIT public source and current repository visibility.
- Do not enable hosted paid CI, automatic Vercel deployment, GitHub App access to private repos, Redis live stress, external tunnels, analytics/telemetry or billing.
- The supported initial deployment is a **single local machine** with Docker Engine 28+, loopback-only port 3000 and anonymous **public** GitHub read-only data. No account registration or GitHub token.
- Docker Desktop commercial licensing differs from free Docker Engine; check customer eligibility before offering installation support.
- Existing Preview/human Redis gates are in #49 and #7; they do not silently pass because a localhost Docker build works.

## Alpha gate — actual build and source QA

- [ ] Review [Docker candidate PR #80](https://github.com/senanurcetin/nexus-devops-intelligence/pull/80) at an exact commit SHA.
- [ ] Run clean `npm ci`, `npm test`, `npm run typecheck`, `npm run build`; record Node version, command outputs and test count.
- [ ] Run `docker compose config`, image build and runtime; verify nonroot Node identity, secret exclusion, small runtime surface and shutdown.
- [ ] Verify the **host** only publishes `127.0.0.1` on a Docker Engine >=28 system with ordinary NAT/direct-routing settings.
- [ ] Run the six-request local safe smoke: homepage 200 and five invalid-route 400/no-store with security headers; it must send **no valid GitHub upstream request**.
- [ ] Perform a bounded, voluntarily requested public repository test and confirm quota/error guidance does not mislabel unknown evidence as healthy.
- [ ] Check Windows Docker Desktop and Ubuntu Docker Engine separately. Record `NOT RUN` for any platform not observed.
- [ ] Run interactive keyboard/mobile and at least one real Chrome/Firefox smoke on the packaged build; real human assistive technology acceptance is a separate explicit gate.
- [ ] Run image/dependency security checks and manual secret inspection **without posting secrets**.

## Owner-only local alpha gate (no external pilots needed)

- [ ] One real maintainer OS install (Docker Engine >=28), source SHA, port and safety checks are recorded before labeling the app usable by its owner.
- [ ] Record at least one real owner workflow/PR inspection with an authentic **public** GitHub source link, or explicitly record "no eligible event" without inventing insights.
- [ ] Record **NOT RUN** for missing platform/browser evidence; owner-local alpha is not a verified cross-platform public release.
- [ ] Owner can continue using the app with **0 outside users / 0 revenue**. No telemetry, account registration or sales process required.
- [ ] Optional 30-day owner evaluation is logged in [owner-first scorecard](NEXUS_OWNER_FIRST_USAGE_SCORECARD_2026-10-15.md) after the plan branch is merged.

## Community publication gate

- [ ] Publish accurate English setup instructions, optional example screenshot with provenance, FAQ and known limitations; do not claim made-up screenshots or usage.
- [ ] Verify issue forms and PR template receive actionable reports without requesting secrets.
- [ ] Review MIT LICENSE, third-party notices, security contact and support boundaries.
- [ ] Select version/tag only after passing build and safety evidence; publish full tag and SHA as **Community alpha**, not production-certified SaaS.
- [ ] Public community documentation is accurate and discoverable. **External pilot recruitment is optional, NOT a release gate**; no paid ads or unsolicited mass mail.
- [ ] Count actual installations, issues and opt-in feedback only when they exist. **0 external installations / 0 revenue is acceptable**; never invent users or revenue.

## Optional revenue gate — only if real demand appears

- [ ] Record at least one independently verified paid installation/customization request or payment commitment before funding managed hosting.
- [ ] Price any work with explicit scope and customer-provided infrastructure; check local invoicing/tax and relevant software licenses.
- [ ] Only consider a separate, owner-approved NEXUS Cloud plan after usage evidence, security architecture, tenant separation and a sustainable cost model.

**Owner decision:** no external pilot or sales target is required. **Public release Go/No-Go signoff:** pending technical and safety acceptance; do not merge/release/charge solely because this document exists.
