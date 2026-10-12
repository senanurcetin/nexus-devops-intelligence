# Contributing

Contributions are welcome in focused, reviewable pull requests.

1. Open an issue describing the bug or enhancement, including reproduction steps or expected behavior.
2. Keep changes small and add unit tests for edge cases.
3. Run `npm run test`, `npm run typecheck` and `npm run build` before submitting a PR; report checks that could not run.
4. Don't expose private repository URLs, tokens, protected CI logs or user data in fixtures, issues or diffs.
5. For upstream data, favor mocked GitHub API responses in tests rather than live rate-limited requests.

Security reports must go to the private contact in [SECURITY.md](SECURITY.md), not public issues.
