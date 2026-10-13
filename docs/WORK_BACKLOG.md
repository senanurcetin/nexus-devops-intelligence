# NEXUS DevOps Intelligence — Öncelikli Çalışma Listesi

**Güncelleme:** 13 Ekim 2026  
**Repo:** https://github.com/senanurcetin/nexus-devops-intelligence  
**Amaç:** NEXUS'u bağımsız, güvenli, mobil uyumlu ve paylaşılabilir salt okunur bir GitHub DevOps Intelligence MVP'sine dönüştürmek.

> Çalışma modeli: **GitHub Actions, CircleCI veya başka hosted CI kullanılmayacak.** Kullanıcının bilgisayarına kurulum istenmeyecek. Kod GitHub üzerinden; testler gerekirse kısa süreli, manuel başlatılan bulut ortamında. Vercel'de Git-push auto-deploy etkinleştirilmeyecek.

## Doğrulanmış başlangıç noktası

- [x] Bağımsız GitHub deposu; Ops-Copilot'dan ayrı.
- [x] Next.js 15.5.27, Tailwind CSS 4.3.3, npm lockfile ve read-only public GitHub Actions/PR API.
- [x] Birim, adapter, route-handler ve güvenlik başlığı testleri: **64/64 başarılı** (son manuel cloud çalışması).
- [x] `npm ci`, TypeScript, Next.js production build ve tam `npm audit` (kontrol anında **0 bulgu**) başarılı.
- [x] Gerçek GitHub verileriyle manuel HTTP smoke kontrolü; PR/Actions endpoint hata durumları.
- [x] Chromium, Firefox ve WebKit'te 375/768/1440px temel responsive, form ve klavye odak kontrolleri; axe-core otomatik WCAG A/AA kontrollerinde test edilen akışlar için **0 ihlal**.
- [x] [PR #9](https://github.com/senanurcetin/nexus-devops-intelligence/pull/9): anti-framing, MIME sniffing, referrer/permissions ve sınırlı CSP güvenlik başlıkları.
- [x] GitHub'da **CI workflow dosyası yok**; hiçbir CI koşulu aranmayacak.
- [ ] **Vercel canlı/preview deployment yok.** Halka açık URL doğrulanmadı.

Bu kontrol sonuçları manuel test edilen commit'lere aittir. Otomatik erişilebilirlik raporu tam WCAG sertifikası, npm audit sonucu ise sürekli güvenlik garantisi değildir.

## Son uygulama — işlenen görev

- [x] **MET-01 — Actions sonucu doğruluğu:** [PR #10](https://github.com/senanurcetin/nexus-devops-intelligence/pull/10) birleştirildi; `cancelled`, `skipped`, `neutral` sonuçları pending değil, `timed_out` ve `startup_failure` tamamlanmış hata olarak sınıflandırılıyor. 4 ek regresyon testiyle **45/45** başarılı; typecheck/build ve gerçek HTTP smoke geçti.
- [x] **QA-02 (otomatik üç motor):** Chromium + Firefox + [WebKit](webkit-browser-qa-2026-10-13.md) temel responsive/klavye/axe testi 375/768/1440 px'de başarılı. İnsan incelemesi [#5](https://github.com/senanurcetin/nexus-devops-intelligence/issues/5) altında açık.

- [x] **API-04 (ikincil rate limit):** [PR #11](https://github.com/senanurcetin/nexus-devops-intelligence/pull/11) tamamlandı; GitHub secondary-limit 403, normal 403 ve Retry-After senaryolarına 3 yeni test eklendi. **48/48** başarılı; yeni isteği otomatik tekrarlamıyor.
- [x] **QA-01 hazırlık:** [Ekran okuyucu kabul kontrol listesi](MANUAL_ACCESSIBILITY_ACCEPTANCE.md) hazır. İnsan NVDA/VoiceOver kontrolü yapılmadı.
- [ ] **DOC-01 ekran görüntüsü:** Gerçek public GitHub verileriyle mobil/masaüstü görüntüler bulutta üretildi; güvenlik kontrolü dosya transferini engellediği için GitHub'a henüz eklenmedi.

- [x] **API-04 (bekleme süresi):** [PR #12](https://github.com/senanurcetin/nexus-devops-intelligence/pull/12) ile güvenli `Retry-After` kullanıcıya gösteriliyor, geçersiz değerler atılıyor ve hata yanıtları `no-store` kalıyor. 9 regresyon testi dahil **57/57 başarılı**. [Davranış notu](RATE_LIMIT_BEHAVIOR.md).

- [x] **API-05 (giriş doğrulaması / kapasite):** [PR #13](https://github.com/senanurcetin/nexus-devops-intelligence/pull/13) ile geçersiz ve 200 karakterden uzun repository girdileri gate öncesi reddediliyor; kapasite dolu koşullarda 400/503 ayrımı ve recovery test edildi. **59/59** başarı.

- [x] **UX-06 — Bağımsız panel yenileme:** [PR #14](https://github.com/senanurcetin/nexus-devops-intelligence/pull/14) merge edildi. Actions/PR ayrı yenileniyor; diğer panelin verisi korunuyor; eski repository yanıtı yeni ekrana karışmıyor. 375/1440 px Chromium, klavye ve axe A/AA otomatik doğrulamada **0 ihlal**. [QA notu](panel-refresh-browser-qa-2026-10-13.md). İnsan ekran okuyucu incelemesi açık.

- [x] **API-04 — PR ayrıntısı kota doğruluğu:** [PR #15](https://github.com/senanurcetin/nexus-devops-intelligence/pull/15) tamamlandı. Liste 200 olsa bile ayrıntıda GitHub 403/429 kota hatası varsa endpoint **429/no-store** döner; birden çok bekleme süresinde en uzun güvenli Retry-After kullanılır. Diğer ayrıntı hataları bilinmiyor kalır. **64/64** test, typecheck/build/tam audit ve gerçek HTTP smoke geçti. [Davranış notu](RATE_LIMIT_BEHAVIOR.md).

## P0 — Paylaşılabilir MVP'nin yayın kapıları

| Sıra | ID | İş | Kabul / bitiş kriteri | Takip |
| --- | --- | --- | --- | --- |
| 01 | SEC-01 | Vercel Hobby WAF fiyat/kota onayı, gerçek mevcut kullanım kontrolü | İlk rate-limit kuralının fiyatlandırma onayı incelenecek; izin/ücret riski kayda alınacak. **Onaysız aktivasyon yok** | [#7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7) |
| 02 | SEC-02 | Tek WAF rate-limit kuralı ile iki anonim API'yi koruma | Hem `/api/public-actions` hem `/api/public-prs` kapsamda; normal istekler geçiyor, yoğun trafikte 429; bölge bazlı sayaç sınırlaması ve rollback belgelenmiş | [#7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7) |
| 03 | QA-01 | Ekran okuyucu ve kapsamlı klavye akışı | NVDA/VoiceOver ile repo arama, hata/boş/yükleniyor/sonuç durumları anlamlı okunuyor; klavye tuzağı yok, odak sırası doğrulandı | [#5](https://github.com/senanurcetin/nexus-devops-intelligence/issues/5) |
| 04 | QA-02 | Tarayıcılar arası son kalite kontrolü | **Chromium, Firefox, WebKit otomatik testleri geçti.** Gerçek cihaz görsel incelemesi ve insan ekran okuyucu testi açık; [WebKit kanıtı](webkit-browser-qa-2026-10-13.md) | [#5](https://github.com/senanurcetin/nexus-devops-intelligence/issues/5) |
| 05 | REL-01 | Manuel, commit-SHA'ya bağlı Vercel preview oluşturma | Ayrı NEXUS projesi, Git auto-deploy kapalı; proje erişim/SSO koruması ve hesap kotaları gözden geçirilmiş; kaynak SHA kaydedilmiş | [Yayın prosedürü](vercel-hobby-waf-release-runbook.md) |
| 06 | REL-02 | Preview URL üzerinde uçtan uca test | 200 ana sayfa; 400 hatalı repo; gerçek Actions ve PR örneği; 404/429/5xx kullanıcı mesajı; WAF, cache ve güvenlik başlıkları; mobil/masaüstü tarayıcı | Bu liste |
| 07 | REL-03 | v0.1.0 release gate | Güncel test/typecheck/build/audit/smoke, kanıt linkleri, rollback, README ve CHANGELOG tamam; yalnızca doğrulanan sürümü etiketle | Bu liste |

**Önemli:** SEC-01 ve SEC-02 etkinleştirilmeden veya koruma stratejisi başka şekilde doğrulanmadan uygulamayı geniş halk erişimine açma. Preview oluşturmak production yayın değildir. Vercel SSO korumasını sırf paylaşmak için sessizce kapatma.

## P1 — Ürün kalitesi ve operasyonel dayanıklılık

| Sıra | ID | İş | Kabul / bitiş kriteri |
| --- | --- | --- | --- |
| 08 | API-04 | Trafik altında GitHub anonim rate-limit davranışı | 403 quota=0, 429, timeout, abort, 503 senaryoları; kontrollü retry/backoff ve kullanıcı dostu durum; gereksiz fan-out yok |
| 09 | API-05 | Eşzamanlı istek koruması ve kapsam belgesi | Process-local 12 unique inflight sınırının ve WAF bölgesel sayaçlarının sınırları net; cache/HTTP hata davranışı doğrulanmış |
| 10 | UX-05 | Veri kaynağı ve örneklem şeffaflığı | Actions (en çok 10 run) / PR (en çok 5) açıkça örneklem; 'faturalanan CI dakikası' veya 'kesin merge-ready' gibi iddialar yok |
| 11 | UX-06 | Boş / hata / yavaş bağlantı / repo değiştirme akışları | İki panel bağımsız; stale result gösterilmiyor; retry ve ekran okuyucu anonsları test edilmiş |
| 12 | QA-03 | Kalıcı manuel QA prosedürü ve rapor | `npm ci`, `npm test`, `npm run typecheck`, `npm run build`, `npm audit`, `npm run smoke:http` tek belgede; hiçbir hosted CI tetiklenmiyor |
| 13 | OBS-01 | Operasyonel gözlemlenebilirlik planı | Token/PII/log sızıntısı olmadan hata yüzdeleri, GitHub 429/5xx oranı, Vercel istek kotası için ölçüm/kontrol prosedürü |
| 14 | DOC-01 | README, güvenlik politikası ve ürün ekran görüntüleri | Kullanıcı kurulum zorunluluğu yok; gerçek doğrulanmış ekran görüntüleri; MVP sınırları, destek ve güvenlik bildirimleri belgeli |

## P2 — MVP sonrasına bırakılacak genişleme

- [ ] **EXT-01** — Sadece gerekli izinlerle private repository desteği için GitHub App; kullanıcı yetkilendirmesi ve gizli veri güvenliği.
- [ ] **EXT-02** — CircleCI pipeline **çalıştırmadan** sadece veri okuyan API entegrasyonu; ayrı ve onaylı.
- [ ] **EXT-03** — GitHub Actions hata trendleri, geçmiş metrikler ve örneklem kapsamı; doğru saklama/retention tasarımı.
- [ ] **EXT-04** — Kanıt bağlantılı AI hata inceleme önerileri; log redaksiyonu, doğrulanabilirlik ve maliyet limiti.
- [ ] **EXT-05** — Portfolyo/ürün sayfası, ürün analitiği, kullanıcı geri bildirimi ve ancak talep doğrulanınca ticari paketleme.

## Çalışma sırası / işleme kuralı

1. Başlangıç için **SEC-01** fiyat/kota kontrolleri ile **QA-01** manuel erişilebilirlik denetiminin hazırlığını paralel yürüt.
2. Kullanıcı veya platform onayı gerektirmeyen test, belge, güvenlik düzeltmesi gibi görevleri GitHub feature branch → manuel cloud test → PR → doğrulanmış merge akışıyla ilerlet.
3. WAF etkinleştirme ve paylaşılabilir deployment gibi **hesapta kullanım/ücret/erişim etkisi olan** işleri ancak gerçek fiyatlandırma ve kota koşulları netleştikten sonra uygula.
4. Her tamamlanan satırda gerçek test kanıtı, commit/PR ve varsa issue numarasını kaydet; başlıktaki test sayısını yeni doğrulama sonuçlarına göre güncelle.
5. CI dosyası ekleme, CI job çalıştırma, Git-push auto-deploy açma, Ops-Copilot dosyalarını değiştirme veya kullanıcıdan PC kurulumu isteme.

## MVP için tamamlandı tanımı

**Güvenli paylaşılabilir preview:** P0 görevleri doğrulanmış, Vercel maliyet ve rate-limit koruması incelenmiş, canlı URL'de her iki API ile gerçek kullanıcı akışı çalışıyor; uygulama, commit SHA ve değişiklik kaydı eşleşiyor. `v0.1.0` etiketini yalnızca bu kapılar tamamlandıktan sonra oluştur.
