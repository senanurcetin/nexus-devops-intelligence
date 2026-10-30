# External upstream OSS contribution audit — 30 October 2026

This is a dated, **GitHub-search-based discovery record**, not a formal Anthropic eligibility verdict. Per owner instruction, GitHub account age verification is deferred until final review.

**Update:** All 15 search-reported merged PRs have now been individually verified for author, destination owner, actual merge state, and UTC merge date. See the [15-row verified evidence register](OSS_VERIFIED_THIRD_PARTY_MERGED_PRS_2026-10-30.md) for source links and exact timestamps. That verification does not establish Anthropic's subjective qualitative acceptance.

## Measured starting point

GitHub-connected PR search with `author:senanurcetin`, `merged:>=2025-10-30`, and `-user:senanurcetin` returned **15 merged upstream PRs**. An analogous search for open third-party PRs returned **33**. Open PRs are not credited toward Anthropic's 100 merged external-PR threshold. If all 15 merged contributions qualify, the remaining numerical gap is **85**, but Anthropic can exclude trivial or manipulated activity.

### Source-linked merged examples

- pyjanitor: [#1786](https://github.com/pyjanitor-devs/pyjanitor/pull/1786), [#1820](https://github.com/pyjanitor-devs/pyjanitor/pull/1820), [#1822](https://github.com/pyjanitor-devs/pyjanitor/pull/1822)
- xarray: [#11713](https://github.com/pydata/xarray/pull/11713), [#11714](https://github.com/pydata/xarray/pull/11714), [#11715](https://github.com/pydata/xarray/pull/11715), [#11806](https://github.com/pydata/xarray/pull/11806)
- Altair: [#4178](https://github.com/vega/altair/pull/4178), [#4179](https://github.com/vega/altair/pull/4179), [#4180](https://github.com/vega/altair/pull/4180)
- DuckDB docs: [#7494](https://github.com/duckdb/duckdb-web/pull/7494), [#7495](https://github.com/duckdb/duckdb-web/pull/7495), [#7496](https://github.com/duckdb/duckdb-web/pull/7496)
- [SciPy #26391](https://github.com/scipy/scipy/pull/26391), [Plotly #5823](https://github.com/plotly/plotly.py/pull/5823)

## Complete 33-PR CI and review checkpoint

See the [33-row upstream PR review and CI matrix](OSS_UPSTREAM_PR_REVIEW_MATRIX_2026-10-30.md), linked to each PR and its observed head revision. As of the 30 October 2026 snapshot: **3 GitHub Actions successes**, **20 `action_required` authorization holds**, **9 PRs with no visible workflow/commit status**, and **1 PR with a failing CircleCI Python 3.9 check** (12 other statuses successful). This is not upstream acceptance, and missing or authorization-blocked checks are not labeled successful.

## Review priorities

| Upstream PR | Inspected state | Next step |
| --- | --- | --- |
| [Anthropic Claude Agent SDK #1421](https://github.com/anthropics/claude-agent-sdk-python/pull/1421) | Open and mergeable; independent **APPROVED** review | Preserve approved head; wait for actual maintainer feedback |
| [Altair #4189](https://github.com/vega/altair/pull/4189) | Open and mergeable; reviewer re-approved after fixes | No gratuitous activity/trigger commits |
| [sktime #11538](https://github.com/sktime/sktime/pull/11538) | Open and mergeable; reviewer noted downstream missing-residual behavior | Independently verify the claimed regression behavior on exact head |
| [Seaborn #4025](https://github.com/mwaskom/seaborn/pull/4025) | Open and mergeable; no review returned | Monitor genuine reviewer requests |
| [Folium #2323](https://github.com/python-visualization/folium/pull/2323) | Open and mergeable; PR body contains pasted HTML | Markdown metadata repair blocked by GitHub integration 403; owner UI may be needed |

Third-party repositories control their own approvals/merges. Connected GitHub write privileges on NEXUS do **not** confer upstream maintainer authority. Do not generate trivial PRs, duplicate reports, automated mass comments or fake adopters.

## Reproducible collector

From NEXUS repository root on Node 22.16+:

```bash
node --test tests/oss-upstream-pr-audit.test.mjs
node scripts/oss-upstream-pr-audit.mjs senanurcetin
```

The new utility issues only anonymous GET calls to `api.github.com`, with a fixed host and bounded pagination (up to 1,000 results per search). It separates open and merged third-party contributions and treats partial, inconsistent, truncated or rate-limited queries as **not fully verified**. This is a point-in-time discovery mechanism, not a guarantee that Anthropic accepts each PR. No deployment, GitHub Actions workflow, token, or paid resource is needed.

Program source: [Claude for Open Source](https://claude.com/contact-sales/claude-for-oss).
