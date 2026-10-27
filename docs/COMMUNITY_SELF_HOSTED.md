# NEXUS Community — localhost-only self-hosted candidate

**Status (2026-10-27):** Docker Desktop/WSL2 Windows image build and localhost runtime were verified on an isolated candidate. Independent native Ubuntu Docker Engine, protected Preview/Production and human accessibility acceptance remain **NOT RUN**. Still DRAFT/NO-GO, not a release. This is not the hosted Cloud/SaaS product.

## Supported scope and prerequisites

- One developer machine, one service, browser on **that same machine only**.
- **Docker Engine 28.0.0 or newer**, with Compose v2 plugin (Linux), or an up-to-date Docker Desktop with Compose (Windows 10/11). Start Docker Desktop before running commands. Check the server version with `docker version`.
- The machine needs enough storage/memory for Docker, Node and the Next.js build; no measured minimum is asserted yet.
- The build uses a pinned official Node 22 Bookworm image index, while the runtime is pinned Google Distroless Node 22 Debian 13 with numeric non-root UID 65532 (no shell or bundled npm). Review and re-pin BOTH approved digests for future security updates; scan the final built image, not only the base.
- The Docker build context is **default-deny**: only the dependency manifests, Next/TypeScript/PostCSS configuration, LICENSE and `src/` / optional `public/` are included. Local untracked files, documentation, scripts and tests are excluded. If a future build needs another asset, explicitly review and add it to `.dockerignore`; do not move credentials into `src/` or `public/`. Source assertions alone do not prove image contents; inspect the actual build before release.
- Internet access to `api.github.com` is required for real repository data. Offline page rendering does not imply offline analysis.
- Only **public repositories** are supported. The application never asks for a GitHub token, private-repo access, Redis key, account registration, or credit card.
- **Docker Desktop is not free for every commercial customer:** its free-use terms cover personal/education/open-source and eligible small businesses (fewer than 250 employees **and** less than USD 10 million annual revenue). Larger enterprises/government may require a paid Docker Desktop subscription. Linux Docker Engine is open-source and has different terms; assess the actual customer's installation and [Docker licensing](https://docs.docker.com/subscription-billing/desktop-license/) before promising a 0-cost deployment. No subscription is purchased or provisioned by this repo.

## First run — Windows PowerShell / Linux terminal

From the project root containing `compose.yaml`:

```sh
docker compose config
docker compose up --build -d
docker compose ps
```

Open **http://127.0.0.1:3000** in a browser on the same computer. Enter a public `owner/repository`. Initial builds need to download a Node image and npm dependencies and can take longer on a first run.

```sh
docker compose logs --tail=80 nexus
docker compose down
```

This is **not** a public endpoint; do not enable router port forwarding, cloud tunnels, LAN access or Docker port mappings to `0.0.0.0`. Container `HOSTNAME=0.0.0.0` listens *inside the isolated container* only; Compose maps it exclusively to host `127.0.0.1`. The runtime uses non-root numeric UID 65532 and drops Linux capabilities. A locally installed app without authentication is **not suitable for public exposure**.

## Check the actual host binding

**Node.js is optional on the Docker host.** A Docker-only user can run the image and inspect HTTP output without installing Node/npm. After Compose reports healthy, test the **host** listener from the same computer using a GET request (not a HEAD-only request).

Linux shell with `curl` installed:

```sh
curl --silent --show-error --include --max-time 5 http://127.0.0.1:3000/
curl --silent --show-error --include --max-time 5 'http://127.0.0.1:3000/api/public-actions?repository=invalid-repo'
```

Windows PowerShell using `curl.exe` (to avoid its `curl` alias):

```powershell
curl.exe --silent --show-error --include --max-time 5 "http://127.0.0.1:3000/"
curl.exe --silent --show-error --include --max-time 5 "http://127.0.0.1:3000/api/public-actions?repository=invalid-repo"
```

Expect **200** for the homepage; malformed repository API requests must produce **400**, `Cache-Control: no-store`, `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff`. Repeat this invalid-input check on `/api/public-prs`, `/api/public-pr-verification`, `/api/public-workflow-evidence`, and `/api/public-workflow-trends`. These checks make **no valid GitHub upstream request**.

If Node.js 22+ is already present on the host, an optional six-request scripted smoke is available without installing npm dependencies:

```sh
node scripts/verify-community-localhost.mjs
# For a deliberately changed host port (e.g., 3001):
node scripts/verify-community-localhost.mjs 3001
```

The automated smoke asserts all five invalid routes and protective headers; it does **not** check the published Docker port or prove Windows/Linux acceptance. See [version identity and release gates](COMMUNITY_VERSIONING_AND_INSTALLATION.md) before selecting any source/tag.

Run `docker compose ps` and verify that the published address reads `127.0.0.1:3000->3000/tcp` (display format varies). To inspect the mapping, use:

```sh
docker compose port nexus 3000
```

Verify it returns `127.0.0.1:3000`. On Linux you can additionally inspect `ss -ltn` to confirm host ports. IMPORTANT: Docker Engine versions **older than 28.0.0** can expose ports published to localhost to other hosts on the same L2 network ([Docker security documentation](https://docs.docker.com/engine/network/port-publishing/)). Do not install this localhost-only candidate on older engines. Custom daemon direct-routing/firewall settings also need independent review. Docker/Windows versions can differ in forwarding behavior; if binding is not loopback-only, **stop with `docker compose down`**, do not use on an untrusted network, and report version/OS without posting secrets.

## Read-only acceptance for an already running container

After starting an existing local Compose installation **and** confirming it has become healthy, run from the project root:

```sh
npm run verify:community:runtime
```

This optional maintainer command requires Node.js 22+ on the host. It runs **only read-only Docker version/config/ps/inspect/port commands and six invalid-repository localhost GET checks**. It never runs `docker compose up`, pulls or builds an image, changes configuration, starts a service, accesses a real GitHub repository or checks Upstash. If the Docker daemon is stopped, the command **fails closed** (nonzero exit status); an offline fixture PASS is not container acceptance.

It verifies Docker Engine 28+, expected Compose service and exact host `127.0.0.1:3000` mapping, a running healthy non-root container, dropped capabilities, no privilege escalation, no unexpected mounts/environment, and the five API validation responses. Any mismatch is a release **NO-GO**. Output is a short PASS/FAIL without dumping Docker-inspected environment variables or other container metadata.

Even a PASS is **not** proof of firewall isolation, external network inaccessibility, image vulnerability scanning, a verified base-image digest, or acceptance on both Windows and Ubuntu. These remain manual, OS-specific release checks in [issue #81](https://github.com/senanurcetin/nexus-devops-intelligence/issues/81).

## Troubleshooting

| Observation | Action |
| --- | --- |
| `docker` or `docker compose` not found | Install/start Docker and its Compose v2 plugin; check `docker compose version`. |
| Cannot access Docker daemon | Start Docker Desktop (Windows) or check Docker daemon/service and local permissions (Linux). |
| Port 3000 already in use | Stop the conflicting service or choose another loopback host port, e.g. `127.0.0.1:3001:3000`, then browse `http://127.0.0.1:3001`. |
| GitHub returns 403/429 | Anonymous GitHub API limits apply; follow the displayed Retry-After where available. Do not insert a token into browser localStorage, URLs, compose, logs or this project's environment. |
| GitHub unavailable/offline | UI may load, but fresh Actions/PR details cannot be retrieved. Missing evidence must not be interpreted as a clean repo. |
| No health / startup error | Inspect `docker compose ps` and `docker compose logs --tail=80 nexus`. Do not post logs without redacting private or sensitive data. |
| Need a clean local restart | `docker compose down` then `docker compose up --build -d`. No application database or persistent volume is created by this package. |

## Developer-only alternative (no Docker)

Requires Node.js >=22.16.0 and npm. From the repo root, run:

```sh
npm ci
npm run typecheck
npm run build
npm run start
```

This is an **unhardened developer fallback**: the default Next.js bind may be reachable outside localhost. Do not use on an untrusted network without independently restricting the listener/firewall. Prefer Compose for a local-only end-user experience.

## Verification / release policy

Static source checks: `npm test` (includes Compose/Docker safety contract); `npm run typecheck`; `npm run build`. Runtime checks require **real Docker**: `docker compose config`, a fresh `docker compose up --build -d`, inspection of non-root runtime user/host port, `curl -i http://127.0.0.1:3000/`, `curl -i 'http://127.0.0.1:3000/api/public-actions?repository=invalid'` (expect 400 and `Cache-Control: no-store`), and manual Windows/Ubuntu browser verification. Do **not** claim those have passed until executed on each target platform.

No SaaS tenant isolation, billing, authentication, telemetry, support SLA, signed installers or GitHub App is included. Past protected Vercel Preview/Production builds are **not** this Community image. Existing Preview human/Redis gates stay open for hosted release.

## 27 October 2026 Windows runtime evidence — NOT a release approval

- The build and verification used a pinned official Node 22 builder image and a pinned Google Distroless Node 22 / Debian 13 non-root runtime image. The runtime contains no shell and no bundled npm CLI; do not attempt shell-based docker exec debugging.
- On an isolated Windows Docker Desktop 4.78.0 / Engine 29.5.3 / Compose 5.1.4 host, the Distroless test image ID was sha256:0f36744daae71b13902277bc86c01471649a13e7c1051d686dd3f03bc4158ce7. The application was healthy on host 127.0.0.1:3000 and the community runtime verifier completed all 6 local HTTP checks, with no valid upstream GitHub requests during this particular image test. Test containers and network were removed.
- Source-local tests: 259/259 passed with controlled test concurrency; TypeScript passed; npm audit returned 0. A first default parallel run experienced an unrelated browser origin subprocess timeout under simultaneous Windows workloads; the isolated browser origin test passed 2/2. Do not conceal this environmental limitation when relying on unattended test automation.
- Independent Trivy 0.76.1 scanner on the actual Distroless app image ID (high+critical vulnerability filter, 27 October 2026 DB): 0 CRITICAL / 0 HIGH, both OS and bundled app packages. This is time-scoped scan evidence, not a guarantee against medium/low findings, unknown vulnerabilities, external code provenance, supply-chain compromise, licensing issues or future CVEs. Re-scan every proposed release.
- On the predecessor Node Bookworm runtime, Trivy had reported 1 CRITICAL / 67 HIGH. The reduced runtime package surface, pinned digest and non-root numeric UID are deliberate safety improvements; avoid reintroducing a shell/npm runtime without a new security review.
- One prior bounded real public GitHub PR read on the preceding, otherwise identical application source returned HTTP 200 and passed restart/health testing. Do not claim that live-read experiment was executed on the later Distroless image until independently repeated.
- Still NO-GO: separate native Ubuntu Docker Engine acceptance; physical-device, Safari/WebKit, NVDA/VoiceOver and owner review; protected exact-SHA Preview, live Free Redis/WAF verification and explicit separate Production authorization. Do not publish a release/tag from this candidate yet.
