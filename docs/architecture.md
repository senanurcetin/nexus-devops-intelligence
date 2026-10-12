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
