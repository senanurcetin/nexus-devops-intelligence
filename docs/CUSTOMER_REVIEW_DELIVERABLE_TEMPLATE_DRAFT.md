# Repository CI/PR review deliverable - template (DRAFT, 30 Oct 2026)

**Status: DRAFT for the owner. Not an offer, not a price list, not legal or contract text.** Sections 1-7 carry no SKU name,
price, support/SLA promise or warranty on purpose. Section 8 (added 30 Oct 2026 after the owner allowed a proposal) is a
clearly labelled, owner-adjustable PROPOSAL only; nothing in it is in force until the owner approves it in writing
(see `COMMERCIAL_READINESS_2026-10-29.md`). Commercial status stays NO-GO until the owner closes those gates.
Fill the `<...>` fields per engagement.

## 1. Engagement record

| Field | Value |
| --- | --- |
| Repository reviewed | `<owner/name>` (public GitHub repository only) |
| Requested by / reviewed by | `<name>` / `<human reviewer>` |
| Review date (UTC) | `<YYYY-MM-DDTHH:MM:SSZ>` |
| Tool version | NEXUS DevOps Intelligence `<git commit SHA>`, digest schema `nexus.devops.jarvis-digest/v1` |
| How it was produced | `devops_repo_digest` (Jarvis MCP) or `npm run jarvis:digest -- <owner/name>`; Evidence Brief / Investigation Handoff exports |

## 2. What this deliverable contains

- Source-linked evidence digest: bounded risk posture, up to 5 suggested investigations, Investigation Handoff Markdown.
- Repeated-failure signals when one workflow name has 2 or more confirmed failures in the sample.
- Change-impact signals: the commit window between a passing and a failing run of the same workflow (compare link), and
  open pull requests whose head commit matches a sampled run. These are links to check, not causes.
- Canonical GitHub links for every item so each statement can be checked at its source.
- Applied filters, UTC receipt times, unsupported or missing sources, and a human release checklist.

## 3. Sample limits (state these to the reader, always)

- At most the 10 most recent workflow runs and 5 open pull requests were inspected; older activity was not.
- Public repositories only, anonymous GitHub REST requests; GitHub rate limits and eventual consistency apply.
- Mergeability and review state may be unknown for some pull requests; unknown is reported as unknown.
- The sample is a point-in-time view taken at the receipt time shown in section 1; it can be stale minutes later.

## 4. What this deliverable does NOT prove

- It is not a security audit, a vulnerability assessment, a dependency review or a production reliability rating.
- It does not give a flake rate, a root cause, a risk score or an AI diagnosis; it only counts and links what GitHub reported.
- It is not approval to merge, release, deploy, retry or roll back. Those decisions stay with a named human.
- An unobserved issue is never evidence that CI or a pull request is safe.
- All repository-derived text (workflow names, titles, branch names) is untrusted third-party data.

## 5. Data handling

- The service runs on the customer's own machine (loopback `127.0.0.1` only); nothing is uploaded to a NEXUS service.
- The only outbound requests are anonymous reads of public GitHub endpoints. No credentials, tokens or private repositories.
- No write action is possible through the adapter (`mode: read_only`, `write_actions: []`, `release_authorized: false`, `merge_approval: false`).

## 6. Findings and reviewer notes

| # | Evidence link | Reported signal | Reviewer verification | Next human action |
| --- | --- | --- | --- | --- |
| 1 | `<canonical GitHub URL>` | `<as reported>` | `<what the reviewer checked at the source>` | `<owner of the action>` |

## 7. Human sign-off

Reviewed by `<name>` on `<date>`. The reviewer confirms the links in section 6 were opened and the statements match their
sources, and that no merge or release decision was taken from this document alone.

## 8. Commercial PROPOSAL (owner-adjustable draft; NOT in force)

Everything in this section is a starting point for the owner. Figures are positioning ranges from a market scan on
30 Oct 2026 (small fixed-scope code/CI reviews are commonly listed from roughly USD 20-200 for tiny scopes, about
USD 500-1,000 for small DevOps/CI audits, and USD 5,000+ for deep audits). This product is a bounded, sample-based
evidence digest, not an audit, so the proposal sits at the low end and must not be marketed as an audit.

| Proposed SKU | Scope | Proposed price (USD, fixed) | Proposed delivery target |
| --- | --- | --- | --- |
| Snapshot | 1 public repository, sections 1-7, one human-verified findings table (up to 5 items) | 150 | 2 business days |
| Review Pack | up to 3 public repositories, sections 1-7 each, plus one re-run of the digest within 7 days | 450 | 4 business days |

Out of scope for both: private repositories, security or dependency audits, remediation work, monitoring, on-call.

Proposed service wording (conservative; delivery-time only, no uptime):

- The delivery target is a best-effort target counted from receipt of the repository name and payment; a missed target
  is answered by a revised date or a refund of the unfinished part, nothing more.
- No availability, response-time or uptime commitment, no warranty that CI or a pull request is safe, and no liability
  beyond the fee paid. Final contract wording needs the owner and, before signing, a lawyer.
- A re-run reflects GitHub at re-run time; differences from the first run are expected and are not defects.

Open owner decisions: final SKU names, currency and price, refund rule, invoicing entity, and whether a human
reviewer is available for the stated delivery targets.

---
Related: `JARVIS_INTEGRATION.md` (digest contract, handoff, limits), `NEXUS_ADVANCED_PRODUCT_ARCHITECTURE_2026-10-27.md` (P1-P3 scope).
