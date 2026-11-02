# Codex Ambassador — public developer portfolio (30 October 2026)

> **Independent portfolio, not an OpenAI endorsement.** Application and selection status are not asserted. This page separates real Codex CLI execution from GPT-6-assisted code and from planned video/content. The open-source repository is MIT-licensed; no production deployment, external review approval or commercial readiness is implied.

**Project:** [NEXUS DevOps Intelligence](../README.md), a read-only Next.js/TypeScript tool for bounded inspection of **public** GitHub Actions workflow runs and pull-request states. It provides source-linked, sample-limited evidence and never grants permission to merge or release.

**Audience and contribution focus:** Turkish-speaking beginners and intermediate developers learning Codex-assisted software engineering, security boundaries, reproducible tests and responsible review. Practical examples also connect to data analysis and industrial-automation software quality. Content should be accessible without private data, a paid cloud account or hosted CI.

## Public evidence — what really happened

| Example | Contribution | Actual tool and verification | Public evidence |
| --- | --- | --- | --- |
| Timestamp regression | `Date.parse('1')` and invalid calendar dates exposed in synthetic tests; source fix and walkthrough | **Initial code fix was GPT-6-assisted, NOT Codex-generated**; isolated Node FAIL → PASS; source PR merged | [Fix PR #90](https://github.com/senanurcetin/nexus-devops-intelligence/pull/90), [Turkish tutorial](CODEX_TIMESTAMP_REGRESSION_TUTORIAL_TR.md) |
| Codex boundary review | Six additional UTC test boundaries for the existing validator | Real Codex CLI source-review suggestions; merged regression test PR, with provenance separately disclosed | [Test PR #92](https://github.com/senanurcetin/nexus-devops-intelligence/pull/92), [independent session evidence](CODEX_INDEPENDENT_TEST_FIRST_EVIDENCE_20261027.md) |
| Native Codex test-first session | Codex authored a synthetic test file, ran it, applied a fix and reran the test in an isolated Windows MXC workspace | **Actual Codex CLI 0.164.0 execution**: 4 FAIL + 2 PASS before, 6/6 PASS after; separate external 6/6 replay. The exploratory patch was **not** merged as duplicate production code | [Native execution evidence](CODEX_MXC_NATIVE_TEST_FIRST_PROOF_20261027.md) |
| Watchlist source trust review | Reject cross-repository digests, forged source receipts, unsafe evidence links and active Markdown/HTML | **GPT-6-assisted code, not Codex CLI-generated.** Final [PR #100](https://github.com/senanurcetin/nexus-devops-intelligence/pull/100) merged. GitHub Actions on exact final PR SHA `6621e702`: **clean npm ci, 389/389 Node tests, typecheck and Next build PASS** | [Merged PR #100](https://github.com/senanurcetin/nexus-devops-intelligence/pull/100), [successful CI run](https://github.com/senanurcetin/nexus-devops-intelligence/actions/runs/41116629184), [Turkish tutorial](CODEX_WATCHLIST_TRUST_BOUNDARY_TUTORIAL_TR.md) |
| Search-page trust boundary (2 Nov) | Refuse to certify malformed GitHub Search pages returning 101 records when 100 were requested | **GPT-6-assisted PR #141**, not native Codex code. Test-first 15/16 → 16/16; exact-head automatic CI **504/504 PASS**. Authenticated Codex CLI 0.166.0 invocation was attempted separately but stopped by usage limit before code/test execution | [Merged PR #141](https://github.com/senanurcetin/nexus-devops-intelligence/pull/141), [successful CI](https://github.com/senanurcetin/nexus-devops-intelligence/actions/runs/41494011633), [10-minute Turkish workshop](CODEX_OSS_SEARCH_PAGE_100_101_WORKSHOP_TR.md) |
| PR identity consistency (2 Nov) | Refuse to certify a Search PR if the item's number contradicts its canonical URL | **ChatGPT/GPT-6-assisted PR #146**, not native Codex code. Offline test-first **16/17 → 17/17**; exact-head [Node quality CI](https://github.com/senanurcetin/nexus-devops-intelligence/actions/runs/41504434963) SUCCESS. Independent Windows full suite was limited by symlink EPERM failures | [Merged PR #146](https://github.com/senanurcetin/nexus-devops-intelligence/pull/146), [bilingual TR/EN workshop](CODEX_OSS_PR_IDENTITY_WORKSHOP_TR_EN.md) |
| Multi-page Search snapshot review (2 Nov) | Prevent certification of apparently complete 101+ result Search pagination when page reads lack snapshot isolation | **Real native Codex CLI 0.166.0 / gpt-6.1-sol source-text review** identified the risk on public source passed via stdin; **ChatGPT/GPT-6 authored the later test-first code**, not Codex CLI. Historical local 17 PASS / 1 FAIL → 23/23 focused PASS; exact-head hosted checks successful | [Merged fix PR #148](https://github.com/senanurcetin/nexus-devops-intelligence/pull/148), [exact-head quality run](https://github.com/senanurcetin/nexus-devops-intelligence/actions/runs/41506874552), [review and test provenance in PR](https://github.com/senanurcetin/nexus-devops-intelligence/pull/148) |
| Native Codex CLI state-validation fix (2 Nov) | Reject GitHub Search PR hits where `state` contradicts `is:merged` or `is:open` | **Actual Codex CLI 0.166.0 / gpt-6.1-sol authored the source guard and both offline regression tests in isolated native Windows MXC workspace-write sandbox.** Baseline 18/18 PASS → test-first 18 PASS / 2 FAIL → fixed 20/20 PASS; independent 25/25 focused PASS; exact-head hosted CI SUCCESS. ChatGPT separately reviewed, committed, opened and merged the PR | [Merged PR #150](https://github.com/senanurcetin/nexus-devops-intelligence/pull/150), [automatic CI #41509233583](https://github.com/senanurcetin/nexus-devops-intelligence/actions/runs/41509233583) |

The distinction between original correction, later Codex suggestions and separate native Codex execution is important. None is fabricated as a single seamless automated Codex PR.

## A first useful public content piece

**Working title (TR):** *Codex ile test-first hata ayıklama: geçersiz GitHub tarihlerini yakalayan 6 test*.

**Runnable workshop:** [10-minute Turkish timestamp exercise](CODEX_TIMESTAMP_10_MIN_WORKSHOP_TR.md), based on the three current source tests and separately evidenced historical Codex sessions. This written tutorial is public; a video or live Codex demo is **not** claimed.

**Learning outcome:** in under ten minutes, a developer can see how to define malicious and malformed timestamp fixtures, inspect a failure, implement a strict UTC rule, and rerun the same tests without leaking credentials or contacting a private repository.

1. Show the actual `Date.parse` boundary case and why it matters to GitHub Actions and PR evidence.
2. Demonstrate the *historical recorded* first failure and subsequent pass; any new live terminal recording must use **new actual results** and its own source SHA.
3. Walk through the public test and code diff on [PR #90](https://github.com/senanurcetin/nexus-devops-intelligence/pull/90) and the independent Codex test-first session evidence.
4. Explain where Codex helped and where human/external verification was necessary. Finish with a short, reproducible challenge and contribution invitation via [CONTRIBUTING.md](../CONTRIBUTING.md).

**Publication checklist:** the tutorial and PR evidence are public; a narrated video, recorded terminal demo, social post and audience questions/comments remain **NOT PUBLISHED / NOT VERIFIED** as of the date above. Do not link a placeholder as a published video.

## ~30-second introduction video — suggested Turkish narration

> Merhaba, veri analizi ve endüstriyel otomasyon geçmişi olan bir açık kaynak geliştiricisiyim. NEXUS DevOps Intelligence üzerinde Codex kullanarak gerçek bir test-first hata ayıklama deneyimi yaptım. Önce hatayı gösteren testleri çalıştırdık, sonra düzeltmeyi doğruladık. Codex Ambassador olarak bu tür deneyleri herkesin tekrarlayabileceği Türkçe eğitimlere dönüştürmek, yeni geliştiricilerin güvenli ve kanıta dayalı kod yazmasına katkı sunmak istiyorum.

**Recording requirements:** approximately 30 seconds, spoken naturally in Turkish. Screen/video must be recorded by the applicant and uploaded to an accessibly shared link; the video is not generated or uploaded by this repository. Remove any secret, private directory, API token or identifying local-session detail. The official application requires a video link accessible to anyone with the link; it need not be indexed publicly.

## Application response outlines (verify before submitting)

**Favorite thing built with Codex (English, short form):**

> In an isolated public Next.js repository, I used Codex CLI to write an offline timestamp regression test, run it, patch the validator and rerun the same test. It went from 4 failures/2 passes to 6/6 passes. I documented the exact execution and limitations, and avoided a redundant production patch because the original fix was already merged. Evidence: https://github.com/senanurcetin/nexus-devops-intelligence/blob/main/docs/CODEX_MXC_NATIVE_TEST_FIRST_PROOF_20261027.md

**First contribution (English, short form):**

> I'll publish a Turkish, beginner-friendly test-first debugging walkthrough using real Codex CLI evidence from NEXUS DevOps Intelligence. It will show a failing GitHub timestamp fixture, a minimal fix, the same tests passing, source-linked PRs, limitations, and a reproducible exercise. I will share an accessible video/demo and gather actionable questions for a follow-up tutorial.

Responses should be edited to the applicant's own voice and checked against the form's field length and actual evidence. A draft is not proof of a submitted or accepted application.

## Six-month content commitment

The [existing six-month content roadmap](CODEX_CONTENT_ROADMAP_2026_2027.md) proposes one outcome-based contribution each month (Nov 2026–Apr 2027). The dates are **provisional**, not official cohort dates. Each public item should include source link, exact revision, Codex session provenance, verification commands/results and community feedback when actually observed.

The official [Codex Ambassadors program](https://developers.openai.com/community/codex-ambassadors) states a six-month volunteer program with at least one useful contribution each month. Content-path examples include tutorials, demos and useful release takeaways. Applications are evaluated by relevant experience, examples, program fit and location; portfolio quality cannot guarantee selection.

## Reviewer navigation

- [Contribution and security boundaries](../CONTRIBUTING.md)
- [Read-only Jarvis integration and limitations](JARVIS_INTEGRATION.md)
- [Real Codex CLI first test-first proof](CODEX_MXC_NATIVE_TEST_FIRST_PROOF_20261027.md)
- [Public Codex timestamp tutorial](CODEX_TIMESTAMP_REGRESSION_TUTORIAL_TR.md)
- [Draft publishing kit — not a released video](CODEX_TIMESTAMP_PUBLICATION_KIT.md)

**Verified final status — 30 October 2026:** The historical [Codex CLI test-first execution](CODEX_MXC_NATIVE_TEST_FIRST_PROOF_20261027.md) and separate GPT-6-assisted code changes remain distinctly attributed. [Watchlist PR #100](https://github.com/senanurcetin/nexus-devops-intelligence/pull/100) was **squash-merged** as commit `74dac35591bb29f91afbcc8f89ee59aee95e6d28`. The exact final PR head `6621e702ab6fc758334ddc033fa58d39199955a1` passed [GitHub Actions run 41116629184](https://github.com/senanurcetin/nexus-devops-intelligence/actions/runs/41116629184): **clean `npm ci --no-audit --no-fund`, 389/389 Node tests (0 failures), TypeScript typecheck and Next.js production build**. CI logs show 49 packages installed. Earlier Windows `npm ci` timeouts and a 372/374 parallel-test run on an *older SHA* remain historical environment limitations, not the final PR's CI result. This is source/build verification, **not** native Ubuntu Docker, live Preview/Production, commercial release or program acceptance. The required personal introduction video, ambassador selection and audience reach remain **unverified**.


## 2 November 2026 — verified handoff checkpoint

- **Program:** [Codex Ambassadors — Content path](https://developers.openai.com/community/codex-ambassadors), a six-month volunteer initiative expecting at least one useful contribution per month. **New applications were closed when checked on 2 November 2026.** This does not establish the disposition of an earlier application. This program differs from GitHub Developer Program and Codex for Open Source.
- **Technical evidence:** [Search-boundary fix PR #141](https://github.com/senanurcetin/nexus-devops-intelligence/pull/141) and [Turkish workshop PR #142](https://github.com/senanurcetin/nexus-devops-intelligence/pull/142) are merged. The fix was GPT-6-assisted, not authored through native Codex CLI. The separate native Codex test-first execution remains the 27 October session recorded above.
- **Public-content quality gate:** [PR #143](https://github.com/senanurcetin/nexus-devops-intelligence/pull/143) is squash-merged (`8eadfa22af2b184ecce8028a63caa81b7202e333`), making all **10** `CODEX_*.md` guides explicit subjects of the offline local-link test and adding a regression that catches missing registrations. The [exact-head Node quality run #41501304613](https://github.com/senanurcetin/nexus-devops-intelligence/actions/runs/41501304613) succeeded for locked dependency installation, tests, typecheck and production build. This is **ChatGPT-assisted test work**, not a Codex CLI run.
- **Still unverified:** external audience reach, a recorded personal introduction video, and an Ambassador admission decision. The separate *native Codex CLI editing and test* milestone was subsequently verified on 2 November; see the dated evidence section below. Publication drafts are not claimed as social-media posts.
- **Next steps and ownership:** [Codex Content handoff tracker #144](https://github.com/senanurcetin/nexus-devops-intelligence/issues/144). Protect parallel DevOps/JARVIS workspaces and require real evidence before changing statuses.

### 2 November: independent Codex CLI source-text review (distinct from authored code)

A genuine **Codex CLI v0.166.0**, model **gpt-6.1-sol**, completed a source-text review of the public `scripts/oss-upstream-pr-audit.mjs` content provided through standard input. For this session, plugin-related startup failures were avoided using `--disable plugins --disable remote_plugin --ignore-user-config --ephemeral --sandbox read-only`. Earlier attempts to read files through Codex's shell were blocked by Windows execution policy, and the review did **not** gain local filesystem tool access, run tests or change files. The completed review identified that GitHub Search multi-page pagination cannot prove snapshot consistency even with stable total and unique IDs.

The separately authored **test-first** regression (commit `054bd36`) failed **17 PASS / 1 FAIL**; the ChatGPT-assisted source patch (commit `99a83bc`) then passed **23/23** focused tests. [Merged PR #148](https://github.com/senanurcetin/nexus-devops-intelligence/pull/148) and [exact-head CI](https://github.com/senanurcetin/nexus-devops-intelligence/actions/runs/41506874552) document the evidence. **This proves native Codex review assistance, not Codex-authored code or a successful Codex-controlled edit/test run.** A personal introduction video, external audience feedback, and Ambassador acceptance remain unverified.


### 2 November: first verified native Codex CLI edit-and-test milestone in this handoff

After a previous read-only text review, the **native Windows MXC sandbox** was independently probed using the documented Codex sandbox check and returned `MXC_OK` with exit code `0`. A separate clean branch was then used with **Codex CLI 0.166.0**, model **gpt-6.1-sol**, using an ephemeral, restricted workspace-write session. The invocation explicitly selected `windows.sandbox=mxc`, disabled plugins/remote plugin for that run, and ignored the unrelated user MCP configuration. **No unrestricted sandbox or bypass flag was used.**

In that isolated repository, **Codex itself** read `scripts/oss-upstream-pr-audit.mjs` and `tests/oss-upstream-pr-audit.test.mjs`, wrote synthetic merged/open state-conflict regressions, ran the offline Node test suite showing **18 PASS / 2 FAIL** before the fix (baseline **18/18 PASS**), made the one-line fail-closed source edit and reran **20/20 PASS** using Node.js **24.13.0**. ChatGPT independently inspected the two-file diff and ran the source and public-guide suites for **25/25 PASS**. ChatGPT, rather than Codex, subsequently committed/pushed the branch and managed [PR #150](https://github.com/senanurcetin/nexus-devops-intelligence/pull/150). The exact-head [Node quality workflow #41509233583](https://github.com/senanurcetin/nexus-devops-intelligence/actions/runs/41509233583) succeeded for locked dependencies, offline regression, TypeScript and production build. The PR was squash-merged as `ddb90bcd560c52d06f13a1ebd1cc690cbc5eb2c1`.

**Attribution:** Unlike #141, #146 or #148, **the test and source code of PR #150 were written and tested by native Codex CLI**. Neither this milestone nor CI implies an OpenAI affiliation, a submitted/accepted Ambassador application, a published video, live user adoption or production deployment.
