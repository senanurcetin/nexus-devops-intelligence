# NEXUS DevOps Intelligence — Tek Proje Uygulama Planı

> **15 Ekim 2026 ticari karar:** NEXUS yalnizca kisisel kullanima ayrilmayacak; **satilabilir Commercial self-hosted teslimat** (ilk SKU: dogrulanmis kurulum + bounded CI Review), sonra farkli gercek Pro ozellikleri hedeflenir. 5–10 ucretsiz test kullanicisi veya pilot sart degil; kendi repolarimizda gercek kaynakli QA ve Docker/OS kabul sart. [Ticari yol](NEXUS_COMMERCIAL_NO_PILOT_GO_TO_MARKET_2026-10-15.md). MIT Community public, 0 TL pesin maliyet ve #49/#7 hosted sinirlari korunur; checkout/Pro/Cloud henuz hazir degil.


**Plan tarihi:** 2026-10-15 · Türkiye saati  
**Tek kapsam:** `senanurcetin/nexus-devops-intelligence`. Jarvis, portföy web, Power BI, diğer GitHub depoları, e-posta/CRM ve diğer NEXUS projeleri bu iş akışına **DAHİL DEĞİL**.  
**Doğrulanan kaynak main SHA:** `27018f829a6f1ba1f6e30ca21939138199ead164` (merged PR #74).  
**Açık takipler:** [#49 G04/G05 protected Preview acceptance](https://github.com/senanurcetin/nexus-devops-intelligence/issues/49), [#7 G06 live independent Redis admission](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7). **Açık PR: 0** at audit.  
**Mevcut korumalı Preview SHA:** `2b5fb7c379bd1f939f3b50f286edfb868ddb386a` (`READY` at latest inventory); deployment `dpl_9sq98XLM2DZAgyBFZoFVUde2NucT`.  
**Production SHA:** `74cd0e344eb94255b4bc8db99e4a4dc7f3a5a0bf`, deployment `dpl_9fXGATNHhyhNVrN1i47k3BU4u5K5`. **No Production authorization**.  
**Critical distinction:** PR #74's safe-copy API response diagnostics are **only in source**, not in existing SSO Preview or Production. Merging a docs PR is not a deployment; `git.deploymentEnabled=false`.

### 15 Ekim G04 devam çalışması — Safari pano yarış düzeltmesi

[Gerçek kaynak SHA'ya bağlı G04 clipboard race QA](G04_CLIPBOARD_SOURCE_SWITCH_RACE_QA_2026-10-15.md): Seçilen GitHub repository değiştikten sonra önceki panoya kopyalama çağrısının geç gelen başarı/hata sonucu artık yeni kaynak üzerinde “kopyalandı” veya yanlış fallback oluşturamaz. Çevrimdışı test **227/227 Node, 16/16 HTTP, 12/12 Chromium, 12/12 Firefox**, JS bütçesi ve audit 0 başarılı. Mevcut Windows WebKit cihazı çevrimdışı olduğundan **yeni 12. senaryo WebKit NOT RUN**; eski 11/11 kanıtı korunur ama genişletilmez. Güncel kaynak hâlâ Preview/Production'da yayınlanmış değildir; G04 gerçek SSO/F01–F05 kabulü, G05 insan AT, G06 canlı iki-instance Redis ve G07 Production ayrı açık kapılardır.

### 15 Ekim G06 tüm route Redis sözleşmesi

[Beş public API'nin fail-closed test raporu](G06_FIVE_PUBLIC_ROUTES_FAILCLOSED_QA_2026-10-15.md): İlk iki route dışında kalan PR verification, workflow evidence ve 7 günlük trend API'leri de gerçek Next GET handler'larında simüle Redis 429/503 ve geçersiz input için sınandı. **230/230 Node, 11/11 odaklı G06 test, 16/16 local HTTP, 12/12 Chromium, 12/12 Firefox**, TS/build/JS budget ve audit 0. Canlı Upstash çağrısı veya hosted CI yok. Bu **kaynak düzeyinde risk azaltımıdır**; iki ayrı gerçek Vercel instance kanıtı (G06/#7) hâlâ **OPEN**, gerçek 21-request test izinsizdir.

### 15 Ekim F03 yüklü URL temizleme — kaynak regresyonu

[F03 URL kanonlaştırma QA](F03_CANONICAL_LOADED_SHARE_URL_QA_2026-10-15.md): `?repo=owner/repo&token=...` gibi paylaşılan URL'ler geçerli depo kimliğini koruyarak gereksiz parametre ve fragment'ı **history.replaceState ile ek API isteği oluşturmadan** temizler. Geçersiz `repo` kaynak seçimi yine hata verir ve sıfır API isteği üretir. Kod SHA `4c41eb7c2ab601916fe7707fce510012ed0f3a5a` üzerinde **232/232 Node, 16/16 HTTP, 14/14 Chromium, 14/14 Firefox**, TS/build/bundle/audit 0 geçmiştir. **WebKit son senaryo NOT RUN**; gerçek SSO Preview G04 ve kullanıcı AT/G06/G07 kapıları açık. Bu düzeltme mevcut giriş URL'sini temizler; geçmiş sunucu erişim kayıtlarını geri alamaz.

## A. Başlangıç — mevcut kanıtların doğru tasnifi

| İş / kapı | Kanıtlanmış mevcut durum | Eksik kabul |
| --- | --- | --- |
| R0/R1 kod güvenliği ve kaynak kontrol | PR #74 exact-code SHA `56c23805a55ec553d1e08a8d1e0451c01efc5e66`: 227/227 Node, 16/16 localhost HTTP, Chromium 11/11, Firefox 11/11, TS/build, bundle budget, npm audit 0 | Her yeni uygulama kodu SHA'sında yeniden çalıştır |
| R2/G02 Free kullanım | 14 Oct owner account screenshots: Upstash 118/500K commands, 10KB/10GB transfer, 0B/250MB storage; **whole Vercel team** 9,329/1M invocations, 23m29s/4h CPU, 2/360 GB-hours memory | Bugünkü gerçek hesap dönemi/timestamp ve canlı yeni istek bütçesi ayrı doğrulanacak; 14 Oct ekranları sürekli güncel sayılmaz |
| R3 WebKit | Real headless Windows Playwright WebKit 27.2, **11/11**, Windows fileURLToPath regression fixed | Gerçek iOS Safari cihazı ve insan ekran okuyucu ayrıca |
| R4/R5/NEXUS F01–F05 | Lokal fixture testleri ve önceki gerçek Preview ekranlarında örnek GitHub iş akışı/PR panelleri, F05 100/225 incomplete coverage koruması | Yeni SHA ile gerçek source payload, export dosyası, F03 history, F04 user-triggered detail |
| G03 | Önceki korumalı Preview `READY`, SSO **project config** etkin | Bugünkü tam SHA ile SSO-korumalı Preview yok; önceki yeni Preview oluşturma işlemi platform kontrolünde engellendi. Bypass **YOK** |
| G04 | Owner mevcut eski SHA'yı desktop + iPhone Safari'de açtı, mobil kullanım sorun bildirmedi | SSO challenge/HTTP headers, API yanıtları, F01 export file/F03 navigation/F04 detail ve 25-origin request ledger yok |
| G05 | Otomatik axe / Chromium / Firefox / WebKit ve owner iPhone Safari temel smoke olumlu | VoiceOver/NVDA klavye/odak testleri ve insan son kabul |
| G06 / #7 | Redis atomik EVAL gerçek yerel multiprocess test ve source unit; PR #73 manual probe **0 GET default** ve 21-call same-client 429 **partial** | Gerçek iki bağımsız Vercel Function instance, aynı shared Upstash bucket, gerçek 429/no-store/Retry-After ve Free kullanım farkı |
| R11 | Local fixture laboratory panel ready 253/281ms, FCP/LCP 136/200ms, CLS 0.01129/0.00325; **NOT field CWV** | Canlı yetkili oturum/gerçek kullanıcı alanı ve INP/LCP/CLS |
| G07 | Production older READY rollback reference | G04/G05/G06 güvenlik kriterleri ve **ayrı exact-SHA production go/no-go** |

## B. Sıralı iş paketi

### P0-1 — Kaynakta QA ve güvenlik açıklarını kapat

1. Her tur GitHub `main` SHA, açık PR/issues, deployed Preview vs Production SHA'ları ve release plan farkını doğrula. `main` değiştiyse eski test raporunu otomatik aktarma.
2. G04 safe-copy receipt adapter'ı / SSR hydration / invalid data / aborted network / stale repository / clipboard fallback / F01–F05 kaynak sözleşmelerini statik ve birim testleriyle gözden geçir; yeni bulgu varsa küçük PR.
3. Her ilgili uygulama değişikliğinde hedef: Node testlerinin tamamı, TS, Next build, offline 16-route smoke, Chromium/Firefox/WebKit 11'er fixture, bundle budget, npm audit 0. Bir motor hostta açılamıyorsa **NOT RUN** yaz; başka motordan PASS çıkarma.
4. CI, gerçek Upstash, Preview veya Production API'si kullanılmadan kaynak-yerel test yap. Uygun ortam yoksa mevcut PASS kanıtını taklit etme.

**Bitirme kriteri:** Güncel executable SHA'ya bağlı yeşil QA + kod değişikliklerinin GitHub PR/commit kanıtı; runtime release anlamına gelmez.

### P0-2 — G03/G04 korumalı Preview canlı kabulü

1. Platformun önceki ikinci Preview oluşturma engelini hesap yöneticisi / izinli resmi kanal ile çöz; arka kapı URL, bypass token, sahte HEAD/redirect sonucu kullanma.
2. Yeni Preview ancak ayrı kaynak SHA / bütçe / SSO kontrolü ile ve platform izin verdiğinde. Mevcut üretim alias'ını asla değiştirme.
3. Yeni SHA'ya ait safe-copy receipt ile kullanıcıdan yalnızca **sanitized HTTP status/cache/admission** iste; password, cookie, IP, `Authorization`, private GitHub data isteme. Önceki Safari geri bildirimini yeniden toplamaya çalışma.
4. F01 CSV/JSON indirilen **gerçek dosya yapısı**, F03 URL/history/Back, F04 bir opt-in detail request, F05 eksik veri uyarısını doğrula. Ölçülen işlemlerin toplamının kullanıcı tarafından yetkilendirilen bounded origin bütçesini aşmadığını kaydet.
5. Canlı test penceresi/sayacı doğrulanamıyorsa **HOLD**. Yalnızca ekran açılması API 200/SSO bypass yok/SSR correct anlamına gelmez.

**Bitirme kriteri:** SSO'lu gerçek tarayıcıda doğru SHA ve F01–F05/HTTP kaydı; #49'daki G04 satırı yalnız gerçek kanıt sonrası kabul.

### P0-3 — G06 iki gerçek Vercel instance Redis

1. Kullanımın **bugünkü** fatura dönemi/team aggregate Free sınırlarına göre kapasiteyi 20% engineering rezerviyle tekrar hesapla; Redis EVAL iç komut faturalandırmasına temelsiz kesinlik atfetme.
2. Birim/multiprocess Redis testlerini gerçek multi-instance yerine koyma. Two-process local Redis EVAL, gerçek Vercel instance kimliği kanıtı değildir.
3. Kanıt toplama için mevcut SSO-korumalı Preview'da bağımsız instance kimliği nasıl güvenilirce tespit edilecek, özel bilgi açmadan nasıl sınırlı örnekleme yapılacak ve G06'nın exact 429/source/no-store/retry şartları nasıl karşılanacak yazılı olarak tasarla; gerekirse test imkânsızlığını **BLOCKED** olarak belgele.
4. **Kullanıcı önce gerçek 21-request live Redis stress'i açıkça kapsam dışında bıraktı.** Yeni açık onay + fresh capacity + SSO + 2-instance identity method olmadan deneme yapılmaz; #7 açık kalır.

**Bitirme kriteri:** Bağımsız instance 1 ve 2 kanıtı + ortak Redis sınırı + gerçek 429/no-store/Retry-After + hesap kullanım değişimi; aksi halde G06 HOLD.

### P1-4 — G05 insan erişilebilirliği ve Safari

1. Gerçek headless WebKit 11/11 ve owner'ın **eski Preview'ı iPhone Safari'de sorunsuz bulduğu** geri bildirimi sakla.
2. Güncel SHA gerçekten live olduğunda kullanıcıya gereksiz DevTools istemeden küçük VoiceOver kontrollistesi: VoiceOver odak sırası, düğme etiketleri, açık/kapalı disclosures, hata/status anonsları, 200/400% metin büyütme; Windows NVDA ayrıca.
3. Otomatik axe=0 hiçbir zaman insan assistive technology kabulüne eşit değildir. İnsan gözlemi yoksa G05 kısmen açık.

**Bitirme kriteri:** Gerçek cihaz ve ekran okuyucuyla desteklenen, açık scope ve tarihli insan QA.

### P1-5 — R11 gerçek performans ve hata sınırları

1. Source-local testlerin 375/1280px FCP, LCP, CLS ve API trafik sayacıyla regresyonunu izle.
2. SSO'lu yetkili Preview güncel source üzerinde erişilebilir hale gelmeden field CWV/INP veya Vercel function CPU/latency iddiası üretme.
3. Ücretli gözlemlenebilirlik veya gizli analytics ekleme; tarayıcının yerleşik performans API'si ve isteğe bağlı kullanıcı ekranı yeterli olduğunda raporla.

### G07 — Bağımsız Production kararı

Yalnızca G04/G05/G06 P0 kabul durumu ve/veya açık yazılı risk kabulü netleştiğinde; ayrı exact-SHA Production onayı, geri dönüş referansı ve sınırlı smoke listesi ile ilerle. Şu an **NO-GO**.

## C. Çalışma ritmi ve maliyet sınırı

- Kullanıcı yeni `devam` yazmasa da **günlük tek-proje kaynak-geliştirme görevi** bu planı takip edecek. Otomasyon bir iş tetikleyicisidir; bu sohbetin sürekli çalışan arka plan işçisi olduğu iddia edilmez.
- Günlük: önce issues/SHA/Preview drift; sonra yalnız güvenli uygulanabilir en yüksek P0; test; GitHub PR; somut ilerleme, güvenlik engeli veya karar gerekiyorsa Türkçe bildirim.
- Haftalık kontrol: açık P0 count, gerçek PR merge/QA delilleri, kaynak-live SHA drift, Free usage risk. Yanlış kapatılmış issue/gate varsa yeniden aç, kanıtsız yüzde/tamamlandı üretme.
- **Yapılmayacaklar:** başka repo/ürün, ücretli plan, hosted CI, GitHub Actions, SSO bypass, credentials/env decrypt, yeni Redis 21-call live yük testi, Production/Preview alias değiştirme, platform güvenlik reddini dolanma. Test için yerel/headless kaynaklar kullan.
- Son bilinen **14 Oct** Team usage: Vercel 9,329 invocations, 0.3914/4 CPU h, 2/360 memory GB-h; Upstash 118/500K commands, 0 B/250 MB, 10KB/10GB. **Fresh snapshot required for additional live scope.**
- Hedef yeni özellik eklemekten çok mevcut P0 kapanışı, belirli SHA üzerinde doğrulanmış kalite ve release açıklığıdır.

## D. Son karar

**Bugün:** Kod/dokümantasyon/test geliştirmelerine devam etmek güvenli. Yeni canlı Preview, gerçek Redis stres ve Production **değil**.  
**İlk somut sonraki iş:** PR #74 sonrasında tamamlanmış kodun en son kaynak SHA'da sürekli gerçek smoke/test kontratını kontrol etmek; G04 safe diagnostic copy'nin doğru sürüme ait olduğunun yanlış anlaşılmasını önleyen kanıtları ve G06 live release gates kayıtlarını sürdürmek.

Bu doküman tarihli yeni operasyon planıdır; tarihsel `NEXUS_MASTER_REMEDIATION_PLAN_2026-10-14.md` ve `NEXUS_RELEASE_BLOCKER_CLOSURE_2026-10-14.md` içindeki eski kaynak SHA'larının güncel deployment veya kod durumu olduğu varsayılmamalıdır.
