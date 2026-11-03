# Codex community contributions / Topluluk içerik takvimi

> Draft planning horizon: **November 2026–April 2027**. This is an independent six-month *preparation calendar*, **not an assigned official Ambassador term** or a claim of selection. Application and private Drive video submission details must not be copied into this public repository.

## What counts / Ne sayılır?

OpenAI's public [Codex Ambassadors guidance](https://developers.openai.com/community/codex-ambassadors) describes at least **one useful event or content contribution per month during an actual six-month term**. We track three separately verifiable milestones rather than inflating a public GitHub draft into an external audience:

- `PUBLISHED_IN_REPO`: a useful guide exists on the public repository; this does **not** establish that it reached an outside community.
- `EXTERNALLY_SHARED`: a real publicly accessible share link and date are recorded; we do not invent social posts.
- `FEEDBACK_RECORDED`: a direct public reaction or review link exists. A self-written PR comment is **not** independent audience feedback.

Planned months do not count as published. The machine-readable [ledger](codex-community-ledger.json) is validated offline with `node scripts/verify-codex-community-ledger.mjs`; a schema/fixture failure should block an inaccurate promotion.

| Month / Ay | Planned topic | Current evidence level | Outstanding next step |
| --- | --- | --- | --- |
| 2026-11 | Native Codex test-first guard for malformed GitHub Search logins | Public repo guide (merged PR #153); external sharing not evidenced | Share [bilingual post draft](CODEX_NATIVE_MXC_COMMUNITY_POST_TR_EN.md) publicly; preserve URL, then real audience feedback |
| 2026-12 | Python regression design around a bounded open-source issue | Planned only | Demonstrate real tool provenance and exact-head tests; avoid assuming an unmerged PR will land |
| 2027-01 | Safe read-only GitHub Actions and CI evidence triage | Planned only | Create an offline reproducible walkthrough, publish and share |
| 2027-02 | Data-science reproducibility and source leakage boundaries | Planned only | Produce deterministic fixtures with a public reviewable diff |
| 2027-03 | Secure AI-assisted maintenance: untrusted source and attribution | Planned only | Teach human-review boundaries with direct evidence |
| 2027-04 | Six-month OSS PR retrospective and maintainer feedback | Planned only | Summarize actual approvals, rejections and CI states with canonical links |

## Recording rules / Kayıt kuralları

1. For each month, keep one record in the ledger. Do **not** imply an official program term starts in November; update dates if formal acceptance later defines different terms.
2. A repository guide is marked `PUBLISHED_IN_REPO` only once it is actually public. A draft in a local or PR branch does not satisfy publication.
3. Mark `EXTERNALLY_SHARED` only with a real `https://` post/event URL and an actual share date. A GitHub document permalink by itself is not an external community post.
4. Only mark `FEEDBACK_RECORDED` when at least one real feedback URL supports it. Store citations, not guessed impressions, audience sizes or follower counts.
5. Log exact source PR, authoring provenance (Codex CLI versus GPT-6 ChatGPT assistance), code/test SHA and CI status in the associated material.
6. Avoid disclosing private Drive video links, personal application identifiers, private submissions or unverified acceptance status.
7. Update user-facing content after major releases based on current official documentation; keep historical software versions and outcomes anchored to dated commits.

## For maintainers / Bakımcılar için

Use the same evidence separation for any open-source support eligibility: ongoing issue triage, review quality, reproducible tests, release safety and actual adoption count more than accumulating open PRs. The public [Codex for OSS overview](https://developers.openai.com/community/codex-for-oss) is aimed at core maintainers or widely used public projects; a self-hosted project is not automatically eligible.

**Next human-owned work:** Post the ready-to-share note on a genuine community channel, record the resulting link, collect real discussion/feedback, and keep official acceptance status private until independently confirmed. This repository provides the tested content and tracker, **not** a claim that these steps already happened.
