# Upstream open PR review and CI evidence matrix — 2026-10-30 UTC

**Scope:** 33 open third-party PRs authored by `senanurcetin` in repositories owned by others, discovered via the connected GitHub PR search. Each listed PR was checked for its review-thread summary, review decisions, head mergeability and visible head-SHA workflow runs. Where no GitHub Actions run was returned, commit statuses were checked separately. This is an **inspection record**, not a code-correctness certification or Anthropic acceptance judgement.

## Summary (head revisions observed on 2026-10-30)

| CI observation | Number | Interpretation |
| --- | ---: | --- |
| GitHub Actions completed successfully | 3 | Workflow CI succeeded; this is **not** maintainer review or merge approval |
| GitHub Actions `action_required` | 20 | Fork workflows need **upstream authorization**; not a failing test result |
| No workflow runs or commit statuses returned | 9 | No official CI PASS/FAIL established for this head |
| CircleCI has 12 SUCCESS statuses and 1 FAILURE | 1 | Python 3.9 check failed; do not label the PR green |
| **Total** | **33** | All are open and **do not count** as merged contributions |

## Per-PR register

`Head` is the observed abbreviated head commit SHA; CI observations apply **only to that revision** and may become stale after new commits.

| Upstream PR | Head | Observable CI category |
| --- | --- | --- |
| [has2k1/plotnine #1139](https://github.com/has2k1/plotnine/pull/1139) | `119d1ab` | GitHub Actions action_required |
| [vega/altair #4189](https://github.com/vega/altair/pull/4189) | `178b4ce` | GitHub Actions SUCCESS |
| [python-visualization/folium #2323](https://github.com/python-visualization/folium/pull/2323) | `512b9b2` | GitHub Actions action_required |
| [holoviz/hvplot #1768](https://github.com/holoviz/hvplot/pull/1768) | `045d11a` | GitHub Actions action_required |
| [holoviz/holoviews #7135](https://github.com/holoviz/holoviews/pull/7135) | `dfd1454` | GitHub Actions action_required |
| [mwaskom/seaborn #4025](https://github.com/mwaskom/seaborn/pull/4025) | `f1f18ae` | GitHub Actions action_required |
| [holoviz/hvplot #1767](https://github.com/holoviz/hvplot/pull/1767) | `421ec70` | GitHub Actions action_required |
| [mwaskom/seaborn #4012](https://github.com/mwaskom/seaborn/pull/4012) | `f819994` | GitHub Actions action_required |
| [mwaskom/seaborn #4022](https://github.com/mwaskom/seaborn/pull/4022) | `37c428e` | GitHub Actions action_required |
| [anthropics/claude-agent-sdk-python #1421](https://github.com/anthropics/claude-agent-sdk-python/pull/1421) | `9676e98` | GitHub Actions action_required |
| [vega/vega-lite #9956](https://github.com/vega/vega-lite/pull/9956) | `2e6286e` | GitHub Actions action_required |
| [skrub-data/skrub #2347](https://github.com/skrub-data/skrub/pull/2347) | `9836a7b` | GitHub Actions SUCCESS |
| [mwaskom/seaborn #4011](https://github.com/mwaskom/seaborn/pull/4011) | `a19cf21` | GitHub Actions action_required |
| [mwaskom/seaborn #4013](https://github.com/mwaskom/seaborn/pull/4013) | `62d8d1a` | GitHub Actions action_required |
| [goldmansachs/gs-quant #408](https://github.com/goldmansachs/gs-quant/pull/408) | `bb2e9e3` | No workflow/commit-status evidence |
| [goldmansachs/gs-quant #407](https://github.com/goldmansachs/gs-quant/pull/407) | `be07818` | No workflow/commit-status evidence |
| [goldmansachs/gs-quant #405](https://github.com/goldmansachs/gs-quant/pull/405) | `51aeda5` | No workflow/commit-status evidence |
| [goldmansachs/gs-quant #406](https://github.com/goldmansachs/gs-quant/pull/406) | `8828d99` | No workflow/commit-status evidence |
| [goldmansachs/gs-quant #411](https://github.com/goldmansachs/gs-quant/pull/411) | `9c4c857` | No workflow/commit-status evidence |
| [scikit-learn-contrib/imbalanced-learn #1240](https://github.com/scikit-learn-contrib/imbalanced-learn/pull/1240) | `bf50a6d` | GitHub Actions action_required |
| [vega/altair #4198](https://github.com/vega/altair/pull/4198) | `c5b0a06` | GitHub Actions SUCCESS |
| [openai/openai-knowledge-retrieval #9](https://github.com/openai/openai-knowledge-retrieval/pull/9) | `d6936e6` | No workflow/commit-status evidence |
| [goldmansachs/gs-quant #399](https://github.com/goldmansachs/gs-quant/pull/399) | `1302f7d` | No workflow/commit-status evidence |
| [goldmansachs/gs-quant #400](https://github.com/goldmansachs/gs-quant/pull/400) | `a56847d` | No workflow/commit-status evidence |
| [narwhals-dev/narwhals #4094](https://github.com/narwhals-dev/narwhals/pull/4094) | `75f2d68` | GitHub Actions action_required |
| [marshmallow-code/marshmallow #3083](https://github.com/marshmallow-code/marshmallow/pull/3083) | `685cbc2` | GitHub Actions action_required |
| [python-visualization/folium #2311](https://github.com/python-visualization/folium/pull/2311) | `9d807fc` | GitHub Actions action_required |
| [plotly/plotly.py #5831](https://github.com/plotly/plotly.py/pull/5831) | `527ed0a` | GitHub Actions action_required |
| [goldmansachs/gs-quant #404](https://github.com/goldmansachs/gs-quant/pull/404) | `3bcd89c` | No workflow/commit-status evidence |
| [feature-engine/feature_engine #1112](https://github.com/feature-engine/feature_engine/pull/1112) | `04b0a22` | CircleCI 12 success / 1 failure |
| [sktime/sktime #11538](https://github.com/sktime/sktime/pull/11538) | `27c2c92` | GitHub Actions action_required |
| [python-visualization/folium #2306](https://github.com/python-visualization/folium/pull/2306) | `761620f` | GitHub Actions action_required |
| [mwaskom/seaborn #4010](https://github.com/mwaskom/seaborn/pull/4010) | `fe8b2ea` | GitHub Actions action_required |

## Review decisions and next actionable steps

1. **Already positive CI; maintainer review pending:** [Altair #4189](https://github.com/vega/altair/pull/4189), [Altair #4198](https://github.com/vega/altair/pull/4198), [skrub #2347](https://github.com/skrub-data/skrub/pull/2347). Altair #4189 has a later reviewer **APPROVED** decision after the earlier **CHANGES_REQUESTED** review; a maintainer raised potential next-major-version compatibility concerns. Do not create trigger-only commits.
2. **Approved by a reviewer but upstream CI authorization pending:** [Anthropic Claude Agent SDK #1421](https://github.com/anthropics/claude-agent-sdk-python/pull/1421). The source review includes an independent test report; official upstream CI remains `action_required`.
3. **Reviewer suggestion already addressed:** [sktime #11538](https://github.com/sktime/sktime/pull/11538) now includes a guard against entirely missing calibration residuals and parameterized interval-prediction regressions; it remains `action_required` in the visible workflows. Do not repeat the same fix.
4. **Review bot suggestion already addressed:** [Narwhals #4094](https://github.com/narwhals-dev/narwhals/pull/4094) includes named/unnamed pandas temporal-scalar row tests. Bot feedback is not a maintainer merge approval; official CI remains `action_required`.
5. **Actual CI failure:** [feature_engine #1112](https://github.com/feature-engine/feature_engine/pull/1112) has [CircleCI Python 3.9 failure](https://circleci.com/gh/feature-engine/feature_engine/35666), while twelve other commit statuses pass. The PR author previously reported seeing the same failure on its base revision, but the failure root cause was **not independently confirmed from logs**. No false local repair claim.
6. **Intentional draft hold:** [plotly.py #5831](https://github.com/plotly/plotly.py/pull/5831) was moved to draft during discussion of the underlying issue. Preserve upstream decision.
7. **DCO and source-review prerequisite:** [GS-Quant #399](https://github.com/goldmansachs/gs-quant/pull/399) is open; seven related GS-Quant PRs remain drafts pending genuine maintainer guidance. They have no visible CI run or commit status returned in this check.
8. **Missing upstream test evidence:** [OpenAI Knowledge Retrieval #9](https://github.com/openai/openai-knowledge-retrieval/pull/9) has contributor-reported local testing but no official workflow or commit status returned; do not conflate the two.
9. **PR-body formatting permission blocker:** [Folium #2323](https://github.com/python-visualization/folium/pull/2323) includes pasted HTML. Attempting to update upstream PR body using the current GitHub integration returned **403 Resource not accessible by integration**. It was **not edited** and may require the contributor's GitHub UI or different authorization.

## Data-quality and permissions boundaries

- No upstream merge, workflow approval, reviewer request, automated reminder or branch edit was performed in this audit.
- An empty review-thread response does **not** establish that a PR has no technical concerns. Review summaries and top-level comments were inspected too; the full upstream source and tests for every open PR were **not** re-executed.
- The connected workflow-run lookup is first-page / pull-request-run scoped. A missing run is **unknown**, not evidence of no CI configuration, nor a PASS. CircleCI and other commit statuses are a separate check.
- `action_required` is a workflow authorization gate, **not** proof that tests failed or passed.
- A 12-month **merged** PR count must use separately verified merge metadata. At this checkpoint, [15 third-party merged PRs](OSS_VERIFIED_THIRD_PARTY_MERGED_PRS_2026-10-30.md) were verified; none of the 33 open PRs counts toward that number.
- This fixed-date matrix should be refreshed before any application decision. Cross-check [OSS issue #103](https://github.com/senanurcetin/nexus-devops-intelligence/issues/103) for accepted work and further review.
