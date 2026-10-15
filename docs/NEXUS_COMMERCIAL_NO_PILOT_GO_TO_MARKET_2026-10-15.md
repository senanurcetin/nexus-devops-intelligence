# NEXUS DevOps Intelligence — Direct Commercial Sales, No Pilot Requirement

**Decision:** 15 October 2026. **Status:** planning; no paid product live, no customer sales verified, no checkout configured. **Cash budget: 0 TRY.** Public MIT Community continues.

## 1. Commercial offer

**First SKU — NEXUS Commercial Setup & CI Review (one-time, customer-hosted).** Deliver a validated, supported setup of the existing Community product on an agreed OS and customer-provided computer, plus a bounded, source-linked audit of public GitHub Actions/PR findings, onboarding/handover, limited support term, clear exclusions and optional separately quoted changes. Fees buy real installation/analysis/support deliverables, not exclusive rights to Community MIT code. Neither an unknown OS nor private repo can be promised without consent and real acceptance.

**Second SKU — NEXUS Pro Self-Hosted Software License (future).** Only sell a license to **genuinely new** verified value (e.g., safe read-only private repo GitHub App auth, durable history, scheduled/team reporting) after own code/contributor/third-party licensing rights are cleared and an approved private development/release process exists. These features are **not built**. MIT Community rights cannot be revoked by switching repos private.

**Optional later:** revenue-backed NEXUS Cloud SaaS. Do not sell the current Hobby Vercel deployment as SaaS.

## 2. Internal QA in place of recruited free pilot users

At least three **real owner** sample investigations referencing actual public GitHub URLs, compared with native GitHub evidence. Separate unit/integration test fixtures for 400/429/503/504, auth/quota failures, incomplete trend coverage, cancelled/unknown PR states and stale data. At exact shipping SHA: clean package installation, tests/typecheck/build, dependency + secret scan, browser keyboard/mobile/error flows, and Docker Engine >=28 Compose port **127.0.0.1 only**, non-root runtime, no embedded token, safe startup/restart/rollback. Windows/Ubuntu support must match **actually tested** platforms. Every item shows PASS/FAIL/NOT RUN.

This establishes engineering readiness only. Internal dogfooding does **not** validate payment willingness, novice UX, or external product-market fit. No mandatory free user recruitment or false testimonials.

## 3. Sales enablement before accepting money

- **Truthful English landing copy**, on the existing portfolio/repo: current features vs planned; public-only, anonymous GET, bounded sample of 10 runs / 5 PRs, explicit partial/unknown status. Include consented real screenshot/source provenance, not synthetic case studies.
- **Commercial scope sheet:** supported OS, setup and verification, sample report format, buyer responsibilities (Docker and own infrastructure), deliverables, aftercare window, non-included work, recovery/rollback, potential usage quotas; fixed-scope quote.
- **Costs/pricing:** draft price = expected service hours × viable rate + support reserve + transaction/tax costs. This is an internal hypothesis; do not invent a competitor price or publish a placeholder as final.
- **Contract / consumer rights / privacy / tax:** verify seller eligibility, invoices and receipts, refund/withdrawal applicability, cross-border data processing and software terms with local professional advice. Customer funds should not be accepted before the product can be delivered as described.
- **Collection method:** for domestic sales compare a lawful bank transfer/verified local payment link; for software/global payments evaluate a Merchant of Record such as Paddle or Lemon Squeezy *only after seller approval*. Supported Turkey country ≠ automatic payout/merchant approval. Payment processor commissions do not require purchasing a hosted SaaS subscription, but onboarding and legal work still exist.
- **Inbound or authorized sales:** NEXUS portfolio and GitHub comparison page, contact/quote, and relevant opt-in B2B outreach. No bought ads, unsolicited mass mail, CRM expense or mandatory demo users.

## 4. Independent acceptance gates

| Gate | Done when | Status as of 15 Oct |
| --- | --- | --- |
| Engineering | Exact source QA + own repo sample validation + documented host OS/Docker security | OPEN — PR #80 and Issue #81 |
| Delivery | Reproducible installer image, support/rollback, honest feature matrix and bounded CI review template | PLANNED |
| Business | Lawful seller/payment/invoice/refund and clear scope/price accepted, no false claims | NOT VERIFIED |
| Visibility | Accurate English product overview and way to request a quote (before checkout) | PLANNED |
| Market | Actual qualified leads, quotes, orders, net paid sales | UNKNOWN/0 verified; **not a technical gate** |
| Free pilots | Optional | **NOT REQUIRED** |
| Pro license | Newly implemented feature and separately checked license/security | NOT BUILT |
| Cloud | Approved funded multi-tenant operations/hosting | HOLD |

**Definitions:** *Sale-ready* = first 4 gates met. *Sold* = a real, lawfully recorded sale; never a roadmap or promise. If no buyers are found, revise positioning/pricing and retain a zero-spend product; there is no reason to invent free users or launch paid hosting.

## 5. Four-week sequence

Week 1: PR #80 and Issue #81 source and Docker/OS acceptance; internal QA.  
Week 2: 3 real source-linked owner sessions, installer/support/recovery checks; prepare bounded deliverable.  
Week 3: rights/third-party review, terms, cost-based proposed pricing, onboarding/payment decision, English Community vs Commercial positioning.  
Week 4: publish truthful sales/contact material once approved; accept legitimate quotes or orders **only after business and technical readiness**. Review inquiry count and actual paid outcomes, including zero. Begin Pro code only when feature/license scope is decided; Cloud remains deferred.

## Source/decision references

- MIT: https://choosealicense.com/licenses/mit/
- Merchant countries: https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle
- Lemon Squeezy payouts: https://docs.lemonsqueezy.com/help/getting-started/supported-countries
- Docker Desktop licensing: https://docs.docker.com/subscription-billing/desktop-license/
- Vercel Hobby: https://vercel.com/docs/plans/hobby
- Repo verification: #80, #81, #82 and hosted gates #49/#7.
