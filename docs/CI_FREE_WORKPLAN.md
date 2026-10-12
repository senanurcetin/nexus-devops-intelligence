# NEXUS DevOps Intelligence — CI'sız ürün geliştirme planı

**Revizyon:** 13 Ekim 2026 · **Depo:** https://github.com/senanurcetin/nexus-devops-intelligence  
**Çalışma modeli:** GitHub üzerinde sürüm kontrollü geliştirme; kısa süreli bulut sandbox'larında manuel doğrulama. Kullanıcının bilgisayarına kurulum yok.  
**İlk sürüm hedefi:** Public GitHub repository'lerinde CI geçmişi, açık PR durumları ve kanıta dayalı öncelikli inceleme önerilerini güvenilir biçimde sunan, halka açık, salt okunur MVP.

## Güvenlik güncellemesi — 13 Ekim 2026

- [x] [PR #3](https://github.com/senanurcetin/nexus-devops-intelligence/pull/3) birleştirildi; [issue #2](https://github.com/senanurcetin/nexus-devops-intelligence/issues/2) çözüldü.
- [x] Next.js `15.5.27`, PostCSS `8.5.30` ve Sharp `0.35.5`; `package.json` ile npm'in oluşturduğu `package-lock.json` birlikte commit edildi.
- [x] Yeni dalın commit'inden temiz `npm ci --no-audit --no-fund`, `npm test` (**33/33**), `npm run typecheck` ve `npm run build` başarılı.
- [x] `npm audit --omit=dev --json`: doğrulama anında **0 üretim bağımlılığı bulgusu** (önce 1 kritik + 2 yüksek).
- [ ] **Yayın engelleri devam ediyor:** tarayıcı/a11y doğrulaması, uygulama ve Vercel seviyesinde kötüye kullanım kontrolleri, manuel preview uçtan uca testi.

## 0. Doğrulanmış mevcut durum

| Bileşen | Durum | Kanıt |
| --- | --- | --- |
| Bağımsız açık kaynak repo | TAMAM | Ops-Copilot'dan ayrı GitHub deposu |
| Next.js 15.5.27 dashboard | KODLANDI | `src/app/page.tsx` |
| Actions + PR API | KODLANDI | `src/app/api/public-*/route.ts` |
| Durum sınıflandırması ve öneriler | KODLANDI | `src/lib/` |
| Bağımlılık kilidi | TAMAM | `package-lock.json`, commit `4b87e6d` |
| Temiz kurulum | BAŞARILI | Bulutta `npm ci --no-audit --no-fund`, 107 paket |
| Unit testler | BAŞARILI | Son cloud çalıştırmasında 33/33 |
| TypeScript + Next.js production build | BAŞARILI | Manuel `npm run typecheck` ve `npm run build` |
| Gerçek HTTP smoke | BAŞARILI | Ana sayfa 200, hatalı input 400, 10 workflow ve 5 PR örneği |
| GitHub Actions / CircleCI | KULLANILMADI | Depoda workflow config yok |
| Route-handler entegrasyon testleri | EKSİK | Adapter testleri, gerçek route davranışının tamamını karşılamıyor |
| Etkileşimli browser / erişilebilirlik testi | EKSİK | HTTP smoke testi browser QA değildir |
| Halka açık yayın | EKSİK | Vercel NEXUS projesi henüz canlı değil |

**Not:** 24 test ve build, en son uygulama değişiklikleri için cloud ortamında doğrulandı; README/plan gibi sonraki yalnızca belge değişiklikleri için CI çalıştırılmadı. Kanıtı olmayan güvenlik, tarayıcı veya dağıtım başarılarını tamamlandı olarak işaretleme.

## Değişmez kısıtlar

1. **GitHub Actions, CircleCI, GitLab CI ve benzeri CI çalıştırılmayacak**; workflow config dosyası eklenmeyecek.
2. Kullanıcının bilgisayarında terminal, npm kurulumu veya yerel çalışma talep edilmeyecek.
3. Ops-Copilot'a yeni NEXUS ürün kodu eklenmeyecek.
4. GitHub'a kod gönderilebilir; her değişiklikten sonra manuel cloud doğrulama yapılacak. Git tabanlı otomatik Vercel dağıtımı açılmayacak.
5. Public MVP yalnızca anonim, sınırlandırılmış ve salt okunur GitHub REST API erişimi kullanacak. Tokenlar istemciye iletilmeyecek.
6. GitHub PR mergeability belirsizliği, gerçek CI testi ve faturalandırma dakika bilgisi olduğu izlenimi oluşturulmayacak.
7. Vercel sandbox saatleri ve olası ücretlendirme göz önünde tutulacak; kullanılmayan oturum kapatılacak.

## Sprint 1 — API güvenilirliği ve güvenlik (P0, ilk sırada)

| İş | Geliştirme | Doğrulama / tamamlanma koşulu |
| --- | --- | --- |
| API-01 | Next.js `/api/public-actions` ve `/api/public-prs` route-handler testleri | Mock GitHub yanıtları üzerinden 200/400/404/429/502/503/504 davranışları ve cache header'ları doğrulansın |
| API-02 | GitHub erişim / kota / bağlantı / bozuk JSON senaryolarını endpoint düzeyinde ele alma | Rate-limit 403 ve 429 ayırt edilsin; 5xx veya zaman aşımında güvenli hata çıktısı üretilecek |
| API-03 | PR listesi ve detay fan-out'ı, upstream kimlik/URL validasyonu | En fazla 1 Actions GET; PR için en fazla 1 liste + 5 detay GET; uyumsuz veri başarılı merge olarak görünmesin |
| SEC-01 | Anonim endpoint kötüye kullanım ve eşzamanlı istek incelemesi | Trafik kısıtları, caching, kullanıcıya hata iletimi belgelensin; gerekiyorsa yayın öncesi platform düzeyinde koruma |
| SEC-02 | Dependency, log ve secrets incelemesi | Tarayıcı bundle'ında token bulunmasın, `npm ci` tekrarlanabilir olsun; `npm audit` salt okunur biçimde değerlendirilsin |

**Sprint geçiş kriteri:** Adapter + route testleri hatasız, TypeScript ve build başarılı, hata yanıtları veri sızıntısı yapmıyor. Geliştirme ortamı yalnızca manuel çalıştırılacak.

## Sprint 2 — Ürün arayüzü ve UX (P1)

| İş | Geliştirme | Doğrulama |
| --- | --- | --- |
| UX-01 | Desktop / tablet / mobil düzeni, metin ve kart taşmaları | 1440, 768 ve 375 px kontrolü |
| UX-02 | Repo seçme, loading, retry, boş veri, API kesintisi ekranları | Actions ve PR panellerinin bağımsız hata durumları |
| UX-03 | Hızlı repo değiştirmede stale response ve cancel yönetimi | Eski repo verileri yeni repo adıyla görüntülenmeyecek |
| A11Y-01 | Form etiketleri, klavye, odak halkası, kontrast, ekran okuyucu mesajları | Klavye + erişilebilirlik incelemesi; kritik hata kalmasın |
| UX-04 | GitHub'a giden linkler, tutarlı CI/PR terimleri, örneklem uyarısı | Her önerinin özgün kanıt linki var; gerçek dışı tasarruf veya AI teşhisi yok |

**Sprint geçiş kriteri:** Manuel bulut tarayıcı kontrolünde temel kullanıcı akışı mobil ve masaüstünde tamamlanır.

## Sprint 3 — Uçtan uca doğrulama (P1)

- [ ] Temiz branch/checkout'ta **`npm ci --no-audit --no-fund`**.
- [ ] **`npm test`**, **`npm run typecheck`**, **`npm run build`** çalıştır; gerçek sonuçları kaydet.
- [ ] `npm run start` altında **`npm run smoke:http`**; canlı public API ve güvenli hatalı input kontrolü.
- [ ] Tarayıcı üzerinden public repo/boş repo/hatalı repo/repo değişimi/PR linkleri testleri.
- [ ] En az bir büyük ve bir küçük ekran boyutunda browser console kontrolü; kritik JS ve accessibility hataları çözülmüş olsun.
- [ ] `git diff`, bağımlılık değişimleri ve sırların yanlışlıkla commit edilmediği kontrol edilsin.

**Sprint geçiş kriteri:** Test + build + HTTP + browser kontrolleri raporlanabilir biçimde başarılı. Başarısız durumlar düzeltilmeden yayın yapılmayacak.

## Sprint 4 — Yayın hazırlığı ve manuel preview (P1)

- [ ] Ayrı Vercel NEXUS projesini kontrol et: `prj_sbU4ylt4OV4fLkcog3VpSr2fEXYe`. Proje Ops-Copilot'a bağlı olmayacak.
- [ ] Mevcut Vercel Hobby kota ve maliyet koşullarını kontrol et. **Git push ile otomatik deploy kapalı kalacak.**
- [ ] Kaynağı doğrulanan SHA'dan **tek seferlik manuel preview** dağıtımı oluştur.
- [ ] Preview URL'sinde gerçek API ve browser kontrolünü yeniden yap.
- [ ] `CHANGELOG.md`, `README.md`, `SECURITY.md` ve support bilgilerini son sürüme göre güncelle.
- [ ] Sürüm onay kriterleri sağlanırsa `v0.1.0` tag/release oluştur; aksi halde preview veya kodu production-ready olarak ilan etme.

**Sprint geçiş kriteri:** Çalışan paylaşılabilir preview, doğrulanan commit SHA ile eşleşiyor; son kullanıcı kendi bilgisayarına kurulum yapmadan deneyebiliyor.

## Sprint 5 — MVP sonrası (P2; ilk yayın için engelleyici değil)

- [ ] En az yetkiyle private repository desteği veren GitHub App.
- [ ] CircleCI'nin **sadece API verilerini okuma** entegrasyonu; CircleCI pipeline'ı çalıştırma değil.
- [ ] Depo bazında tarihsel hata eğilimleri, latency ve örneklem kapsamı.
- [ ] Kanıta dayalı AI kök-neden önerisi; özel log redaksiyonu ve kullanıcı onayı.
- [ ] GitHub Marketplace / CLI paketleme ve gerçek kullanım geri bildirimine dayalı fiyatlandırma.

## İş sırası ve takip yöntemi

**Şimdi yapılacak sıra:** API-01 → API-02 → API-03 → SEC-01 → SEC-02 → UX-01 → UX-02 → UX-03 → A11Y-01 → UX-04 → Sprint 3 doğrulaması → Sprint 4 manuel preview.

Her iş için: kod değişikliği → ilgili test → kısa süreli Vercel Sandbox'ta manuel test/build → GitHub commit/PR → dokümantasyon. Mümkün olduğunda bağımsız feature branch + PR kullan; otomatik check gerektirme. Doğrulanmış değişiklikler gerekli incelemeden sonra manuel birleştirilebilir.

## MVP tamamlanma tanımı

**MVP tamamlandı** demek için: API route testleri ve güvenlik incelemesi, 33 mevcut test dahil tüm güncel testlerin geçmesi, temiz `npm ci`, tam typecheck ve build, mobil/masaüstü browser QA, hatasız manuel HTTP testi ve kamuya açık çalışan preview gerekir. Repo dosyalarının varlığı veya başarılı build tek başına ürünün yayına hazır olduğu anlamına gelmez.
