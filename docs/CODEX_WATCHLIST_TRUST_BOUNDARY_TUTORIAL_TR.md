# Codex için gerçek repo incelemesi: NEXUS watchlist veri güven sınırı

> **Durum:** Açık kaynak kod, regresyon testleri ve bu öğretici aynı inceleme dalında hazırlanmıştır. Bu değişiklikler **GPT-6 destekli GitHub geliştirmesidir; Codex CLI'nin bu PR'ı yazdığı veya testleri çalıştırdığı iddia edilmez.** Başvuru sonucu, video, yayın ve topluluk etkileşimi için doğrulanmış ayrı kanıt gerekir.

## Problem ve sınır

NEXUS DevOps Intelligence salt-okunur, anonim, kamuya açık GitHub verilerinden en fazla **10 workflow run / 5 açık PR** örnekleyerek özet çıkarır. `scripts/jarvis-watchlist.mjs` en fazla 10 repo için yerel Jarvis MCP `devops_repo_digest` yanıtlarını `triageWatchlist` ile sıralar; bu bir skor, kök neden veya merge/release izni değildir.

30 Ekim 2026'da `src/lib/nexus-watchlist-triage.ts` kaynak incelemesinde iki güven sınırı görüldü:

1. `toEntry` istekteki `repository` ile digest içindeki `digest.repository` değerinin aynı olduğunu kontrol etmiyordu. Başka bir repo için üretilmiş, doğrulanmış sinyaller yanlış watchlist satırında görünebilirdi.
2. Digest'in ilk `source_url` değeri Markdown tabloya doğrudan aktarılıyor; başlıktaki HTML/Markdown işaretleri yalnızca whitespace ve kontrol karakterleri seviyesinde temizleniyordu. Bozuk veya manipüle edilmiş bir yanıt yanıltıcı dış bağlantı/metin üretebilirdi.

Bunlar yerel yanıt işleme katmanındaki **savunma-derinliği ve veri bütünlüğü** riskleridir; uzak sistemin ele geçirildiğine veya gerçek kullanıcıların saldırıya uğradığına dair bulgu değildir.

## Test-first doğrulama reçetesi

Düzeltmeden önceki ana kaynak SHA: `2bad0d2f280a47dd18bb5ca0b002c0de93dbba6c`.

Regresyonlar: `tests/nexus-watchlist-triage.test.mjs`.

- İstek `o/expected`, yanıt `o/other`: kaynak `unreadable` kabul edilmeli, başka repo kanıtı taşınmamalı.
- Yanlış şema/veri kaynağı, yazma yetkisi iddia eden envelope, bozuk `sources` veya `investigations`: fail-closed.
- `https://github.com/o/good/actions/runs/7` geçerli; farklı repo, query, path traversal, güvensiz scheme, dev sayısal id ve PR/run tip uyumsuzluğu kabul edilmemeli.
- `<img ...>` ve `[click](https://evil.example)` gibi üçüncü taraf başlıkları aktif HTML/Markdown olmamalı.
- Gerçek canonical GitHub kanıt bağlantısı korunmalı; yoksa `-` gösterilmeli.

Yerel, internet üzerinden API çağrısı yapmayan testler:

```bash
git checkout codex/watchlist-evidence-trust-20261030
npm ci
node --import tsx --test tests/nexus-watchlist-triage.test.mjs
npm test
npm run typecheck
npm run build
```

Daha güçlü test-first kanıtı üretmek için regresyon testlerini **önce ana SHA üzerinde**, sonra aynı testleri düzeltme dalında çalıştırın. Her komut için cihaz/OS, Node sürümü, tam commit SHA, exit code ve çıktı saklayın. Her iki sürüm gerçekten çalıştırılmadan `FAIL → PASS` gerçekleşti denilmemelidir.

## Uygulanan düzeltme

- Digest'in şema, public veri kaynağı, salt-okunur yetki bildirimi, repo kimliği, doğrulanmış HTTP 200 kaynak kanıtı ve bounded investigation listesini denetle.
- Eşleşmeyen veya bozuk digest için `readable=false`, `first_url=null`; sırayı yazma yetkisine dönüştürme.
- İlk kanıt bağlantısında yalnızca ilgili `owner/repo` kapsamındaki canonical GitHub `actions/runs/<id>` veya `pull/<id>` yollarına izin ver; sayıyı ve kanıt tipini denetle.
- Tablo hücrelerindeki HTML ve Markdown meta karakterlerini escape et. GitHub'dan gelen içerik daima veri kabul edilir.

**Değişmeyen yetkiler:** Yeni GitHub GET, token, gizli repo erişimi, retry, merge, commit, deploy, bulut CI, ödeme ve sunucu yayını eklenmedi.

## Codex ile yeniden uygulanabilir çalışma

Aşağıdaki istem, bağımsız bir Codex oturumunda kullanılmak üzere **öneridir**; gerçekleşmiş oturum kanıtı değildir:

```text
Bu public NEXUS DevOps Intelligence reposunda sadece watchlist digest güven sınırını incele.
Önce test yaz ve asıl davranışı yanlış repo kimliği, çapraz repo URL, HTML/Markdown
ve bozuk JSON/envelope senaryolarıyla test et. Test başarısızlığını gerçek exit code
ile göster. Ardından en küçük güvenli yamayı uygula, testleri, typecheck'i ve
tam Node suite'ini çalıştır. Hiçbir GitHub write, CI, canlı servis, private repo,
credential veya deployment çalıştırma. Sonuçları PASS/FAIL/NOT RUN olarak,
tam SHA ve gerçek kanıtlarla raporla. Kodun GPT-6 ile önceden üretildiğini
gizleme; bağımsız Codex katkısını ayrıca ayır.
```

## Bu değişiklikteki çalışma kanıtı — 30 Ekim 2026

- Test-fixture ve regresyon testleri önce `fd81c2706391039115e6719661141bb6a1f4894d` commit'i ile yazıldı.
- Ana SHA'daki önceki `triageWatchlist` ve Markdown üretimi, GitHub'dan okunmuş kaynak metnindeki TypeScript tipleri geçici olarak çıkartılıp izole V8 ortamında çalıştırıldığında üç riskli davranışı gösterdi: başka repo digest'i kabulü, kontrolsüz dış URL ve ham HTML.
- Düzeltme dalının son kodu üzerinde **17/17 izole V8 davranış kontrolü PASS**: repo kimliği, eksik ve yetki modeliyle uyuşmayan envelope, canonical kaynaklar, kötü niyetli URL, HTML/Markdown ve tablo yapısı.
- Bu kontrollerde import edilen sanitizer'ın eşdeğeri test ortamında yeniden üretildi. Dolayısıyla **tam Node test sonucu, TypeScript typecheck, Next.js build veya Codex CLI çalışması değildir.** Bunlar halen **NOT RUN**.

## İnceleme ve yayın kontrolü

Bu repo, test ve öğretici **bir PR içinde inceleme için** sunulmalıdır. PR'ın açılması veya source-only testlerin geçmesi production/Docker/Ubuntu, ücretli hizmet, erişilebilirlik veya canlı dağıtım kapılarını kapatmaz. Resmî [Codex Ambassadors](https://developers.openai.com/community/codex-ambassadors) Content yolunda topluluğa faydalı, tekrarlanabilir içerik beklenir; bu dosya teknik altyapıdır, yayınlanmış video veya Codex tarafından tamamlanmış çalışma olarak tanıtılmamalıdır.

| Kanıt | Bu değişiklikte durum |
| --- | --- |
| Açık kaynak değişiklik ve regresyon testleri | Geliştirme dalında mevcut |
| GitHub PR ve review | PR durumu ayrıca kontrol edilmeli |
| GitHub ana SHA / dal kaynaklı izole V8 yeniden üretim | **Önceki davranış 3/3 doğrulandı; düzeltilmiş davranış 17/17 PASS** (tam Node testi değil) |
| Bağımsız yerel Node test, typecheck, build | **NOT RUN** — bu ortamda repo bağımlılıkları kurulamadı |
| Gerçek Codex CLI kodlama/test oturumu | **NOT RUN** |
| Video/sosyal medya/topluluk geri bildirimi | **NOT PUBLISHED / doğrulanmadı** |
| Hosted CI, Production, Docker OS kabulü | **NOT RUN / yetkilendirilmedi** |
