# Codex ile test-first inceleme alıştırması: GitHub'da 100 mü, 101 mi?

> **Kamuya açık Türkçe laboratuvar · 2 Kasım 2026.** Bu sayfa, herkese açık MIT lisanslı bir repodaki gerçek bir doğruluk hatasını **sentetik çevrimdışı testlerle** anlatır. Kaynak düzeltmesi **GPT-6 destekli** yapıldı; 2 Kasım'daki Codex CLI 0.166.0 oturumu **kullanım limitinde durduğu için** test veya düzeltme yapmadı. [27 Ekim'deki ayrı, gerçekten tamamlanmış Codex CLI test-first oturumunun kanıtı](CODEX_MXC_NATIVE_TEST_FIRST_PROOF_20261027.md) bu çalışmaya ait değildir. Ambassador kabulü, video ya da haricî bir sosyal medya yayını iddiası yoktur.

## Öğrenme hedefi

Bir denetim aracının **doğruladığını iddia ettiği kanıtın sınırını** test etmek: GitHub Search API'ye `per_page=100` denildiğinde, beklenmedik şekilde 101 öğe dönen bir yanıtın `complete=true` sayılması güvenilir değildir. Gerçek GitHub'ın 101 kayıt verdiği iddia edilmiyor; bu, bozuk veya taklit edilmiş bir sağlayıcı yanıtını kullanan **sentetik bir güven sınırı testi**.

Bu örnekte açık PR'lar *asla* birleşmiş PR sayısı değildir. Geçersiz sağlayıcı verisi için `confirmed_count=null` sonucu, yanlış bir kesin sayıdan daha doğrudur.

## 10 dakikalık uygulama

**Gerekenler:** Git, Node.js 24 (veya testleri destekleyen güncel Node); ücretli API, özel GitHub token'ı, Docker, GitHub Actions tetiklemesi veya gerçek GitHub araması gerekmez.

```bash
git clone https://github.com/senanurcetin/nexus-devops-intelligence.git
cd nexus-devops-intelligence
git fetch origin pull/141/head

# 1) Düzeltme öncesi: yalnızca yeni regresyon testlerini içeren commit
git switch --detach d29fd8a58a8fb25c61c3459ad17706fcbb82b013
node --test tests/oss-upstream-pr-audit.test.mjs

# 2) Düzeltme sonrası: aynı testler, yeni kaynak kodu
git switch --detach 8ba87f0a90784aa3fb79107d07088af5530a17a7
node --test tests/oss-upstream-pr-audit.test.mjs
```

**2 Kasım 2026'da doğrulanmış geçmiş sonuçlar:**

| Revizyon | Test sayısı | Beklenen kanıt |
| --- | --- | --- |
| Test-first `d29fd8a` | 15 PASS, **1 FAIL**, exit 1 | 101 satırlı sahte yanıt yanlışlıkla `complete=true` kabul ediliyordu |
| Düzeltme `8ba87f0` | **16 PASS**, 0 FAIL, exit 0 | 101 satırlı sayfa doğrulanmıyor; geçerli 100 satırlı sayfa hâlâ doğrulanıyor |

Bu sonuçlar tarihsel, izole Windows/Node çalışmalarıdır; her okuyucunun çıktısı ancak komutu gerçekten çalıştırınca doğrulanır. [Kaynak ve test değişikliği PR #141](https://github.com/senanurcetin/nexus-devops-intelligence/pull/141), [PR başındaki 504/504 başarılı otomatik CI](https://github.com/senanurcetin/nexus-devops-intelligence/actions/runs/41494011633).

## Kod incelemesinde nelere bakmalı?

1. [`searchPages()`](../scripts/oss-upstream-pr-audit.mjs) içindeki `PAGE_SIZE=100`, `complete`, `seenRows` ve `confirmed_count` ilişkisini incele.
2. [Regresyon testlerinde](../tests/oss-upstream-pr-audit.test.mjs) **101 satırlı bozuk sağlayıcı yanıtı** ile **100 satırlı geçerli yanıtı** karşılaştır. Sadece testin geçmesi değil, yanlış güven iddiasının engellenmesi önemlidir.
3. Düzeltmede `result.items.length > PAGE_SIZE` durumunun `complete=false` olarak işaretlendiğini, ayrıca incelenen öğelerin `slice(0, PAGE_SIZE)` ile sınırlandığını doğrula.
4. `observed_valid_external_prs` ile `confirmed_count` aynı şey değildir. Eksik veya tutarsız kaynak verisinde kesin birleşmiş katkı sayısı ilan etme.

## Codex ile isteğe bağlı yeniden uygulama

Codex CLI girişiniz ve kullanım hakkınız mevcutsa, **yalnızca kendi geçici klonunuzda**, test-first commit'ine geçip şu talimatla çalışabilirsiniz. Aşağıdaki talimat bir *alıştırma örneğidir*, bu PR için başarıyla çalıştırılmış bir Codex oturumu olarak sunulmaz.

```bash
codex exec --sandbox workspace-write "Inspect scripts/oss-upstream-pr-audit.mjs and tests/oss-upstream-pr-audit.test.mjs. First reproduce the overfull 101-item page failure with node --test tests/oss-upstream-pr-audit.test.mjs. Then implement the smallest fail-closed fix. Rerun the test suite. Do not modify other files, use secrets, call external APIs, commit, push or deploy."
```

**İnceleme kuralı:** Gerçek prompt, araç sürümü, yürütülen test komutu, tam Git SHA ve çıkış kodu olmadan 'Codex yaptı' denmez. 2 Kasım'da Codex CLI 0.166.0 kullanıcı oturumunda giriş başarılıydı; kullanım limiti nedeniyle **yeni Codex kodu üretilmedi**. Bu eğitimdeki PR #141 kaynak düzeltmesi GPT-6 desteklidir.

**Bağımsız test sonrası:** `git switch main` ile kendi klonunuza dönebilirsiniz. Bu alıştırma herhangi bir canlı servise dağıtım yapmaz.
