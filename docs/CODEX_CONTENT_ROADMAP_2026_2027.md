# Altı aylık öneri: Codex odaklı, kanıta dayalı içerik programı

> Plan taslağı — Codex Ambassador başvurusunun kabul/ret sonucu bilinmiyor. Dönem 2026 Kasım – 2027 Nisan olarak varsayıldı; resmî dönem başladığında tarihler güncellenecek. İlk kamuya açık kod ve GitHub eğitim dosyaları #90–#92 ile birleştirildi. Video veya sosyal medya gönderisi henüz yayımlanmadı. Codex kullanım kanıtı, ilk GPT-6 kaynak düzeltmesinden ayrı tutulur.

## Aylık teslimatlar

| Ay (önerilen) | Teknik hedef / öğrenme çıktısı | Kaynak | Kanıt / tamamlanma şartı | Durum |
|---|---|---|---|---|
| 2026-11 | Test-first regresyon: güvenilmeyen GitHub tarihini fail → pass doğrula | NEXUS DevOps Intelligence | Gerçek Codex oturumu + hedef/full test + PR + kamuya açık Türkçe eğitim | KOD + GITHUB EĞİTİMİ BİRLEŞTİ (#90–#92); 241/241 test, audit 0; gerçek Codex test tasarımı ve harici FAIL→PASS kanıtı mevcut; video henüz yok |
| 2026-12 | Python'da gerçek hata analizi ve deterministik test | xarray / pyjanitor uygun issue | Açık issue, bağımsız Codex oturumu, pytest, maintainer review | PLAN |
| 2027-01 | GitHub Actions/CI yapılandırmasını maliyetsiz ve güvenli inceleme | NEXUS veya izinli OSS repo | Değişiklik, statik doğrulama, CI maliyet onayı ve gerçek çalışma kayıtları | PLAN |
| 2027-02 | Veri bilimi reproducibility / sentetik fixture doğruluğu | Seçilecek açık kaynak data repo | Deterministik test, before/after, lisans uyumluluğu | PLAN |
| 2027-03 | AI destekli yazılımda güvenlik ve kaynak doğrulaması | Public MIT proje | Güvenlik sınırları, testler, gerçek Codex ve inceleme | PLAN |
| 2027-04 | Uçtan uca OSS PR ve geriye dönük dersler | Açık issue ve bakımlı upstream | Merge edilmeyi beklemeden açıklanan PR statüsü, bakımcı geri bildirimi | PLAN |

## İçerik kartı şablonu

| Alan | Doldurulacak bilgi |
|---|---|
| İçerik ID, başlık, hedef kitle | Ör. NEX-CODEX-001; Türkçe giriş/orta seviye |
| Öğrenme çıktısı, yöntem | Somut yeniden üretim, değişiklik, test |
| Kaynak repo, issue, PR, tam SHA | GitHub permalink ve gözden geçirme durumu |
| Codex kullanım kanıtı | Gerçek oturum tarihi, model/araç, redakte edilmiş komut/prompt, kayıt referansı; yoksa YOK |
| Test ve kalite doğrulama | Komut, çalıştırılan cihaz/ortam, çıkış kodu, PASS/FAIL/NOT RUN |
| İçerik ve video hazırlığı | DRAFT / REVIEW / PUBLISHED; yayın URL'si |
| Yayın tarihi ve dil | Yalnızca gerçekleşince ekle |
| Topluluk geri bildirimi | Doğrulanmış soru/yorum ve bağlantısı, uydurma takipçi yok |
| Revizyon ihtiyacı, sorumlu | Tek bir sonraki teknik adım, güncelleme zamanı |

## Kalite ve gizlilik kapıları

1. Kodun özgün tarihçesini ve lisansını kontrol et; başka modelin ürettiği değişikliği Codex'e atfetme.
2. Issue/PR çakışmasını, aktif branch ve review durumunu sorgula; default branch'e doğrudan yazma.
3. Redakt edilmiş sentetik fixture ve çalışma çıktısıyla hatayı önce göster.
4. Test, typecheck, build, audit ve CI bilgisini ayrı ayrı PASS/FAIL/NOT RUN olarak raporla; eski test sonuçlarını yeni HEAD'e mal etme.
5. Secrets, kişisel veriler, private ticari kaynaklar, ücretli altyapı ve Production için ayrı gözden geçirme/izin gerekir.
6. Gerçekten yayımlanmamış video, LinkedIn gönderisi, topluluk etkisi veya elçilik kabulü ilan etme.

## Mevcut örnek için durum — 27 Ekim 2026

- NEX-CODEX-001: [#90](https://github.com/senanurcetin/nexus-devops-intelligence/pull/90) ilk kaynak düzeltmesi ve Türkçe eğitim, [#91](https://github.com/senanurcetin/nexus-devops-intelligence/pull/91) güvenlik yaması, [#92](https://github.com/senanurcetin/nexus-devops-intelligence/pull/92) Codex kaynak incelemesi destekli sınır testi **main'e birleştirildi**.
- Node v22.16.0 üzerinde önce 1/2 PASS, sonra 2/2 PASS; Windows Node v24.13.0 üzerinde GitHub kod SHA ba1974f1...: hedef 2/2, tam npm testi 240/240, typecheck ve build PASS.
- Codex CLI 0.164.0 ile iki doğrulanabilir çalışma var: kaynak-metin sınır örnekleri (#92) ve gerçek MXC oturumunda sentetik test dosyası + alternatif yama önerisi. İkinci dosya harici Node ile **önce exit 1, yama sonrası 2/2 PASS** doğrulandı. Ancak Codex'in kendi shell testi başlatılamadı; **tam otonom Codex düzeltmesi ve video kanıtı yok**. [Kanıt](CODEX_INDEPENDENT_TEST_FIRST_EVIDENCE_20261027.md).
- Teknik rehber ve ilk katkı bağlantıları main'de herkese açık. LinkedIn ve video materyalleri yalnızca taslak durumundadır; yayına alındıkları iddia edilmez.
- Tarihsel Next.js 15.5.27 güvenlik bulgusu #91 ile giderildi. Son birleşmiş kaynak checkpoint'i **241/241 test PASS, typecheck/build PASS, npm audit 0**. Kalan bağımsız kapılar: çekilecek gerçek demo videosu, insan erişilebilirlik/cihaz onayı ve korumalı Production/Preview/Docker kabulü; bunlar GitHub source merge ile kapatılmaz.
