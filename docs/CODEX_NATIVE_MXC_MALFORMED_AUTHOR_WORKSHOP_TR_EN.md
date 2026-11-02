# Native Codex + Test-First: Malformed GitHub Search Author / Hatalı Yazar Verisi

> TR/EN · 2 Kasım 2026 · Hedef süre 10–15 dakika. Public MIT kaynakları ve çevrimdışı sentetik testler. Bu belge [birleştirilmiş PR #152](https://github.com/senanurcetin/nexus-devops-intelligence/pull/152) ile doğrulanmış bir **gerçek native Codex CLI kaynak ve test geliştirmesini** açıklıyor; video, topluluk erişimi veya program kabulü kanıtı değildir.

## Türkçe: Ne bozulmuştu?

GitHub Search yanıtı dış veridir. Denetleyici, `item?.user?.login?.toLowerCase()` çağırıyordu. `login` alanı metin değil de sayı, nesne veya dizi olduğunda JavaScript `TypeError` üretiyor ve tüm denetim sonlanıyordu. Doğru davranış, bozuk PR kaydını **doğrulanamaz** kabul etmek, sonucun `complete=false` ve `confirmed_count=null` olmasını sağlamak; diğer gözlemlenebilir kayıtları bozmamaktır. Bir sağlayıcının gerçekten bu veriyi gönderdiği iddia edilmiyor: örnekler sentetiktir.

**Gerçek geliştirme kanıtı:** Windows MXC altında Codex CLI `0.166.0` (`gpt-6.1-sol`) kaynak ve test dosyalarını **kendisi okuyup değiştirdi**, ayrıca Node testlerini çalıştırdı. Başlangıç **20/20 PASS**; altı yeni regresyonla **20 PASS / 6 FAIL** (`TypeError`); minimum `typeof` denetiminden sonra **26/26 PASS**. Bağımsız rehber-bağlantı testiyle toplam **31/31 PASS**. Testler Node `24.13.0` üzerinde; [PR #152](https://github.com/senanurcetin/nexus-devops-intelligence/pull/152) ve [tam GitHub CI #41512749583](https://github.com/senanurcetin/nexus-devops-intelligence/actions/runs/41512749583) bu sonucu destekler. ChatGPT git commit/push/PR/merge işlemlerini yönetti; kaynağı ve altı testi Codex yazdı.

## Türkçe: Aynı hatayı kendin yeniden üret

Git ve Node.js 24 yeterli. Komutları **temiz, geçici bir public klonda** çalıştır; kişisel çalışma alanındaki değişikliklerin üzerine yazma. İlk adım kamuya açık depoyu klonlamak için ağ gerektirir, sonraki Node testleri GitHub API'ına istek yapmaz ve API anahtarı istemez.

```bash
git clone https://github.com/senanurcetin/nexus-devops-intelligence.git
cd nexus-devops-intelligence

# Kod düzeltmesinden önceki ana dalda bulun
git switch --detach 5bc24f7db6928b979ff6bbf3bb8f911f1b29cf9a

# Yeni testleri, ESKİ kaynak kodunun üstüne yalnızca çalışma ağacına al
git restore --source=ed04526c1279dae55e469f654c65b6db1b8eb836 --worktree -- tests/oss-upstream-pr-audit.test.mjs
node --test tests/oss-upstream-pr-audit.test.mjs
# Beklenen regresyon: 20 PASS / 6 FAIL (TypeError); bu aşamadaki FAIL amaçlıdır

# Test dosyasını temizle ve Codex düzeltmesini içeren commit'e geç
git restore --worktree -- tests/oss-upstream-pr-audit.test.mjs
git switch --detach ed04526c1279dae55e469f654c65b6db1b8eb836
node --test tests/oss-upstream-pr-audit.test.mjs
# Kaydedilen sonuç: 26 PASS / 0 FAIL
```

İki sürüm arasındaki farkı incele: [kaynak dosyası](../scripts/oss-upstream-pr-audit.mjs) ve [regresyonlar](../tests/oss-upstream-pr-audit.test.mjs). Başarısız test ile doğrulanamayan sayım (`null`), **doğrulanmış sıfır** (`0`) ile aynı şey değildir.

## English: What failed and why?

The public GitHub Search audit treated the provider's `user.login` as a string without checking its type. Optional chaining does **not** make a number, object or array support `.toLowerCase()`. A malformed synthetic record consequently crashed the entire audit instead of being rejected as unverifiable. The fail-closed fix type-checks the login before comparing it, preserving verified evidence without falsely certifying a malformed result.

### Reproduce the recorded before/after

Run the cross-platform Git/Node commands in the Turkish section in a **new disposable checkout**. Start at the exact pre-fix commit `5bc24f7`, restore only the **new test file** from fixed commit `ed04526`, and observe the expected six `TypeError` regressions. Restore the original test file before switching to `ed04526`; rerun the same test to observe the 26/26 recorded PASS. These are actual historical results, not fabricated fresh executions. No private repository, API key, paid cloud service, live Search call or installed Codex CLI is needed for this replay.

## For Codex learners / Codex ile çalışanlara

An actual Codex CLI v0.166.0 session used Windows **MXC**, an isolated `workspace-write` sandbox, and disabled plugin/remote-plugin startup for that invocation. It inspected and edited only the auditor source and its offline test, ran the failing tests and then verified the fix. This **does not** require bypassing the security sandbox or publishing any workstation identifiers. To practice in your own clean clone, request a minimal fail-first patch and restrict it to those two files; verify every result yourself.

**Attribution / Kaynak ayrımı:** PR #152 source and tests **native Codex-authored**; separate git/PR orchestration and independent test checks **ChatGPT-assisted**. [Developer portfolio](CODEX_AMBASSADOR_PUBLIC_PORTFOLIO_20261030.md), [six-month roadmap](CODEX_CONTENT_ROADMAP_2026_2027.md) and [contribution guidance](../CONTRIBUTING.md) retain the verified evidence and limitations.
