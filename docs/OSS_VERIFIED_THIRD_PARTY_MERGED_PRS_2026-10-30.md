# Claude for OSS — individually verified third-party merged PR evidence

**Snapshot:** 2026-10-30 UTC. **GitHub author:** `senanurcetin`. **Purpose:** independently inspect each GitHub pull request's `user.login`, `merged=true`, `merged_at` and destination repository ownership, rather than relying on a search count or internal NEXUS PR numbers.

**Result:** **15/15** GitHub search candidates independently confirmed merged into repositories owned by organizations other than `senanurcetin`. **Six distinct upstream owners**. All 15 `merged_at` timestamps are within the preceding 12 months as of the snapshot; the earliest is 2026-10-13. No known future or pre-window merge is included.

**Important:** This is confirmed *GitHub merge evidence*, **not Anthropic acceptance or a declaration that every PR is sufficiently substantive**. Anthropic may evaluate code, review context, authenticity, relevance and ecosystem impact independently. Open PRs do not count, and NEXUS-owned PRs are excluded. GitHub account-age validation is intentionally deferred until the final application gate per owner instruction.

## Source-verified register

Each row was checked through the GitHub PR details endpoint on 2026-10-30; author was `senanurcetin`, `merged=true`, and the exact UTC timestamp below was non-null.

| Upstream owner | PR | Category | Merged at (UTC) | Short description |
| --- | --- | --- | --- | --- |
| pyjanitor-devs | [pyjanitor #1822](https://github.com/pyjanitor-devs/pyjanitor/pull/1822) | Code / performance | 2026-10-28 02:10:22 | Faster homogeneous-value `pivot_longer` |
| pydata | [xarray #11806](https://github.com/pydata/xarray/pull/11806) | Documentation | 2026-10-27 09:54:42 | DataTree backend entrypoints |
| pyjanitor-devs | [pyjanitor #1820](https://github.com/pyjanitor-devs/pyjanitor/pull/1820) | Code / bug fix | 2026-10-26 19:54:58 | Avoid input DataFrame mutation in `pivot_longer` |
| pyjanitor-devs | [pyjanitor #1786](https://github.com/pyjanitor-devs/pyjanitor/pull/1786) | Code / bug fix | 2026-10-26 07:53:16 | Account for missing values in `drop_constant_columns` |
| vega | [Altair #4180](https://github.com/vega/altair/pull/4180) | Documentation | 2026-10-20 17:26:53 | Inline and URL data sources |
| vega | [Altair #4178](https://github.com/vega/altair/pull/4178) | Documentation | 2026-10-20 16:54:56 | Interactive HTML dashboard example |
| plotly | [plotly.py #5823](https://github.com/plotly/plotly.py/pull/5823) | Documentation | 2026-10-20 15:14:53 | Quiver/streamline return types |
| pydata | [xarray #11713](https://github.com/pydata/xarray/pull/11713) | Documentation | 2026-10-20 07:36:04 | `Dataset.drop_duplicates` usage examples |
| duckdb | [duckdb-web #7494](https://github.com/duckdb/duckdb-web/pull/7494) | Documentation | 2026-10-18 12:10:50 | `FILTER` with NULL list values |
| duckdb | [duckdb-web #7495](https://github.com/duckdb/duckdb-web/pull/7495) | Documentation | 2026-10-18 12:09:51 | Window/aggregate clause placement |
| duckdb | [duckdb-web #7496](https://github.com/duckdb/duckdb-web/pull/7496) | Documentation | 2026-10-18 12:06:23 | Deprecated PRAGMA assignments |
| scipy | [SciPy #26391](https://github.com/scipy/scipy/pull/26391) | Documentation | 2026-10-18 07:32:21 | Smoothing scaling examples |
| pydata | [xarray #11715](https://github.com/pydata/xarray/pull/11715) | Documentation | 2026-10-17 06:11:36 | Close netCDF datasets before overwrite |
| vega | [Altair #4179](https://github.com/vega/altair/pull/4179) | Documentation | 2026-10-14 09:09:42 | `Chart.show()` and multiple charts |
| pydata | [xarray #11714](https://github.com/pydata/xarray/pull/11714) | Code / bug fix | 2026-10-13 14:13:37 | Suppress expected all-NaN fallback warnings |

**Portfolio composition:** 4 code/performance/bug PRs and 11 documentation/example PRs. Those labels are a navigation aid, **not** Anthropic's quality classification.

## Accurate application framing

- If the program applies its alternative criterion of **100 merged PRs into repositories the applicant does not own during the preceding 12 months**, these 15 give a **potential numerical starting point** and leave **85 additional qualifying merges**. This assumes all 15 are accepted as bona fide contributions, which has **not** been certified.
- The active upstream pipeline has **33 open PRs** in the 2026-10-30 connected GitHub search. **Open does not mean accepted or merged.**
- The most technically substantial already merged contributions to cite are [pyjanitor #1822](https://github.com/pyjanitor-devs/pyjanitor/pull/1822), [#1820](https://github.com/pyjanitor-devs/pyjanitor/pull/1820), [#1786](https://github.com/pyjanitor-devs/pyjanitor/pull/1786), and [xarray #11714](https://github.com/pydata/xarray/pull/11714). Include issue/review/test context in the final narrative.
- An **ecosystem impact** claim should still include *real third-party adoption, dependency/reuse, endorsements or independent maintainer feedback*, not synthetic GitHub stars or fabricated installs.
- Keep this register dated. The 12-month lookback rolls forward and newly merged work must be reverified by PR metadata before updating this ledger.
- **No application submission, benefit claim, release, CI certification or live usage claim results from this evidence register.**

## Reproduction

Run the read-only utility from a NEXUS local checkout, respecting GitHub API rate limits:

```sh
node scripts/oss-upstream-pr-audit.mjs senanurcetin
```

The utility is an independent discovery aid. It returns `confirmed_count: null` if search coverage is partial; the rows above were **separately verified** through the GitHub PR details connection. A user can revisit each canonical PR URL and its merge state.

Associated work plan: [#103](https://github.com/senanurcetin/nexus-devops-intelligence/issues/103).
