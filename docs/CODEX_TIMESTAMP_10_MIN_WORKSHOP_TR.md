# 10 dakikalık uygulama: Codex ile test-first düşünme ve geçersiz GitHub tarihleri

> **Kamuya açık, tekrar edilebilir Türkçe eğitim.** Kod, sentetik testler ve düzeltme zaten bu depodadır. Bu yazı yeni bir Codex CLI oturumu, canlı demo veya yayımlanmış video kanıtı değildir. İlk üretim düzeltmesi **GPT-6 destekli** [PR #90](https://github.com/senanurcetin/nexus-devops-intelligence/pull/90) ile geldi; gerçek Codex incelemesi [PR #92](https://github.com/senanurcetin/nexus-devops-intelligence/pull/92) ve [ayrı native Codex MXC deneyinde](CODEX_MXC_NATIVE_TEST_FIRST_PROOF_20261027.md) belgelendi.

**Hedef kitle:** Node/TypeScript'e yeni başlayanlar, veri doğrulama ve güvenli AI destekli kod incelemesi öğrenenler. **Süre:** bağımlılık kurulumu hariç yaklaşık 10 dakika. **Gerekenler:** Node.js 22.16+, npm, Git. GitHub token'ı, ücretli bulut, private repo veya Production bağlantısı gerekmez.

## 1. Hatanın semptomunu gözlemle (2 dakika)

Terminalde aşağıdaki komutu çalıştır:

```bash
node -e "console.log(Number.isFinite(Date.parse('1'))); console.log(new Date('2026-02-30T11:00:00Z').toISOString())"
```

Node 24 ile doğrulanan çıktı:

```text
true
2026-03-02T11:00:00.000Z
```

İlk değer, `Date.parse` fonksiyonunun tarih olmayan `'1'` girdisini reddetmediğini gösterir. İkincisi, olmayan 30 Şubat'ın sessizce 2 Mart'a taşınabileceğini gösterir. **Bu çıktı tek başına uygulamanın güncel sürümünde hata olduğunu söylemez**; JavaScript'in yerleşik tarih ayrıştırıcısının gevşekliğini gösterir. Uygulamadaki tarih doğrulayıcısı artık daha sıkıdır.

## 2. Gerçek depo testini çalıştır (3 dakika + kurulum)

```bash
git clone https://github.com/senanurcetin/nexus-devops-intelligence.git
cd nexus-devops-intelligence
git rev-parse HEAD
npm ci --no-audit --no-fund
node --import tsx --test tests/nexus-panel-timestamps.test.mjs
```

`git rev-parse HEAD` çıktısını not et: test sonucu **ancak o kaynağa** aittir. İlgili dosyada üç üst düzey Node testi vardır: geçerli UTC örnekleri, geçersiz takvim/offset örnekleri ve daha önce Codex tarafından incelenmiş sınır durumları. **Beklenen davranış:** her üç test PASS; gerçek sonucu ve çıkış kodunu kendi terminalinden kaydet. Kurulum veya test çalışmazsa PASS yazma, `NOT RUN` ya da `FAIL` olarak raporla.

Windows'ta ağ, antivirüs veya npm önbelleği nedeniyle kurulum uzayabilir. Önceki bir Windows denemesinin zaman aşımına uğraması, aynı kaynak üzerinde başarıyla tamamlanan bir başka çalıştırmanın kanıtı değildir. [PR #100'ün GitHub Actions kaydı](https://github.com/senanurcetin/nexus-devops-intelligence/actions/runs/41116629184) ayrı bir final PR SHA üzerinde temiz kurulum, 389/389 test, typecheck ve build PASS göstermiştir.

## 3. Test ile uygulama arasındaki sözleşmeyi oku (2 dakika)

- [Sentetik tarih testleri](../tests/nexus-panel-timestamps.test.mjs): `isPublicActionsSample` ve `isPublicPullSample` doğrulayıcılarına aynı girdi aileleri verilir.
- [Gerçek doğrulama kodu](../src/lib/nexus-panel-validation.ts): kabul edilen UTC biçimi, takvim bileşenleri ve kaynak sınırları kontrol edilir.
- [Tarihsel düzeltme](https://github.com/senanurcetin/nexus-devops-intelligence/pull/90): ilk hatayı gösteren test ve minimum kaynak düzeltmesi; değişiklik **Codex'e atfedilmemeli**.
- [Gerçek Codex CLI test-first oturumu](CODEX_MXC_NATIVE_TEST_FIRST_PROOF_20261027.md): **ayrı, izole** bir Windows MXC çalışma alanında Codex önce 4 FAIL / 2 PASS, sonra 6/6 PASS gördü. Bu deneyin alternatif yaması, zaten mevcut üretim düzeltmesini tekrarladığı için tekrar birleştirilmedi.

Önemli ayrım: bugünün `main` dalı zaten düzeltilmiş davranışı içerir. Tarihsel **FAIL → PASS** deneyini güncel kaynakta yeni yaşanmış gibi göstermeyin.

## 4. Kendi sentetik sınır testini tasarla (2 dakika)

Fork ya da **ayrı çalışma dalında**, `tests/nexus-panel-timestamps.test.mjs` içindeki geçersiz örnekler dizisine `'2026-02-31T00:00:00Z'` eklemeyi deneyin. Daha sonra aynı hedef testini çalıştırın:

```bash
node --import tsx --test tests/nexus-panel-timestamps.test.mjs
git diff -- tests/nexus-panel-timestamps.test.mjs
```

Beklenen sözleşme: 31 Şubat hem Actions hem PR yanıtında reddedilmelidir. Bu alıştırma yalnızca **yerel test fikstürü** düzenler; gerçek GitHub API'sine veri yazmaz. Test sonucu beklenmedikse, hata mesajını inceleyin; koşulsuz PASS ilan etmeyin.

## 5. Codex'e verilebilecek güvenli istem ve kanıt şablonu (1 dakika)

Bu istem **öneridir**, gerçekleşmiş yeni bir oturum iddiası değildir:

```text
Bu kamuya açık NEXUS deposundaki tarih doğrulama sözleşmesini incele.
Önce sentetik testte 31 Şubat, Date.parse('1') ve UTC offset örneklerini
beklenen davranışla karşılaştır. Değişiklik gerekirse yalnızca ilgili
kaynak ve test dosyasını düzenle; tüm komutları ve tam Git SHA'yı raporla.
Canlı GitHub yazma işlemi, deployment, gizli token, ücretli CI ve private
repo erişimi kullanma. FAIL, PASS ve NOT RUN durumlarını ayır.
Başlangıçta bu hatanın GPT-6 destekli PR #90 ile zaten düzeltildiğini
açıkla; önceki işi kendine atfetme ve gereksiz ikinci yama hazırlama.
```

| Kaydedilecek kanıt | Örnek / kural |
| --- | --- |
| Kaynak revizyonu | `git rev-parse HEAD` tam SHA |
| Aracın katkısı | Codex çalıştırıldıysa gerçek oturum; çalıştırılmadıysa **YOK** |
| Test sonucu | Çalışan komut, çıkış kodu, gerçek PASS/FAIL sayısı |
| Dış bağımlılık | npm kurulumu başarılı mı, zaman aşımı mı? |
| Yayın kanıtı | Gerçek URL varsa yaz; video/sosyal paylaşım yoksa **YAYIMLANMADI** |
| Yetki sınırı | Source CI, Docker OS kabulü ve Production dağıtımı birbirinden ayrılır |

**Devam okuması:** [ayrıntılı Türkçe hata incelemesi](CODEX_TIMESTAMP_REGRESSION_TUTORIAL_TR.md), [Codex yayın kiti (taslak)](CODEX_TIMESTAMP_PUBLICATION_KIT.md), [katkı rehberi](../CONTRIBUTING.md), [bağımsız portföy](CODEX_AMBASSADOR_PUBLIC_PORTFOLIO_20261030.md).
