# Community Docker — exact-image vulnerability evidence (27 October 2026)

## Verification scope

This checkpoint applies to the **Windows Docker Engine 29.5.3** test environment only. It is not independent Ubuntu acceptance or permission to release. All tests are local and no paid, hosted or customer deployment occurred.

- Docker candidate source at scan time: `d0986464d576b026340dbf5288844763e516e8e8`.
- Built image identity: `sha256:097178142520d5fdf068dee14a0da3c51a6d438a3cbb82c0ddbc8c057c01b399`.
- Pinned, locally cached Distroless Debian 13 Node.js 22 base image identity: `sha256:10747a1323be68f206aed893599d43e6697ad67257e7c42703553f99fbce3d33`.
- Scanner: Aqua Trivy 0.76.1 Windows binary verified against official published SHA-256 checksums; vulnerability DB downloaded 27 October 2026. Read-only local Docker image scans.
- Built image report (JSON) SHA-256: `f6ca51b9a603c61db796c972ee1c81fce0b4a43a6129b8c19a8174cb758f08cc`.
- Pinned base report (JSON) SHA-256: `4aa7134865d72d0e969e6fd4f84e95a3032e063f364df3d75aa242d98caf86c2`.
- Reports reside locally in `C:\NEXUS-AI\_devops-security-scan-20261027`, not committed to the public repository. SHA-256 values are evidence integrity checks, not signatures or independent attestations.

## Findings — do not treat scan completion as clearance

| Finding | Pinned base | NEXUS runtime |
| --- | ---: | ---: |
| CRITICAL | 0 | 0 |
| HIGH | 0 | 0 |
| MEDIUM OS package records | 23 | 23 |
| LOW OS package records | 8 | 8 |
| Distinct OS CVE identifiers | 25 | 25 |
| Node package vulnerability records | 0 | 0 |

The **31 OS records are identical** across base and NEXUS (vulnerability ID, package name, installed version and severity; zero differing records). This shows no *additional* OS findings in the scanned application image. It **does not remove inherited risk**. Trivy supplied no `FixedVersion` for these records as of the scan; that does not prove a fix cannot ever exist. Debian version and vulnerability feed must be reassessed before release.

## Repeatable report admission, no approval

From the same source branch, with Node.js 22+:

```sh
node scripts/verify-community-vulnerability-report.mjs --report "C:/path/to/trivy-report.json" --image-id "sha256:<64-lowercase-hex>" --sha256 "<report-file-sha256>"
```

This utility makes **zero network calls**. It requires a bounded regular JSON file (no symlinks), matching full report SHA-256, exact image SHA-256 identity, Trivy schema/version, Debian 13 OS results **and** Node.js package results, a scan created within 72 hours, and recognized vulnerability record types. A mismatched identity, stale/incomplete scan, tampered file or unknown finding is fail-closed. It returns either `BLOCKED` (HIGH/CRITICAL/UNKNOWN) or `REVIEW_REQUIRED`; `release_authorized` is always false and its CLI always exits 3. No "PASS" is issued by this check.

**Required risk-disposition work before close/release:** security owner to examine CVE reachability/exposure and compensating controls, remediate with a re-pinned base image when verified fixes are available or document time-bounded explicit acceptance; repeat scan on the **new exact image** and record the signed decision. Independent native Ubuntu Engine 28+ acceptance, Preview, Redis and human device checks remain separate gates.

No private tokens, Docker login, Upstash quota stress, remote CI or external deployment are required by this verification procedure.
