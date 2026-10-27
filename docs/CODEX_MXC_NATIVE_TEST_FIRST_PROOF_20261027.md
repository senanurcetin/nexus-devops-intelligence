# Codex CLI Windows MXC — gerçek test-önce geliştirme kanıtı

**Tarih:** 27 Ekim 2026  
**Geliştirme türü:** Kaynağa dayalı, gerçek Codex CLI kod düzenlemesi ve terminal testi  
**Kapsam:** Yerel, izole, kamuya açık NEXUS DevOps Intelligence klonu. Production, GitHub Actions, Vercel veya ücretli altyapı değişmedi.

## Neden ayrıca belgelendi?

Önceki [Codex test-first incelemesinde](CODEX_INDEPENDENT_TEST_FIRST_EVIDENCE_20261027.md), Codex Windows sandbox nedeniyle komutları kendisi çalıştıramamış; regresyon doğrulaması başka bir çalıştırıcıyla yapılmıştı. Bu belge **farklı, sonraki bir denemeyi** kaydeder: Codex hem dosyaları düzenledi hem de hedef Node testini kendi sandbox içindeki terminal komutlarıyla çalıştırdı. Bu iki oturumun kanıtları birbirine karıştırılmamalıdır.

## Güvenli çalıştırma ortamı

- Codex CLI **0.164.0** ve oturum açmış mevcut ChatGPT kullanıcısı kullanıldı.
- SentinelX servis hesabı SYSTEM olduğu için Codex geçici ve kullanıcı tarafından izinli bir Windows göreviyle **etkin normal kullanıcı token'ı** altında çalıştırıldı; görev yetki seviyesi `Limited` idi.
- Resmî Codex Windows sandbox uyumluluk kontrolü: `windows.sandbox=mxc` → **MXC_OK, exit 0**.
- Tam izolasyon korunarak Codex `-s workspace-write -c windows.sandbox=mxc` ile çalıştırıldı. `--dangerously-bypass-approvals-and-sandbox` kullanılmadı.
- Depo, kullanıcı bağlamında ayrı bir dizine klonlandı. Başlangıç kaynak commit'i tam SHA: `bb0500a75df5800fb6590d4398b0b7dc700eebf7`.
- Codex'in `apply_patch` yardımcı aracı bu Windows ortamında yeni dosya oluşturamadığı için yalnızca **sandbox içindeki PowerShell dosya işlemleri** kullanıldı. MXC terminal yazma kontrolü ayrıca `MXC_WRITE_OK`, exit 0 ile doğrulandı.
- Sistem geneli ACL gevşetilmedi, var olan kullanıcı profilindeki gizli bilgiler kopyalanmadı, ağ veya deployment izni genişletilmedi.

## Gerçek test-first çıktıları

| Sıra | İşlem | Sonuç |
|---|---|---|
| 1 | `git rev-parse HEAD`, branch ve temiz çalışma ağacını doğrulama | PASS |
| 2 | `src/lib/nexus-panel-validation.ts` tarih kontrolünün incelenmesi | `Date.parse` hatası mevcut |
| 3 | `tests/nexus-panel-timestamp-regression.test.mjs` sentetik dosyasının **Codex tarafından yazılması** | PASS |
| 4 | `node --experimental-strip-types --test tests/nexus-panel-timestamp-regression.test.mjs` — ilk çalıştırma | **4 FAIL, 2 PASS; exit 1** |
| 5 | `src/lib/nexus-panel-validation.ts` içerisine sıkı ISO UTC / takvim dönüşü kontrolünün **Codex tarafından uygulanması** | PASS |
| 6 | Aynı test dosyasının tekrar çalıştırılması | **6 PASS; exit 0** |
| 7 | Var olan `tests/nexus-panel-validation.test.mjs` | **6 PASS; exit 0** |
| 8 | `git diff --check` | PASS; exit 0 |

İlk başarısızlıkta hem Actions hem PR doğrulayıcısının tarih olmayan `1` değerini ve olmayan `2026-02-30T11:00:00Z` tarihini kabul ettiği gösterildi. Sonrasında geçerli `2026-10-13T11:00:00Z` örneği korunurken bu iki hatalı girdi reddedildi.

**Bağımsız doğrulama:** Codex oturumu bittikten sonra ayrı SentinelX/Node çalıştırıcısı aynı yeni testi tekrar çalıştırdı: **6/6 PASS**, mevcut altı doğrulama testi: **6/6 PASS**, `git diff --check`: PASS. Codex işleminin dıştaki sonuç kaydı `CODEX_EXIT=0` gösterdi; yalnızca beklenen iki kaynak/test dosyası değişti.

## Özgün katkı ve PR kapsamı

Bu çalışma **yerel bağımsız eğitim deneyi** olarak korundu; bu branch'teki kaynak düzeltmesi, daha önce [PR #90](https://github.com/senanurcetin/nexus-devops-intelligence/pull/90) ile ana dala alınan hatayı tekrar çözdüğü için gereksiz ikinci bir kod PR'ı açılmadı. Birleştirilmiş [PR #92](https://github.com/senanurcetin/nexus-devops-intelligence/pull/92) ise başka bir önceki Codex kaynak-inceleme oturumuna ait altı ek test vakasını içeriyordu.

**Bu belge, yerel Codex CLI uygulama kanıtının kamuya açık ve gizlilik açısından arındırılmış özetidir.** Ham yerel Codex logları, kullanıcı profili ve oturum bilgileri kamuya açılmadı. Video kaydı, gerçek NVDA/VoiceOver kabulü, Ubuntu Docker testi veya Vercel Production/Preview yayımlaması bu çalışmanın sonucu değildir.

## Tekrarlanabilir öğrenme

Kullanıcıya ait, herkese açık bir kod tabanında önce *başarısız test*, ardından **minimal düzeltme**, sonrasında *başarılı aynı test* ile test-first bir yazılım geliştirme akışı gösterildi. Codex CLI ve Node komutları gerçekten çalıştı; yürütme ile dokümantasyonun kaynağı ayrıca belirtildi.
