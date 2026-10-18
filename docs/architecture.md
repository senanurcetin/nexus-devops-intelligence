# NEXUS DevOps Intelligence — architecture and Community boundaries

**Browser:** one Next.js React dashboard in `src/app/page.tsx`, with separate
independently failing panels for workflow runs and pull requests.

**Backend:** Five Next.js route handlers: `api/public-actions`, `api/public-prs`, `api/public-pr-verification`, `api/public-workflow-evidence`, and `api/public-workflow-trends`.
No authentication or user data storage. They handle anonymous, read-only GitHub
REST requests with fixed host, validated repository identifier and bounded samples.

**Domain models:** `src/lib/github-public-actions.ts`, `src/lib/nexus-public-prs.ts`, `src/lib/nexus-pr-evidence.ts` and `src/lib/nexus-workflow-trends.ts`.
Validation rejects inconsistent payloads or unsafe upstream browser URLs.
GitHub `mergeable_state` can be unknown while computation is pending.

**Design rationale:** No user token required for public repositories. Avoid
misleading billing estimates. Sample counts are not repo-wide health scores.

**Operational limitations:** Anonymous rate limits and caching apply. Untrusted
public repository names and PR titles are React-escaped. Private repo access
requires a future authenticated GitHub App implementation, not browser tokens.

## GitHub REST fault boundaries (CI-free MVP hardening)

The standalone `src/lib/github-public-client.ts` module owns all external requests;
Next.js route handlers only translate its structured `{status, body}` result to JSON.
That module accepts an injected fetcher so response handling can be verified locally
without a running server or any GitHub request.

- Actions: **one** fixed-host GET for at most ten workflow runs.
- Pull requests: **one** list GET (at most six records for pagination signaling),
  plus at most five detail GETs. Draft PRs do not cause detail requests.
- Every outgoing request uses anonymous read-only GETs, a 10-second timeout and
  a Next.js 120-second fetch revalidation window. No token is sent or persisted.
- A bad upstream list fails with HTTP 502, without fetching its PR details.
  Partial details fail to the explicit `unknown` status, not a green result.
- Invalid repository names return 400 before a network call; 404 and 429 are
  distinct; a timeout returns 504; upstream denial/failure returns 503.
- Successful anonymous responses may be cached by the browser/proxy for 60
  seconds, with a further 120-second stale window. Errors carry `no-store`.
- These are sample-based diagnostics, **not** complete repository health scores
  or statements about actual GitHub Actions billing.

Run the dependency-free checks on Node.js 22.16 or newer:

```bash
npm test
# Focused domain typecheck, until project dependencies become available:
tsc --noEmit --skipLibCheck --strict --lib es2022,dom --target es2022 \
  --module nodenext --moduleResolution nodenext --allowImportingTsExtensions \
  src/lib/github-public-actions.ts src/lib/nexus-public-prs.ts src/lib/github-public-client.ts
```

## Prioritized investigations

`src/lib/nexus-recommendations.ts` derives up to five links to source evidence
from the already-validated sample. Confirmed conflicts or failed workflows
precede restrictions and pending states. Draft PRs and successful or cancelled
workflow runs do not become incidents. Missing upstream evidence yields an empty
recommendation list; the UI explicitly says the sample cannot be verified.
No AI diagnosis, workflow trigger or write permission is involved.

## Current five-route security and provenance contract (18 October 2026)

The two original workflow/PR sample endpoints were extended with **three on-demand source-evidence routes**. Each route shares strict repository query parsing, public-only read limitations and explicit cache/failure attribution. A successful response is a bounded sample, never repo-wide proof. Review the exact source and tests, not only this architecture summary:

| Endpoint | Primary source | Invariant to preserve |
| --- | --- | --- |
| `/api/public-actions` | `src/app/api/public-actions/route.ts` | Bounded GitHub workflow evidence; never label missing/unknown CI healthy |
| `/api/public-prs` | `src/app/api/public-prs/route.ts` | Draft, unknown mergeability, clean and confirmed conflict remain distinct |
| `/api/public-pr-verification` | `src/app/api/public-pr-verification/route.ts` | On-demand PR evidence is tied to real GitHub source; no fabricated root cause |
| `/api/public-workflow-evidence` | `src/app/api/public-workflow-evidence/route.ts` | Bounded details and source provenance; safe treatment of absent/incomplete runs |
| `/api/public-workflow-trends` | `src/app/api/public-workflow-trends/route.ts` | UTC seven-day sampling/coverage distinguished from actual full repo totals |

Routing and admission helpers live in `src/lib/nexus-public-gate.ts`, `nexus-public-rate-limit.ts`, `nexus-shared-rate-limit.ts` and `nexus-panel-validation.ts`. Review [five-route security QA](G06_FIVE_PUBLIC_ROUTES_FAILCLOSED_QA_2026-10-15.md) for **historical exact-head evidence**, not a present-day pass. The real cross-instance Vercel shared Redis contract is still [open #7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7), distinct from single-process unit tests.

**Runtime surfaces must remain separated:**

- **GitHub `main` at this audit** was `3838027cdaa0c020caba76e591d04adba8bfb144` and had **no** Dockerfile/Compose.
- **Proposed Community** is a `127.0.0.1`-published, non-root, single-device self-hosted Next.js standalone container in [draft PR #80](https://github.com/senanurcetin/nexus-devops-intelligence/pull/80). Docker builds use `NEXUS_SELF_HOSTED_BUILD=1`; Vercel builds intentionally retain the default config. Docker runtime safety requires independent host checks, not just Compose text.
- **Existing hosted Vercel** includes separate historical Production/Preview deployed SHAs, not current `main`. `vercel.json` disables Git-triggered deployment; new deployments require explicit owner consent.
- **Future Pro/Cloud** rights-cleared modules, auth, multi-tenancy, customer data storage and paid hosting do **not** exist in this MIT Community runtime and should not be shown as capabilities.

See [Community release decision](NEXUS_COMMUNITY_RELEASE_DECISION_2026-10-18.md), [reproducible operations](COMMUNITY_MAINTENANCE_AND_RELEASE.md), [safe contributor onboarding](COMMUNITY_FIRST_CONTRIBUTION.md) and the [manual hosted rollback runbook](NEXUS_MANUAL_RELEASE_RUNBOOK_2026-10-14.md).
