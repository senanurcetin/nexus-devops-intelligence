# NEXUS DevOps Intelligence — Sıfır Bütçeli Ürünleştirme ve Community → Cloud Planı

**Karar tarihi:** 15 Ekim 2026 · **Kapsam:** yalnızca `senanurcetin/nexus-devops-intelligence`  
**Kaynak başlangıç SHA:** `98febb079d7141c0cba9694b81330dd2919891f5`  
**Karar:** Community public/MIT kalır. Ticari satış hazırlığı zorunlu iş koludur fakat Cloud ancak finansman ve ayrı onayla açılır; mevcut runtime/deploy/lisans değiştirilmez.  
**Başlangıç nakit bütçesi:** 0 TL. Bu, müşterinin kendi cihazında elektrik/internet/işletim maliyeti olmayacağı veya geliştirici emeğinin maliyetsiz olduğu anlamına gelmez.

> **15 Ekim 2026 — yeni TICARI KARAR (onceki owner-only yaklasimini gunceller):** NEXUS satilabilir bir yazilim ve hizmet paketi olarak hazirlanacak. **Harici pilot, ucretsiz beta, 5–10 kullanici ve erken musteri bulma teknik yayina hazirlik kosulu DEGILDIR.** Sahip olarak kendi gercek GitHub projelerimizde dogfooding + otomatik/yerel QA kullanacagiz. Ilk satis ve gelir yine hedefimiz; ancak gercek odeme olmadan ticari basari iddia edilmeyecek. Ilk satilabilir paket verified self-hosted kurulum + bounded CI inceleme; daha sonra yeni, haklari kontrol edilmis Pro kodu. Public MIT haklari degismez; Cloud gelire ve ayri onaya baglidir. [Detayli ticari plan](NEXUS_COMMERCIAL_NO_PILOT_GO_TO_MARKET_2026-10-15.md).


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

## D. P1 — Gerçek alıcı test kullanıcısı aramadan teknik QA (zorunlu)

Dış pilot sayısı **0** olabilir. Ürünün ilk ve gerçek teknik kullanıcısı sahibi olacak: 1–3 public GitHub repository üzerinde Actions/PR kaynakları kontrol edilir; en az üç mümkün gerçek kullanım senaryosu kaynak kanıtıyla, 400/429/503/504, quota ve eksik data fail-closed durumları offline fixture'larla doğrulanır. Sadece iç test ile 'müşteri talebi doğrulandı' denmez. README'de bugünkü gerçek sınırlar (10-run/5-PR sample, yalnız public, token yok, tam repo geneli analiz yok, AI root cause yok) korunur.

Teknik satılabilirlik: source exact-SHA `npm ci/test/typecheck/build`, üçüncü taraf lisans ve secret kontrolü, Docker Engine 28+ loopback-only, nonroot, start/stop/rollback; satılacak hedef OS'de gerçek kurulum ve destek provası. PR #80 / #81 açık. **NOT RUN** PASS'e çevrilmez. Ücretli satış için paket ve söz verilen müşteri destek senaryosu kanıtlanmalı.

## E. P1 — Satılabilir ürün ve doğrudan satış yolu (zorunlu hedef, dış pilot yok)

| Paket | Değer ve ücretlendirme | Mevcut durum |
| --- | --- | --- |
| **Community** | MIT lisanslı ücretsiz public GitHub analiz çekirdeği | Mevcut MVP, Docker PR #80 henüz kabul edilmedi |
| **Commercial Setup & CI Review** | Müşterinin kendi makinesinde doğrulanmış kurulum, sınırları belli gerçek CI/PR inceleme raporu, destek/onboarding; **hizmet/teslimat** ücretli, MIT kullanım hakları sürer | İlk satış için seçilen SKU; henüz satılabilir olarak doğrulanmadı |
| **Pro Self-Hosted** | **Yeni** hakları temiz proprietary kod ve gerçekten ek kabiliyetler için yazılım lisansı + açık güncelleme/destek şartları | Taslak; private repo/yeni özellikler ve lisans incelemesi daha sonra, bugün Pro yok |
| **Cloud SaaS** | Gelirle finanse edilen hosted abonelik | HOLD |

MIT kaynak kodu başkaları da satabilir veya yeniden dağıtabilir. Bir ücretli lisans 'Community kullanmaya devam etme hakkını' iptal edemez. Pro ayrı geliştirilmiş nitelikli özellik gerektirir; GitHub App özel repo veya geçmiş veri saklama ancak gerçekten uygulanıp güvenlik koşulları sağlandığında pazarlanır.

**Sales readiness, pilotsuz:** İngilizce gerçek ürün sayfası + dürüst ekran görüntüleri, Community/paid karşılaştırması, net kurulum/OS kısıtları, teslimat-kapsam-SLA olmayan açık destek süresi, iade ve sipariş şartları, maliyet bazlı fiyat hipotezi, satış iletişim/teklif formu, izinli doğrudan B2B görüşmeleri. İlk ödemeden önce satıcı/şirket vergi-fatura şartları ve payment provider merchant approval; örn. Türkiye'de uygun tahsilat veya uygun Merchant of Record araştırılır. Paddle/Lemon Squeezy country eligibility hesap onayı değildir. Mevcut Vercel Hobby ticari SaaS olarak kullanılmaz. Ücretli reklam, soğuk spam, CRM aboneliği, domain ve ücretli hosting yok.

**Pazar ölçümü:** sales-ready (teknik+hukuk+teslimat) ve *ilk gerçek satış* iki ayrı aşama. Hiç müşteri çıkmazsa gelir 0 kaydedilir; ürün yine satış amacıyla geliştirilebilir, ama gelir uydurulmaz. Doğrudan ödeme/kredi kartı entegrasyonu hazır olmadan satış tamamlandı denmez. Ücretsiz pilot toplamak hiçbir dönüm noktasının koşulu değildir.

## F. P2 — Gelir veya onaylı finansman sonrası Cloud

Cloud otomatik sonraki aşama değildir. İşletim geliri veya ayrı fon, tenant isolation, GitHub App scoped authorization, kullanıcı verisi/KVKK/GDPR, takvimli destek, ödeme/fatura, gerçek çok-instance rate limiting ve Preview/Production güvenliği tamamlanmadan abonelik servisi açılmaz. #49 ve #7 hosted kapıları açık kalır. Mevcut Vercel Hobby abonelik SaaS için kullanılmaz.

## Önceliklendirilmiş pilotsuz satış çalışma planı

| Adım | İş | Tamamlama ölçütü |
| --- | --- | --- |
| 1 | Commercial ürün SKU ve MIT hak sınırı | Doğru pozisyonlama |
| 2 | PR #80 Docker + #81 yerel OS/güvenlik QA | Teknik satılabilir sürüm |
| 3 | Owner GitHub projelerinde 3 gerçek kaynaklı inceleme | Pilot olmadan gerçek teknik kanıt |
| 4 | Ücretli kurulum + CI inceleme teslimat dokümanı ve destek/sınır | Müşteri paketi |
| 5 | Gerçek portföy sayfası + doğru ekran görüntüsü + teklif kanalı | Pazarlama hazır |
| 6 | Mevzuat, satıcı doğrulaması, ödeme/fatura, iade/şartlar | Sipariş kabulü hazır |
| 7 | Yeni premium Pro kabiliyetleri / ayrı lisans ve private kod | Gerçek yazılım lisansı satışı |
| 8 | İlk gerçek ücretli müşteri ve maliyet defteri | Gelir gerçekleşirse kaydet; garanti değil |
| 9 | Cloud ihtiyacı | Gerçek gelir veya onaylı bütçe olana dek HOLD |

**NO-GO:** teknik QA yerine ücretsiz kullanıcı sayısı koymak, sahte gelir/test/referans, MIT hakkını geri almak, private işlevler hazır olmadan Pro'yu satmak, G04/G05/G06 bypass, izinsiz CI/Upstash/live deploy/harcama. [Ticari plan](NEXUS_COMMERCIAL_NO_PILOT_GO_TO_MARKET_2026-10-15.md).

## Başvuru kaynakları

- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility
- https://choosealicense.com/licenses/mit/
- https://nextjs.org/docs/app/getting-started/deploying
- https://docs.docker.com/guides/nextjs/
- https://docs.docker.com/compose/how-tos/use-secrets/
- https://vercel.com/docs/plans/hobby
