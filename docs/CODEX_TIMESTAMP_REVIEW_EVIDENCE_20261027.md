# Codex ile kaynak metni üzerinden bağımsız test senaryosu incelemesi

**Tarih:** 27 Ekim 2026  
**Durum:** Gerçek Codex CLI oturumu tamamlandı; ancak bu bir **kaynak metnine dayalı test tasarımıdır**, Codex tarafından doğrudan dosya düzenleme veya terminalde test çalıştırma değildir.

## Kanıt ve araç kapsamı

- Kullanılan araç: OpenAI Codex CLI **0.164.0**, model CLI çıktısında **gpt-6.1-sol**.
- CLI ile ChatGPT hesabı üzerinden giriş doğrulandı.
- Gerçek Codex oturumunda yalnızca public repodan alınan `timestamp` işlevinin tam metni ile iki doğrulayıcıda nerede kullanıldığı belirtildi. Kod metni prompta eklendi; Codex'ten shell veya başka araç çağırmaması istendi.
- Çıktı: altı adet somut sentetik sınır durumu ve beklenen kabul/ret yanıtı. Codex kaynak metninde yeni bir hata tespit etmediğini belirtti.
- Başarılı kaynak-metin incelemesi öncesindeki doğrudan repo okuma denemesi **Windows error 5 / `helper_sandbox_lock_failed`** nedeniyle başarısızdı. Bu nedenle **Codex'in dosyayı terminalden okuyarak test ettiği iddia edilmez**.
- Çalışma esnasında ücretli bulut işlemi, Production değişikliği, GitHub Actions veya Codex'ten doğrudan PR/commit gerçekleştirme olmadı.
- Codex'in önerdiği altı fikstür, ayrı test dalında **ChatGPT/GitHub araçları aracılığıyla** `tests/nexus-panel-timestamps.test.mjs` dosyasına işlendi. Testi gerçekten çalıştıran araç ile öneriyi üreten araç birbirinden ayrı olarak raporlanır.

## Codex'in önerdiği test girdileri

| UTC timestamp | Beklenen | Gerekçe |
|---|---|---|
| `0000-01-01T00:00:00Z` | Kabul | Dört basamaklı sıfır yılı JS parse/ISO roundtrip ile uyumlu |
| `2026-10-13T11:00:00.123456789Z` | Kabul | Dokuz ondalık hane regex tarafından desteklenir |
| `2026-10-13T11:00:00.1234567890Z` | Ret | Regex üst sınırı dokuz hane |
| `2026-10-13T24:00:00Z` | Ret | Saatin sonraki güne taşınması roundtrip kontrolünden geçemez |
| `2026-10-13T11:00:60Z` | Ret | Artık saniye değeri JavaScript Date tarafından kabul edilmez |
| `2026-10-13T11:00:00z` | Ret | Büyük harfli `Z` zorunludur |

İki örnekleme türü de (`isPublicActionsSample`, `isPublicPullSample`) aynı değerlerle sınanır. Bu sınır durumları genel tarih standardına dair garanti değildir; mevcut NEXUS kaynak doğrulayıcısının açıkça uyguladığı biçim sözleşmesinin regresyon testleridir.

## Ayrım: Codex üretimi / test / kaynak teslimatı

- **Codex tarafından gerçekleştirilen:** public fonksiyon metni üzerinde 6 fikstürün ve beklenen sonuçların önerilmesi.
- **Codex tarafından gerçekleştirilMEyen:** terminalde kod okuma, dosya düzenleme, test çalıştırma, commit, PR oluşturma, depolama veya deploy.
- **Bağımsız doğrulama:** yalnızca gerçekten çalıştırılan yerel Node/npm komutlarının başarı/başarısızlık kayıtlarıyla raporlanacaktır.
- **Açık kaynak bağlantıları:** [orijinal kod ve Türkçe eğitim (#90)](https://github.com/senanurcetin/nexus-devops-intelligence/pull/90), [Next.js güvenlik yaması (#91)](https://github.com/senanurcetin/nexus-devops-intelligence/pull/91).
- **Video kanıtı:** henüz çekilmedi. Örnek video çekim planı ilk eğitimde bulunuyor. Uydurma ekran kaydı paylaşılmadı.

## Sonraki gerçek Codex kodlama gösterimi için

Windows sandbox hatası kullanıcı yetki ayarlarını zayıflatmadan onarılmalı veya desteklenen, bağımsız ve güvenli bir Codex çalışma ortamı kullanılmalıdır. Ardından yeni gerçek issue/PR üzerinde **önce başarısız test → Codex destekli kod değişikliği → başarılı test → inceleme** akışı tamamlanmalıdır. Bu doküman böyle bir süreç gerçekleşti iddiasında bulunmaz.
