# NEXUS — Manuel erişilebilirlik ve ekran okuyucu kabul kontrol listesi

**Hazırlanma:** 13 Ekim 2026  
**Kapsam:** `senanurcetin/nexus-devops-intelligence` MVP (Actions ve PR salt okunur panelleri)  
**Durum:** **İnsan tarafından ekran okuyucu testi henüz yapılmadı.** Bu belge test senaryosu, tamamlanmış denetim raporu değildir.

## Teste başlamadan

- Uygulamanın doğrulanmış build'ini **kısa süreli bulut veya erişim korumalı preview** ortamında aç. Herkese açık yayını ve Vercel WAF korumasını birbirinden ayrı doğrula.
- Mümkünse ayrı bir değerlendiriciyle NVDA + Firefox veya VoiceOver + Safari kullan. Kullanıcının kendi bilgisayarına kurulum yapmasını zorunlu tutma; başka bir yetkili değerlendirici bu testi yapabilir.
- Test edilen **commit SHA**, tarayıcı ve sürümü, ekran okuyucu/sürümü, tarih, eklenen ekran görüntüleri veya kısa kayıtların özel veri içerip içermediğini yaz.
- En az üç senaryo: veri olan public repo (`vercel/next.js`), boş Actions/PR örneği ve kasıtlı hatalı repo girdisi. GitHub'a sahte veri göndermeden yalnızca test sunucusunda önceden belirlenmiş fixture kullanılabilir.

## İnsan testçisi için adımlar

| ID | Adım | Beklenen davranış | Durum |
| --- | --- | --- | --- |
| SR-01 | Sayfayı aç, landmark ve başlıklar arasında dolaş | Tek bir ana içerik alanı, anlamlı H1 ve alt başlık sırası; tekrarlı/boş landmark yok | [ ] |
| SR-02 | Klavyeyle repository alanına git | Alan etiketi ve `owner/repository` biçimi okunuyor, belirgin odak var | [ ] |
| SR-03 | Geçersiz repo gönder | Hata canlı bölge/uyarı ile anons ediliyor; yanlış input açıklamasına geri dönülebiliyor | [ ] |
| SR-04 | Geçerli repoyu klavyeyle gönder | Submit çalışıyor, odak kaybolmuyor, loading bilgisinin kaynağı anlaşılıyor | [ ] |
| SR-05 | Actions paneli beklerken PR paneli yavaşlasın | İki farklı yükleme anonsu kafa karıştırmıyor; biten panel diğerini beklemiyor | [ ] |
| SR-06 | Actions/PR başarı ve boş veri sonuçları | Örneklem adedi, boş sonuç ve belirsiz PR merge durumu doğru ifade ediliyor | [ ] |
| SR-07 | API 404/429/503 hatası aldır | Hatalar okunuyor, HTML veya sunucu iç detayları ekrana dökülmüyor | [ ] |
| SR-08 | Çok hızlı repo değiştir | Eski repo yanıtı yenisinin altında görünmüyor; eski hata yanlış repo için anons edilmiyor | [ ] |
| SR-09 | Kanıt bağlantılarına git, klavyeyle geri gel | URL'ler gerçek GitHub sayfasına gidiyor; bağlantı metni amaç belirtiyor ve klavye tuzağı yok | [ ] |
| SR-10 | %200 ve %400 metin büyütme, zoom | Kritik metin ve kontroller erişilebilir; yatay kaydırma zorunluluğu oluşmuyor | [ ] |
| SR-11 | Harici tarayıcı yazı boyutu ve yüksek kontrast | Yükleme, hata ve durum etiketleri yalnızca renk aracılığıyla ayırt edilmiyor | [ ] |
| SR-12 | Tüm sayfayı sadece Tab/Shift+Tab ile dolaş | Tüm interaktif öğeler erişilebilir; kapalı/gizli öğelerde odak takılmıyor | [ ] |

## Bulguların kayıt biçimi

`ID | Commit SHA | Motor/sürüm | Ekran okuyucu/sürüm | Başarılı/Başarısız | Reprodüksiyon | Erişilebilirlik etkisi | Ekran görüntüsü veya kayıt | Issue/PR`.

Kritik engeller (form çalışmıyor, sonuçlar okunamıyor, klavye tuzağı var, veri yanlış anons ediliyor) **yayın engeli** olarak değerlendirilir. Her düzeltmeden sonra aynı senaryoyu tekrar çalıştır.

## Zaten doğrulanmış olanlar (insan testi yerine geçmez)

- [x] Chromium, Firefox ve Playwright WebKit, 375 / 768 / 1440 pikselde temel responsive ve form denetimleri.
- [x] axe-core otomatik WCAG 2/2.1 A/AA denetiminde test edilen akışlarda sıfır otomatik ihlal.
- [x] Ana arama alanından submit düğmesine Tab/Shift+Tab geçişi ve görünür odak.
- [x] Actions/PR yükleme ve hata panellerinin ayrı davranışı, stale-response yarış senaryosu.
- [ ] **SR-01 – SR-12 insan ekran okuyucu kabul adımları**.
- [ ] Yetkilendirilmiş public preview adresinde aynı kontrollerin doğrulanması.

Kanıtlar: [Chromium/Tailwind](tailwind4-browser-audit-2026-10-13.md), [bağımsız paneller](independent-panel-qa-2026-10-13.md), [Firefox](firefox-browser-qa-2026-10-13.md), [WebKit](webkit-browser-qa-2026-10-13.md).

**Açık takip:** [GitHub issue #5](https://github.com/senanurcetin/nexus-devops-intelligence/issues/5).

## Görsel kanıtların durumu

13 Ekim 2026 geçici Vercel Sandbox testinde `vercel/next.js` gerçek API verileriyle 375 piksel mobil ve 1100 piksel masaüstü görüntüleri alındı. Her iki görünümde 20 kaynak bağlantısı ve sıfır uygulama hatası gözlendi. **İkili dosyaların GitHub'a aktarımı güvenlik kontrolü tarafından engellendi; repo içinde görsel bulunmuyor.** Bu nedenle ekran görüntüsü talebi **açık** kalır. Değerlendirici gerçek ekranda yeniden yakalamalı veya izin verilen bir dosya aktarım yöntemi kullanılmalıdır.

## Yayın engelleri

Yalnızca otomatik test başarısına dayanarak tüm erişilebilirlik kriterlerinin karşılandığını ilan etme. Vercel WAF maliyet/kota değerlendirmesi ve platform genelinde hız sınırı [issue #7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7) kapsamında ayrı tutulur. Hiçbir GitHub Actions veya CircleCI pipeline'ı çalıştırılmaz.
