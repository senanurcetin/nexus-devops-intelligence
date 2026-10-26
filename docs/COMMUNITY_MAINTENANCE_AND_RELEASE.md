# Community maintenance, reproducible installation and release playbook

**State:** DRAFT MANUAL PROCESS — **NO-GO** as of 18 October 2026. No Docker installer is present in `main`; it is proposed by [draft PR #80](https://github.com/senanurcetin/nexus-devops-intelligence/pull/80). The commands below are a **future acceptance protocol**, not a transcript of executed commands. An older Vercel deployment is not a local Community release.

## 1. Preparation and immutable identity

- Read [release decision](NEXUS_COMMUNITY_RELEASE_DECISION_2026-10-18.md), [#81 acceptance checklist](https://github.com/senanurcetin/nexus-devops-intelligence/issues/81), [security policy](../SECURITY.md), [architecture](architecture.md) and [contribution guide](../CONTRIBUTING.md).
- Work only on a local clone on a developer-controlled Windows or Ubuntu machine with a checked Docker daemon and adequate free storage. Host Docker Desktop/Engine usage and licenses remain the machine owner's responsibility.
- Confirm exact **full 40-character** SHA of proposed merged candidate. Do **not** assume that `main`, `latest`, `0.1.0`, a previous Preview or `nexus-devops-community:local` refers to that source. Replace the placeholder below only with a recorded reviewed SHA.

```bash
git clone https://github.com/senanurcetin/nexus-devops-intelligence.git
cd nexus-devops-intelligence
git fetch origin
git checkout --detach <APPROVED_40_CHAR_COMMIT_SHA>
git rev-parse HEAD
git status --short
node --version
npm --version
docker version
docker compose version
```

**Do not run** Docker commands on the present `main` until a reviewed Docker candidate has actually merged. For proposed #80 only, a local checkout of that **draft** SHA may be used for isolated development QA, not as a public release.

## 2. Reproducible source checks

Use isolated local tools, no hosted GitHub Actions or paid pipeline. Store terminal output as sanitized local evidence with SHA, start/end, OS, exit code and installed versions. Distinguish real failures from unavailable tools and never auto-commit generated lockfiles.

```bash
npm ci
node -e "const p=require('./package.json');const l=require('./package-lock.json');if(p.version!==l.version||p.version!==l.packages[''].version)process.exit(1)"
npm test
npm run typecheck
npm run build
npm audit --omit=dev
npm audit
```

**Lint gap:** At the 18 Oct audited `main`, `package.json` has **no `lint` script**. Do not run or document `npm run lint` as a passing command. Add an approved zero/low-cost repo-owned lint/format configuration in a separately reviewed change or produce explicit formatter/linter command evidence that is compatible with existing code. Avoid unreviewed `npx` installs that silently change dependency versions. Typecheck alone is not a lint run.

**Dependency/security gating:** A historical npm-audit pass is not a current pass. An audit requires registry access; if offline report **NOT RUN**, do not assert zero vulnerabilities. Run secret-scanning or static patterns only against a disposable working tree without printing suspected secrets to logs. Never load Upstash/Vercel credentials.

## 3. Docker candidate acceptance (only after checkout of the source that contains Docker files)

```bash
docker compose config
docker compose build --no-cache
docker compose up -d
docker compose ps
docker compose port nexus 3000
docker compose logs --tail=100 nexus
```

- The **host** published address must be `127.0.0.1:3000`; check using `docker compose port`, host socket/firewall inspection, and a bounded local request. Docker `HOSTNAME=0.0.0.0` inside the container is acceptable only because host publishing remains loopback-restricted.
- Check runtime UID, security options and actual mounts. YAML `USER node`, `cap_drop: ALL`, `no-new-privileges` and `.dockerignore` do not prove runtime behavior or exclude secrets in built layers.
- Inspect image identity/digest and the pinned base image digest selected after security review; do not promote an image based on a floating base image tag alone.
- The first smoke must use local invalid repository parameters, causing **no external GitHub API calls**. Use the script in #80 if present: `npm run smoke:community:localhost`; or run host-side requests below. For Windows PowerShell use `curl.exe`, not the PowerShell `curl` alias.

```bash
curl -i --max-time 5 http://127.0.0.1:3000/
curl -i --max-time 5 'http://127.0.0.1:3000/api/public-actions?repository=invalid-repo'
curl -i --max-time 5 'http://127.0.0.1:3000/api/public-prs?repository=invalid-repo'
curl -i --max-time 5 'http://127.0.0.1:3000/api/public-pr-verification?repository=invalid-repo'
curl -i --max-time 5 'http://127.0.0.1:3000/api/public-workflow-evidence?repository=invalid-repo'
curl -i --max-time 5 'http://127.0.0.1:3000/api/public-workflow-trends?repository=invalid-repo'
```

Expected outcomes **to verify**, not already observed: homepage `200`; five invalid-repository responses `400`, `Cache-Control: no-store`; security headers `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff`. If different, STOP and troubleshoot. Browser check must exercise keyboard navigation/one actual public repository only with explicit request budget and distinguish `403`/rate-limit, network error, empty data, stale data and genuine success.

After a successful session, record the `docker compose config` output stripped of any sensitive values, build logs, ports, image sha256 digest, all test exit statuses and whether machine is Windows/Ubuntu. **Do not paste tokens or user data into public issues.**

## 4. Shutdown, rollback and recovery

```bash
docker compose down
docker compose ps
```

The proposed #80 Compose file does not mount a persistence volume and is an anonymous, single-host read-only dashboard; no database migration/recovery is expected. Still avoid asserting data persistence or making promises about browser-cached information. A `docker compose down` stops containers; Docker images can remain on the host.

Before any upgrade, record the **previous tested 40-char SHA and local image digest**, keep the prior image if rollback is needed, and ensure no external listeners. Rollback **only on developer-controlled local Community host**, never Vercel Production:

1. `docker compose down` and confirm the process/port is stopped.
2. `git checkout --detach <LAST_VERIFIED_40_CHAR_SHA>`; verify `git rev-parse HEAD`.
3. Run `docker compose config && docker compose build --no-cache && docker compose up -d` on that known candidate source; if it has no Compose files, **STOP** rather than inventing an installer.
4. Rerun host-port, invalid API, health and nonroot checks; record restoration or **FAILED** with true SHA/digest.
5. Report any outage or dangerous exposure through [SECURITY.md](../SECURITY.md) privately if appropriate. Do not delete customer logs without a separate retention agreement.

Vercel rollback must follow the entirely separate [existing protected hosted runbook](NEXUS_MANUAL_RELEASE_RUNBOOK_2026-10-14.md) with explicit owner approval and exact deployment IDs. Never call a local Docker rebuild a Vercel rollback.

## 5. Release/version and changelog rules

1. **Before tagging** verify license file remains MIT, intended version in package/lock files agrees, source is buildable with `npm ci`, tested Docker base pinned to an approved digest, image digest known, and Windows/Ubuntu acceptance has signed-off evidence.
2. Use a new prerelease tag such as `v0.1.0-alpha.1` only **after** approval. This is a *suggested naming convention*, not a created tag or released version; current `0.1.0` package metadata is not the release.
3. Update `CHANGELOG.md` at the **actual release candidate** after reconciling the separate draft #80 changelog entry. Do not duplicate its unmerged `Unreleased — 18 October` section on `main` while #80 is still draft.
4. For release notes, state: exact source SHA, tag, built image sha256 digest/base sha256, supported OS versions, installation and rollback links, test exit status and CI/manual provenance, security limitations, unsupported features, and link to issue #81. Mark any partial OS coverage prominently.
5. Publish a GitHub Release or image **only with explicit release authorization**. No latest/auto-updater, image registry push, npm publish, Production/Preview deploy, Cloud/Redis test or external telemetry is part of this playbook.

## 6. Human operations and maintenance ownership

| Cadence / trigger | Maintenance work | Evidence |
| --- | --- | --- |
| Before each candidate | Compare new `main` and #80/#82 heads; verify SHA, licenses, dependency and template conflicts | Diff and changed files |
| Monthly or after security advisory | Review lockfile and pinned Node/Next image advisories without automatic upgrades | Source advisory links, reviewed patch/test result |
| Every accepted code PR | Unit tests, TypeScript/build, targeted route and security regression, scope/review checks | Exact SHA and exit codes |
| Before any public release | Windows + Ubuntu clean-install acceptance and rollback rehearsal | Recorded environment, sanitized logs, digest |
| After voluntary feedback | Triage private security, reproducible bug reports and feature requests without collecting tokens | Redacted issue URL and explicit owner/priority |
| Before a paid installation promise | Check [commercial issue #85](https://github.com/senanurcetin/nexus-devops-intelligence/issues/85), customer scope/support SLA and rights to use MIT software; no payment claim without real fulfillment | Reviewed scope and quote |

## 7. Reusable, currently blank release receipt

```text
Source SHA (40 chars): UNKNOWN
Tag (if actually published): NONE VERIFIED
OS/architecture: NOT RUN
Node/npm: NOT RUN
Docker Engine/Compose: NOT RUN
npm ci: NOT RUN
npm test: NOT RUN
Lint: NOT CONFIGURED/NOT RUN
Typecheck/build: NOT RUN
npm audit prod/full: NOT RUN
Compose config/image/loopback/nonroot: NOT RUN
Home + 5 invalid API smoke: NOT RUN
Image digest/SBOM/vulnerability scan: NOT RUN
Windows + Ubuntu installations: NOT RUN
Actual user downloads/installations: UNKNOWN
Approval: NOT GRANTED
Release decision: NO-GO
```

See [first contributor onboarding](COMMUNITY_FIRST_CONTRIBUTION.md) and the [source-based decision ledger](NEXUS_COMMUNITY_RELEASE_DECISION_2026-10-18.md).
