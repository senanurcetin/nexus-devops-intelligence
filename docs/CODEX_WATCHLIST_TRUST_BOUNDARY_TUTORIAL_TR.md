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
- Düzeltme dalının son kodu üzerinde **20/20 izole V8 davranış kontrolü PASS**: üst seviye ve iç içe posture repo kimliği, reddedilen release yetkisi iddiası, eksik/bozuk envelope, canonical kaynaklar, kötü niyetli URL, HTML/Markdown ve tablo yapısı. İç içe repo ve release iddiasının önceki dal sürümünde yanlışlıkla kabul edildiği ayrıca gözlendi.
- İzole V8 kontrolünde import edilen sanitizer'ın eşdeğeri test ortamında yeniden üretildi; bu sonuçlar aşağıdaki **gerçek Node testlerinden ayrıdır**.
- **30 Ekim 2026, ayrı Windows klonu, tam kaynak commit SHA `666ba42ca34e3386ae833165a0c818a7bc1dea43`, Node v24.13.0 / npm 11.6.2:** `node --import tsx --test tests/nexus-watchlist-triage.test.mjs` **11/11 PASS, exit 0**; `npm test` **373/373 PASS, exit 0**; `npm run typecheck` **PASS, exit 0**; `npm run build` **PASS, exit 0**, Next.js 15.5.28. Son `git status --short` temizdi.
- **Bağımlılık kurulumu sınırı:** `npm ci --ignore-scripts --no-audit --no-fund` 480 saniyelik zaman sınırında tamamlanmadı; **PASS değildir**. Gerçek testler, aynı `package-lock.json` SHA-256 (`823DB7B6853D814EAD1F9B7AD05E48A5F8AB57337687D2144F46083422B6A4E7`) bulunan mevcut başka bir yerel NEXUS klonundan **test klasörüne kopyalanan** `node_modules` ile çalıştırıldı. Mevcut ana çalışma klasörünün kaynakları değiştirilmedi. Bu, temiz npm kurulumu onayı değildir.
- Bu Windows source-only doğrulamaları **GitHub-hosted Actions, Ubuntu, Docker, Preview, Production veya Codex CLI oturumu değildir**. Bu PR GPT-6 destekli hazırlanmıştır; bağımsız gerçek Codex oturumunun kanıtları farklı belgelerde tutulur.

## İnceleme ve yayın kontrolü

Bu düzeltme ve testler [PR #100](https://github.com/senanurcetin/nexus-devops-intelligence/pull/100) üzerinden incelendi ve **ana dala birleştirildi**. PR'ın açılması veya source-only testlerin geçmesi production/Docker/Ubuntu, ücretli hizmet, erişilebilirlik veya canlı dağıtım kapılarını kapatmaz. Resmî [Codex Ambassadors](https://developers.openai.com/community/codex-ambassadors) Content yolunda topluluğa faydalı, tekrarlanabilir içerik beklenir; bu dosya teknik altyapıdır, yayınlanmış video veya Codex tarafından tamamlanmış çalışma olarak tanıtılmamalıdır.

| Kanıt | Bu değişiklikte durum |
| --- | --- |
| Açık kaynak değişiklik ve regresyon testleri | PR #100 ile `main` dalına birleştirildi |
| GitHub PR ve review | [PR #100](https://github.com/senanurcetin/nexus-devops-intelligence/pull/100) — **MERGED**, squash SHA `74dac35591bb29f91afbcc8f89ee59aee95e6d28` |
| GitHub ana SHA / dal kaynaklı izole V8 yeniden üretim | **Önceki davranış 3/3 doğrulandı; düzeltilmiş davranış 20/20 PASS** (tam Node testi değil) |
| Bağımsız yerel Node test, typecheck, build | **11/11 + 373/373 Node PASS; typecheck PASS; Next build PASS** — Windows, Node 24.13.0, SHA `666ba42c`; `npm ci` **TIMEOUT / NOT PASS** |
| Gerçek Codex CLI kodlama/test oturumu | **NOT RUN** |
| Video/sosyal medya/topluluk geri bildirimi | **NOT PUBLISHED / doğrulanmadı** |
| GitHub-hosted CI, Production, Docker OS kabulü | [CI #41116629184](https://github.com/senanurcetin/nexus-devops-intelligence/actions/runs/41116629184) **PASS**; Production ve native Ubuntu/Docker kabulü **NOT RUN** |

## Nihai kaynak ve CI doğrulaması — 30 Ekim 2026

Bu bölüm yukarıdaki **tarihsel Windows test sonuçlarını** geçersiz kılmaz, ancak PR'ın nihai durumunu esas alır. Windows'taki iki bağımsız `npm ci` denemesi zaman aşımına uğramıştı; bir ara commit'te eşzamanlı 374 testten 372'si geçmiş, iki browser alt süreç testi yerel yük altında başarısız olmuştu. Bu sonuçlar son commit üzerinde bütün kalite kapılarının başarısız olduğu anlamına gelmez.

- **Birleştirilmiş PR:** [#100](https://github.com/senanurcetin/nexus-devops-intelligence/pull/100).
- **Tam son PR HEAD:** `6621e702ab6fc758334ddc033fa58d39199955a1`. **Squash merge:** `74dac35591bb29f91afbcc8f89ee59aee95e6d28`.
- **Doğrulanmış bağımsız GitHub Actions:** [run 41116629184](https://github.com/senanurcetin/nexus-devops-intelligence/actions/runs/41116629184), `pull_request` olayı, Node.js 24; **completed / success**.
- **Kurulum:** `npm ci --no-audit --no-fund` **PASS**; logda 49 paket kurulduğu görülüyor.
- **Tam test paketi:** `npm test` **389/389 PASS, 0 FAIL**.
- **TypeScript:** `npm run typecheck` **PASS**.
- **Next.js üretim derlemesi:** `npm run build` **PASS**.
- **Sınır:** Bu çalışma temiz kurulumu ve uygulama kaynaklarını CI'da doğrular; Docker'ın Ubuntu üzerinde çalışmasını, canlı GitHub erişimini, Redis yük testini, ücretli/production yayını, gerçek Codex CLI oturumunu *bu PR'da*, tanıtım videosunu veya Codex Ambassador kabulünü **kanıtlamaz**. Kodun GPT-6 destekli üretildiği bilgisi korunmalıdır.
