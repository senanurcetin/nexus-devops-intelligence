# NEXUS DevOps Intelligence — Uygulama Planı

**Güncelleme:** 13 Ekim 2026  
**Kaynak repo:** https://github.com/senanurcetin/nexus-devops-intelligence  
**Hedef:** Bağımsız, salt okunur, güvenliği doğrulanmış, erişilebilir ve paylaşılabilir GitHub DevOps Intelligence v0.1.0 MVP.

## Kesinleşmiş başlangıç durumu

- [x] Son manuel bulut kontrolünde **64/64 otomatik test başarılı**, TypeScript ve Next.js production build başarılı.
- [x] Son tam `npm audit --json` raporunda **0 bulgu**. Bu, gelecekteki açıkları garanti etmez.
- [x] Gerçek public GitHub Actions ve PR REST API için localhost HTTP smoke başarılı.
- [x] Chromium, Firefox ve Playwright WebKit motorlarında **375/768/1440 px** için temel responsive, form, klavye odağı ve otomatik axe-core WCAG A/AA testleri başarılı. Bu, tam WCAG veya ekran okuyucu onayı değildir.
- [x] Workflow sonuç sınıflandırma düzeltmesi [PR #10](https://github.com/senanurcetin/nexus-devops-intelligence/pull/10) üzerinden merge edildi.
- [ ] **Kamuya açık Vercel deployment yok; WAF rate-limit etkinleştirilmedi.** Aktif yayın hazırlığı bu iki durumu karıştırmamalıdır.
- [ ] Gerçek GitHub verileriyle 375 ve 1100 px yeni mobil/masaüstü görüntüleri bulutta üretildi; aktarım güvenlik kontrolü tarafından engellendiğinden **GitHub'da ikili ekran görüntüsü henüz yok**. Kanıtın kalıcı yayını açık.

## Faz 1 — Güvenlik ve API dayanıklılığı (P0/P1 paralel)

### SEC-01: WAF maliyet ve erişim kontrolü — [Issue #7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7)
- [ ] Vercel Hobby takımının mevcut kullanım/kota/ilk kural fiyatlandırma ekranını gözden geçir; kuralın bölgesel sayaç sınırlamasını kaydet.
- [ ] Her iki `/api/public-actions` ve `/api/public-prs` endpoint'ini kapsayan tek kuralın kapsamını ve loglama/429 stratejisini önceden doğrula.
- [ ] IP paylaşımlı ağlarda olası yanlış pozitifler, yapılandırmayı geri alma ve istek maliyeti etkilerini belgeleyip hesap izinlerini teyit et.
- [ ] **Maliyet/izin bilgisi netleşmeden WAF kuralını etkinleştirme; canlı dağıtım yapma.**

### API-04/05: Kod üzerinde güvenli devam işleri
- [x] [PR #11](https://github.com/senanurcetin/nexus-devops-intelligence/pull/11) ile GitHub'ın **ikincil 403 hız sınırı** (Retry-After veya secondary-limit mesajı) doğru HTTP 429 olarak sınıflandırılıyor, otomatik retry yapılmıyor ve olağan 401/403 erişim yasağından ayrılıyor. 3 yeni testle **48/48** başarılı; typecheck/build/tam audit/gerçek HTTP smoke geçti.
- [x] [PR #12](https://github.com/senanurcetin/nexus-devops-intelligence/pull/12): GitHub ve WAF `429` yanıtlarından yalnızca güvenli **1–3600 saniye** sayısal `Retry-After` aktarımı. İki API, browser paneli ve kötü niyetli/büyük başlık testleri dahil **57/57** geçti; otomatik retry yok. [Davranış notu](RATE_LIMIT_BEHAVIOR.md).
- [ ] Timeout, abort, parallel request ve platform-level WAF senaryolarını gerektiği ölçüde genişlet; aşırı gerçek trafik üretme.
- [ ] Önbellek, istemci retry davranışı ve 12 farklı process-local in-flight sınırını kaynak kullanımını artırmadan test et.
- [ ] GitHub API rate-limit yanıtının kullanıcıya güvenli ve anlaşılır biçimde gösterildiğini doğrula.
- [ ] Her değişiklik için ayrı branch/PR, `npm ci`, `npm test`, `npm run typecheck`, `npm run build`, tam `npm audit` ve manuel HTTP smoke.

**Bitiş kriteri:** Doğrulanmış API hata yönetimi; WAF kapsam/maliyet planı ve rollback dosyası hazır. Gerçek WAF aktivasyonu ayrı bir onay ve doğrulama adımıdır.

- [x] [PR #13](https://github.com/senanurcetin/nexus-devops-intelligence/pull/13): Her iki Next.js endpoint'inde parametre doğrulaması koordinatörden önce yapılır; 12 istek yuvası doluyken bile geçersiz/uzun repo parametreleri **400/no-store**, gerçek kapasite aşımı **503/no-store**. 2 yeni testle **59/59 başarılı**, typecheck/build/tam audit ve HTTP doğrulaması geçti.

- [x] **PR ayrıntısında kota hatası görünürlüğü:** [PR #15](https://github.com/senanurcetin/nexus-devops-intelligence/pull/15) ile GitHub PR listesi başarılı olsa dahi ayrıntı 403/429 kota hatası tüm endpoint'te **429/no-store** oluyor. En uzun geçerli Retry-After taşınıyor; 5 yeni regresyon testiyle **64/64** başarılı. Normal ayrıntı hata/timeout bilinmiyor. [Teknik açıklama](RATE_LIMIT_BEHAVIOR.md).
- [ ] 5 paralel ayrıntı çağrısının halen eşzamanlı başladığı unutulmamalı; bu düzeltme global WAF değildir.

## Faz 2 — Ürün UX ve erişilebilirlik (P0/P1 paralel)

### QA-01/02 — [Issue #5](https://github.com/senanurcetin/nexus-devops-intelligence/issues/5)
- [x] Üç tarayıcı motorunda temel responsive, form, klavye odağı ve otomatik axe kontrolleri.
- [x] [Manuel ekran okuyucu kabul listesi](MANUAL_ACCESSIBILITY_ACCEPTANCE.md) hazır; insan testi yapılmış sayılmıyor.
- [ ] NVDA veya VoiceOver ile gerçek ekran okuyucu kontrolü: arama, iki panelin loading/error/empty/success durumları, yeni repo seçimi ve hata anonsu.
- [ ] Tam klavye ile uçtan uca dolaşma, görünür odak, yeni sekme bağlantıları ve gerektiğinde gerçek cihaz görsel kontrolü.
- [ ] Kullanıcı deneyimi için farklı ağ gecikmeleri, stale-result yarışları, 404/429/5xx ve sıfır kayıt davranışlarını manuel browser ile tekrar denetle.
- [ ] **Gerçek ekran görüntüleri:** geçici buluttan güvenilir biçimde dosyaya aktar, mobil/masaüstü görsellerini gözle incele ve doğrulanmış sürümle GitHub'a kaydet. Dosya transferi yapılamazsa tamamlandı olarak işaretleme.
- [ ] Tasarımın NEXUS slate/cyan paletiyle tutarlılığını ve kolay okunurluğunu değerlendir.

**Bitiş kriteri:** Erişilebilirlik raporu, browser test kanıtları ve doğrulanmış ekran görüntüleri; makine testinin insan ekran okuyucu testi yerine geçmediği açıkça yazılmış.

- [x] [PR #14](https://github.com/senanurcetin/nexus-devops-intelligence/pull/14): iki veri paneline ayrı, klavye erişilebilir yenileme düğmesi; ayrı loading/aria-busy ve stale-response koruması. **59/59** test, typecheck/build/tam npm audit/gerçek HTTP smoke ve 375/1440 px Chromium etkileşim/axe kontrolü geçti. [Kanıt](panel-refresh-browser-qa-2026-10-13.md).
- [ ] İnsan ekran okuyucu incelemesi tamamlandı iddiası yok; [issue #5](https://github.com/senanurcetin/nexus-devops-intelligence/issues/5) açık.

## Faz 3 — Güvenli manuel Vercel preview (P0, önkoşullu)

**Önkoşullar:** SEC-01 gözden geçirildi, API koruması ve erişim/ücret şartları doğrulandı.

- [ ] Belirlenmiş **commit SHA** üzerinden, ayrı `nexus-devops-intelligence` Vercel projesine manuel preview; **Git auto-deploy kapalı**.
- [ ] Vercel SSO/koruma ayarları ve paylaşım izinlerini onaysız gevşetme.
- [ ] Normal kullanımda iki public API'nin çalışmasını; yoğun trafikte WAF 429 davranışını ve yanlış pozitifleri test et.
- [ ] Gerçek preview URL'de homepage 200, geçersiz repo 400, örnek workflow/PR verileri, güvenlik başlıkları, browser mobil/masaüstü ve no-store hata yanıtlarını doğrula.
- [ ] Vercel kota/maliyet gözlemini ve rollback yöntemini kayıt altına al.

**Bitiş kriteri:** URL + kaynak commit + test sonuçları tutarlı; hiçbir CI çalıştırılmadı; WAF ve kota korumalarının gerçekten devrede olduğu kanıtlandı.

## Faz 4 — v0.1.0 hazırlığı

- [ ] Kaynak ve yayınlanan sürümün commit SHA'sı aynı; son `npm ci/test/typecheck/build/audit/smoke` kontrolleri tekrarlanmış.
- [ ] README, `CHANGELOG.md`, güvenlik/erişilebilirlik sınırları, ürün kullanım rehberi, gerçek ekran görüntüleri ve geri alma adımları güncel.
- [ ] Yalnızca tamamlanan P0 şartlarından sonra `v0.1.0` etiketi/release oluştur.
- [ ] NEXUS portfolyo/ürün sunumunu gerçek çalışan demo bağlantısı ve ölçülebilir MVP kapsamı üzerinden hazırlama.

## Faz 5 — Sonraki ürün genişlemesi (P2)

- [ ] İzinleri sınırlandırılmış GitHub App, gerekçelendirilmiş private repository erişimi.
- [ ] **Yalnızca veri okuyan** CircleCI entegrasyonu; CI workflow veya pipeline tetikleme yok.
- [ ] GitHub Actions tarihsel kalite trendleri ve örneklem/retention açıklamaları.
- [ ] Kanıt bağlantılı AI önerileri, log redaksiyonu ve düşük bütçeli çalışma.
- [ ] Kullanım geri bildirimi, analitik ve portfolyo paketlemesi.

## Çalışma yöntemi ve raporlama

1. Güncel kaynak ve açık issue'ları doğrula → tek soruna odaklı GitHub branch oluştur.
2. Kullanıcı müdahalesi gerektirmeyen kod, belge ve test işleri devam ettirilebilir; bağımlılık ve güvenlik etkisini sınırlandır.
3. Manuel kısa süreli bulut ortamında `npm ci`, test, typecheck, build, audit ve gerçek HTTP/browser kontrollerini çalıştır, sonra ortamı kapat.
4. PR başlığını ve açıklamasını teknik açıdan net yaz. Birleştirme öncesi beklenmedik diff, test ve mergeability kontrolü yap.
5. İlerlemeyi bu plana ve ilgili GitHub issue'larına **yalnızca gerçekten tamamlanan kanıtlarla** işle.
6. GitHub Actions/CircleCI/hosted CI kullanma, kullanıcıdan yerel kurulum isteme, Git-based auto-deploy açma, Ops-Copilot'a dokunma.
7. Asenkron/otonom gelecekte çalışıyor gibi davranma; yapılan işi oturum içinde uygulayıp doğrulanan sonucu raporla.

## Sıradaki uygulanabilir iki iş

1. **API-04 takip işi:** İkincil kota sınıflandırması tamamlandı; paralel istek/backoff incelemesi ve platform WAF gerçek doğrulaması açık.
2. **QA-01/02 takip işi:** [İnsan testçisi kontrol listesi](MANUAL_ACCESSIBILITY_ACCEPTANCE.md) hazır; görseller bulutta üretildi, aktarım güvenlik koruması nedeniyle engellendi. Yetkili dosya aktarımı/gerçek cihaz yakalaması açık.

**Halka açık yayın engeli:** [WAF issue #7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7) kapanmadan ve kalan yayın şartları doğrulanmadan canlı prod/preview yayını yapılmış veya tamamlanmış olarak raporlanamaz.
