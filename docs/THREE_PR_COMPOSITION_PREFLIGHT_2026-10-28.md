# NEXUS DevOps — Offline three-PR composition preflight

**Status (28 October 2026):** Source-only, non-authorizing verification helper in draft PR #96. No GitHub merge, CI activation, Vercel deployment, Docker image, privileged access, live Redis requests or billing changes are initiated by this script.

## Purpose

`npm run verify:pr:composition -- --base SHA --product SHA --community SHA --evidence SHA`

checks pinned **full, lowercase, 40-character Git commit IDs** representing `main`, PR #95 (product/analytics), PR #80 (Community Docker), and PR #96 (release evidence). Git must already have fetched the corresponding commit objects into the local repository. **The tool never fetches**, searches live PR state, authenticates a reviewer or updates remote refs.

It checks:
1. All four supplied IDs resolve to distinct *commit* objects, and all PRs descend from the pinned base.
2. Each PR pair has that same pinned merge base.
3. Each pair can be merged by local `git merge-tree --write-tree`, failing closed on textual conflict.
4. The three-PR combined tree can be constructed in fixed `#95 + #80 + #96` order. It returns the exact combined Git **tree SHA** for independent comparison.

It uses local `git commit-tree` for an *unreachable synthetic commit object* and `git merge-tree` for trees. These operations **write Git objects inside the local object database**, but **never** change a branch ref, stash, the current HEAD, working-tree files or a GitHub PR. The tool refuses a tracked-dirty checkout. Untracked local files are ignored by Git's committed-tree composition and remain untouched. A test verifies that neither Git refs nor the working tree change.

### Reproducible historical candidate

On 28 October, before this tool was added to PR #96, the following exact inputs were independently tested:

| Role | Git identity |
| --- | --- |
| Base `main` | `04fb91c411d4a2995d8b70cc9b0f8acfb41b1ad6` |
| Product PR #95 | `13280edcdb2a262b6a3bf4f8b518645624105306` |
| Community PR #80 | `e9287daa7adbd83fac99344a1bbbf55a2b5a5954` |
| Release PR #96 at that time | `24d6f8278bc4534e699bcba2c5a317234d9fe8f3` |

Expected combined tree: `da6223b1d41a87abb92e46005c4a29bbb872e277`. CLI result was `CLEAN_MERGE_LOCAL_ONLY`, with 3/3 conflict-free pairs and `release_authorized:false`; the original 302/302 Node, production build, 28 automated browser fixture and 16 local HTTP tests referred **only to that exact historical combined tree**.

Current PR heads change as development continues. **Never reuse the prior tree, test receipts or image scan as proof for a different combination of input SHAs.** Fetch new head objects explicitly before rerunning if an authorized operator wants a new composition check.

### CLI behavior and limits

Run from any *clean tracked* worktree belonging to the target repository, with Node.js 22+ and Git 2.38+ installed:

```sh
npm run verify:pr:composition -- \
  --base 04fb91c411d4a2995d8b70cc9b0f8acfb41b1ad6 \
  --product 13280edcdb2a262b6a3bf4f8b518645624105306 \
  --community e9287daa7adbd83fac99344a1bbbf55a2b5a5954 \
  --evidence 24d6f8278bc4534e699bcba2c5a317234d9fe8f3
```

- **Exit 0**: local Git composition is conflict-free, **NOT** that tests have run or release is approved.
- **Exit 3**: missing/wrong source object, dirty tracked checkout, base drift, unsupported/invalid args or merge conflict; fail closed.
- Results include `source_shas`, pairwise merge tree IDs and a `combined_tree`; always include `release_authorized:false` and the remaining acceptance tasks. No arbitrary Git logs, credentials or private repository contents are printed.

**Not verified by this command:** lockfile consistency, typecheck/tests/build execution, exact-image OS CVE scan, independent native Ubuntu, physical Safari/NVDA/VoiceOver, owner-authenticated Preview, shared Redis across actually separate function instances, branch protection and owner release approval. These are **separate acceptance gates**, not optional warnings.

The original production Release Evidence Gate (`verify:release:evidence`) also never authorizes production and uses self-supplied hashes, not trusted signed attestations. Both tools remain in draft-only governance until the owner explicitly approves a release process.
