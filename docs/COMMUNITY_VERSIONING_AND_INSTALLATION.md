# NEXUS Community — version and installation acceptance

**Status — 18 October 2026: UNRELEASED / NO-GO.** The source manifests currently declare `0.1.0`, but a manifest value is **not** a Git tag, GitHub Release, tested Docker image, or approved installer. No Community release has been published. Draft [PR #80](https://github.com/senanurcetin/nexus-devops-intelligence/pull/80) and [OS acceptance issue #81](https://github.com/senanurcetin/nexus-devops-intelligence/issues/81) remain open. Hosted Vercel Preview/Production approvals are separate.

## Version identity — fail closed

1. For every proposed candidate, record the **full 40-character** Git commit SHA, date, source branch, Node/npm versions, Docker **server** version, Compose version, OS, image digest and test evidence. A floating branch or `nexus-devops-community:local` tag does **not** identify immutable source.
2. Keep `package.json.version`, `package-lock.json.version`, and `package-lock.json.packages[""].version` identical. Use `npm ci` rather than `npm install` for acceptance; no dependency or lockfile mutation is permitted during a release verification run.
3. Use an explicitly identified release candidate and semantic version (an `-alpha.N` prerelease if still experimental) **only after** the candidate passes the required gates. Do not tag or publish an unverified version. The current `0.1.0` is package metadata, **not** evidence of a released `v0.1.0`.
4. Before a future public tag, reconcile the draft branch with the then-current `main`; require a clean reviewable diff, passed exact-SHA source QA, and completed Windows/Ubuntu installation/security acceptance. Obtain explicit release authorization before creating a tag or GitHub Release.
5. For an approved release, write release notes containing the full SHA, image digest and base-image digest, verified systems, known limitations, security checks, the installation procedure and rollback steps. Validate the tag resolves to the **same** reviewed commit. Do not infer verification from an earlier commit's passing tests.

## Reproducible candidate checkout — for reviewers only

The following checkout is for inspecting an **unreleased draft**, not a recommendation to deploy it as a public service:

```sh
git clone https://github.com/senanurcetin/nexus-devops-intelligence.git
cd nexus-devops-intelligence
git fetch origin feat/community-localhost-docker-20261015
git checkout --detach <reviewed-full-40-character-commit-sha>
git rev-parse HEAD
```

Replace the placeholder with the exact full SHA selected for QA; confirm it matches the recorded candidate before any build. Do not use a mutable branch name as the acceptance identity. Run the commands from [the self-hosting instructions](COMMUNITY_SELF_HOSTED.md) only on a trusted local machine, with Docker Engine **28.0.0+** (server), Compose v2 and loopback-only host publishing.

## Local-only acceptance — keep outcomes explicit

| Gate | Required evidence | Current state |
| --- | --- | --- |
| Source identity | Full SHA, version triplet, clean reviewed diff | NOT VERIFIED at a release candidate SHA |
| Dependency/build | `npm ci`, tests, typecheck, Next build, image/base digest | NOT RUN at a signed-off release SHA |
| Docker runtime | `docker compose config`, actual up/health, non-root identity, host `127.0.0.1:3000` publishing | NOT RUN |
| Local HTTP | Homepage 200; five invalid-input API GETs produce 400/no-store with security headers; no upstream GitHub traffic | NOT RUN against built Docker image |
| Windows | Docker Desktop installation, start/stop, safe mapping, browser/error modes | NOT RUN |
| Ubuntu | Docker Engine installation, start/stop, safe mapping, browser/error modes | NOT RUN |
| Publication | Explicit review and release approval; tag and SHA parity | BLOCKED |

**Do not replace any NOT RUN with PASS based on source assertions, a different SHA, or in-container-only probes.** Issue #81 is the acceptance ledger. Avoid GitHub Actions, hosted deployment, Redis stress, paid services, and live traffic outside a separately authorized small public-repository check.

## Docker-only verification and rollback

A Docker user **does not need Node.js/npm installed on the host** to build or run Compose. Check `docker version` (the **Server** section), `docker compose version`, `docker compose config`, `docker compose up --build -d`, `docker compose ps`, `docker compose port nexus 3000`, and `docker compose exec -T nexus id` for actual `uid=1000(node)`. The host binding must be exactly loopback. Keep the port on 3000 unless you intentionally change the Compose mapping and test the new value.

From the **same host**, use the platform's HTTP client; inspect statuses and headers without supplying valid repositories:

```sh
# Linux shell (requires curl; no host Node.js/npm needed):
curl --silent --show-error --include --max-time 5 http://127.0.0.1:3000/
curl --silent --show-error --include --max-time 5 'http://127.0.0.1:3000/api/public-actions?repository=invalid-repo'
```

```powershell
# Windows PowerShell (curl.exe, not the PowerShell "curl" alias):
curl.exe --silent --show-error --include --max-time 5 "http://127.0.0.1:3000/"
curl.exe --silent --show-error --include --max-time 5 "http://127.0.0.1:3000/api/public-actions?repository=invalid-repo"
```

Expect 200 at the homepage; expect 400, `Cache-Control: no-store`, `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff` for malformed repository requests. Repeat the invalid-request check for all five routes listed in [the self-hosting guide](COMMUNITY_SELF_HOSTED.md). Optional automated six-request source smoke is `node scripts/verify-community-localhost.mjs` on a host that **already has Node 22+**; its local-only mock tests do not establish actual Docker safety.

If binding is not loopback-only, Docker Server is older than 28, identity is unexpectedly root, or responses are unsafe, immediately `docker compose down`, record FAIL and do **not** expose the port. The image is local/dev-only; an approved tagged version would need a separately tested digest and rollback recipe.