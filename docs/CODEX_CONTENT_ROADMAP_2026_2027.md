# Altı aylık öneri: Codex odaklı, kanıta dayalı içerik programı

> Plan taslağı — programa kabul/ret sonucu bilinmiyor. Dönem 2026 Kasım – 2027 Nisan olarak varsayıldı; resmî altı aylık dönem başladığında tarihler güncellenecek. Hiçbir içerik yayınlandı veya Codex ile yapıldı olarak işaretlenmedi.

## Aylık teslimatlar

| Ay (önerilen) | Teknik hedef / öğrenme çıktısı | Kaynak | Kanıt / tamamlanma şartı | Durum |
|---|---|---|---|---|
| 2026-11 | Test-first regresyon: güvenilmeyen GitHub tarihini fail → pass doğrula | NEXUS DevOps Intelligence | Gerçek Codex oturumu + hedef/full test + PR + kamuya açık Türkçe eğitim | HAZIRLIK (hedef 2/2, npm 240/240 ve build PASS; audit 1 kritik bulgu; Codex tamamlanmadı) |
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

- NEX-CODEX-001: GitHub kaynak düzeltmesi, sentetik hedef test ve Türkçe/İngilizce taslak belgeler ayrı branch'te oluşturuldu.
- Node v22.16.0 üzerinde önce 1/2 PASS, sonra 2/2 PASS; Windows Node v24.13.0 üzerinde GitHub kod SHA ba1974f1...: hedef 2/2, tam npm testi 240/240, typecheck ve build PASS.
- Codex CLI 0.164.0 ile ChatGPT girişli oturum 27 Ekim 2026 tarihinde denendi, ancak hesap kullanım limiti nedeniyle kaynak değişikliği oluşmadı. **Tamamlanmış Codex katkısı ve video kanıtı: YOK**.
- İçerik linkleri henüz ana dalda değil; önerilen değişiklik PR incelemesinden önce kabul edilmiş sayılmaz.
- npm audit: Next.js 15.5.27 bağımlılığı için 1 kritik bulgu; ayrı güvenlik yama branch'i açıldı. Öncelikli işler: Next.js 15.5.28 güvenlik düzeltmesini ayrı PR/test ile değerlendirmek ve kullanım kotası açıldığında Codex ile bağımsız yeniden üretimi tamamlamak.
