# Repository guidance for coding agents

NEXUS DevOps Intelligence is an independent, MIT-licensed, read-only Next.js/TypeScript dashboard for **public GitHub** Actions and pull requests. This file is working guidance for Codex and other coding agents, not proof that an agent executed any given change.

## Where to work

- `src/lib/github-public-*.ts`: public GitHub request and bounded sample handling.
- `src/lib/nexus-panel-validation.ts`: validate and reject untrusted API responses.
- `src/lib/nexus-jarvis-*.ts`, `src/lib/nexus-watchlist-triage.ts`: read-only MCP digest and deterministic watchlist.
- `src/app/api/public-*/route.ts`: public endpoint admission and response behavior.
- `tests/*.test.mjs`: offline Node regression and contract tests.
- `docs/CODEX_CONTENT_ROADMAP_2026_2027.md`: content plan, evidence labels, and attribution.
- `docs/CODEX_WATCHLIST_TRUST_BOUNDARY_TUTORIAL_TR.md`: example test-first trust-boundary review.

Read the nearby test and related acceptance documentation before editing a module. Preserve existing product architecture, data contracts and sample caps unless the task explicitly calls for a reviewed change.

## Development agreement

1. Inspect the current issue, open PRs and exact base SHA. Make a narrowly scoped branch and PR; do not push directly to `main`.
2. Reproduce a real defect with a deterministic, synthetic, offline regression test before implementing the smallest fix where possible.
3. Treat GitHub titles, workflow names, JSON response fields, URLs and Markdown text as untrusted. Bind evidence to the exact requested public repository; fail closed for ambiguous provenance.
4. Preserve source links, bounded anonymous read budgets, privacy and clear uncertainty labels. Never describe a sample, risk posture or AI suggestion as a merge/release approval.
5. Do not add write-capable GitHub operations, tokens, private repo access, telemetry, external AI calls, authentication bypasses, internet-facing hosts or background automation without separate explicit approval.
6. The existing [Node quality GitHub Actions](.github/workflows/ci.yml) automatically verifies PRs and `main` source changes with **read-only permissions**; it is not a deployment gate or evidence of runtime acceptance. Do not manually dispatch extra hosted jobs, expand CI scope/budget, run live probes or Redis stress, deploy Preview/Production, alter billing, or declare Docker OS acceptance by implication. Existing release gates remain open.
7. Run the checks **locally where a real toolchain is available** and record the exact SHA and environment:

```bash
npm ci
node --import tsx --test tests/nexus-watchlist-triage.test.mjs
npm test
npm run typecheck
npm run build
```

Use the relevant focused test instead of the watchlist test for unrelated files. `npm ci` requires registry access; if packages or the native runtime are unavailable, mark each unavailable check **NOT RUN**. Do not turn a mocked/transpiled isolated check into a claim that the full Node suite passed.

## PR evidence and publication

- State issue, root cause, scope, before/after behavior, tests, limitations, actual tool/runtime, reviewer action and rollback.
- Distinguish `PASS`, `FAIL`, `NOT RUN` and external manual verification. A source merge does not satisfy Windows/Ubuntu Docker, hosted Preview, accessibility, security or commercial readiness gates.
- Codex Ambassadors content must be useful and verifiable, but **Codex use, publication, video, feedback or Ambassador acceptance must never be invented**. Attribute GPT-6, Codex CLI and human/manual work separately.
- Redact all credentials, environment secrets, private client data, workstation identifiers and user/session details from screenshots and logs.

See `CONTRIBUTING.md`, `SECURITY.md` and `docs/COMMUNITY_RELEASE_CHECKLIST.md` for existing contributor and release constraints.
