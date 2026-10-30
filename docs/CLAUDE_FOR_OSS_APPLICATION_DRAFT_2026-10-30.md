# Claude for Open Source — evidence-based application working draft

**Status:** PREPARED, **NOT SUBMITTED**, **NOT ELIGIBILITY-CERTIFIED** (snapshot 2026-10-30). This is for final owner review when genuine contributions/adoption provide enough evidence. **Do not submit an additional application if an earlier application for this person is already pending.**

## Official form and terms

- [Application](https://claude.com/contact-sales/claude-for-oss)
- [Terms and Conditions](https://www.anthropic.com/claude-for-oss-terms)
- The application page currently describes **six months of Claude Max 20x**, while the linked terms currently identify **Claude Ultra**. This inconsistent product naming must be confirmed with Anthropic before describing the precise award or post-benefit billing; **this is a subscription, not API credits**.
- Application fields include GitHub handle, repository URL, factual reach/impact and proposed subscription use. Terms request a **maximum 500-word** qualification statement, applicant email and GitHub sign-in.
- Anthropic may disregard trivial, duplicative, automated or manipulated contribution metrics. Numerical thresholds alone do not guarantee approval.

## Current evidence and limitations

- GitHub: `senanurcetin`.
- [15 individually verified PRs merged into six third-party organizations](OSS_VERIFIED_THIRD_PARTY_MERGED_PRS_2026-10-30.md) as of 2026-10-30: four code/performance/bug fixes and eleven documentation/example improvements.
- Representative code work: [pyjanitor performance](https://github.com/pyjanitor-devs/pyjanitor/pull/1822), [pyjanitor mutation fix](https://github.com/pyjanitor-devs/pyjanitor/pull/1820), [pyjanitor missing-value fix](https://github.com/pyjanitor-devs/pyjanitor/pull/1786), and [xarray warning fix](https://github.com/pydata/xarray/pull/11714). The PR links verify merge status, not independent downstream utilization.
- [NEXUS DevOps Intelligence](https://github.com/senanurcetin/nexus-devops-intelligence) is an open MIT-licensed project with public GitHub Actions/PR analysis and a localhost-only Community build candidate. Independent real-world installs, package downloads, adoption, and Community cross-platform release acceptance are **not verified**.
- The **100 external merged PR** path is **not yet met** (15 known). The discretionary **Ecosystem Impact** path requires evidence of the ecosystem's meaningful dependence; the current NEXUS adoption evidence does **not** establish that.
- **Do not assert** registered maintainer status in pyjanitor/xarray/Altair, OpenSSF criticality, 20 external NEXUS contributors, dependency/download thresholds, or a two-year GitHub account without the actual source. Account age remains intentionally deferred to final pre-application verification at the owner's direction.

## Qualification / reach and impact — candidate response (English, under 500 words)

I contribute to public open-source Python data and visualization libraries while maintaining the MIT-licensed NEXUS DevOps Intelligence project.

Between 13 and 28 October 2026, GitHub records confirm that 15 of my pull requests were merged into repositories owned by six independent organizations: pyjanitor-devs, pydata, SciPy, Vega, Plotly, and DuckDB. My code contributions include preventing unintended input DataFrame mutation in pyjanitor's `pivot_longer`, improving performance for homogeneous NumPy value groups, fixing missing-value handling in `drop_constant_columns`, and addressing expected all-NaN warning behavior in xarray. I also contributed documentation and usage examples that clarify data-science library behavior. The linked merge records are available in my public evidence register.

NEXUS DevOps Intelligence is an MIT-licensed, read-only tool for investigating public GitHub Actions and pull-request evidence. I am improving its security, reproducibility and self-hosted developer experience. It is still a Community release candidate, and I do not claim verified downstream installations or downloads.

I am not claiming to have reached the 100 merged-external-PR threshold or any other numerical threshold. I would welcome discretionary consideration for my substantive cross-project maintenance contributions, with the understanding that ecosystem impact and eligibility are determined by Anthropic.

## How will you use the subscription? — candidate response (English)

I would use the subscription to investigate and fix genuine upstream issues in Python data/visualization libraries, reproduce bugs against pinned versions, design targeted regression tests, review maintainers' feedback, and improve documentation. I would also use it to develop and validate NEXUS DevOps Intelligence's open-source Community release, with particular emphasis on safe read-only GitHub access, testable evidence, Docker security, accessible UI and reliable self-hosted workflows. I will report tests and platform acceptance honestly and respect upstream review processes.

## Pre-submission hard gates (DO NOT SKIP)

- [ ] Confirm whether any previous Claude for OSS application is pending, to avoid duplicate submission.
- [ ] Independently validate GitHub account `created_at` is at least two years before application date, account good standing, eligible residency, age and 90-day public OSS activity. Owner requested **account-age check last**.
- [ ] Confirm personally approved GitHub OAuth, intended associated email address, correct application repo URL (do not misrepresent ownership of external library repos) and the then-current subscription terms.
- [ ] Re-run latest upstream merge audit and verify any new PR merge dates/metadata; update the 12-month rolling window.
- [ ] Collect verified additional evidence of upstream project usefulness or NEXUS external adoption. Never invent dependents, downloads, reviews or maintainers' endorsements.
- [ ] Reassess whether the Maintainer Track or Ecosystem Impact Track is supportable; if neither is supported, maintain the draft rather than claiming eligibility.
- [ ] Submit only one complete, truthful application with owner-reviewed text. No application has been submitted as part of this document.

**AI assistance disclosure:** The working draft was prepared with AI assistance from dated public GitHub PR metadata; all substantive eligibility claims require final human review before publication.
