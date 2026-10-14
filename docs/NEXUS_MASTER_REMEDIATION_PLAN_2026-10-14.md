# NEXUS DevOps Intelligence — Ana geliştirme ve eksik kapama planı

**Tarih:** 14 Ekim 2026 (Europe/Istanbul)  
**Proje:** senanurcetin/nexus-devops-intelligence. Ops-Copilot, Power BI, Fraud ve Smart Factory hariç.  
**Kaynak başlangıç SHA:** d9c6cd76714fab8d86ee4040171603c960493dd6.  
**Durum:** Bu plan yayın veya ücretli servis kullanım izni değildir.  
**Güncel Vercel snapshot (14 Ekim):** Yetkili SSO Preview `dpl_9sq98XLM2DZAgyBFZoFVUde2NucT` = `READY`, kaynak `2b5fb7c379bd1f939f3b50f286edfb868ddb386a`; Production `dpl_9fXGATNHhyhNVrN1i47k3BU4u5K5` = `READY`, kaynak `74cd0e344eb94255b4bc8db99e4a4dc7f3a5a0bf`. Sonraki PR'lar otomatik deploy değildir. Dağıtımdan önce yeniden sorgula.

**Ana kayıtlar:** [Güncel kabul #49](https://github.com/senanurcetin/nexus-devops-intelligence/issues/49), [Redis ve Free kapasite #7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7), [eski/güncel kapılar](NEXUS_CURRENT_RELEASE_WORK_PLAN_2026-10-14.md), [manuel yayın/geri dönüş runbook](NEXUS_MANUAL_RELEASE_RUNBOOK_2026-10-14.md).

## 1. Hedef ve mevcut kanıt tabanı

Hedef; salt-okunur, gerçek kaynağı gösterilen, maliyeti doğrulanmış, elit NEXUS görsel sistemiyle sunulan, kaynak-veri anlamı doğru bir DevOps ürünüdür. Demo/fixture veri gerçek veri olarak gösterilmez. Örneklenmiş iş akışı sayısı geçmiş uptime/SLA anlamına gelmez. PR belirsizliği merge onayı gibi yorumlanmaz. AI tarafından doğrulanmamış kök neden uydurulmaz.

**Kodda geliştirilmiş ürün sözleşmesi:**

- F01: doğrulanmış mevcut filtrelenmiş CSV/JSON; tekrar ağ çağrısı yok, spreadsheet enjeksiyonu nötr.
- F02: kanıta ve güvenli GitHub bağlantısına bağlı inceleme önerileri; unsupported root cause yok.
- F03: tek canonical depo, paylaşım URL'si, Back/Forward, stale-response temizliği.
- F04: kullanıcının açık tıklamasıyla PR check/review ve failed job-step kanıtı; ilk yüklemede ek fan-out yok.
- F05: yalnızca tamamlanmış yedi UTC gününün hacim tablosu; eksik source coverage ile sahte tarihsel sonuç yok.
- S03: beş public API'de belirsiz/tekrarlı parametre Redis öncesinde 400/no-store; simüle edilmiş ortak Redis sınırı 429; arızası 503.

**En son doğrulanmış offline kanıt:** 205/205 Node, 16/16 loopback HTTP, Chromium 11/11, Firefox 11/11 iki ayrı çalışmada, TS/Next build, JS bundle bütçesi ve audit 0. [T03 kaynak kanıtı](T03_CROSS_ENGINE_WEBKIT_QA_2026-10-14.md). WebKit hiç başlayamadı; gerçek Safari, iPhone, VoiceOver ve korumalı gerçek Preview henüz test edilmedi. T02 görsel düzenlemeleri mühendislikçe bitti, insan estetik onayı açık.

## 2. Açık işler — öncelik, bağımlılık, doğrulanabilir kabul

P0 = yayın engeli; P1 = ürün kalitesi; P2 = ertelenen kapsam. 'Offline DONE' gerçek kullanıcı/Preview kabulü değildir.

| ID | Öncelik | İş ve sorumluluk | Durum | Ölçülebilir kabul / kanıt | Bağımlılık |
| --- | --- | --- | --- | --- | --- |
| R0 | P0 | Mühendislik: iddia/kanıt/doküman tutarlılığı | **DONE_OFFLINE** (yeniden dağıtımda kontrol) | Git main, tested application SHA, deployed Preview ve Production SHA ayrı; eski yanlış WebKit PASS işareti kaldırılmış; tarihli kaynak ve testler belirtilmiş | Yok |
| R1 / G01 | P0 | Mühendislik: son değişikliklerden sonra immutable release candidate | **DONE_OFFLINE** (son app QA: 8bb2e7c; ayrı Preview onayı gerekir) | Tam 40-karakter SHA, temiz npm ci, tüm Node testleri, typecheck, production build, JS budget, audit, 16 HTTP, Chromium/Firefox (+ gerçekten çalıştırılmışsa WebKit) suite, loglar ve kaynak hash; herhangi hata => HOLD | R0 ve son mühendislik değişiklikleri |
| R2 / G02 | P0 | Hesap sahibi: Upstash Free ve tüm Vercel Hobby ekibi gerçek tüketimi | **Altı gerçek kullanım metriği gözlendi; 25-istek what-if READY_FOR_OWNER_REVIEW** (dönem hizası açık) | Paylaşılan Preview+Production Redis DB aylık komut, MB, GB; tüm Hobby ekip fonksiyon invocations/CPU/memory, dönem ve UTC gözlem zamanı, ek Preview origin GET planı; offline capacity screen ve sahibin açık kabulü | Hesap dashboard erişimi |
| R3 | P0 / G05 için | Mühendislik: WebKit gerçek testi | BLOCKED - HOST | Uyumlu Ubuntu/macOS ile playwright-core 1.64.0; webkit.launch ve mevcut 11 fixture senaryosunda gerçek test; engine+versiyon+SHA+console/axe/network+screenshot; host hatası NOT RUN kalır | R2'den bağımsız uygun ortam |
| R4 | P1, G05 öncesi | Tasarım ve mühendislik: NEXUS görsel kalite ve marka QC | KISMİ | 320/375/768/1280/1440/(mümkünse 1920) genişlikte veri, boş/kısmi, timeout, hata, 200%-400% büyütme; grafik sayıları ve alanları okunur, kartlar tasarım bütünlüğüne sahip, marka yerleşimi estetik; insan screenshot PASS/FIX | Lokal build; gerçek kabul R7 |
| R5 | P0 | Mühendislik: doğruluk, provenance ve beş API hata matrisi | **DONE_OFFLINE; G04 LIVE AÇIK** | 200/400/403/429/404/502/503/504; no-store/Retry-After; 2 ilk source GET; F04/F05 yalnızca click; kaynak linkleri, örneklem sınırları, CSV injection, UTC günü, missing coverage, stale race | Offline özgür, live R6 |
| R6 / G03 | P0 | Hesap sahibi izin verir, mühendis exact-SHA protected Preview kurar | **Preview READY/exact-SHA DONE** (deployed 2b5fb7c; SSO gerçek challenge not proven) | Sadece Preview hedefi ve onaylı SHA, Vercel unique URL/ID, READY/SSO, env adları Sensitive Preview+Production (değerler açılmaz), Production alias değişmez, rollback referansı | R1, R2, ayrı Preview izni |
| R7 / G04 | P0 | Mühendis + SSO yetkili testçi: gerçek Preview F01–F05 kabulü | **PARTIAL_REAL_BROWSER_EVIDENCE** (kullanıcı ekranları; HTTP ve eylemler açık) | Kaynak SHA eşleşir; izinli origin GET sayısı aşılmaz; gerçek GitHub source vs fixture ayrımı; data/export/history/evidence/trend; 400/429/503 gözlemi yalnızca izin kapsamıyla; console/screenshot/repro ve istek sayısı kaydı | R6 ve belirlenmiş trafik bütçesi |
| R8 / G05 | P0 | İnsan testçi: Safari/iPhone, NVDA/VoiceOver, elit tasarım onayı | BLOCKED | SR-01–SR-12 testçi+tarih+cihaz+sürüm+SHA ile PASS/FAIL; gerçek zoom, keyboard, focus, reduced-motion, table, chart, dynamic announcements; açık P0 a11y/visual bulgusu 0 | R7; R3 destekleyici |
| R9 / G06 / #7 | P0 | Hesap sahibi + mühendis: gerçek bağımsız Vercel Function instance'larında tek Redis kota | BLOCKED | En az iki bağımsız gerçek instance provenance, iki route tek IP kovası; Redis kaynaklı 429/no-store/Retry-After ve gerçek Free delta; local/github 429 ayrımı; kanıtı güvenli, küçük trafikle üretme yolu yoksa kalıcı risk sahibi tarafından resmen değerlendirilir, geniş public koruması olmuş sayılmaz | R2 + R6 + ayrı trafik izni |
| R10 | P0 | Mühendis: güvenlik ve operasyonel rollback | **KISMİ** (R10 Preview probe uyumu DONE_OFFLINE; canlı SSO/WAF/rollback açık) | SSO generated URL, WAF Log ≠ enforcing 429, no secrets, headers/CSP/nosniff/no-store, rate-limit attribution, deploymentEnabled:false, Production önceki READY rollback ID ve restore prosedürü | Lokal checklist ve R6 canlı metadata |
| R11 | P1; ciddi UX/perf sorunları P0 | Mühendis: performans, gözlemlenebilirlik, hata deneyimi | **DONE_OFFLINE lab; field CWV / gerçek API açık** | JS/CSS bütçesi, gerçek LCP/CLS/INP ölçüldüyse referansı; ölçülmediyse NOT MEASURED; render/hydration, kontrollü fetch ve timeout, mobil scroll, kullanıcıya açık hata dilinin doğruluğu | Lokal mümkün, canlı ölçüm R2/R6 |
| R12 / G07 | P0 | Hesap sahibi ayrı onay verir: Production ve rollback | NOT AUTHORIZED | Tüm ilgili P0 kapılar kanıtla geçilir; açık kalan riskler yazılı karar alır; ayrı exact SHA Production izni, READY/alias, dar post-release smoke, rollback hedefi | R1, R2, R6–R10 |
| R13 | P2 | Yeni özellik: private GitHub App, CircleCI connector, AI, 3D, daha derin trendler | ERTELENDİ | Ayrı kullanıcı değeri/veri doğruluğu/güvenlik/maliyet kararı; MVP release öncesi kapsam şişirilmez | P0 tamamlandıktan sonra |

**G06 kararı:** Gereken bağımsız instance kanıtı düşük kotayla güvenli şekilde mümkün değilse test yapılmaması doğrudur. Sahip risk kabulü bir test PASS'i değildir; özellikle geniş public koruması ile karıştırılmamalıdır. Onaysız 21 geçerli gerçek istek yasaktır.

### R4 ilk mühendislik paketi — kaynak-lokal (14 Ekim 2026)

[R4 mobil hiyerarşi ve kanıt QA](R4_MOBILE_HIERARCHY_QA_2026-10-14.md):
Kaynak `2efaefcc27c8fafe8c5f2534ac34f3f59cd35f13` üzerinde
375px arayüzde uzun giriş/kanıt paneli daraltıldı; arama alanı erken görünür,
share açıklaması tam genişlikte, örneklem sınırları ve iki kaynak yanıt zamanı
yerinde. 205/205 Node, 16/16 yerel HTTP, 11/11 Chromium, 11/11 Firefox,
TS/build/bundle ve audit 0. **R4 insan/gerçek cihaz tasarım kabulü hâlâ
KISMİ/AÇIK. R3 WebKit ortamı, R2 kapasite ve yayın kapıları değişmedi.**

### R10 kaynak-yerel operasyonel düzeltme — 14 Ekim 2026

[Redis Preview diagnostic QA](R10_PROTECTED_PREVIEW_PROBE_QA_2026-10-14.md):
R10 alt işi tamamlandı: `_nexus_rate_check` parametresi,
PR #57'den beri API'nin katı query sözleşmesiyle çelişip Redis öncesi 400
üretiyordu. Betik şimdi sadece izin verilen parametreyi gönderiyor;
CDN'de HIT/STALE/REVALIDATED veya belirsiz yanıtı origin kanıtı saymıyor.
**208/208 Node, TypeScript, production build, JS budget, audit 0**
(exact executable SHA `3779071524633694157adc05be3f9d3a3808118a`).
Yalnızca R10 offline tanılama kodu düzeltildi; **G02, gerçek Preview,
gerçek bağımsız Redis instance ve Production KAPANMADI**.

### R0 + R1 exact-main kaynak mühendislik kapanışı — 14 Ekim 2026

[R1 208-test immutable main QA](R1_EXACT_MAIN_SOURCE_QA_2026-10-14.md)
konusunda kaynak sürüm `2df2ea635fd57b0d9f4d852818f6de55e0f1e3ce`
clean `npm ci` sonrası **208/208 Node, 16/16 yerel HTTP,
11/11 Chromium, 11/11 Firefox**, TS/build/budget/audit 0 ile doğrulandı.
R0 kanıt ayrımı: yanlış WebKit geçiş checkbox'ı çıkarıldı; mevcut
**Preview 599ced7** ve **Production 74cd0e3** farklı sürümlerde kaldı.
**R0 ve R1 sadece kaynak-lokal DONE_OFFLINE**; R2 gerçek Free kullanım,
R3 WebKit, R6–R9 canlı/insan kabulü ve R12 Production açık.

**WebKit ortam notu:** Resmî Ubuntu/Playwright container imajı
bulundu ancak bağlı Vercel Sandbox API'si harici MCR imajını doğrudan
kabul etmedi; Vercel Container Registry'ye ayrı imaj push işlemi
gerekiyor. Paid/registry altyapısı bu planla otomatik açılmaz. Kaynak
seviyesindeki WebKit testini çalışmış kabul etmiyoruz.

### R5 kaynak/doğruluk test matrisi — 14 Ekim 2026

[R5 kaynak ve hata matrisi](R5_SOURCE_DATA_ERROR_MATRIX_2026-10-14.md)
F01–F05 kaynak kimliği, örneklem sınırları, doğrulanmamış verinin
gizlenmesi ve beş API 400/429/503 güvenlik sözleşmesini mevcut
Node/HTTP/browser fixture testlerine bağladı. 403 GitHub quota, 404,
502, 504, sınırlandırılmış Retry-After, CSV enjeksiyon, UTC kapsama,
source switch ve sadece tıklamayla detay/UTC GET **offline doğrulandı**.
Başarılı mevcut kaynak SHA `2df2ea635fd57b0d9f4d852818f6de55e0f1e3ce`
ve [R1 QA](R1_EXACT_MAIN_SOURCE_QA_2026-10-14.md).

**R5 DONE_OFFLINE; G04 gerçek SSO Preview kabulü AÇIK.**
Mock statü testleri gerçek GitHub/Vercel/Upstash kanıtı değildir.

### R2 otomatik hesap-metrik toplama alternatifi (14 Ekim)

Kullanıcıdan aylık rakamları kopyalaması istenmeden,
[resmî Upstash Management API salt-okunur okuyucusu](R2_AUTOMATED_UPSTASH_MANAGEMENT_USAGE_2026-10-14.md)
hazırlandı. Yetkisiz varsayılan davranış **INCOMPLETE / 0 HTTP isteği**;
yalnızca ayrı Upstash yönetim yetkisi ve açık
`--authorized-readonly` ile hesap DB kimliği, Free planı ve aylık
komut/bant genişliği/depolama istatistiği iki sabit Management API GET
üzerinden alınabilir. **Bu anahtar mevcut Redis REST token'ı değildir,
değerleri açılmaz, hiçbir canlı Upstash komutu çalıştırılmadı.**
Exact kod `d234e9d4f62ec7ed0f97ed05462700b7aa0ef224` üzerinde
**216/216 Node**, TS/build/budget ve audit 0 PASS.

**R2 hâlâ BLOCKED:** şu anda management kimliği bağlı değil; bağlı
Vercel Hobby ekibinin toplam kaynak kullanımı da mevcut araçlardan
okunamadı. Metrik bilinmediğinde tahmini sıfırla değiştirilemez;
`UPSTASH_ONLY_VERIFIED` tüm G02 onayı değildir. Ücretli
Observability Plus etkinleştirilmez, Redis'e probe gönderilmez.

### R2 gerçek hesap ekranlarından elde edilen kısmi kullanım kanıtı — 14 Ekim

[R2 sahibin sağladığı altı ekran görüntüsünden doğrulanan kullanım kayıtları](R2_OWNER_USAGE_SNAPSHOT_2026-10-14.md):
**Upstash Free** 118/500.000 aylık komut, yaklaşık 10 KB/10 GB,
gösterilen 0 B/**250 MB** ve $0,00. NEXUS proje özel
Vercel: 1,26 MB Fast Data Transfer, 270,57 KB Fast Origin,
195 CDN istek, 33 ISR Reads. **Tüm Vercel takımının 30 günlük**
görünümü: 1,01 GB Fast Data Transfer / 100 GB, 157,28 MB Fast Origin
/ 10 GB, 23 bin CDN istek, 642 ISR Reads, 9 saniye **CDN request CPU**
(**Function CPU değildir**). Güncel G02 storage code sınırı 256 MB'dan,
hesap paneline göre **250 MB'ye** düşürüldü (proje 80% review sınırı
**200 MB**). **Gerçek Function Invocations, Active Function CPU,
Provisioned Memory GB-hours, kesin UTC ölçüm zamanı ve origin-GET
bütçesi hâlâ eksik.** CDN request sayısını Function Invocations sayısı
yerine geçirmiyoruz. **R2 G02 sadece PARTIAL EVIDENCE, henüz PASS değil.**

### R2 Vercel Functions ekranlarından ek kanıt (14 Ekim)

Dört ek ekran görüntüsüyle takım genelinde **9.329 / 1.000.000**
Vercel **Function Invocations**, NEXUS projesi özelinde **66**
çağrı doğrulandı. Project, runtime, type ve success/timeout
dağılımları aynı 9.329 toplamıyla uyuşuyor.
[R2 kanıt kaydı](R2_OWNER_USAGE_SNAPSHOT_2026-10-14.md)
güncellendi. Bunlar CDN istekleri değildir; tam Function çağrı
sayılarıdır. **Function Active CPU ve Provisioned Memory GB-hours
hâlâ eksik**, fatura/limit penceresinin başlangıcı ve kaynak bütçesi
de doğrulanmadı. **G02 INCOMPLETE**; hiçbir dağıtım yetkisi verilmedi.

### R2 — altı gerçek kullanım metriği, şartlı kapasite incelemesi (14 Ekim)

Dokuz ek Vercel Fluid Functions ekranında **takım Active CPU
23m29s / 4h** (NEXUS 8 sn) ve **Provisioned Memory
2.0 / 360 GB-saat** (NEXUS 0,01) görüldü. Önceki
**9.329/1.000.000 invocation**, Upstash **118/500K komut,
10 KB/10 GB bant, 0 B/250 MB depolama** ile tüm altı
metriğin ekran kanıtı oluştu.
[R2 gerçek kullanım ve yerel kapasite sonucu](R2_OWNER_USAGE_SNAPSHOT_2026-10-14.md).

Kaynak SHA `0d33b409879a333d3143e499503e48e610e39ffa`
üzerinde **25 ek origin GET varsayımıyla** gerçekten çalıştırılan
`capacity:offline` çıktısı **`READY_FOR_OWNER_REVIEW`**,
6/6 metrik 80% sınırın altında. **Ancak:** UTC zaman girdisi
screenshot dosya adından ve Türkiye saat diliminden
türetilmiş **temsili zaman**, sağlayıcı tarafından doğrulanmış
UTC fatura/ölçüm dönemi değil. 25 istek de kullanıcı tarafından
onaylanmış bir trafik izni değil. **R2 metrik toplama DONE;
G02 sahibin kullanım dönemi/trafik sınırı incelemesini bekliyor,
G03 Preview ve G07 Production yetkisi verilmedi.**

### G03: Kullanıcı onaylı yeni korumalı Preview — 14 Ekim

[Gerçek yeni Preview ve sınırlandırılmış kabul kaydı](G03_PROTECTED_PREVIEW_ACCEPTANCE_2026-10-14.md):
Kullanıcı **yalnızca onaylanan güncel SHA `2b5fb7c...`**
için SSO korumalı Preview ve **en fazla 25 origin isteği**
fonksiyonel kabul izni verdi (gerçek 21 Redis stresi/Production hariç).
Vercel ID `dpl_9sq98XLM2DZAgyBFZoFVUde2NucT`,
`READY`, target Preview, tam `meta.githubCommitSha` eşleşti,
beş serverless API build edildi; Production alias'ı değişmedi.
Projede SSO `enabled:true/all_except_custom_domains`,
Preview+Production Upstash env değişken adları **Sensitive**.
**G03 kaynak/dağıtım teknik kimliği DONE, canlı SSO browser
erişimi henüz kanıtlanmadı. G04 gerçek yetkili SSO/UI/API
kabulü OPEN:** test ortamı URL DNS çözümleyemedi; sıfır
başarılı app-origin isteği doğrulandı. Kullanıcıdan güvenli,
oturum açılmış Preview ekranı ve sadece hassas olmayan
Network status/header bilgisi alınmalı. G05/G06/G07 açık.

### Güncel kapanış özeti — G04 response receipts + R11 (14 Ekim)

[Kaynağa bağlı HTTP yanıt kanıtı ve yerel performans testleri](G04_R11_SAFE_RECEIPTS_PERFORMANCE_QA_2026-10-14.md):
Dört yeni güvenlik/adapter testiyle toplam **221/221 Node**,
**16/16 HTTP**, **11/11 Chromium**, **11/11 Firefox**,
TypeScript/build/JS budget ve audit 0 geçmiştir. Uygulama SHA
`8bb2e7c2fc664d051f4d34d0c02b8ee4cc7494c3`.
Kaynak panellerindeki **“Request diagnostics · no new requests”**
bölümü önceden alınmış yanıtın yalnızca güvenli HTTP durumunu, allowlist
CDN sınıfını ve hız sınırı kaynak bilgisini gösterir; **0 yeni API GET**,
çerez, token, ham başlık veya hata gövdesi göstermez.
Bu henüz dağıtılmış **Preview 2b5fb7c'de bulunmuyor**.

R11 localhost Chromium fixture laboratuvarı: 375/1280px'de 3'er
oturum, medyan iki panel görünümü **253/281ms**,
FCP **136/200ms**, LCP **136/200ms**, CLS **0,01129/0,00325**,
her çalışmada iki intercept edilmiş API çağrısı, harici ağ 0.
**Bunlar field Core Web Vitals veya gerçek SSO/gecikme kanıtı değil.**

**Bağımlı nihai kapılar:** G04 son kullanıcı gerçek HTTP/SSO,
F01 indirme dosyası/F03 geçmiş/F04 opt-in; R3 WebKit destekli host;
G05 gerçek Safari/iPhone ve NVDA/VoiceOver;
G06 gerçek bağımsız Vercel Redis instance provası;
G07 Production için ayrıca onay. G02 6/6 güncel kullanım
değeri gözlendi; ancak sağlayıcı kesin dönem bilgisi ve üretim
izni review aşamasından bağımsız.

## 3. Yürütme sırası

### Parti A — dış yetki ve gerçek Redis tüketimi gerektirmeyen mühendislik

1. R0: Belge çelişkilerini ve eski SHA'ları ayır; G05 listesindeki WebKit checkbox hatasını düzelt.
2. R3: Amazon Linux 2023'e uyumsuz ICU 74 kütüphanesini symlink ederek sahte çalışma yaratma. Playwright destekli Ubuntu/macOS üzerinde WebKit'i açıp aynı 11-local-fixture testi çalıştır; başarısızsa durum açık.
3. R4: NEXUS koyu mavi/teal tasarımını koruyarak *elit veri analizcisi* görsel QC ve gerekiyorsa bileşen düzeyinde yeniden yerleşim. 320–1920px, kısmi/hata/boş durum, yakınlaştırma, F05 tablo, kaynak kartları, logo, grafik içi sayı okunurluğu. Sahte metrik, kullanıcının gerçek verisi gibi gösterilen demo yok.
4. R5/R10: Ek offline negatif testler: duplicate source, GitHub 403/429, malformed JSON, Redis fail-closed, no-store/Retry-After, stale repo-switch, source receipt ve outbound network guard. Her hata sınıfı için beklenen 400/429/503/502/504, upstream GET sayısı ve cache sözleşmesi.
5. R11: Yerel Lighthouse/Web Vitals ölçümü mümkünse ölç, değilse belgele; yük altında ekstra otomatik origin isteklerini engelle; önceki JS bundle bütçesini koru.
6. R1: Nihai uygulama değişikliğinden sonra SHA sabitle; temiz tüm testleri yeniden çalıştır, insan kabulünü taklit etme.

### Parti B — yalnızca hesap sahibinin gerçek altyapı verisiyle

7. R2: Upstash Console + Vercel Team Usage toplamları ve dönem/tarih; ücretsiz kalan kapasiteyi gerçek rakamlarla ekranla. npm run capacity:offline için güncel snapshot ve açıkça belirlenen origin request bütçesini gir. 4 Redis komutu/istek varsayımı kesin faturalanma kanıtı değildir; %20 güvenlik payı proje önerisidir. Kullanım bilinmiyorsa STOP.
8. R6: Ayrıca yalnızca onaylanan SHA + Preview-only + trafik limiti yetkisiyle SSO Preview dağıtımı. Git otomatik deployment kapalı; Production alias sabit. Her yeni Preview ayrı izin gerektirir.

### Parti C — korumalı Preview ve insan kabulü

9. R7: Yetkili SSO Preview testleri; her gerçek origin GET sayısı, ekran kaydı, statü/header ve source SHA; F01–F05 doğruluğu. Toplu Redis/21 istek testi yok.
10. R8: Gerçek Safari/iPhone veya macOS Safari ve NVDA/VoiceOver testçisi; SR-01–12, tasarım kabulü, raporlanan kusurların düzeltilmesi ve **aynı exact-SHA'da** tekrar. WebKit'in Linux engine testi gerçek cihazın yerine geçmez.
11. R9: Önce Free headroom ve ayrı izin; mümkünse iki farklı gerçek Vercel instance üzerinden ekonomik ortak Redis kanıtı ve harcama deltası. Mümkün değilse yayın riskini kapandı olarak işaretleme.

### Parti D — ayrı Production kararı

12. R12: İnsan, güvenlik, Free maliyet ve veri kapıları tamamlanınca farklı ve açık **Production** izni; exact SHA, READY, rollback, sınırlı smoke. Plan veya GitHub merge yayın yetkisi değildir.

## 4. Görsel ve veri kalite kabulü

- Gerçek/provenance verisi: “up to ten Actions runs”, “up to five open PRs” örneklem kapsamı; eksik veri ve yanlış kaynak bağlantısı saklanmaz. F05 yedi tamamlanmış UTC gününü tam kapsamadıkça tarihsel güvenilirlik sonucu üretilmez.
- Grafik tasarımı: NEXUS renk/kontrast hiyerarşisi, okunur rakamlar, kategorik count+percentage, ölçüm tanımları, responsive tablo ve kendi konteynerinde scroll; “yapıştırılmış grafik” görünümü ve hatalı logo konumu yok.
- Erişilebilirlik: axe otomatik sonuçları ayrı; gerçek klavye/AT testleri ayrı; SR-01–12 tamamlanmadan human signoff yok; gerçek Safari ayrı.
- Güvenlik: İlk açılışta yalnız iki panel GET, detay opt-in, kaynak sabit GitHub hostu, safe-CSV, no-store hata, Redis fail-closed ve SSO, WAF Log gerçek bloklama değildir.
- Performans: yalnızca ölçülmüş değerleri raporla; Core Web Vitals ölçülmediyse NOT MEASURED.
- Yayın: SHA = onaylanan build, Preview target + unique URL/ID + SSO doğrulanmış, Production için bağımsız karar ve geri dönüş planı.

## 5. Standart kanıt kaydı

Her iş/PR için zorunlu alanlar:

| Alan | Değer |
| --- | --- |
| ID / öncelik / sorumlu | Rxx, P0/P1/P2, engineer/owner/human |
| Durum | OPEN / BLOCKED / IN_PROGRESS / DONE_OFFLINE / VERIFIED_PREVIEW / HUMAN_ACCEPTED |
| Exact source SHA | 40 karakter |
| Ortam / engine / testçi / tarih | Somut |
| Test komutları, exit status, örneklem kapsamı | Kanıtla doğrulanabilir |
| Canlı GitHub/Upstash/Vercel origin istekleri | Gerçek rakam veya 0 |
| Kabul ölçütü ve delil | PASS / FAIL / NOT_RUN |
| Kalan risk, maliyet, geri dönüş | Açık/kapalı, bağlantı |
| Yayın yetkisi | NONE / APPROVED_PREVIEW / APPROVED_PRODUCTION |

**Kritik ayrım:** DONE_OFFLINE != VERIFIED_PREVIEW != HUMAN_ACCEPTED != PRODUCTION_RELEASED.

## 6. Kalıcı durdurma koşulları

GitHub Actions/CircleCI/hosted CI, Vercel otomatik Git deployment, paid WAF/Upstash/Vercel tier, yetkisiz yeni Preview, Production, SSO bypass, ücret/kota tüketen kontrolsüz live probes, paylaşılan Redis için gerçek 21-request stres testi ve Upstash bağlantı URL/token deşifresi yok. Yerel güvenlik araçları yalnızca localhost origin kullanabilir.

**Başarı tanımı:** kaynağı ve sonucu güvenilir uygulama + ücretsiz kullanım headroom kanıtı + tam SHA protected Preview gözlemi + gerçek cihaz/insan kabulü + dağıtık Redis risk kararı + ayrı yetkilendirilmiş Production yayın. Bunların hepsi tamamlanana kadar “release-ready” ibaresi kullanılmaz.
