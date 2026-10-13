# NEXUS development / verification / deployment status register

**Snapshot:** 14 October 2026, Europe/Istanbul. **Authoritative for acceptance labels**, alongside [release manifest](NEXUS_RELEASE_CANDIDATE_MANIFEST_2026-10-14.md) and [remaining backlog](NEXUS_REMAINING_DEVELOPMENT_BACKLOG_2026-10-13.md). A completed PR or closed GitHub issue is **not** automatic proof that all acceptance gates passed.

## Status terminology

- **Implemented:** Source changes are in `main`; no claim about deployed/runtime effect.
- **Offline/manual tested:** Disposable Node/Chromium/local Redis/mock test results exist and are explicitly dated; the exact commit may need re-verification.
- **Protected Preview verified:** A specific READY Vercel Preview deployment with **matching SHA** passed explicitly authorized real checks. Evidence for an older SHA does not transfer.
- **Production released:** Production alias points to the **approved candidate SHA** and a bounded smoke result is recorded. A historical Production deployment exists, but the current GitHub candidate is not released.
- **Human accepted:** Evidence exists for actual NVDA/VoiceOver, real-device and owner/editorial testing; axe/fixture/browser automation alone is insufficient.
- **Deferred / risk accepted:** Owner explicitly recorded the residual issue; a deferred test does not become verified simply by choosing to accept risk.

## Workstreams as of snapshot

| Workstream | Implemented | Offline/manual tested | Latest Preview | Latest Production | Human accepted | Remaining |
| --- | --- | --- | --- | --- | --- | --- |
| Redis-first 20/60s IP admission / shared Actions+PR gate | Yes, PR #25/#26/#30 | Yes: real **local** Redis, two independent Node processes; 20 allowed, 21st 429; 0 Upstash commands | **Older** SHA `e745c61`: one cache-MISS connected shared-redis **200** only | **Older** SHA `74cd0e3`: not Redis-first authoritative implementation | Not applicable | **Actual independent Vercel instance enforcement UNVERIFIED**, Issue #7 OPEN; WAF Hobby Log-only, shared Free quota |
| Actions sampled outcome visualization | Yes, PR #31 | Yes, controlled Chromium and Node 111/111 at milestone | No new SHA deployed | No new SHA deployed | No | Source-specific visual acceptance on updated Preview |
| PR sampled merge-state visualization | Yes, PR #32 | Yes, controlled Chromium and Node 117/117 at milestone | No | No | No | Source-specific visual acceptance |
| Executive navigation, queue-first layout | Yes, PR #33 | Yes, six-width Chromium and Node 121/121 at milestone | No | No | No | Human editorial and actual Preview |
| Separate Actions/PR receipts, stale repo protection | Yes, PR #34 | Yes, 121/121 and controlled stale/503/retry Chromium | No | No | No | Exact-candidate Preview validation |
| API error sanitization / Redis-GitHub offline matrix | Yes, PR #35 | Yes, 129/129; 400/429/502/503/504/no-leak/no fanout | No | No | Not applicable | Real deployment error-budget review |
| Long/unbroken source label reflow / zoom | Yes, PR #36 | Yes, 132/132; 320–1440px + selected large text zoom; 0 automated axe A/AA violations | No | No | No | Extreme 320px+400% extra text-only zoom still overflowed, plus Firefox/WebKit and physical device |
| Offline API GitHub/Redis fanout + bundle budget | Yes, PR #37 | Yes, **135/135**; max 7 GitHub GETs, 2 synthetic Redis admissions; local page JS **401,241 raw / 117,432 gzip** | No | No | Not applicable | Actual Upstash/Vercel usage is unknown; owner check required |
| Release manifest / safe manual deploy + rollback procedure | Yes, docs on this branch when merged | Snapshot metadata checked 14 Oct | Deployment **not authorized** | New release **not authorized** | No | New exact-SHA preflight and owner approvals |
| Accessibility final acceptance | Some keyboard/axe/Chromium controls verified | Many automated checks | Latest updated SHA not deployed | Current production is old SHA | **UNVERIFIED** | [Manual SR-01…SR-12](MANUAL_ACCESSIBILITY_ACCEPTANCE.md) all unchecked. **Issue #5 is CLOSED** (GitHub state reason `completed`, closed 13 Oct 20:39 UTC) but there is no human-signoff evidence in the current manual checklist. Treat as **tracking discrepancy**, not permission to reopen without owner choice |

## Acceptance conflicts / editorial corrections

1. The historical [13 Oct Preview Redis runbook](PROTECTED_REDIS_PREVIEW_QA_2026-10-13.md) says Preview has no Redis variables and no live probe was ever performed. **Superseded**: Vercel currently reports both names as `Sensitive` / Production+Preview; a single protected Preview admission test succeeded for **older** SHA `e745c61`. That old runbook remains useful for script safeguards, but its opening status is no longer current.
2. The original [remaining backlog](NEXUS_REMAINING_DEVELOPMENT_BACKLOG_2026-10-13.md) still contains **historical task wording** (e.g., Q-01 says there is one common `lastApiResponseAt`, and older paragraphs call Q-05 pending). The newer completed PRs #34–37 and this status table supersede those old sentences. Do not interpret them as new regressions.
3. The [README](../README.md) previously stated **no public deployment** during a prior milestone. A READY Production deployment does exist, but it serves **older code** `74cd0e3` and should not be called a production release of current `main`.
4. GitHub **issue #5 is closed** by an owner action, but independent human NVDA/VoiceOver/physical-device evidence is **not present in the manual acceptance checklist**. Do not use the closed issue as proof. An operator may ask the owner whether to reopen it or use a new signoff record, but this documentation does not change its state.
5. An automated axe report with zero detected A/AA violations is **not** a human accessibility certification; a mock/fixed browser sample is **not real GitHub repo health**; an origin Redis 429 is **not edge WAF protection**.
6. SSO `all_except_custom_domains` protects applicable generated URLs only; verify the **exact** Preview domain rather than assuming all NEXUS aliases are gated.

## Immediate pending actions — no implicit deployment

- [x] R-01 metadata inventory documented (candidate proposed, not approved).
- [x] D-02 status ledger separates implementation, offline proof, protected Preview, Production and human signoff.
- [x] D-03 written owner-gated release/rollback procedure.
- [ ] R-01 exact proposed SHA rebuilt/tested (if not independently evidenced; must record result).
- [ ] R-02 owner verifies aggregate Upstash Free command/storage headroom; no secret access.
- [ ] R-03 owner explicitly approves **exact SHA, protected Preview only, expected origin-request budget**. Until then, no deploy.
- [ ] R-04 new protected Preview real visual/functional checks after R-03.
- [ ] R-05 human screen-reader/physical-device/editorial acceptance; tracking issue closure is not signoff.
- [ ] R-06 independent live cross-instance Redis evidence **without shared-Free quota stress**, or separately owner-accepted residual risk. Issue #7 stays OPEN.
- [ ] R-07 separate explicit Production approval, READY exact-SHA deployment, bounded public smoke and recoverable fallback.

## Pointers

- [Immutable audit source](https://github.com/senanurcetin/nexus-devops-intelligence/commit/599ced76605c25161b182b2d5bfbadbd091bfb53)
- [Production legacy SHA](https://github.com/senanurcetin/nexus-devops-intelligence/commit/74cd0e344eb94255b4bc8db99e4a4dc7f3a5a0bf)
- [Current local budget evidence](Q05_PUBLIC_BUDGET_QA_2026-10-13.md)
- [Manual accessibility checklist](MANUAL_ACCESSIBILITY_ACCEPTANCE.md)
- [No-CI manual release runbook](NEXUS_MANUAL_RELEASE_RUNBOOK_2026-10-14.md)
