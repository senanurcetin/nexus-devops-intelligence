# Codex OSS workshop / Atölye: PR URL ve numara tutarlılığı

> **TR + EN · 2 Kasım 2026 · Çevrimdışı, sentetik test.** Bu eğitim [birleştirilmiş kaynak PR #146](https://github.com/senanurcetin/nexus-devops-intelligence/pull/146) içindeki test-first kanıtlarına dayanır. Kaynak düzeltmesi **GPT-6/ChatGPT desteğiyle** yapıldı; yeni bir Codex CLI kod üretimi olarak sunulmaz. 27 Ekim'deki [gerçek Codex CLI oturumu](CODEX_MXC_NATIVE_TEST_FIRST_PROOF_20261027.md) farklı bir çalışmadır.

## TR — Öğrenme hedefi

GitHub Search sonuçlarını inceleyen bir araç, `html_url` içinden PR numarasını okuyup Search yanıtındaki `number` alanını kontrol etmezse, tutarsız bir sağlayıcı yanıtını **doğrulanmış PR** gibi sayabilir. Bu alıştırma gerçek GitHub'ın böyle bir yanıt gönderdiğini iddia etmez; tamamen sentetik bir güven sınırı vakasıdır.

```text
html_url = https://github.com/upstream/widget/pull/12
number   = 99
```

Doğru davranış: Hem birleşmiş hem açık PR sonuçlarında `complete=false`, `confirmed_count=null` ve kabul edilen PR sayısı `0`. Bilgi eksik olduğunda `0 doğrulanmış PR` ile `kesin olarak 0 PR` aynı anlama gelmez.

### TR — 10 dakikalık yeniden üretim

Gereksinimler: Git ve Node.js 24. Özel token, ücretli API, gerçek GitHub araması ve Docker gerekmez. Komutlar geçici bir klonda çalıştırılmalıdır.

```bash
git clone https://github.com/senanurcetin/nexus-devops-intelligence.git
cd nexus-devops-intelligence
git fetch origin pull/146/head

# 1. Test önce: kaynak düzeltmesi yok, regresyon bilinçli olarak başarısız
git switch --detach 83e36dbebf1d5a67b4319f359ae5f25440877777
node --test tests/oss-upstream-pr-audit.test.mjs

# 2. Aynı test, düzeltilmiş kaynak ile
git switch --detach 25cfb01baa4c5dbcc25775123af58c182fa8286b
node --test tests/oss-upstream-pr-audit.test.mjs
```

| Revizyon | Gerçek yerel kayıt (Windows, Node 24.13.0) | Anlamı |
| --- | --- | --- |
| Test-first `83e36db` | **16 PASS / 1 FAIL** | URL #12 iken `number=99` yanlış biçimde kabul edilir |
| Düzeltme `25cfb01` | **17 PASS / 0 FAIL** | Tutarsız kimlikler kesin sayım üretmez |

Değişiklik [kaynak denetleyicide](../scripts/oss-upstream-pr-audit.mjs) bir alan uyum kontrolü ve [test dosyasında](../tests/oss-upstream-pr-audit.test.mjs) sentetik regresyondur. [PR #146'nın tam commit CI sonucu](https://github.com/senanurcetin/nexus-devops-intelligence/actions/runs/41504434963) bağımlılık kurulumu, tam Node testleri, TypeScript ve Next.js derlemesi için **SUCCESS** gösterir. Ayrı Windows tam test çalışmasında sembolik bağlantı oluşturma izni (`EPERM`) kaynaklı ilgisiz başarısızlıklar vardı; bu nedenle **yerel tam paket PASS** iddiası yoktur.

## EN — Learning objective

A GitHub Search auditor must not certify a pull request when the `number` returned in the Search item disagrees with the PR ID extracted from its canonical `html_url`. This is a **synthetic malformed-provider response**, not a claim that GitHub returns such records.

The safely bounded result for **both merged and open** searches is `complete=false`, `confirmed_count=null`, and zero accepted PR entries. Unknown evidence is not a verified count of zero.

### EN — Reproduce the fail-first exercise

Use Git and Node.js 24 in a disposable public checkout. No API token, Docker, paid service, private data or live GitHub Search call is required. Run the two commands in the Turkish section above against the exact immutable commits:

- `83e36db`: regression exists but source fix does not; **16 passed, 1 failed** in the recorded local run.
- `25cfb01`: same focused suite after the source fix; **17 passed, 0 failed** in the recorded local run.

Inspect the new test in [`tests/oss-upstream-pr-audit.test.mjs`](../tests/oss-upstream-pr-audit.test.mjs) and the fail-closed condition in [`scripts/oss-upstream-pr-audit.mjs`](../scripts/oss-upstream-pr-audit.mjs). Compare **observed** versus **confirmed** totals. The exact-head hosted [quality check](https://github.com/senanurcetin/nexus-devops-intelligence/actions/runs/41504434963) completed successfully, but it does not establish Codex authorship, external PR acceptance, deployment readiness or real-world source authenticity.

## Optional Codex practice / İsteğe bağlı Codex alıştırması

Kendi izole klonunuzda, test-first commit'inde Codex erişiminiz varsa şu yönergeyi verebilirsiniz. **Bu bir önerilen alıştırma metnidir, PR #146'nın Codex tarafından yürütüldüğünün kanıtı değildir.**

> Review the failing offline test for mismatched Search item numbers and canonical PR URLs. Make the smallest fail-closed change in `scripts/oss-upstream-pr-audit.mjs`, rerun `node --test tests/oss-upstream-pr-audit.test.mjs`. Do not use tokens, network APIs, paid services, commits, push, deployment, or other files. Explain why `confirmed_count=null` matters.

**Kanıt / Evidence rule:** Only label a change as native Codex work when the actual tool session, code changes, exact commit, commands, exit codes and model attribution can be independently verified. Otherwise identify the actual tool used.

[Codex developer portfolio / Portföy](CODEX_AMBASSADOR_PUBLIC_PORTFOLIO_20261030.md) · [Contribution rules / Katkı ilkeleri](../CONTRIBUTING.md)
