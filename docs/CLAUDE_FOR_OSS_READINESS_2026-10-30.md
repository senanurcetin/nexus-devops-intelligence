# Claude for Open Source — evidence-first readiness (2026-10-30)

**Status: application research, not an eligibility or acceptance claim.** Project: [NEXUS DevOps Intelligence](https://github.com/senanurcetin/nexus-devops-intelligence). Program: [Anthropic's official terms](https://www.anthropic.com/claude-for-oss-terms) and [application](https://claude.com/open-source-max). **Benefit wording discrepancy (observed 2026-10-30):** the official application page advertises six months of **Claude Max 20x**, while the linked Anthropic Terms and Conditions currently describe six months of **Claude Ultra**. Confirm the actual awarded plan and billing terms during application/activation. This is a subscription benefit, **not API credits**. See the [evidence-based application draft](CLAUDE_FOR_OSS_APPLICATION_DRAFT_2026-10-30.md).

## Current verified repository facts

- Public GitHub repository `senanurcetin/nexus-devops-intelligence`, created **2026-10-12**; GitHub identifies its license as **MIT**. This is an OSI-approved license, but project-level license does not prove all upstream attribution obligations are satisfied.
- **0 stars and 0 forks** at the time of inspection on 2026-10-30. These are context, **not** formal threshold criteria.
- The source includes a public GitHub PR/Actions analytics dashboard, contributor documentation, synthetic tests, and a localhost-only Docker installation candidate. It does **not** document measured downstream adoption, package downloads, or community releases.
- The project's [PR #98](https://github.com/senanurcetin/nexus-devops-intelligence/pull/98) was merged on 2026-10-30. PRs in a repository the applicant owns **do not** count toward the program's 100 merged PRs into **other owners' repositories**. A PR number is not a verified count of merged PRs.

## Requirements and status

| Program rule | Evidence/status | What would establish it |
| --- | --- | --- |
| GitHub account age >= 2 years | **NOT VERIFIED**. Repo age is not account age. | Public GitHub user `created_at` as of application date. If younger than two years, this is a hard blocker that code cannot fix. |
| Public OSS activity in preceding 90 days | Recent source PRs exist; **account-wide scope not audited**. | Public commit/PR/review/release evidence and dates. |
| At least one project with an OSI-approved license | **MIT repo present**. | Verify source and license provenance before submitting. |
| 500 downstream repos / 100 downstream packages | **NOT VERIFIED**. | GitHub dependency graph or package registry statistics. |
| 200,000 monthly registry downloads | **NOT VERIFIED**; this package is marked `private` in `package.json`. | Real registry listings and download records. |
| 100 merged PRs into other owners' repos in preceding 12 months | **NOT VERIFIED**. PRs in this NEXUS repo do not qualify. | Public PR list across third-party repositories, filtered by merged date and author. |
| 20 unique external merged-PR contributors in preceding 12 months | **NOT VERIFIED**. | GitHub PR author, merge date and verified non-maintainer/collaborator status. |
| OpenSSF criticality >= 0.4 | **NOT VERIFIED**. | Actual OpenSSF criticality tool report, pinned to the repo. |
| Ecosystem Impact discretionary track | **NO CURRENT EVIDENCE OF DOWNSTREAM DEPENDENCE**. | Real adoption, downstream integrators, third-party use and criticality of the function. |

Meeting numerical thresholds is not automatic acceptance. **Trivial, duplicate, automated or contrived PRs may be disregarded.** Do not generate artificial commits, fake installations or manufacture contributions for eligibility.

## Reproducible, read-only evidence collection

From the repository root with Node 22.16+:

```bash
node --test tests/oss-community-evidence.test.mjs
node scripts/oss-community-evidence.mjs senanurcetin/nexus-devops-intelligence
```

The read-only CLI makes only **anonymous, bounded HTTPS GETs** to `api.github.com` and prints a JSON snapshot of repository/license metadata, a strictly validated owner account creation timestamp (if the owner is a user), and non-owner human authors of merged PRs *observed* within the exact preceding 12-month UTC window. It rejects wrong-repository PR links, noncanonical or out-of-window merge receipts and duplicate PR identifiers. `confirmed_distinct_non_owner_human_authors` is **null whenever coverage is incomplete**; the observed author list is only partial evidence in that case. It uses GitHub search and caps pagination at 10 pages/1,000 matches. It does **not** retrieve private data or access a token. GitHub may rate-limit anonymous traffic. An attempted live search on 2026-10-30 returned **403 secondary rate limit**; no live external contributor count is claimed from it.

**Interpretation:** Non-owner author counts are a **proxy**, not an audited count of external contributors; collaborators can also be non-owners. GitHub search results can be truncated or incomplete. The output makes coverage explicit. Account `created_at` for an organization is `null` by design. The output intentionally does **not** assert formal eligibility, dependents, downloads, OpenSSF criticality or account-wide 90-day activity.

## Submission plan

1. Verify account age using the GitHub profile data. If it is younger than two years, do not claim baseline eligibility; continue developing genuine OSS work and revisit when it meets the requirement.
2. Gather independently verifiable third-party adoption/contribution signals (with links, dates and counts). Prioritize substantive features, issue support, safe releases and real external users rather than cosmetic activity.
3. Submit the **accurate** evidence and planned use of Claude on the [official application](https://claude.com/open-source-max) only if making a good-faith application; there is also a discretionary track for infrastructure the ecosystem meaningfully depends on. Anthropic's approval is not guaranteed.
4. Avoid duplicate applications, fabricated usage or wording that confuses a new MIT project with established ecosystem infrastructure.

**Operational boundaries:** No GitHub-hosted CI workflows, deployment, paid services, automated PR creation in third-party repos, tokens, or changes to current production configuration are required for this evidence workflow. This document is a dated snapshot, not a release approval.
