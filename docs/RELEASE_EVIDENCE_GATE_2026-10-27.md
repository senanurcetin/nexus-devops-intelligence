# NEXUS Release Evidence Gate — 27 October 2026

Status: **source-only candidate**. This is a read-only, local evidence checker, not a release controller or trusted attestation system. It does not execute tests, install packages, send traffic, contact GitHub/Vercel/Redis, deploy, merge, or authorize payments or releases.

## Usage

From a clean, checked-out Git commit with Node 22+:

```sh
node scripts/verify-release-evidence.mjs --mode source --manifest /path/to/evidence.json
node scripts/verify-release-evidence.mjs --mode self_hosted --manifest /path/to/evidence.json
node scripts/verify-release-evidence.mjs --mode production --manifest /path/to/evidence.json
```

Without explicit arguments the program returns HOLD and exit 3. Missing, failed, invalid or stale receipts also return exit 3. In production mode exit 3 and `release_authorized:false` are **unconditional**; a source-verified or self-hosted evidence-complete result is **not deployment permission**.

Manifest: `{"schema_version":1,"source_sha":"40-lowercase-hex-Git-HEAD","checks":{...}}`. Checks use `{"status":"NOT_RUN"}`, `{"status":"FAIL"}`, or `{"status":"PASS","receipt_path":"receipts/node_tests.json","receipt_sha256":"64-lowercase-hex"}`.

Each PASS receipt is a JSON file with `schema_version:1`, matching `check_id` and `source_sha`, `result:"PASS"`, and `observed_at_utc` in full UTC ISO 8601 millisecond format. Receipts are local self-reported assertions: **hash integrity does not prove the claimed test actually ran**. Future attestation requires authenticated, independently trusted runners and signatures.

The tool checks the Git HEAD and refuses a modified tracked checkout; unknown check IDs, path traversal, symlinks, mismatched hashes, future/stale receipts, oversized documents and missing required checks fail closed. Only bounded outcome codes and check IDs are emitted, never raw receipt/log contents or arbitrary filenames. It does not create any file.

## Stage-specific requirements

- **source:** Node tests, TypeScript, production build, npm audit, local HTTP smoke, JS bundle budget and Chromium/Firefox/WebKit fixture tests.
- **self_hosted:** all source requirements, Windows Docker runtime, an independent **native Ubuntu** Engine runtime, full OS/image CVE scan and container security. Docker Desktop's WSL engine is **not** native Ubuntu acceptance.
- **production:** all previous requirements, exact-SHA SSO Preview, physical/human assistive technology acceptance, independently proven cross-instance Redis control, owner-signed release approval and rollback rehearsal. This CLI always returns NO release authorization.

## Actual unresolved release constraints

As checked 27 October 2026, local Windows Docker Engine 29.5.3 and Compose 5.1.4 are available. Windows local-system WSL fails `WSL_E_LOCAL_SYSTEM_NOT_SUPPORTED`; Ubuntu evidence remains NOT_RUN, not PASS. No complete image/OS CVE report was produced. This does not close Docker PR #80/#81, exact-SHA Preview and human QA #49, shared Redis #7 or separate production authorization.

All repository changes remain reviewable, with no hosted CI, live 21-call Redis probe, production deploy or Jarvis integration. Do not wire this script into a deployment approval workflow without separate source-verifiable and cryptographically authenticated authorization controls.
