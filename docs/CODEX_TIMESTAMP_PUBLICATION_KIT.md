# Timestamp doğrulama eğitimi — video ve topluluk yayın kiti

> **Durum: video ve sosyal medya paylaşımı taslak; GitHub kodu ve rehberleri kamuya açık.** İlk üretim kodu GPT-6 yardımıyla, sonraki test senaryoları ise gerçek Codex CLI kaynak metni incelemesiyle geliştirildi. Ayrı MXC Codex CLI oturumu ayrıca bir sentetik test dosyası ve yama önerisi üretti; bağımsız Windows çalıştırıcısı aynı testi önce FAIL, sonra PASS doğruladı. [Gerçek iş akışı ve sınırları](CODEX_INDEPENDENT_TEST_FIRST_EVIDENCE_20261027.md). Codex'in kendisinin terminal testlerini başarıyla çalıştırdığı veya video yayımlandığı iddia edilmez.

## 60–90 saniyelik teknik video senaryosu (çekim planı)

| Süre | Ekran görüntüsü/aksiyon | Anlatım |
|---|---|---|
| 0–12 sn | NEXUS GitHub deposu ve src/lib/nexus-panel-validation.ts | 'GitHub verilerinde küçük görünen bir tarih kontrolü, güvenilmeyen yanıtları yanlış kabul edebilir.' |
| 12–25 sn | Terminalde Date.parse('1') ile ISO karşılaştırma | 'JavaScript 1 değerini tarih gibi yorumlayabiliyor. Hedefimiz bu tür girdileri açıkça reddetmek.' |
| 25–40 sn | test dosyası, ilk hedef test FAIL | 'Önce sentetik Actions ve PR fikstürleriyle hatayı yakalayan regresyon testini kurduk.' |
| 40–59 sn | timestamp doğrulayıcısının diff'i | 'UTC ISO 8601 biçimini denetliyor ve takvimdeki taşmaları tarih dönüşümüyle kontrol ediyoruz.' |
| 59–75 sn | hedef test, 2/2 PASS; PR diff | 'İlk düzeltme ve güvenlik yaması birleştirildi; güncel kaynakta 241 test, typecheck ve build geçti, npm audit sıfır bulgu. Bu, Production onayı anlamına gelmiyor.' |
| 75–90 sn | rehber bağlantısı ve Codex uygulama reçetesi | 'Kod, test ve yeniden üretim adımlarını GitHub'da bıraktık. Codex ile gerçek oturum çekimi yapılırsa kaydı ayrıca paylaşacağız.' |

**Ekran kaydı mevcut değil.** Yukarıdaki tablo sadece yapılabilir çekim planıdır; gerçek terminal komutlarını ve mevcut test sonuçlarını kaydedin. GitHub özel token'ları, private repo isimleri, environment dosyaları, oturum kimlikleri veya kişisel bilgiler görünmemeli.

## LinkedIn / geliştirici topluluğu gönderisi — taslak

Gerçek bir Next.js + TypeScript açık kaynak projesinde küçük ama öğretici bir veri doğrulama problemi üzerinde çalıştım.

GitHub Actions ve PR özetlerindeki zaman damgaları için kullanılan Date.parse(), '1' gibi tarih olmayan değerleri geçerli sayabiliyordu. Önce sentetik regresyon testiyle hatayı doğruladım; ardından ISO 8601 UTC ve takvim geçerliliği kontrolü ekledim.

İlk düzeltmede regresyon testi önce 1/2 PASS, sonra 2/2 PASS verdi. Birleşmiş [PR #90](https://github.com/senanurcetin/nexus-devops-intelligence/pull/90), Next.js güvenlik [PR #91](https://github.com/senanurcetin/nexus-devops-intelligence/pull/91) ve Codex sınır durumları [PR #92](https://github.com/senanurcetin/nexus-devops-intelligence/pull/92) güncel kaynakta bulunuyor. Tam **241/241 test**, TypeScript ve Next.js build PASS; **npm audit 0 bulgu**. Bu sonuçlar hosted release onayı değildir.

Kaynak ve Türkçe uygulama rehberi: https://github.com/senanurcetin/nexus-devops-intelligence/blob/main/docs/CODEX_TIMESTAMP_REGRESSION_TUTORIAL_TR.md

İlk kod düzeltmesi GPT-6 destekliydi. Sonraki gerçek Codex CLI oturumlarında tarih sınır testleri önerildi; ayrıca Codex yeni bir sentetik test dosyası ve alternatif yama üretti. Harici Windows test çalıştırıcısıyla FAIL → PASS doğrulaması tamamlandı. Codex'in kendi shell testi başarılı değildi; bu sınır açıkça belgelenmiştir.

#OpenSource #TypeScript #SoftwareTesting #GitHub #DeveloperEducation

**Yayın kararı:** GitHub kaynağı ve eğitim dokümanı zaten kamuya açık; bu sosyal medya metni ve video **henüz paylaşılmadı/çekilmedi**. Video ancak gerçek ekran kaydı ve kişisel veri redaksiyonundan sonra yayımlanabilir.

## English technical summary — draft

**Hardening GitHub API timestamp validation in an open-source Next.js dashboard.** The browser-side validator previously relied on Date.parse(), which can accept non-date strings such as '1' and normalize impossible calendar dates. A synthetic, offline regression test reproduced the issue in both Actions and PR payloads. The patch requires canonical ISO 8601 UTC timestamps and checks the date components after parsing to reject silent calendar rollover. The isolated Node 22.16.0 test changed from 1/2 passing to 2/2 passing. At source commit ba1974f1cdbedc203f1730ea5c8b660f61e64bb6, Windows verification passed 240/240 npm tests, TypeScript checks and Next.js build. That historical Next.js 15.5.27 advisory was resolved in merged PR #91; the subsequent merged-source checkpoint reported 241/241 tests passing, clean TypeScript/Next.js build and zero npm audit findings. Separate real Codex CLI sessions proposed UTC boundary cases and generated an independent synthetic test plus an alternative patch. An external Windows Node runner observed a real FAIL then 2/2 PASS after the proposed patch was applied outside Codex. **Codex's own shell test execution and automated source edit were blocked by Windows sandbox child-process restrictions.** No video or live deployment acceptance is claimed.

## Yayın öncesi kontrol

- [x] İlk hata düzeltmesi #90, güvenlik yaması #91 ve Codex sınır durumları #92 birleştirildi; kesin merge commit'leri ilgili PR'larda bulunuyor.
- [x] Güncel birleşmiş kaynak: 241/241 Node testi, TypeScript, Next.js build PASS; npm audit 0. Bu hosted/Production QA değildir.
- [x] Gerçek Codex CLI test ve yama önerisi oturumu için kaynak/aktör/FAIL→PASS bilgisi [ayrı kanıt dosyasına](CODEX_INDEPENDENT_TEST_FIRST_EVIDENCE_20261027.md) bağlandı; Codex'in doğrudan shell testi başarılı diye sunulmuyor.
- [ ] Video çekildi mi, redaksiyon kontrolü yapıldı mı? Yoksa 'çekim planı' olarak bırak.
- [ ] LinkedIn yayın URL'sini ancak gerçek paylaşım gerçekleşince kaydet.
- [ ] Kişisel veri, maliyet, üretim erişimi, yerel sistem bilgisi ve secrets taraması yap.
