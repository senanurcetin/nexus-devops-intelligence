# NEXUS DevOps Intelligence - commercial readiness (29 Oct 2026)

**State: NO-GO for selling today. No paid product, checkout, Pro license or Cloud SaaS exists or is authorized.**
This note separates what engineering can finish at zero spend from what needs an owner decision or money. It does not change
the MIT Community license and it is not authorization for billing, deployment or external communication.

## What is sellable first (as already planned)

The first proposed paid SKU in `NEXUS_COMMERCIAL_NO_PILOT_GO_TO_MARKET_2026-10-15.md` is a **verified, customer-hosted
installation plus a bounded CI/PR review deliverable**. The Jarvis integration contributes the repeatable review deliverable:
`devops_repo_digest` produces a source-linked, evidence-bounded digest and Markdown handoff for one public repository
(see `JARVIS_INTEGRATION.md`). It is a delivery tool, not a feature that justifies a Pro license.

## Gates that engineering alone cannot close

| Gate | Why it blocks | Who decides |
| --- | --- | --- |
| Pro functionality (S4) | A Pro license needs genuinely new, rights-cleared premium functionality in a **separate approved private codebase**; adding it to this MIT repository would make it MIT. | Owner |
| Native Ubuntu Docker acceptance and image CVE review (#81) | Community Docker candidate is merged but not accepted on Ubuntu; release stays NO-GO. | Owner provides an Ubuntu host/Engine |
| Hosting | Vercel Hobby must not host a commercial SaaS; Cloud (S7) is not authorized. A customer-hosted install avoids this. | Owner |
| Checkout, tax, terms, privacy notice, support/SLA wording | No account or legal text exists; creating accounts or taking payments is an owner action. | Owner |
| Spend | Budget is 0 TRY unless the owner explicitly authorizes a purchase. | Owner |
| Exact-SHA release evidence | `npm run verify:release:evidence` must be fed real receipts (Windows + Ubuntu + Docker + CVE) for the exact commit; incomplete proof cannot return PASS. | Engineering, after the inputs above exist |

## Zero-spend work that remains for engineering

1. DONE 30 Oct 2026 on `adf189f` (fresh clone, `npm ci --ignore-scripts --include=dev`): Windows typecheck PASS, build PASS, tests 316 pass / 4 fail - all 4 are `EPERM symlink` (no symlink privilege on this Windows account). Linux (Ubuntu under WSL2, real Linux filesystem, Linux Node): typecheck PASS, tests 320 = 319 pass / 0 fail / 1 skipped. This is NOT the native Ubuntu acceptance of #81. Re-run 30 Oct 2026 on `e12483b` (fresh Linux clone, pure Linux PATH, Linux Node 24.13.0): typecheck PASS, tests 334 = 333 pass / 0 fail / 1 skipped. Note: with `NODE_ENV=production` in the shell, `npm ci` skips devDependencies (no tsc/tsx); use `--include=dev`.
2. Register the DevOps MCP adapter in Jarvis through ANA CORE's landing gate (requested separately).
3. Customer deliverable template: neutral DRAFT written (`CUSTOMER_REVIEW_DELIVERABLE_TEMPLATE_DRAFT.md`: scope, sample limits, what a digest does not prove, data handling, sign-off). It carries no SKU, price, SLA or warranty wording; the owner fixes those before any use.
4. Windows auto-start is done (`ops/windows/`, see `JARVIS_INTEGRATION.md`). Linux systemd user unit written (`ops/linux/`) and tested under WSL2 Ubuntu on port 3011: busy-port guard exit 3, healthy 200 on 127.0.0.1 only, `kill -9` gives a new PID and health 200, uninstall leaves no unit and no listener. Not tested: native Ubuntu host, reboot/logon, linger.
