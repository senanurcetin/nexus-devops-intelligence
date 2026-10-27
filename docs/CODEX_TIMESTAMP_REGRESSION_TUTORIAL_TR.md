# Gerçek bir GitHub projesinde regresyon testi: GitHub zaman damgaları

> **27 Ekim 2026 güncel durum:** İlk hata düzeltmesi ChatGPT/GPT-6 destekli olarak [PR #90](https://github.com/senanurcetin/nexus-devops-intelligence/pull/90) ile birleştirildi. Sonrasında gerçek **Codex CLI 0.164.0** oturumlarında önce kaynak metnine dayalı test sınırları önerildi ([#92](https://github.com/senanurcetin/nexus-devops-intelligence/pull/92)), sonra ayrı bir Codex oturumunda sentetik regresyon testi oluşturulup alternatif kaynak düzeltmesi önerildi. Codex Windows sandbox'ı Node alt sürecini çalıştıramadığı için testleri bağımsız Windows çalıştırıcısı **önce FAIL, sonra PASS** olarak doğruladı. [Ayrıntılı gerçek oturum kanıtları](CODEX_INDEPENDENT_TEST_FIRST_EVIDENCE_20261027.md). Video çekildiği veya Codex'in kendi içinde test/commit gerçekleştirdiği iddia edilmez.

## 1. Problem ve neden önemli?

NEXUS DevOps Intelligence, public GitHub Actions ve PR özetlerini okur. Tarayıcıdaki sınır denetimi, gelen zaman damgaları için yalnızca JavaScript Date.parse() sonucunun sonlu olmasına bakıyordu. Ancak Date.parse('1'), 2001-01-01 tarihine dönüşebilir; 2026-02-30 gibi imkânsız tarihler de sonraki aya taşınabilir. Bu nedenle güvenilmeyen bir API yanıtındaki sahte tarih, geçerli örnek olarak kabul edilebilirdi.

Beklenen davranış: public GitHub verilerinde ISO 8601 UTC 'YYYY-MM-DDTHH:mm:ss[.fraction]Z' biçimi kabul edilmeli; tarih olmayan, takvimde geçersiz, alternatif RFC tarih biçimleri ve saat dilimi ofsetleri tarayıcı sınırında reddedilmeli. Bu, sunucu tarafındaki doğrulamaların yerini almaz.

## 2. Başlangıç noktası ve çakışmaları önleme

- Hedef depo: https://github.com/senanurcetin/nexus-devops-intelligence
- Referans ana dal commit'i: bb0500a75df5800fb6590d4398b0b7dc700eebf7
- Başlangıç kaynak dosyası Git blob SHA: 8c03cb8d8e417338e6a8aa7d7df0bce0880af27a
- Etkilenen kod: src/lib/nexus-panel-validation.ts, hem isPublicActionsSample hem isPublicPullSample.
- İzole dal: content/codex-timestamp-regression-20261027.
- Mevcut taslak PR #80 Docker/self-hosting kapsamındadır; bu çalışma Docker, release, deployment veya ücretli hizmetleri değiştirmez.

## 3. Önce testi kır: gerçek çevrimdışı yeniden üretim

Bağımsız dosya tests/nexus-panel-timestamps.test.mjs sentetik Actions ve PR yanıtları içerir. Geçerli örnekler 2026-10-13T11:00:00Z, 2026-10-13T11:00:00.123Z ve artık yıldaki 2024-02-29T23:59:59Z biçimleridir. Reddedilmesi gereken örnekler: '1', '2026-02-30T11:00:00Z', '2026-04-31T11:00:00Z', '+03:00' ofsetli zaman, RFC 1123 tarih ve yalnızca YYYY-MM-DD.

Başlangıç kaynak blob'uyla eşleştiği Git SHA üzerinden denetlenen yerel dosyada, yalnızca hedef test Node v22.16.0 ile çalıştırıldı:

    node --experimental-strip-types --test tests/nexus-panel-timestamps.test.mjs

**Önce:** 2 alt testten 1 PASS / 1 FAIL. Reddedilmesi beklenen '1' değerini Actions örneği için kabul ettiği doğrulandı ('true !== false'). Bu, tüm proje test paketi değildir.

## 4. En küçük düzeltme

- Date.parse öncesinde ISO 8601 UTC biçimini tam eşleşen bir düzenli ifadeyle denetle.
- Sonlu zamanı kontrol et.
- new Date(parsed).toISOString() ile orijinal yıl/ay/gün/saat/dakika/saniyenin aynı kaldığını doğrula. Böylece 30 Şubat gibi sessiz takvim düzeltmeleri reddedilir.
- Tarih kabul kuralını hem Actions hem PR bileşenlerinin kullandığı ortak timestamp yardımcısında tut.
- GitHub GET, ağ erişimi, Redis, auth, dağıtım ve otomatik yeniden deneme davranışını değiştirme.

## 5. Sonuç ve tekrarlanabilir komutlar

Yama uygulandıktan sonra aynı çevrimdışı hedef test Node v22.16.0 üzerinde yeniden çalıştırıldı: **2/2 PASS, 0 FAIL**.

**Windows kaynak testleri (27 Ekim 2026):** İzole, temiz GitHub klonunda `ba1974f1cdbedc203f1730ea5c8b660f61e64bb6` commit'i, Node v24.13.0 ve npm 11.6.2 ile doğrulandı. `npm ci --ignore-scripts --no-audit --no-fund`: PASS; `node --import tsx --test tests/nexus-panel-timestamps.test.mjs`: **2/2 PASS**; `npm test`: **240/240 PASS**; `npm run typecheck`: PASS; `npm run build`: PASS (Next.js 15.5.27). Build kaynak kodu değiştirmedi; otomatik üretilen `next-env.d.ts` farkı yerel klonda geri alındı. Bunlar **CI veya Production kabulü değildir**.

**Tarihsel güvenlik bulgusu:** İlk testte `next@15.5.27` üzerinde `npm audit` bir kritik bulgu verdi ([GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw)). Bu bulgu **ayrı [PR #91](https://github.com/senanurcetin/nexus-devops-intelligence/pull/91)** ile Next.js `15.5.28`e geçilerek giderildi. PR #92'deki güncel test kaynak ağacında **241/241 test PASS**, TypeScript ve Next.js build PASS, `npm audit` **0 bulgu** doğrulandı. Bu sonuçlar Production deployment onayı değildir.

Yeni test GitHub reposuna da eklendi. Normal paket bağımlılıklarının bulunduğu bir ortamda aşağıdaki komutlar ayrıca çalıştırılmalıdır:

    npm ci
    node --import tsx --test tests/nexus-panel-timestamps.test.mjs
    npm test
    npm run typecheck
    npm run build

**Ayrı kalan doğrulamalar:** Tarayıcı/gerçek cihaz, erişilebilirlik, Docker OS matrisi ve Production/Preview kabulü bu eğitimin parçası olarak çalıştırılmadı. Güvenlik kaynak denetimi [#91](https://github.com/senanurcetin/nexus-devops-intelligence/pull/91) ile temizlendi; mevcut uygulama kaynakları hiçbir şekilde otomatik olarak Production'a çıkarılmış sayılmaz.

## 6. Gerçek Codex oturumları ve tekrarlanabilir alıştırma

27 Ekim'de iki ayrı Codex katkısı gerçekleşti: [#92](https://github.com/senanurcetin/nexus-devops-intelligence/pull/92) için kaynak metninden altı tarih sınırı önerisi ve [ikinci bağımsız Codex CLI oturumu](CODEX_INDEPENDENT_TEST_FIRST_EVIDENCE_20261027.md) için bir sentetik test dosyası ile alternatif yama önerisi. İkinci çalışmada harici Node komutu önce **exit 1**, önerilen düzeltme haricen uygulandıktan sonra **2/2 PASS, exit 0** verdi. Bu, Codex'in kendi terminalinde testleri çalıştırdığı anlamına gelmez. Aynı iş akışını yeni, bağımsız bir kaynak klonunda tekrarlamak için aşağıdaki prompt kullanılabilir:

> NEXUS DevOps Intelligence deposundaki src/lib/nexus-panel-validation.ts zaman damgası denetimini incele. Date.parse('1') ve 2026-02-30 örneklerini önce yalnızca çevrimdışı sentetik testlerle yeniden üret; başlangıç testini çalıştırıp çıktıyı kaydet. Sonra en küçük güvenli ISO 8601 UTC düzeltmesini yap, aynı testleri ve mevcut uygun doğrulamaları çalıştır. Başka branch'lere dokunma, Vercel/GitHub Actions tetikleme, Production'a deploy yapma, gizli bilgi isteme. Uygulanan komutları, başarısızlıkları, gerçek test çıktılarını ve commit SHA'yı açıkça raporla.

**Kanıt ayrımı:** Codex gerçekten yeni bir sentetik test dosyası üretti ve ikinci bir doğrulama algoritması önerdi. İlk uygulama düzeltmesinin [#90](https://github.com/senanurcetin/nexus-devops-intelligence/pull/90) kodu ise **GPT-6 destekli** olarak yazıldı. Codex'in alternatif yaması yalnızca izole çalışma ve karşılaştırma için haricen uygulandı; mevcut `main` doğrulayıcısı geniş Codex testiyle de geçtiğinden gereksiz üretim değişikliği yapılmadı. Uygulanan gerçek komut, başarısızlık, SHA ve sınırlamalar [kanıt dosyasında](CODEX_INDEPENDENT_TEST_FIRST_EVIDENCE_20261027.md) açıklanır.

## 7. Güvenlik, sınırlamalar ve öğrenilenler

- Tarih biçimini kabul etmek tek başına GitHub verisinin gerçekliğini kanıtlamaz; URL, ID, sayım ve repo sınır denetimleri korunur.
- Zorunlu UTC, GitHub REST verisi için bilinçli bir sözleşme kararıdır; başka veri kaynaklarından offsetli zaman almak gerekirse ayrı bir spesifikasyon gerekir.
- Regex yalnız başına takvim doğrulamaz; ISO round-trip kontrolü gereklidir.
- GitHub bağlantılı commit kayıtları Codex oturumu kanıtı değildir.
- Yayın ve video için Codex çalıştırma ve insan incelemesi sonrasında ikinci bir doğrulama geçişi yap.

## 8. Referanslar

- Kaynak repo: https://github.com/senanurcetin/nexus-devops-intelligence
- Başvuru kriterleri: https://developers.openai.com/community/codex-ambassadors
- Katkı rehberi: ../CONTRIBUTING.md
- Node test altyapısı: https://nodejs.org/api/test.html
- Codex ile gerçek çalışma: https://developers.openai.com/learn/codex
- Gerçek Codex CLI test-first kanıtı: [bağımsız oturum kaydı](CODEX_INDEPENDENT_TEST_FIRST_EVIDENCE_20261027.md)
- İlk Codex metin incelemesi: [PR #92 kanıt dosyası](CODEX_TIMESTAMP_REVIEW_EVIDENCE_20261027.md)

## 27 Ekim 2026 — birleşme ve bağımsız Codex kaynak incelemesi (güncel durum)

- Yukarıdaki eğitim ve ilk regresyon düzeltmesi **[PR #90](https://github.com/senanurcetin/nexus-devops-intelligence/pull/90) ile main dalına birleştirildi**. İlk baştaki 'draft' ve 'Codex hiç kullanılmadı' ifadeleri tarihsel aşamayı anlatır; güncel durum için bu bölüm esas alınmalıdır.
- **[Güvenlik PR #91](https://github.com/senanurcetin/nexus-devops-intelligence/pull/91)** ile Next.js 15.5.28 kaynak dalına alındı. İki değişikliğin bir arada bulunduğu kaynak kombinasyonunda Windows'ta **240/240 otomatik test, TypeScript, Next.js build ve npm audit (0 bulgu)** başarılı oldu. Bu doğrulama Vercel Production onayı değildir.
- **Gerçek Codex CLI (0.164.0) kaynak incelemesi** ayrıca tamamlandı: Orijinal kamuya açık fonksiyonun tam metni prompt ile verilerek altı test sınır durumu önerildi. Bu vakalar ayrı bir test PR'ına aktarıldı. Codex kaynak dosyasını shell ile okumadı, test çalıştırmadı, dosya değiştirmedi veya commit oluşturmadı. Ayrıntılar: [Codex inceleme kanıtı](CODEX_TIMESTAMP_REVIEW_EVIDENCE_20261027.md).
- İlk Windows sandbox denemesi `helper_sandbox_lock_failed` (error 5) ile engellendi; ancak **MXC sandbox** ile Codex test dosyası oluşturabildi. Codex içerisindeki `node`/`git` alt süreçleri `0xC0000142` hatası verdi; harici Windows doğrulaması gerçek önce FAIL/sonra PASS çıktısını sağladı. Sandbox güvenliği devre dışı bırakılmadı. Video, insan cihaz/erişilebilirlik onayı ve hosted release ayrı kalır.
