## Scope

Explain the user problem and the exact files/routes changed. Keep this PR limited to NEXUS DevOps Intelligence.

## Verification (report actual results, not assumptions)

- [ ] Source SHA and base branch recorded
- [ ] `npm ci` — PASS / FAIL / NOT RUN
- [ ] `npm test` — PASS / FAIL / NOT RUN
- [ ] `npm run typecheck` — PASS / FAIL / NOT RUN
- [ ] `npm run build` — PASS / FAIL / NOT RUN
- [ ] Browser / Docker / localhost smoke (if relevant) — PASS / FAIL / NOT RUN
- [ ] Security review: no credentials, personal data, new unapproved permissions or exposure
- [ ] `README.md`, `SECURITY.md`, and docs updated if behavior changes

## Release boundaries

- Is this source-only, local Community acceptance, protected Preview or Production? State one.
- **PR merge is not Vercel deployment.** No CI, Preview, Production, Redis stress, paid service or Cloud spending without separately documented authorization.
- Human VoiceOver/NVDA and real multi-instance Redis proofs must not be relabeled PASS using mocks.


## Authorship and AI assistance

- State whether AI tools were used. If used, name the tools and identify which code, tests or documentation they helped produce.
- The contributor is responsible for reviewing, understanding and being able to explain every change; do not claim tests or human review that did not happen.
- No credentials, customer data or private build logs in prompts, screenshots or public PR comments.

## Screenshots/evidence

Only include sanitized proof with environment, viewport, date and source SHA. Do not upload tokens or private repository payloads.
