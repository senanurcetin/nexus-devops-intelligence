# NEXUS DevOps — Owner-First 30 Günlük Gerçek Kullanım Karnesi

**Başlangıç:** 2026-10-15 · **Kapsam:** pilotsuz ticari sürüm öncesi gerçek *iç QA* · **Bütçe:** yeni ücretli hizmet 0 TL · **Durum:** şablon; gerçek kullanım yapıldığı iddia edilmez. **Ticari satış hedefi aktif, ücretsiz dış test kullanıcı zorunlu değildir.**

## Amaç ve sınırlar

NEXUS'u kendi public GitHub repolarının GitHub Actions/PR sorunlarını kanıta dayalı incelemeye yarayan yerel bir araç olarak değerlendirmek. **Dış kullanıcı sayısı = 0 kabul edilir.** Uygulama anonim public verileri kullanır; kullanıcı/private repo token'ı, otomatik veri toplama, hosted telemetri veya ödeme ekranı yoktur. Kullanıcıların isteğe bağlı raporları public issue'ya kişisel bilgi koymamalıdır.

**Mevcut doğruluk sınırları:** 10 workflow run ve 5 PR örneklemi repo toplamı değildir. Eksik, belirsiz, stale veya hiç olmayan CI/PR verisi “sağlıklı” sonucu değildir; kaynak bağlantıları olmadan kök neden söylenmez. Yedi günlük UTC trend ancak tam kaynak kapsamıyla yorumlanır.

## Önkoşul — birincil OS kabulü

- [ ] Kontrol edilen tam commit SHA kaydedildi
- [ ] Node test, typecheck, build ve güvenlik temel kontrollerinin PASS / FAIL / NOT RUN durumu kaydedildi
- [ ] Gerçek Docker Engine 28+ / Compose ile **localhost-only** kurulum doğrulandı veya açıkça NOT RUN yazıldı
- [ ] 127.0.0.1 yayınlanan port, nonroot runtime, düzgün stop/restart ve yanlış repository için HTTP 400/no-store test edildi
- [ ] GitHub kotası/ağ sorunlarının kullanıcıya yanlış temiz sonuç göstermediği doğrulandı

> Tek OS'de doğrulanan local-owner alpha; Windows + Ubuntu üzerinde doğrulanmış herkese açık çok platformlu release anlamına gelmez. Real external internet access/Cloud release için ayrı güvenlik ve insan kabulü gerekir.

## Seans kaydı (yalnızca doğrulanmış gerçek çalışmalar)

| Tarih | Public repo | İnceleme amacı | GitHub kaynak kanıtı | Manuel süre | NEXUS süre | Sonuç/fayda | Hata veya sınırlama |
| --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | — | **NOT RUN** | — |

Süreler kullanıcıya ait yaklaşık gözlemler olabilir; tahmin ile ölçülen sonuç açıkça ayrılmalı. Bazı repolarda gerçek CI/PR yoksa yalnız kaynağın eksik olduğunu kaydet; sahte hata bulgusu oluşturma.

## 30 gün sonu karar matrisi

| Boyut | Önerilen hipotez (otomatik başarı iddiası değil) | Kaydedilecek kanıt |
| --- | --- | --- |
| Kurulabilirlik | Birincil OS'de başarılı kur/başlat/durdur ve yeniden başlat | Yerel komut/OS/sha |
| Güvenlik | 0 bilinen kritik açık, localhost-only erişim, secret sızıntısı yok | Test ve inceleme |
| Doğruluk | 3 gerçek seans içinde yanlış pozitif “her şey temiz” yok | GitHub URL + manuel kontrol |
| Fayda | En az bir kaynaklı inceleme kararında kolaylık veya süre farkı | Manuel karşılaştırma |
| Bakım yükü | Sahibinin makul gördüğü sürdürülebilir iş yükü | Güncelleme/test zamanı |
| Dış kullanıcı | **0 kabul edilir** | Yalnız gerçek gönüllü katkı varsa |
| Gelir | **0 TL kabul edilir** | Varsayımsal müşteri/gelir yazılmaz |

**Karar dalları:** Teknik QA yeterliyse Commercial Setup & CI Review paketinin satış/teslimat hazırlığına devam et. Yetersizse gerçek sorunları gider; ticari iddiaları genişletme. 0 pilot ile satış kanalı hazırlanabilir; 0 siparişte gelir 0 kaydedilir. Premium Pro modülleri yeni özellik ve lisans hakları tamamlanana dek pazarlanmaz. Cloud için finansman + ayrı karar gerekir.

## Haftalık gözden geçirme (opsiyonel, zorunlu otomasyon yok)

- 1. hafta: güvenli localhost kurulum, test ve ilk gerçek kaynağı doğrulama.
- 2. hafta: kaynak bağlantısı/doğruluk ve ihtiyaç halinde UI/rapor iyileştirmesi.
- 3. hafta: 2. veya 3. gerçek kullanım seansı; varsa manuel karşılaştırma ve bir darboğaz.
- 4. hafta: satışa hazır olma değerlendirmesi (QA + kurulum + hukuki/ödeme + pazarlama), *0 pilot kabul edilir, gelir gerçekleşmediyse 0 kaydedilir*.

Açık olmayan QA'yı PASS yapma; yayınlanmayan özelliği kullanılabilir diye sunma. Yerel notlar kişisel veriye dönüşüyorsa herkese açık repoya commit etme.
