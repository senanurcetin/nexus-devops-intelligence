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
| Watchlist source trust review | Bind digest claims to the requested repo; constrain public source URLs; escape Markdown | **GPT-6-assisted**, not a Codex CLI execution. Historical SHA `666ba42c`: **11/11 focused, 373/373 full, typecheck/build PASS**. Later SHA `1c03804`: **11 native source cases + 4 separately invoked CLI argument cases PASS**; latest full suite/build **NOT RUN**. Clean `npm ci` timed out twice | [Draft PR #100](https://github.com/senanurcetin/nexus-devops-intelligence/pull/100), [Turkish walkthrough (PR branch)](https://github.com/senanurcetin/nexus-devops-intelligence/blob/codex/watchlist-evidence-trust-20261030/docs/CODEX_WATCHLIST_TRUST_BOUNDARY_TUTORIAL_TR.md) |

The distinction between original correction, later Codex suggestions and separate native Codex execution is important. None is fabricated as a single seamless automated Codex PR.

## A first useful public content piece

**Working title (TR):** *Codex ile test-first hata ayıklama: geçersiz GitHub tarihlerini yakalayan 6 test*.

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

**Status as of 30 October 2026:** This portfolio was merged into `main` in [PR #101](https://github.com/senanurcetin/nexus-devops-intelligence/pull/101). Historical actual Codex execution is separately documented. Source SHA `666ba42ca34e3386ae833165a0c818a7bc1dea43` of watchlist [PR #100](https://github.com/senanurcetin/nexus-devops-intelligence/pull/100) passed 11/11 focused, 373/373 full Node tests, typecheck and Next.js build in an isolated Windows clone. **Clean `npm ci` timed out; same-lockfile dependencies were reused** for those tests; this does not certify a clean install. PR #100 subsequently advanced to source SHA `1c0380459645ae3fc85b212febea1169dfd77e78`, adding canonical UTC source receipt validation. **Eleven pure source cases and four separate CLI invalid-input cases passed** on that SHA; its original full Node/tsx suite, typecheck and build are **NOT VERIFIED**. PR #100 remains **draft / unmerged** at this checkpoint. A separate offline `npm ci` attempt also timed out; its cache hits do not certify a clean install. Ambassador selection, a recorded introduction video, audience feedback and external community reach are **not established**.
