# NEXUS Community — first external release gate

**Date:** 2026-10-15. **State: NO-GO / release not published.** **Commercial decision (supersedes owner-only):** zero free pilot users is acceptable, but preparing a sale-ready product is a required workstream. Actual revenue may remain zero until a genuine sale. External pilot recruitment is NOT a release gate. This checklist applies only to `senanurcetin/nexus-devops-intelligence` and is separate from any Vercel/Cloud launch approval.

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

## Direct commercial-sale readiness gate (NO mandatory pilots)

- [ ] Exactly define **NEXUS Commercial Setup & CI Review** as a paid verified installation/analysis/handover/support deliverable on buyer-owned infrastructure, with realistic time limits, refund/rollback and exclusion list.
- [ ] Distinguish Community MIT rights from the **paid service**; no implication of exclusive licensing over publicly available source.
- [ ] Do not advertise **NEXUS Pro** software licenses until new rights-cleared premium features exist, security acceptance passed and real commercial licensing terms approved.
- [ ] Supply truthful English comparison/landing and actual authorized screenshots/source evidence; do not fabricate references, active subscriptions or clients.
- [ ] Before accepting money, verify legal seller, invoicing/tax/returns, service terms and an approved payment collection method; no unverified hosted checkout.
- [ ] Optional outside beta recruitment and external testers are **NOT REQUIRED** for this sale-ready gate; use owner's real source-linked QA, offline fixtures and supported target OS acceptance.
- [ ] Record first real sale only after accepted order/payment and delivered/contracted scope; 0 verified sales stays 0.
- [ ] Follow [commercial strategy](NEXUS_COMMERCIAL_NO_PILOT_GO_TO_MARKET_2026-10-15.md) after that document is merged to main.

## Optional revenue/Cloud financing gate

- [ ] Record independently verified paid work or separately approved financing **before** funding managed hosting; a sale-ready product alone does not fund Cloud.
- [ ] Price any work with explicit scope and customer-provided infrastructure; check local invoicing/tax and relevant software licenses.
- [ ] Only consider a separate, owner-approved NEXUS Cloud plan after usage evidence, security architecture, tenant separation and a sustainable cost model.

**Commercial decision:** no external pilot is required; preparing the paid package and lawful checkout path IS a target. Successful sales cannot be guaranteed. **Public release Go/No-Go signoff:** pending technical and safety acceptance; do not merge/release/charge solely because this document exists.
