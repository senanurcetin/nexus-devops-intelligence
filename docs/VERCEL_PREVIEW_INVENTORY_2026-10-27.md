# NEXUS DevOps — Vercel Preview SHA drift (27 October 2026)

**Status:** Read-only Vercel inventory; NOT an authenticated live acceptance or release approval.

Authenticated Vercel project/deployment metadata were inspected without deploying, modifying credentials, requesting the protected application URL, or invoking Redis.

| Environment | Deployment ID | GitHub commit | Vercel status |
| --- | --- | --- | --- |
| Protected Preview (older) | `dpl_9sq98XLM2DZAgyBFZoFVUde2NucT` | `2b5fb7c379bd1f939f3b50f286edfb868ddb386a` | READY |
| Production (existing) | `dpl_9fXGATNHhyhNVrN1i47k3BU4u5K5` | `74cd0e344eb94255b4bc8db99e4a4dc7f3a5a0bf` | READY |

- **Source main baseline at inspection:** `04fb91c411d4a2995d8b70cc9b0f8acfb41b1ad6`.
- **Release-gate candidate PR #96:** different, unmerged SHA, and therefore also not on the deployed Preview.
- Project ID `prj_sbU4ylt4OV4fLkcog3VpSr2fEXYe`; SSO protection setting `enabled:true`, `deploymentType:all_except_custom_domains`. This is a project configuration observation. It is **not** evidence of a real authenticated browser session or of enforcement on every custom domain.
- Historical observations do not satisfy G04 exact-source authenticated F01–F05, human VoiceOver/NVDA, G06 independent shared-Redis origin enforcement, or separate G07 Production approval.

## Offline inventory comparator

`scripts/verify-preview-inventory.mjs` accepts an **operator-provided metadata snapshot** and compares it with the clean local Git HEAD, expected project ID, repository, deployment target, READY state and project SSO setting. It **never** calls Vercel/GitHub/Redis, runs a load test, creates a deployment or opens the protected URL.

```sh
node scripts/verify-preview-inventory.mjs --snapshot ./private-inventory.json --project-id prj_sbU4ylt4OV4fLkcog3VpSr2fEXYe
```

Snapshot schema (illustrative; not an authenticated Vercel receipt):

```json
{
  "schema_version": 1,
  "observed_at_utc": "2026-10-27T19:55:00.000Z",
  "project": {
    "id": "prj_sbU4ylt4OV4fLkcog3VpSr2fEXYe",
    "name": "nexus-devops-intelligence",
    "ssoProtection": { "enabled": true, "deploymentType": "all_except_custom_domains" }
  },
  "preview": {
    "id": "dpl_9sq98XLM2DZAgyBFZoFVUde2NucT",
    "state": "READY",
    "target": null,
    "project": { "id": "prj_sbU4ylt4OV4fLkcog3VpSr2fEXYe" },
    "meta": {
      "githubCommitSha": "2b5fb7c379bd1f939f3b50f286edfb868ddb386a",
      "githubCommitRef": "main",
      "githubOrg": "senanurcetin",
      "githubRepo": "nexus-devops-intelligence"
    }
  }
}
```

Do not include credentials, source URLs, tokens, cookies, or account-private metadata in the snapshot. The CLI output is constrained to source SHA, deployment ID, boolean status and explicit `NOT_VERIFIED` gates.

- Stale/mismatched SHA -> **HOLD** `preview_source_sha_drift`.
- Even when SHA matches and the recorded SSO setting is enabled -> **HOLD** `source_aligned_but_live_acceptance_required`.
- No data or source tampering can turn the CLI into approval: `release_authorized:false`, exit code **3** in all cases.
- Snapshot data is self-supplied and **not signed or independently authenticated**. A fake snapshot is not an attestation.

## Next authorized acceptance prerequisites

The owner must separately authorize any new protected Preview creation. Once an exact-SHA Preview exists, G04 needs authenticated owner/browser evidence for all F01–F05 functions and data-source conditions. G06 needs two proven separate function-instance identities, attributed shared Redis admission and explicit current Free-budget approval for any actual live 21-request probe. G05 physical Safari/VoiceOver/NVDA remains independent. Do not deploy, promote, roll back, activate CI or spend money from this document.
