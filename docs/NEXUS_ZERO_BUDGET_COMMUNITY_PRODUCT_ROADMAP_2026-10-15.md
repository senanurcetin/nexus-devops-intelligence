# NEXUS DevOps Intelligence — Sıfır Bütçeli Ürünleştirme ve Community → Cloud Planı

**Karar tarihi:** 15 Ekim 2026 · **Kapsam:** yalnızca `senanurcetin/nexus-devops-intelligence`  
**Kaynak başlangıç SHA:** `98febb079d7141c0cba9694b81330dd2919891f5`  
**Karar:** **Mevcut public + MIT repo public kalacak.** Şu anda lisans, görünürlük, fiyatlandırma, runtime veya üretim dağıtımı değiştirilmez. Ticari SaaS, müşterilerden somut talep/gelir olmadan işletilmeye başlanmaz.  
**Başlangıç nakit bütçesi:** 0 TL. Bu, müşterinin kendi cihazında elektrik/internet/işletim maliyeti olmayacağı veya geliştirici emeğinin maliyetsiz olduğu anlamına gelmez.

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

## D. P1 — İlk 5–10 pilot kullanıcı, ücretsiz müşteri keşfi

**D1.** Hedef: freelance geliştiriciler, küçük startup'lar, açık kaynak bakımcıları ve yoğun GitHub Actions kullanan 5–10 bağımsız ekip/kişi. İsteğe bağlı tanıtım/iletişim; spam veya izinsiz otomatik gönderim yok, ücretli reklam yok.

**D2.** Her pilot için: kuruluş/kişi kimliğini gereğinden fazla toplama; kullanıcıya yükleme süresi, anlamlı risk tespitleri, tekrar açma sıklığı, hangi rapora ihtiyaç duyduğu, “buna para öder miydin / ne için” soruları. Repo ve özel kod paylaşmak zorunda bırakılmaz; opsiyonel anonim geri bildirim.

**D3.** Başarı ölçütü (hipotez, vaat değil): en az 5 gerçek kurulum; 3 kişinin ikinci kez kullanması; 2 bağımsız ücretli kurulum/özelleştirme ihtiyacı; sistematik kritik hata yok. 30 günde gerçekleşmezse ücretli SaaS'a geçilmez, kullanıcı ihtiyacına göre ürün daraltılır.

**Çıkış kriteri:** Gerçek geri bildirim ve çözülen sorun listesi; ücretli müşteri sayısı olduğundan fazla sunulmaz.

## E. P2 — İlk gelir: satılan şey barındırma değil hizmet

**E1.** Ticari platformu ücretsiz Hobby'de işletmek yerine müşterinin **kendi barındırdığı ortam için isteğe bağlı kurulum, eğitim, veri/CI analizi ve özelleştirme hizmeti** sunulabilir. Ücretsiz MIT kod satılabilir ama rakipler de kopyalayabilir; esas değer güvenilir kurulum/özel entegrasyon/hız ve destektir. Her iş için kapsam, teslimat, geri alma, izinler ve açık fiyat anlaşması; vergi/fatura ve sözleşme konuları yerel mevzuata göre ayrıca değerlendirilir.

**E2.** İlk işlerden önce sunucuyu, alan adını veya veritabanını cebimizden finanse etmeyiz; müşterinin sağladığı/ödediği altyapıyla yürütürüz. En az bir gerçek gelir veya ödeme taahhüdü gelmeden ücretli bulut planına geçilmez. Tek seferlik gelir = düzenli SaaS geliri değildir.

**E3.** Ticari modüller için yeni, hak sahipliği açık kodu private repoda geliştirmenin gerekliliği kullanıcı talebiyle belirlenir; Community MIT kaynakları ve eski haklar korunur.

**Çıkış kriteri:** Ölçülmüş gerçek talep, maliyet hesabı ve gelir/hosting oranı.

## F. P3 — Sonra NEXUS Cloud SaaS

Yalnız D ve E'de doğrulanmış müşteriler oluşunca ayrı onaylı kararla:
- GitHub App installation-level scoped read-only authorization; kullanıcı, organizasyon ve repo isolation; GitHub callback/webhook güvenliği.
- Multi-tenant auth, tenant-scoped data persistence, veri silme ve KVKK/GDPR değerlendirmesi, log redaksiyonu, support/recovery; arka plan job kota kontrolü.
- Gerçek SSO + protected Preview exact SHA (G04), manual VoiceOver/NVDA (G05), iki bağımsız Vercel Function + ortak Redis admission (G06) gibi **seçilen barındırma mimarisinde geçerli** gereksinimleri test et. Tek-machine localhost Docker için “iki Vercel instance” bir acceptance gereksinimi değildir; **public shared multi-instance SaaS** için hâlâ zorunlu.
- Barındırma ticari kullanıma izin veren ücretli plan veya uygun kendi sunucusu üzerinden ayrıca fiyatlandırılır; ücretsiz Hobby'yi ticari ödeme trafiği için kullanma.
- Fiyat ve aylık işlem maliyeti doğrulanmadan ödeme altyapısı bağlanmaz.
- Sonra ihtiyaç kanıtlanırsa Electron/Tauri Windows EXE kararı verilir; ilk dağıtım yolu değildir.

**NO-GO:** müşteri yokken sürekli ücretli barındırma, geliştirici cihazını kamuya port-forward etme, token paylaşma, kullanıcıdan ayrı izin almadan GitHub App özel depolarına erişme, kilidi atlayarak Preview yaratma, hosted CI/Actions çalıştırma, izinsiz Upstash 21-call canlı sınama, varsayımsal gelir ya da tamamlama iddiası.

## Öncelikli hemen sonraki iş ve yürütme takip tablosu

| Sıra | PR/iş paketi | Bağımlılık | Kabul |
| --- | --- | --- | --- |
| 1 | Public/MIT/NO-SPEND + güncel kaynaklı ürün statüsü dokümantasyonu | Yok | Public repo değişmez; README yanlış deploy iddiası içermez |
| 2 | `output:standalone`, Dockerfile + `.dockerignore` | Node QA | Lokal image build + nonroot + no secret COPY |
| 3 | Loopback-only `compose.yaml`, start/stop, health/invalid-input smoke | 2 | 127.0.0.1 bind; tek node local-only; external exposure yok |
| 4 | Windows/Ubuntu Community onboarding, troubleshooting | 2–3 | Gerçek iki OS üzerinde talimat doğrulama |
| 5 | G04/G05/ G06 SaaS yayına hazırlık; ayrı kapılar | #49/#7 | Sahte canlı PASS yok, Production izinli |
| 6 | 5–10 ücretsiz pilot ve kullanıcı görüşmesi | 4 | Gerçek kurulum/geri bildirim |
| 7 | İlk isteğe bağlı kurulum/özelleştirme hizmeti | 6 | Gerçek ücretli iş talebi |
| 8 | Ticari SaaS fizibilitesi ve ayrı private premium modüller | 7 | Gelir + bütçe + lisans/izin kararı |

**İş planının uygulanması için “private yap” işlemi gerekmiyor.** Kullanıcı yeni “devam et” beklenmeden tek-proje günlük geliştirmeyi zaten yetkilendirdi; yine de her planlı çalışma kendi çalıştırma ortamı ve güvenli sınırları içinde yapılır; sohbetin kesintisiz çalışan bağımsız bir process olduğu iddia edilmez.

## Başvuru kaynakları

- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility
- https://choosealicense.com/licenses/mit/
- https://nextjs.org/docs/app/getting-started/deploying
- https://docs.docker.com/guides/nextjs/
- https://docs.docker.com/compose/how-tos/use-secrets/
- https://vercel.com/docs/plans/hobby
