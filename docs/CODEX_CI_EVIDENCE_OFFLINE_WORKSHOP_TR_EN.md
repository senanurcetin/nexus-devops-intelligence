# Codex CI evidence: exact-SHA checks / Tam SHA ile CI kanıtı

> Independent TR/EN engineering lesson (November 2026). This guide and its new validator are **GPT-6/ChatGPT-assisted**, not authored or executed by native Codex CLI. Prior native Codex evidence lives in [the separate Windows MXC workshop](CODEX_NATIVE_MXC_MALFORMED_AUTHOR_WORKSHOP_TR_EN.md). A submitted application, private video, program acceptance, user feedback and externally shared post are **not asserted by this guide**.

## Türkçe: Neyi doğruluyoruz?

Bir PR üzerindeki yeşil işaret tek başına `PASS` değildir. Kaynak commit'i, zorunlu kontrol adı, son durum, sonuç ve tam sayfa kapsamı aynı anda doğrulanmalıdır. GitHub API'sinden alınmış gibi görünen JSON bile **kendi başına bağımsız doğrulama değildir**: dosyayı kimin oluşturduğunu veya GitHub'dan geldiğini bu çevrimdışı araç ispatlayamaz.

[Çevrimdışı denetleyici](../scripts/verify-codex-ci-evidence.mjs), [Node.js regresyonları](../tests/codex-ci-evidence.test.mjs) ve mevcut [Codex içerik yol haritası](CODEX_CONTENT_ROADMAP_2026_2027.md) açık kaynaklıdır. Ağ, GitHub token'ı, yazma yetkisi veya ücretli API gerektirmez.

### Çalıştırılabilir 5 dakikalık alıştırma

Yeni geçici bir klonda Node.js 22+ ile:

```bash
node --test tests/codex-ci-evidence.test.mjs
```

Ardından aşağıdaki **tamamen sentetik** JSON örneğini `checks.json` adıyla oluşturun. Bu SHA gerçek bir projenin test kanıtı değildir.

```json
{
  "total_count": 2,
  "check_runs": [
    {
      "name": "Tests, types and production build",
      "status": "completed",
      "conclusion": "success",
      "head_sha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    },
    {
      "name": "Optional platform matrix",
      "status": "completed",
      "conclusion": "skipped",
      "head_sha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    }
  ]
}
```

```bash
node scripts/verify-codex-ci-evidence.mjs --sha aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --required "Tests, types and production build" --file checks.json
```

Beklenen: `gate: "PASS"`, `counts.passed: 1`, `counts.skipped: 1`, `independently_attested: false`, `merge_authorized: false`. **PASS sadece sağladığınız tek sayfalık JSON örneğinin tutarlı olduğunu gösterir.** Bu örnek gerçek bir CI çalıştırmasının başarılı olduğunu iddia etmez.

Deney: Zorunlu kontrolün `conclusion` alanını `skipped` yapın; `gate: "HOLD"` ve çıkış kodu `2` beklenir. Sonra `total_count` değerini `3` yapın; eksik sayfa yüzünden `HOLD` beklenir. Başka SHA kullanıldığında da `HOLD` gerekir. Her karşılaştırmayı çalıştırdığınız test çıktısıyla doğrulayın.

### Güvenlik ve kapsam sınırları

- GitHub Actions `check-runs` REST cevabının **tek ve tam sayfasını** bekler: `total_count` ile `check_runs.length` eşleşmelidir; 100'den çok kayıt varsa `HOLD`. Çok sayfalı bir sorgu, tek sayfaymış gibi birleştirilerek sertifikalandırılamaz.
- `--sha` tam, küçük harfli 40 karakterlik Git SHA'sıdır. Her check-run'ın `head_sha` değeri onunla eşleşmelidir. Branch adı veya güncel olmayan commit yeterli değildir.
- Bir veya birden çok `--required "TAM KONTROL ADI"` kullanılabilir. Her gerekli isim bir kez bulunmalı ve `completed/success` olmalıdır. Aynı isimli zorunlu kontroller belirsizlik yaratır; isteğe bağlı işler farklı workflow'larda aynı adla bulunabilir.
- `skipped` veya `neutral` **zorunlu işte** `HOLD`; isteğe bağlı işte görünür sayaç olarak kalır. Kaynak SHA'sı ve sayfa bütünlüğü tutarlıysa açık `failure`, `timed_out`, `cancelled` veya `action_required` sonucu `FAIL` üretir. Eksik, bekleyen, hatalı veya başka commit'e ait veride öncelik `HOLD` durumundadır.
- Sahte/değiştirilmiş JSON, git merge izni, branch protection, kapsamlı release readiness, insan incelemesi ve üretim dağıtım kararı doğrulanmaz. Kaynağı doğrulamak için gerçek GitHub PR/commit/check URL'leri ayrıca okunmalıdır.
- JSON dosyası üzerinden özel kişisel veriler veya token'lar örneklere eklenmemelidir.

## English: Why the distinction matters

A green icon is not sufficient CI evidence. The offline validator requires an explicit exact commit SHA, at least one named required check, all check-run source SHAs matching, complete single-page counts, and a successful required job. Failure is distinct from missing or pending evidence. Optional skipped jobs remain counted but do not independently certify coverage.

Run the same `node --test` command and the synthetic `checks.json` example above. Try changing a required check to `skipped` or setting `total_count` to a larger number: both must return `HOLD` with a nonzero exit status. A completed failure returns `FAIL` when the supplied source and snapshot structure are otherwise internally valid.

A valid `PASS` is **only an offline consistency evaluation of caller-supplied input**, not proof that the file was fetched from GitHub or that the PR may be merged. The tool never makes requests, uses credentials, triggers Actions, changes a PR, or authorizes deployment.

### Real-world review example (separate from synthetic fixture)

[Upstream xarray PR #11843](https://github.com/pydata/xarray/pull/11843) is an external open-source contribution. The exact PR SHA and current check status must always be independently read from the live PR before reporting an outcome. The code in that upstream PR is **GPT-6/ChatGPT-assisted, not native Codex-authored**; its maintainer approval does not imply a merge. This lesson does not insert a fabricated check-run result into the evidence ledger.

**Reader challenge:** What should happen when the required workflow is successful but an optional security check failed? Why is a missing required check a `HOLD` rather than a successful zero?
