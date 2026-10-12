# MVP architecture

**Browser:** one Next.js React dashboard in `src/app/page.tsx`, with separate
independently failing panels for workflow runs and pull requests.

**Backend:** Next.js route handlers `api/public-actions` and `api/public-prs`.
No authentication or user data storage. Both issue anonymous, read-only GitHub
REST requests with fixed host, validated repository identifier and bounded samples.

**Domain models:** `src/lib/github-public-actions.ts` and `src/lib/nexus-public-prs.ts`.
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
