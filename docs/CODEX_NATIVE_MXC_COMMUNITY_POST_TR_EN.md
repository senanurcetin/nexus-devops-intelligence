# Codex ile gerçek bir test-first düzeltme: bozuk GitHub verisini güvenle reddetmek

> Türkçe/English topluluk yazısı taslağı | 3 Kasım 2026. Bu, **bağımsız bir eğitim içeriğidir**; OpenAI onaylı bir Ambassador paylaşımı veya doğrulanmış topluluk erişimi iddiası değildir. Anlatılan kaynak düzeltmesi gerçekten **Codex CLI** tarafından hazırlanmıştır; bu açıklayıcı yazı ChatGPT yardımıyla düzenlenmiştir.

## Türkçe: Sorun ve öğrenme hedefi

Bir GitHub PR denetleyicisi, dış arama yanıtındaki `user.login` alanını her zaman metin kabul ediyordu. Sağlayıcı sayı, nesne veya dizi döndürdüğünde `?.toLowerCase()` çağrısı `TypeError` oluşturuyor ve denetim tamamen duruyordu. **Optional chaining, veri tipini doğrulamaz.**

**Doğrulanmış çözüm:** [Birleştirilmiş PR #152](https://github.com/senanurcetin/nexus-devops-intelligence/pull/152) için gerçekleştirilen native Codex CLI 0.166.0 / `gpt-6.1-sol` oturumunda, Windows MXC sandbox içerisinde önce altı başarısız regresyon senaryosu, ardından asgari tip kontrolü yazıldı. Tarihsel test akışı: **20 PASS → 20 PASS / 6 FAIL → 26/26 PASS**. Bu değerler kayıtlı oturuma aittir; aşağıdaki komutların bu konuşmada yeniden çalıştırıldığı iddia edilmez.

### 10 dakikalık tekrar üretim (Git ve Node.js 22+)

Komutları **yeni, geçici ve herkese açık bir klonda** çalıştırın. Özel depolara, gizli anahtarlara veya ücretli API'lara gerek yoktur.

```bash
git clone https://github.com/senanurcetin/nexus-devops-intelligence.git
cd nexus-devops-intelligence

# Eski uygulamaya yeni regresyonları uygula: altı kasıtlı başarısızlık beklenir.
git switch --detach 5bc24f7db6928b979ff6bbf3bb8f911f1b29cf9a
git restore --source=ed04526c1279dae55e469f654c65b6db1b8eb836 --worktree -- tests/oss-upstream-pr-audit.test.mjs
node --test tests/oss-upstream-pr-audit.test.mjs

# Test dosyasını geri al; birleştirilen Codex düzeltmesini doğrula.
git restore --worktree -- tests/oss-upstream-pr-audit.test.mjs
git switch --detach ed04526c1279dae55e469f654c65b6db1b8eb836
node --test tests/oss-upstream-pr-audit.test.mjs
```

İlk çalıştırmada `user.login` alanı **sayı, nesne veya dizi** olduğunda merged/open aramaları için altı regresyonun başarısız olması beklenir. İkinci çalıştırmanın tarihsel sonucu **26 PASS** olarak kaydedilmiştir. Kendi ortamınız farklı davranırsa terminal çıktısını, `git rev-parse HEAD` değerini ve Node sürümünü kaydedin. Doğrulanmamış sonucu PASS olarak etiketlemeyin.

### Bu örneğin öğretici tarafı

- Önce **davranış sözleşmesi** tanımlanır: tek bir bozuk sağlayıcı kaydı bütün denetimi çökertmemelidir.
- Ardından **en küçük güvenli düzeltme** uygulanır: `login` yalnızca `string` tipindeyse küçük harfe çevrilir.
- Bozuk kayıt **doğrulanamaz** kabul edilir. `confirmed_count=null` sonucu, gerçekten sayılmış `0` ile karıştırılmaz.
- Gerçek Codex kaynak yazarlığı, ChatGPT'nin yürüttüğü Git, PR ve CI koordinasyonundan ayrı raporlanır.

**Kendiniz deneyin:** Boş metin veya beklenmeyen `state` gibi yeni bir sentetik sınır durumu seçin. Önce başarısız olması gereken testi yazın; ardından yalnızca ilgili kontrolü düzeltin. Hangi kararda insan incelemesinin zorunlu olduğunu gerekçelendirin.

**Topluluk sorusu:** GitHub PR denetiminde hatalı bir kayıt, bütün isteği başarısız mı kılmalı; yoksa sağlam kayıtlar korunurken toplam sayımın doğrulanabilirliği açıkça düşürülmeli mi? Gerekçenizi ve tekrar üretim sonucunuzu paylaşabilirsiniz.

**Herkese açık kanıtlar:** [Codex tarafından yazılmış PR #152](https://github.com/senanurcetin/nexus-devops-intelligence/pull/152) · [ilgili GitHub CI](https://github.com/senanurcetin/nexus-devops-intelligence/actions/runs/41512749583) · [iki dilli adım adım rehber](CODEX_NATIVE_MXC_MALFORMED_AUTHOR_WORKSHOP_TR_EN.md).

### Kısa sosyal paylaşım taslağı (henüz dış platformda yayımlandığı iddia edilmez)

> Codex ile gerçek bir test-first güvenlik düzeltmesini nasıl geliştirdik? GitHub Search yanıtında `user.login` beklenmeyen tipte gelince PR denetleyicisi `TypeError` üretiyordu. Gerçek Codex CLI oturumunda altı başarısız regresyon testinden başlayarak minimum tip kontrolü ile 26/26 başarılı teste ulaşıldı. Kod, komutlar ve tam SHA'lar: https://github.com/senanurcetin/nexus-devops-intelligence/blob/main/docs/CODEX_NATIVE_MXC_MALFORMED_AUTHOR_WORKSHOP_TR_EN.md — Siz güvenli ve kanıta dayalı hata yönetimini nasıl tasarlardınız?

## English: a real Codex-authored test-first fix

A public GitHub Search auditing tool assumed the untrusted `user.login` field was a string. With malformed numeric, array or object values, calling `.toLowerCase()` caused a `TypeError`. **Optional chaining did not validate the field's type.**

In a recorded **native Codex CLI 0.166.0** session inside an isolated Windows MXC workspace, Codex added six synthetic failing tests and a minimal type guard. Recorded historical progression: **20 passing baseline tests; six new failures; then 26 passing tests**. The merged source and test change is [PR #152](https://github.com/senanurcetin/nexus-devops-intelligence/pull/152). ChatGPT separately handled commits and PR coordination; the source change was genuinely Codex-authored.

To reproduce, follow the exact Git/Node commands above on a fresh disposable checkout. The old implementation should fail the new malformed-login tests; the fixed commit should pass them. Your own result is determined by your run, not the historical count.

**Practical lesson:** validate external payload types, distinguish *unknown or uncertifiable* from a genuine numeric zero, and keep a human review boundary around AI-generated code. The offline exercise does not require credentials or paid services.

**Question for builders:** When a GitHub search result contains malformed author data, should an auditor fail the entire request or preserve verified observations while marking the overall count uncertifiable?

**Share-ready English summary (not yet claimed as externally published):**

> I used a real native Codex CLI session to build a test-first guard for malformed GitHub Search author logins. Six synthetic failures became 26 passing tests after a minimal type check, with an exact merged PR and CI evidence. Reproduce it offline: https://github.com/senanurcetin/nexus-devops-intelligence/blob/main/docs/CODEX_NATIVE_MXC_MALFORMED_AUTHOR_WORKSHOP_TR_EN.md . How would you design safe fail-closed audit behavior?

---

**Publication integrity:** This Markdown is public only after its branch is merged/published. An external social post, attendance, reach, replies, official program selection or submitted personal video are **not** evidenced by this article. The maintained [content ledger](CODEX_COMMUNITY_CADENCE_TR_EN.md) records external sharing and feedback separately.
