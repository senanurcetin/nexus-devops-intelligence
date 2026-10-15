# NEXUS DevOps Intelligence — Sıfır Bütçeli Ürünleştirme ve Community → Cloud Planı

**Karar tarihi:** 15 Ekim 2026 · **Kapsam:** yalnızca `senanurcetin/nexus-devops-intelligence`  
**Kaynak başlangıç SHA:** `98febb079d7141c0cba9694b81330dd2919891f5`  
**Karar:** **Mevcut public + MIT repo public kalacak.** Şu anda lisans, görünürlük, fiyatlandırma, runtime veya üretim dağıtımı değiştirilmez. Ticari SaaS, müşterilerden somut talep/gelir olmadan işletilmeye başlanmaz.  
**Başlangıç nakit bütçesi:** 0 TL. Bu, müşterinin kendi cihazında elektrik/internet/işletim maliyeti olmayacağı veya geliştirici emeğinin maliyetsiz olduğu anlamına gelmez.

> **15 Ekim 2026 Owner-First karar güncellemesi:** Bu planın varsayılan müşterisi / ilk gerçek kullanıcısı ürün sahibidir. **Dış pilot, 5–10 kullanıcı, ücretli talep, gelir ve SaaS lansmanı hiçbir iç kullanım veya Community kaynak sürümü için kabul koşulu değildir.** Aşağıdaki D–F bölümleri ve yürütme tablosu bu karara göre yeniden düzenlenmiştir. Dış kullanıcı ve gelir olursa ayrıca, isteğe bağlı değerlendirilir.


## 0. Strateji ve kontrol sınırları

**Konumlandırma:** `NEXUS DevOps Community` = public GitHub Actions / Pull Request read-only evidence dashboard; `NEXUS Cloud` = gelecekte izinli GitHub App, yönetilen barındırma, abonelik; `NEXUS Self-Hosted` = önce tek bilgisayarda loopback-only Docker kurulum, ihtiyaç doğrulanırsa kurumsal kapalı ağ sürümü. EXE en sona bırakılır; mevcut Next.js server API'lerinin güvenli biçimde EXE'ye taşınması ikinci dağıtım yüzeyi demektir.

**Lisans:** mevcut `LICENSE` MIT; verilmiş MIT hakları sonradan depoyu private yapınca geri alınmaz. Geliştiriciler MIT kapsamındaki community kodunu fork ederek ticari kullanabilir; gelir farkı yalnızca kodun gizlenmesine değil, entegrasyon, hizmet kalitesi, destek, iş akışı ve müşterinin zaman kazanmasına dayanmalıdır. Özel premium modüller ileride **yeni ve lisans hakları uygun** kodla ayrı private repoda yapılabilir; katkıcı hakları değerlendirilmeden mevcut kodu yeniden lisanslama sözü verilmez. Repo private yapılırsa GitHub'ın fork/star/watch/security özellikleri etkilenebilir.

**Yayın:** Şu an Vercel Hobby'de barınan önceki Preview/Production ticari hizmet olarak sunulmaz. Hobby ticari kullanım kısıtlıdır: https://vercel.com/docs/plans/hobby . Mevcut Vercel `git.deploymentEnabled=false`; merge = deploy değildir. Yeni dağıtım, gerçek Redis yük testi, ücretli hizmet, hosted GitHub CI/Actions, SSO korumasını aşma, Production alias değişikliği için ayrı değerlendirme/izin gerekir.

**Teknik mevcut durum:** Next.js 15 / React 19 / TypeScript; beş read-only API; public repo only; GitHub App/OAuth, multi-tenant auth, faturalandırma veya özel repo desteği yok. Önceki tam 232/232 Node, 14/14 Chromium + Firefox çevrimdışı testler source SHA `4c41eb7c2ab601916fe7707fce510012ed0f3a5a` için kanıttır; güncel merge SHA `98febb...` sadece ilgili kod + dokümantasyonu birleştirmiştir. Her yeni runtime koduna exact SHA'ya bağlı QA gerekir.

## A. P0 — Temeli koru ve maliyet çıkaran davranışları kapat (ilk öncelik)

**A1.** Issue [#49](https://github.com/senanurcetin/nexus-devops-intelligence/issues/49) (G04/G05) ve [#7](https://github.com/senanurcetin/nexus-devops-intelligence/issues/7) (G06) açık kalacak. Başarılı lokal testleri gerçek SSO, gerçek VoiceOver/NVDA, gerçek iki Vercel serverless instance Redis kotası olarak göstermeyeceğiz.

**A2.** Mevcut public repoda secret scanning/config review, `.gitignore`, örnek env, Vercel Hobby kuralı, README'nin eski SHA durum notları ve `main` sürüm görünürlüğü kontrol edilecek. Özellikle log/README/dökümanda bypass token, PAT, Upstash key, private URL bulunmadığı doğrulanacak; API çağrısı veya hesabın izni olmadan yeni canlı sorgu yapılmayacak.

**A3.** Public browser ve API için 400/429/503 fail-closed, F01–F05 ve Safari clipboard/link privacy regresyonları korunacak. Önceki gerçek WebKit 11/11 diğer SHA'ya ait; yeni 14. senaryo WebKit kabulü gerçek cihaz/test ortamı açılınca yeniden yürütülecek.

**Çıkış kriteri:** Yeni sıfır-bütçeli dağıtım kaynakları eklenmeden önce exact-code SHA, güvenlik kısıtları, public API sınırlamaları ve yöneticinin açık NO-SPEND kuralı belgeli.

## B. P0 — NEXUS Community tek makine self-hosted dağıtımı

**B1. Docker:** Next.js `output: 'standalone'` ile çok aşamalı `Dockerfile`; küçük, non-root runtime; `.dockerignore` ile `.env*`, test artefaktları, `node_modules`, `.git`, loglar ve gizli kaynaklar image build context dışında. `compose.yaml` tek servis, varsayılan **yalnızca `127.0.0.1:3000:3000`** port yayımlama; otomatik internete açılma, reverse proxy, telemetry veya ücretli üçüncü taraf servis yok. Upstash Redis veya kişisel GitHub token zorunlu değil. Mevcut uygulamanın Vercel dışındayken request limiter davranışı (process-local guard da devre dışı) **özellikle incelenecek**, loopback dışı kullanım güvenlik incelemesi olmadan desteklenmeyecek. Docker'ın standalone Next.js desteği: https://docs.docker.com/guides/nextjs/ .

**B2. Sıradan kullanıcı kurulumu:** `docker compose up --build -d` → `http://127.0.0.1:3000`; `docker compose down`; Windows Docker Desktop ve Linux için ayrı rehber; host loopback binding'in bazı platformlarda nasıl doğrulanacağı; diğer cihazlardan bağlantı vaat edilmez. Docker kurulu değilse yerel `npm ci && npm run build && npm run start` alternatif geliştirici yöntemi.

**B3. Güvenli kimlik bilgisi:** Community v1 **public repo / anonymous API** dışında token veya private repo istemez. İleride kişisel GitHub erişimi gelirse düz metin token dosyası/URL/localStorage kullanmama; yetkili GitHub App, scoped permissions ve Docker secrets veya OS keychain tasarımı gerekir. Docker Compose secrets rehberi: https://docs.docker.com/compose/how-tos/use-secrets/ .

**B4. Doğrulama:** `docker compose config`, image build, container nonroot kullanıcı, host port sadece 127.0.0.1, yerel homepage, API 400/no-store ve güvenlik headerları, Docker volume/secret taraması, `npm test`, TS, Next build, local 16 HTTP, Chrome/Firefox+uygun WebKit; test altyapısı yoksa `NOT RUN`. Dış ağ olmadan GitHub verisi gelmeyeceği açıkça belirtilir.

**Çıkış kriteri:** Test edilmiş **tek makine localhost Community paketi**, sıfır zorunlu bulut hizmeti, 10 dakikadan kısa hedef kurulum (gerçek kullanıcıda ölçülmedikçe başarı diye yazılmaz), Docker build için gerçek host kanıtı. *Bu sonuç public internet Production/SaaS sertifikası değildir.*

## C. P1 — GitHub Community sürümü ve bakım

**C1.** README en üstte yeni kaynak SHA ile “Community self-hosted alpha/beta / public repos only / no private repo / no guarantee of full CI reliability” açıklaması; tek komut, sistem gereksinimleri, gerçek ekran görüntüsü ve veri sınırları. Release checklist/tag belirlenir; mevcut package version `0.1.0` kendi kendine prod release olarak etiketlenmez.

**C2.** `SECURITY.md`, `CONTRIBUTING.md`, issue/bug/feature şablonları ve ücretsiz destek kapsamı; hassas veri iletilmesini reddeden hata raporu yönergesi; MIT lisans bildirimi korunur. Açık olmayan test sonuçları için sahte badge/başarı oranı kullanılmaz.

**C3.** Kurulum doğrulaması Windows ve Ubuntu'da izole ortamda, port çakışması, Docker yok, ağ yok, GitHub anonymous quota 403/429, Redis secret yok, başarısız API, kesilen bağlantı, veri kaynağı değişimi senaryolarıyla tekrarlanır. Windows EXE bu aşamada yapılmaz.

**Çıkış kriteri:** Zaman damgalı en az iki işletim sistemi test raporu ve baştan sona kullanıcı rehberi; gerçek GitHub release yalnız tüm belgeli güvenlik/görsel kabul koşulları sağlanınca.

## D. P1 — Owner-First: Ürünü kendimiz için çalıştır ve doğrula (zorunlu)

**D1. Tek kullanıcı varsayımı:** NEXUS DevOps'un ilk ve tek kullanıcısı proje sahibi olabilir. Bu durum başarısızlık değildir. Başarılı ürün: sahibinin günlük veya ihtiyaç halinde yürüttüğü GitHub CI/PR incelemelerini daha hızlı, daha anlaşılır ve kanıt bağlantılarıyla yapmasına yardımcı olan, güvenilir, bakım maliyeti makul, yerel bir araçtır. Başkalarının kurulumu, kayıt olması, bağış yapması, gelir elde edilmesi ya da kullanım verisi göndermesi **gerekmez**.

**D2. Kapsam:** İlk olarak kullanıcının erişilebilen **public** GitHub repolarındaki gerçek Actions/PR örnekleriyle çalış. Mevcut 10-run/5-PR örneklem sınırını, on-demand F04 ayrıntıları ve F05 tam UTC kapsama uyarılarını sakla; bilinmeyen, erişilemeyen, eski veya eksik veriyi otomatik olarak sağlıklı/başarılı gösterme. Kullanıcının özel repo analizine ihtiyacı doğarsa anonim Community API sınırını zorlamadan, yeni yetkilendirme mimarisini **ayrı karar** olarak ele al.

**D3. Tek kişilik ölçüm:** İlgili veri barındıran 1–3 public repo ile elle yapılmış tekrarlanabilir senaryolar kullan. Repo hiç workflow/PR içermiyorsa “bilgi yok” doğru sonuçtur; sahte incident türetme. Her gerçek kullanımda isteğe bağlı olarak neyin incelendiğini, referans GitHub linkini, yaklaşık manuel süreyi, NEXUS süresini, doğruluk/hata durumunu ve faydayı yerel notta kaydet. Notlar uygulama telemetrisi veya public GitHub issue olarak otomatik gönderilmez. Örnek kayıt: [Owner kullanım karnesi](NEXUS_OWNER_FIRST_USAGE_SCORECARD_2026-10-15.md).

**D4. 30 günlük karar hipotezi (dış kullanıcı gerekmez):** Birincil OS'de başarılı yerel başlangıç ve durdurma, temiz yeniden başlatma, sıfır kritik gizlilik/güvenlik sorunu, 400/429/503 gibi kaynak hata durumlarının dürüst gösterimi; **en az üç gerçek sahibi-kullanım oturumu** (farklı günlerde mümkünse), her oturumda yanlış olumlu “temiz” sonucu olmaması. Ek değer sinyali: kaynak bağlantısıyla **en az bir** kararın kolaylaşması, veya manuel incelemeye göre ölçülmüş süre avantajı; gerçek veri bunu sağlamıyorsa “fayda henüz kanıtlanmadı” yaz. Hedefler çalışma hipotezidir; tutmaması “ürün kapandı” demek değil, özellik daraltma / duraklatma sebebidir.

**D5. Dağıtım ayrımı:** Önce **owner-local** tek OS kabulüyle yalnız sahibin kullandığı test/alpha kurulum yapılabilir. Windows+Ubuntu iki gerçek OS kabulü, Docker image provenance ve yayın güvenliği tamamlanmadan “çok platformlu doğrulanmış Community release” denmez. PR [#80](https://github.com/senanurcetin/nexus-devops-intelligence/pull/80), [#82](https://github.com/senanurcetin/nexus-devops-intelligence/pull/82) ve [#81](https://github.com/senanurcetin/nexus-devops-intelligence/issues/81) bağlamında sürüm/QA kapıları korunur. Ayrı GHCR, Community Web veya Cloudflare Pages dağıtımı yalnız kendi kullanımında somut kolaylık gösterirse ve yeni güvenlik/QA gereksinimleri geçerse ele alınır; ön şart değildir.

**Çıkış kriteri:** 1 kişinin tekrar kullanabildiği, kaynakla doğruladığı ve kişisel DevOps iş akışına değer katıp katmadığını objektifçe değerlendirebildiği yerel uygulama. **5–10 dış pilot yokluğu bir blokaj değildir.**

## E. P2 — İsteğe bağlı dış Community kullanıcıları ve gelir (zorunlu değil)

**E1. Dış kullanıcılar:** Public MIT repo ve doğru README/kullanım rehberi bulunabilir kalır. Başka kullanıcı kendi isteğiyle gelirse issue/geri bildirim üzerinden desteklenebilir. İstenmeyen outreach, rastgele tanıtım, reklam, topluluk büyüklüğü, 5–10 kurulum veya dönüşüm oranı, **sürüm veya ürün değerinin ön şartı değildir**. İsteğe bağlı kullanıcıların sayısı 0 olabilir; 0 kullanıcılı ayda proje “başarısız” sayılmaz.

**E2. Gelir:** Kurulum, CI/CD health review veya özelleştirme talebi kendiliğinden doğarsa müşteri ortamında destek/hizmet modeli değerlendirilebilir. Gerçek müşteri, hizmet kapsamı, lisans, güvenlik, vergi/fatura ve açık fiyat onayını gerektirir. Hiç talep olmazsa ödeme platformu, CRM, satış hunisi, fiyat sayfası, çok kiracılı veri tabanı, premium özel repo veya satıcı hesabı **kurulmaz**. Gelir hedefi 0 TL olabilir; nakit çıkışı da 0 TL hedefiyle devam edilir.

**E3. Destek maliyeti ve proje kararı:** Haftalık sürdürme yükü faydayı aşıyorsa özellikleri azalt veya geliştirmenin hızını düşür. GitHub topluluğu dış katkıya açık kalabilir fakat tek geliştiricinin sınırsız ücretsiz destek SLA'sı yoktur. “Portföy/profesyonel referans + kendi işinde kullanılan araç” kalıcı, geçerli bir ürün sonucudur.

**Çıkış kriteri:** Yok; E bölümü tamamlanması gereken bir kapı değildir. Dış kullanıcı veya müşteri çıkması durumunda ayrı ürün kararıyla etkinleşir.

## F. P3 — NEXUS Cloud SaaS (yalnızca talep + finansman + ayrı karar ile)

Cloud'a geçiş **bir sonraki zorunlu aşama değildir**. Owner-local Community uygulaması tek kullanıcıyla süresiz sürdürülebilir. Cloud kararı ancak uzaktan erişim, ekip işbirliği veya müşterinin barındırılmış servis talebi gibi **tekrarlanan somut bir sorun**, finansman ve ayrı ürün sahibi onayı varsa değerlendirilir; dış kullanıcı/güvenli finansman yoksa **HOLD süresiz** kalır.

Cloud için, ancak karar alınırsa:
- GitHub App scoped read-only installation yetkileri; tenant isolation, güvenli webhook/callback, hesap erişim kontrolleri.
- Auth, depolama, deletion ve KVKK/GDPR değerlendirmesi; log redaksiyonu, destek, yedekleme, bounded background jobs, finansal üst limit.
- Seçilen barındırma mimarisinde gerçek protected Preview/SSO ve insan erişilebilirlik kabulü; birden çok instance varsa gerçek shared limiter kanıtı. Eski Vercel #49/#7 açık takipleri, localhost-alpha doğrulamasının yerini tutmaz.
- Ticari kullanıma uygun hosting ve gerçek aylık maliyet; önce gelirin veya onaylı kaynağın olması, sonra harcama.

**NO-GO:** kullanıcı bulmak için ürünü bitmiş sayma, sahte demo/telemetri/kullanıcı, ödeme veya gelir tahmini üretme; zorunlu ücretli hosting; güvenlik/kapı atlayarak internet yayını; özel token veya key isteme; 21-call Redis stress veya yeni Actions/CI çalışmasını mevcut izin olmadan tetikleme.

## Öncelikli hemen sonraki iş ve yürütme takip tablosu — Owner-First

| Sıra | İş paketi | Bağımlılık | Kabul |
| --- | --- | --- | --- |
| 1 | Public/MIT/NO-SPEND + owner-first durum belgesi | Yok | Pilot ve gelir varsayımı kaldırıldı; deploy iddiaları doğru |
| 2 | #80 self-hosted standalone/Docker kaynağı ve offline kalite | Güncel SHA | Test/TS/build/doğruluk kanıtı; başarısız test raporlanır |
| 3 | Birincil OS'de localhost kurulum/smoketest | 2, gerçek Docker host | Tek makine 127.0.0.1, nonroot, 400/no-store; gerçek kullanılabilir |
| 4 | Kendi public repolarında 30 gün boyunca ihtiyaç temelli kullanım | 3 | 3 dürüst kaynaklı kullanım oturumu; değer/fayda kararı |
| 5 | #82 Community yönergeleri ve release checklist | Kod kapıları | Açık kaynak katkı mümkün; müşteri/pilot bağımlılığı yok |
| 6 | İkinci OS/GHCR veya Community Web (isteğe bağlı) | Kullanım ihtiyacı | Gerçek QA; yayınlamadan önce güvenlik kabulü |
| 7 | Başkalarının isteğe bağlı katkı/kullanımı (opsiyonel) | Kendi isteği | 0 kullanıcı kabul edilir |
| 8 | Ücretli hizmet / Cloud (opsiyonel) | Gerçek talep + finansman + onay | Hiç talep olmazsa HOLD; harcama yok |

**Yürütme ritmi:** Bu plan ilgili sohbet/izinli görevlendirme süresince izlenir. Sürekli arka planda çalışan bir ajan, sayaç, bildirim veya kullanıcı izleme olmadığı açıkça kabul edilir. Dış pilot kullanıcı için zaman sınırı/dönüşüm baskısı oluşturulmaz.

## Başvuru kaynakları

- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility
- https://choosealicense.com/licenses/mit/
- https://nextjs.org/docs/app/getting-started/deploying
- https://docs.docker.com/guides/nextjs/
- https://docs.docker.com/compose/how-tos/use-secrets/
- https://vercel.com/docs/plans/hobby
