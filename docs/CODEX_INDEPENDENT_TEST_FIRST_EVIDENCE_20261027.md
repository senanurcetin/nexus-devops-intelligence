# Gerçek Codex CLI test-first deneyinin kanıtları — 27 Ekim 2026

> **Kapsam:** Bağımsız Codex CLI oturumu, Codex tarafından yazılan sentetik regresyon testi, Codex'in önerdiği alternatif düzeltme ve bunların **harici, gerçek Windows Node çalıştırıcısıyla** başarısız/başarılı doğrulanması. Codex'in kendi terminalinin testleri başarıyla yürüttüğü, uygulama kodunu otomatik olarak teslim ettiği veya video çekildiği iddia edilmez.

## Kaynak ve ortam

- Açık kaynak depo: [NEXUS DevOps Intelligence](https://github.com/senanurcetin/nexus-devops-intelligence)
- Bağımsız testin başlangıç SHA'sı: `bb0500a75df5800fb6590d4398b0b7dc700eebf7`; başlangıç dalı ayrı, `main` değiştirilmedi.
- Araç: **OpenAI Codex CLI 0.164.0**, ChatGPT oturumu, CLI'nin bildirdiği model `gpt-6.1-sol`.
- Başlangıçta hesap kullanım sınırı nedeniyle oturum ilerlemedi. Sonraki denemede Windows eski sandbox ACL başlatması `helper_sandbox_lock_failed` (error 5) döndürdü.
- Resmî Windows sandbox rehberindeki `windows.sandbox=mxc` tek-komut denetimi `MXC_OK` ve exit 0 verdi. Sandbox koruması kapatılmadı ve sistem-geneli ACL değiştirilmedi.
- Codex yalnızca izole kamuya açık kaynak klonunu ve sentetik fikstürleri işlemek üzere görevlendirildi; gizli dosya, uzak API, özel repo, CI, dağıtım, harcama veya production erişimi talep edilmedi.

## Yapılan işler ve kanıt ayrımı

| Adım | Gerçekte yapan | Sonuç |
|---|---|---|
| Yeni sentetik Actions/PR UTC regresyon testi tasarımı ve dosyaya yazılması | **Codex CLI, MXC** | `tests/nexus-panel-timestamp-regression.test.mjs` yerel izole klonda oluştu |
| Yeni testin düzeltilmemiş başlangıç kodunda çalıştırılması | **Bağımsız Windows Node 24 çalıştırıcısı** | `node --experimental-strip-types --test tests/nexus-panel-timestamp-regression.test.mjs`: **exit 1**, iki alt testten biri FAIL; `1`, `2026-02-30T11:00:00Z` gibi değerlerin kabul edildiği gerçek hata çıktısında görüldü |
| Sıkı ISO UTC ve takvim denetimi yama fikri | **Codex CLI, MXC** | Regex ve milisaniyeye normalize edilmiş `Date.parse`/`toISOString` round-trip içeren kod önerisi üretildi |
| Önerilen yamayı dosyaya yazmak | **Bağımsız Windows aracı** | Codex içindeki `apply_patch` ve PowerShell yazımı Windows sandbox/alt süreç hatalarıyla sonuçlandığından yama haricen uygulandı; tamamlayıcı tam eşleşme denetimi de korundu |
| Değişiklik sonrası **aynı** sentetik test | **Bağımsız Windows Node 24 çalıştırıcısı** | **2/2 PASS, exit 0**; başarısız/başarılı döngüsü gerçekten gözlendi |
| Kontrolün mevcut `main` davranışıyla karşılaştırılması | **Bağımsız Windows Node çalıştırıcısı** | Codex'in geniş sınır testi, hâlihazırda #90'da birleşmiş doğrulayıcı üzerinde de **2/2 PASS** verdi; üretim doğrulayıcısını tekrar değiştirmek gereksiz görüldü |

**Önemli:** Codex sandbox'ı alt süreçlerde Windows `0xC0000142` başlatma hatası verdiği için **Codex kendi içinde başarılı `node` veya `git` çalıştırmadı**. Harici test sonuçları Codex çıktısı olarak sunulmamalı.

## Herkese açık kaynak izi

İzole deneyin GitHub'a kaydedilmiş **arşiv dalı**, birleşmiş kaynak dalı **değildir**:

- <https://github.com/senanurcetin/nexus-devops-intelligence/blob/content/codex-timestamp-regression-20261027/tests/nexus-panel-timestamps.test.mjs> — Codex'in hazırladığı geniş test fikstürünün gözden geçirilmiş sürümü
- <https://github.com/senanurcetin/nexus-devops-intelligence/blob/content/codex-timestamp-regression-20261027/src/lib/nexus-panel-validation.ts> — Codex'in önerdiği alternatif doğrulama yaklaşımının haricen uygulanmış sürümü
- Dosya Git blob SHA'ları: test `cf41a9ff8225f8fcedd0b6ce470981d08de2fea1`; öneri yaması `3efa57d1c0ec65c9829b8fb94d7be1f63a52a664`.
- İlgili birleşmiş çalışmalar: [#90 ilk GPT-6 test/düzeltme](https://github.com/senanurcetin/nexus-devops-intelligence/pull/90), [#91 Next.js 15.5.28 güvenlik yaması](https://github.com/senanurcetin/nexus-devops-intelligence/pull/91), [#92 Codex kaynak-metin önerileriyle altı sınır durumu](https://github.com/senanurcetin/nexus-devops-intelligence/pull/92).

Bu farklı oturumlar ve katkılar birbirine karıştırılmamalıdır: **#90'ın üretim kodundaki düzeltmesi GPT-6 destekliydi; #92 altı sınır senaryosu için Codex'in metin incelemesini kullandı; bağımsız Codex CLI deneyi daha geniş bir test dosyası ve alternatif yama önerisi üretti ancak bunlar mevcut `main`e ikinci kez kopyalanmadı.**

## Eğitimde kullanılması gereken dürüst anlatım

"Önce mevcut doğrulayıcının hatasını Node testleriyle gösterdik ve GitHub'da düzelttik. Daha sonra Codex CLI'dan ayrı bir sentetik regresyon testi ve alternatif doğrulama önerisi aldık. Codex Windows sandbox'ında kod çalıştıramayınca aynı testi bağımsız çalıştırıcıda önce başarısız, ardından başarılı sonuçla doğruladık. Her iki uygulamayı karşılaştırarak gereksiz ikinci bir üretim kodu değişikliğinden kaçındık."

İçeriğin GitHub'da erişilebilir olması **video kaydının, LinkedIn gönderisinin veya Codex Ambassador kabulünün gerçekleştiği anlamına gelmez.** Bunlar ayrı yayımlama ve doğrulama adımlarıdır. Vercel Production/Preview, Docker ve erişilebilirlik onayları ayrıca gereklidir.
