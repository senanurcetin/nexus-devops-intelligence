# Local acceptance evidence audit

This read-only audit examines the **saved** NEXUS DevOps Windows acceptance report and four local logs. It **does not** run a build, launch a service, connect to the internet, alter a Git checkout or authorize a release.

## Verify an existing local acceptance

From the primary checkout or any isolated NEXUS DevOps worktree, with Python 3.11+:

```powershell
python -B scripts\audit-local-acceptance.py  --repo C:\NEXUS-AI\nexus-devops-intelligence  --report C:\NEXUS-AI\runtime\devops-automation\acceptance\acceptance-4d748e6178de-20261103T192000292363Z.json
```

The command reads Git HEAD and working-tree status from `--repo`. It validates the report's exact SHA, timestamp, successful build/HTTP/MCP result codes, cleanup flags, absence of the old lock/worktree and the following evidence:

- Bounded, regular, nonsymlink report and log files with exact expected names and paths.
- A Next.js build log containing completion and route summaries.
- Sixteen HTTP passes, ten JARVIS MCP passes, and the same localhost port in the server and MCP logs.
- SHA-256 of the report, build log, HTTP log, MCP log and temporary server log.

Outputs include `evidence_consistent`, `current_sha_matches`, `local_acceptance_gate`, `issues`, hashes and a non-negotiable `release_authorized: false`. `LOCAL_ACCEPTED` (exit 0) requires consistency **and** the clean current checkout having the same 40-character SHA as the report. An older but otherwise consistent report returns `HOLD` (exit 3) when checked against a newer commit. Failed, unreadable or tampered evidence also returns `HOLD`.

These hashes are calculated on demand. They are **not authenticated timestamps, signatures or independent attestation**, and are not sufficient to approve a deployment. Any new tracked code commit changes the exact SHA and requires a new real build and acceptance to claim current local acceptance.

## Release evidence still required

The independent `verify-release-evidence.mjs` gate remains separate. Its **source** phase calls for nine categories: Node tests, typecheck evidence, production build, npm audit, local HTTP smoke, bundle budget and Chromium/Firefox/WebKit fixture tests. A local acceptance report supports the build and HTTP/MCP subset but does not by itself satisfy all nine or provide the separate receipts required by that gate. Those receipts are themselves self-reported, not signed attestation. Missing steps remain `NOT_RUN`/`HOLD`, not `PASS`.

The **self-hosted** phase also requires independent Windows/native Ubuntu Docker runtime checks, image CVE and container security evidence. **Production** further requires exact-SHA protected preview, human accessibility, independent Redis proof, owner release authorization and rollback evidence. This audit does not change those requirements. Keep disabled services off until expressly authorized.

## Regression tests

```powershell
python -B tests\test_audit_local_acceptance.py
node --test tests\release-evidence-policy.test.mjs
```

Scope: local evidence consistency only. It does not re-run or prove the authenticity of the historical acceptance itself.
