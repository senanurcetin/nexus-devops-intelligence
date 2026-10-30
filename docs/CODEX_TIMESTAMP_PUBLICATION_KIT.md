# Timestamp doğrulama eğitimi — video ve topluluk yayın kiti

> **Durum: video ve sosyal medya paylaşımı taslak; GitHub kodu ve rehberleri kamuya açık.** İlk üretim kodu GPT-6 yardımıyla, sonraki test senaryoları ise gerçek Codex CLI kaynak metni incelemesiyle geliştirildi. Ayrı MXC Codex CLI oturumu ayrıca bir sentetik test dosyası ve yama önerisi üretti; bağımsız Windows çalıştırıcısı aynı testi önce FAIL, sonra PASS doğruladı. [Gerçek iş akışı ve sınırları](CODEX_INDEPENDENT_TEST_FIRST_EVIDENCE_20261027.md). **Önemli ayrım:** İlk bağımsız Codex oturumunda shell komutları Windows sandbox tarafından engellendi; daha sonraki [ayrı native MXC oturumunda](CODEX_MXC_NATIVE_TEST_FIRST_PROOF_20261027.md) Codex testleri gerçekten çalıştırdı (**önce 4 FAIL / 2 PASS, sonra 6/6 PASS**). Video hâlâ yayımlanmadı.

**Bu 60–90 saniyelik teknik demo, başvuruda istenen yaklaşık 30 saniyelik kişisel tanıtım videosundan farklıdır.** Her iki kayıt da henüz yayımlandı olarak işaretlenmemelidir. Başvuru videosunun önerilen kısa metni [portföyde](CODEX_AMBASSADOR_PUBLIC_PORTFOLIO_20261030.md) bulunur.

## 60–90 saniyelik teknik video senaryosu (çekim planı)

| Süre | Ekran görüntüsü/aksiyon | Anlatım |
|---|---|---|
| 0–12 sn | NEXUS GitHub deposu ve src/lib/nexus-panel-validation.ts | 'GitHub verilerinde küçük görünen bir tarih kontrolü, güvenilmeyen yanıtları yanlış kabul edebilir.' |
| 12–25 sn | Terminalde Date.parse('1') ile ISO karşılaştırma | 'JavaScript 1 değerini tarih gibi yorumlayabiliyor. Hedefimiz bu tür girdileri açıkça reddetmek.' |
| 25–40 sn | test dosyası, ilk hedef test FAIL | 'Önce sentetik Actions ve PR fikstürleriyle hatayı yakalayan regresyon testini kurduk.' |
| 40–59 sn | timestamp doğrulayıcısının diff'i | 'UTC ISO 8601 biçimini denetliyor ve takvimdeki taşmaları tarih dönüşümüyle kontrol ediyoruz.' |
| 59–75 sn | hedef test, 2/2 PASS; PR diff | 'İlk tarih düzeltmesi birleştirildi. Daha sonraki kaynak doğrulamasında GitHub Actions 389 test, typecheck ve Next.js build aşamalarını geçti. Bu, Production onayı değil.' |
| 75–90 sn | rehber bağlantısı ve Codex uygulama reçetesi | 'Gerçek Codex test-first oturumu ayrı kanıt dosyasında, kod ve eğitim GitHub'da. Yeni video kaydını yayımladığımızda bağlantısını ekleyeceğiz.' |

**Ekran kaydı mevcut değil.** Yukarıdaki tablo sadece yapılabilir çekim planıdır; gerçek terminal komutlarını ve mevcut test sonuçlarını kaydedin. GitHub özel token'ları, private repo isimleri, environment dosyaları, oturum kimlikleri veya kişisel bilgiler görünmemeli.

## LinkedIn / geliştirici topluluğu gönderisi — taslak

Gerçek bir Next.js + TypeScript açık kaynak projesinde küçük ama öğretici bir veri doğrulama problemi üzerinde çalıştım.

GitHub Actions ve PR özetlerindeki zaman damgaları için kullanılan Date.parse(), '1' gibi tarih olmayan değerleri geçerli sayabiliyordu. Önce sentetik regresyon testiyle hatayı doğruladım; ardından ISO 8601 UTC ve takvim geçerliliği kontrolü ekledim.

İlk düzeltmede regresyon testi önce 1/2 PASS, sonra 2/2 PASS verdi. Birleşmiş [PR #90](https://github.com/senanurcetin/nexus-devops-intelligence/pull/90), Next.js güvenlik [PR #91](https://github.com/senanurcetin/nexus-devops-intelligence/pull/91) ve Codex sınır durumları [PR #92](https://github.com/senanurcetin/nexus-devops-intelligence/pull/92) güncel kaynakta bulunuyor. **Tarihsel** #92 kontrol noktasında 241/241 test ve o tarihte `npm audit` 0 bulgu vardı. Daha sonra [PR #100'ün son commit'inde](https://github.com/senanurcetin/nexus-devops-intelligence/pull/100) [GitHub Actions](https://github.com/senanurcetin/nexus-devops-intelligence/actions/runs/41116629184) ile **389/389 test, temiz `npm ci`, TypeScript ve Next.js build PASS** doğrulandı. Bu sonuçlar hosted release/Production onayı veya güncel bir `npm audit` sonucu değildir.

Kaynak ve Türkçe uygulama rehberi: https://github.com/senanurcetin/nexus-devops-intelligence/blob/main/docs/CODEX_TIMESTAMP_REGRESSION_TUTORIAL_TR.md

İlk kod düzeltmesi GPT-6 destekliydi. Sonraki gerçek Codex CLI oturumlarında tarih sınır testleri önerildi; ayrıca Codex yeni bir sentetik test dosyası ve alternatif yama üretti. Harici Windows test çalıştırıcısıyla FAIL → PASS doğrulaması tamamlandı. İlk bağımsız Codex oturumundaki shell testi sandbox nedeniyle engellendi; [ayrı sonraki MXC oturumunda](CODEX_MXC_NATIVE_TEST_FIRST_PROOF_20261027.md) ise Codex testleri kendi terminalinde önce 4 FAIL / 2 PASS, düzeltmeden sonra 6/6 PASS olarak çalıştırdı. Ana dala tekrar eden bir kaynak yaması alınmadı.

#OpenSource #TypeScript #SoftwareTesting #GitHub #DeveloperEducation

**Yayın kararı:** GitHub kaynağı ve eğitim dokümanı zaten kamuya açık; bu sosyal medya metni ve video **henüz paylaşılmadı/çekilmedi**. Video ancak gerçek ekran kaydı ve kişisel veri redaksiyonundan sonra yayımlanabilir.

## English technical summary — draft

**Hardening GitHub API timestamp validation in an open-source Next.js dashboard.** The browser-side validator previously relied on Date.parse(), which can accept non-date strings such as '1' and normalize impossible calendar dates. A synthetic, offline regression test reproduced the issue in both Actions and PR payloads. The patch requires canonical ISO 8601 UTC timestamps and checks the date components after parsing to reject silent calendar rollover. The isolated Node 22.16.0 test changed from 1/2 passing to 2/2 passing. At source commit ba1974f1cdbedc203f1730ea5c8b660f61e64bb6, Windows verification passed 240/240 npm tests, TypeScript checks and Next.js build. That historical Next.js 15.5.27 advisory was resolved in merged PR #91; the subsequent merged-source checkpoint reported 241/241 tests passing, clean TypeScript/Next.js build and zero npm audit findings. Separate real Codex CLI sessions proposed UTC boundary cases and generated an independent synthetic test plus an alternative patch. An external Windows Node runner observed a real FAIL then 2/2 PASS after the proposed patch was applied outside Codex. **In the earlier independent Codex session, shell tests were blocked by Windows sandbox restrictions; in a later, separate native MXC session Codex wrote the synthetic test and fix, executed the test (4 failed, 2 passed), then reran it successfully (6/6 passed).** That exploratory fix was not merged because equivalent production code was already merged. No video or live deployment acceptance is claimed.

## Yayın öncesi kontrol

- [x] İlk hata düzeltmesi #90, güvenlik yaması #91 ve Codex sınır durumları #92 birleştirildi; kesin merge commit'leri ilgili PR'larda bulunuyor.
- [x] Tarihsel kontrol noktasında 241/241 test ve o gün `npm audit` 0 bulgu; **güncel kaynak kalite kanıtı:** [PR #100 CI](https://github.com/senanurcetin/nexus-devops-intelligence/actions/runs/41116629184) üzerinde 389/389 test, temiz `npm ci`, typecheck/build PASS. **Yeni bir audit veya Production QA çalıştırıldığı iddia edilmez.**
- [x] **İki ayrı Codex oturumu** açıkça belirtildi: [ilk Windows sandbox kısıtı](CODEX_INDEPENDENT_TEST_FIRST_EVIDENCE_20261027.md) ve [sonraki gerçek native Codex MXC test-first yürütümü](CODEX_MXC_NATIVE_TEST_FIRST_PROOF_20261027.md). İlk kod yaması GPT-6 destekli; alternatif MXC yaması mevcut üretim düzeltmesini tekrarladığı için birleştirilmedi.
- [ ] Video çekildi mi, redaksiyon kontrolü yapıldı mı? Yoksa 'çekim planı' olarak bırak.
- [ ] LinkedIn yayın URL'sini ancak gerçek paylaşım gerçekleşince kaydet.
- [ ] Kişisel veri, maliyet, üretim erişimi, yerel sistem bilgisi ve secrets taraması yap.
