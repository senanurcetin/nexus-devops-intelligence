# Timestamp doğrulama eğitimi — video ve topluluk yayın kiti

> DURUM: TASLAK / HENÜZ YAYINLANMADI. Kod inceleme ve regresyon testinde ChatGPT/GPT-6 ile GitHub araçları kullanıldı; **Codex oturumu yok**. Gerçek Codex çalışma kaydı tamamlanmadan bu materyali 'Codex tarafından geliştirilmiş' diye yayımlamayın.

## 60–90 saniyelik teknik video senaryosu (çekim planı)

| Süre | Ekran görüntüsü/aksiyon | Anlatım |
|---|---|---|
| 0–12 sn | NEXUS GitHub deposu ve src/lib/nexus-panel-validation.ts | 'GitHub verilerinde küçük görünen bir tarih kontrolü, güvenilmeyen yanıtları yanlış kabul edebilir.' |
| 12–25 sn | Terminalde Date.parse('1') ile ISO karşılaştırma | 'JavaScript 1 değerini tarih gibi yorumlayabiliyor. Hedefimiz bu tür girdileri açıkça reddetmek.' |
| 25–40 sn | test dosyası, ilk hedef test FAIL | 'Önce sentetik Actions ve PR fikstürleriyle hatayı yakalayan regresyon testini kurduk.' |
| 40–59 sn | timestamp doğrulayıcısının diff'i | 'UTC ISO 8601 biçimini denetliyor ve takvimdeki taşmaları tarih dönüşümüyle kontrol ediyoruz.' |
| 59–75 sn | hedef test, 2/2 PASS; PR diff | 'İki hedef test geçti. Tam npm test, build ve yayına alma için ayrı onay ve doğrulama gerekiyor.' |
| 75–90 sn | rehber bağlantısı ve Codex uygulama reçetesi | 'Kod, test ve yeniden üretim adımlarını GitHub'da bıraktık. Codex ile gerçek oturum çekimi yapılırsa kaydı ayrıca paylaşacağız.' |

**Ekran kaydı mevcut değil.** Yukarıdaki tablo sadece yapılabilir çekim planıdır; gerçek terminal komutlarını ve mevcut test sonuçlarını kaydedin. GitHub özel token'ları, private repo isimleri, environment dosyaları, oturum kimlikleri veya kişisel bilgiler görünmemeli.

## LinkedIn / geliştirici topluluğu gönderisi — taslak

Gerçek bir Next.js + TypeScript açık kaynak projesinde küçük ama öğretici bir veri doğrulama problemi üzerinde çalıştım.

GitHub Actions ve PR özetlerindeki zaman damgaları için kullanılan Date.parse(), '1' gibi tarih olmayan değerleri geçerli sayabiliyordu. Önce sentetik regresyon testiyle hatayı doğruladım; ardından ISO 8601 UTC ve takvim geçerliliği kontrolü ekledim.

Yerel hedef doğrulama: düzeltmeden önce 1/2 PASS, düzeltmeden sonra 2/2 PASS. Bu sonuç, tüm proje testlerinin geçtiği anlamına gelmiyor.

Kaynak ve Türkçe uygulama rehberi: https://github.com/senanurcetin/nexus-devops-intelligence/blob/content/codex-timestamp-regression-20261027/docs/CODEX_TIMESTAMP_REGRESSION_TUTORIAL_TR.md

Bu çalışma ChatGPT/GPT-6 destekli yapıldı. Codex için ayrıca gerçek oturumla uygulanabilecek bir eğitim akışı hazırladım; Codex'i fiilen kullandığımı iddia etmiyorum.

#OpenSource #TypeScript #SoftwareTesting #GitHub #DeveloperEducation

**Yayın kararı:** Paylaşılmadı. İnsan gözden geçirmesi, PR bağlantısı ve test sonucu metni kontrol edildikten sonra yayımlanabilir. Codex özelindeki video ancak gerçekten çalıştırılmış Codex oturumundan sonra yayımlanabilir.

## English technical summary — draft

**Hardening GitHub API timestamp validation in an open-source Next.js dashboard.** The browser-side validator previously relied on Date.parse(), which can accept non-date strings such as '1' and normalize impossible calendar dates. A synthetic, offline regression test reproduced the issue in both Actions and PR payloads. The patch requires canonical ISO 8601 UTC timestamps and checks the date components after parsing to reject silent calendar rollover. The isolated Node 22.16.0 test changed from 1/2 passing to 2/2 passing. Full npm tests, typechecking, Next.js build and deployment checks were not executed in this work session. Developed using ChatGPT/GPT-6 and GitHub tools; **not an independently verified Codex implementation**.

## Yayın öncesi kontrol

- [ ] GitHub PR ve exact commit SHA ekle; PR taslak ise o durumu belirt.
- [ ] Yeni dalın testleri Node/npm bağımlılıklarıyla tam doğrulandı mı? NOT RUN bilgilerini gizleme.
- [ ] Gerçek Codex ile yeniden üretim yapılırsa prompt ve oturum kaydı bağla; aksi halde Codex sonucu deme.
- [ ] Video çekildi mi, redaksiyon kontrolü yapıldı mı? Yoksa 'çekim planı' olarak bırak.
- [ ] LinkedIn yayın URL'sini ancak gerçek paylaşım gerçekleşince kaydet.
- [ ] Kişisel veri, maliyet, üretim erişimi, yerel sistem bilgisi ve secrets taraması yap.
