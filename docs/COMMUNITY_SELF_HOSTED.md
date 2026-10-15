# NEXUS Community — localhost-only self-hosted candidate

**Status (2026-10-15):** Source-level Docker/Compose packaging candidate. Docker image build, Compose runtime, real Windows and Ubuntu acceptance have **NOT RUN** in the authoring environment; do not label this a verified release. This is not the hosted Cloud/SaaS product.

## Supported scope and prerequisites

- One developer machine, one service, browser on **that same machine only**.
- **Docker Engine 28.0.0 or newer**, with Compose v2 plugin (Linux), or an up-to-date Docker Desktop with Compose (Windows 10/11). Start Docker Desktop before running commands. Check the server version with `docker version`.
- The machine needs enough storage/memory for Docker, Node and the Next.js build; no measured minimum is asserted yet.
- The Docker base image follows the maintained Node 22 LTS patch channel; for a tagged release, verify a fresh image and pin an approved image digest with supply-chain checks.
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

This is **not** a public endpoint; do not enable router port forwarding, cloud tunnels, LAN access or Docker port mappings to `0.0.0.0`. Container `HOSTNAME=0.0.0.0` listens *inside the isolated container* only; Compose maps it exclusively to host `127.0.0.1`. The runtime has a non-root `node` user and drops Linux capabilities. A locally installed app without authentication is **not suitable for public exposure**.

## Check the actual host binding

Run the safe, **invalid-input-only** offline-upstream smoke from the checked-out repository after Compose reports healthy:

```sh
npm run smoke:community:localhost
# Optional if the host loopback mapping is changed to port 3001:
node scripts/verify-community-localhost.mjs 3001
```

This script contacts **127.0.0.1 only**: it checks the homepage and five intentionally invalid GitHub repo API requests, asserting 400/no-store and protective headers. No valid upstream GitHub request, credential or shared Redis probe is generated. It is not a substitute for actually checking the published Docker port or live data functionality.

Run `docker compose ps` and verify that the published address reads `127.0.0.1:3000->3000/tcp` (display format varies). To inspect the mapping, use:

```sh
docker compose port nexus 3000
```

Verify it returns `127.0.0.1:3000`. On Linux you can additionally inspect `ss -ltn` to confirm host ports. IMPORTANT: Docker Engine versions **older than 28.0.0** can expose ports published to localhost to other hosts on the same L2 network ([Docker security documentation](https://docs.docker.com/engine/network/port-publishing/)). Do not install this localhost-only candidate on older engines. Custom daemon direct-routing/firewall settings also need independent review. Docker/Windows versions can differ in forwarding behavior; if binding is not loopback-only, **stop with `docker compose down`**, do not use on an untrusted network, and report version/OS without posting secrets.

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
