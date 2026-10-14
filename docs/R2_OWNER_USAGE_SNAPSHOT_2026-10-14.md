# R2 — Owner-supplied Upstash and Vercel usage screenshots: partial verified evidence

**Date supplied:** 14 October 2026.  
**Project:** `senanurcetin/nexus-devops-intelligence`.  
**Source:** Ten owner-uploaded screenshots across two batches reviewed within the NEXUS development conversation. The screenshots have not been published in the repository. This record stores **only non-secret displayed totals**; it does not contain private API tokens or dashboard links.
**Snapshot caveat:** Screenshots do not contain a reliable explicit UTC capture timestamp for all vendor counters; values are **rounded displays**, not precise underlying API account measurements. Upstash is **current month**, Vercel screenshots use **last 30 days**, whereas the Vercel function consumption may be on its own billing reset period. Do not silently equate their periods.

## 1. Actual Upstash Free database snapshot

| Owner's Upstash database Usage tab | Value displayed | Panel allocation | Interpretation |
| --- | ---: | ---: | --- |
| Commands | **118** | **500,000 / month** | Small current reported command volume, includes any users of this database |
| Bandwidth | **10 KB** | **10 GB** | Rounded display |
| Storage | **0 B** | **250 MB** | Rounded display; the current UI says **250 MB**, not 256 MB |
| Cost | **$0.00** | — | At screenshot time only; not a future guarantee |

The database Settings screenshot also shows primary region **Frankfurt, Germany (eu-central-1)**. It includes additional security and paid-tier options; **none were changed or upgraded**.

**Engineering correction:** Existing offline G02 code used a historical Upstash Free storage cap of **256 MB**. Current owner account display is **250 MB**, so the calculator is updated to use the **more restrictive observed 250 MB ceiling**. Its 80%-of-limit *engineering proposal* therefore evaluates the database at **200 MB** for review, not 204.8 MB. The script still needs all other account fields and a planned request count and never authorizes a deployment on its own.

## 2. Vercel project-specific and whole-team snapshots (Last 30 Days)

| Usage metric | NEXUS project screenshot | Whole-team/general screenshot |
| --- | ---: | ---: |
| Fast Data Transfer | **1.26 MB** | **1.01 GB / 100 GB** |
| Fast Origin Transfer | **270.57 KB** | **157.28 MB / 10 GB** |
| CDN Requests | **195** | **23K** (rounded) |
| ISR Reads | **33** | **642** |
| CDN Request CPU Duration | **0 s** (displayed) | **9 s** |

The general view also displays incoming **31.24 MB**, outgoing **977.2 MB** within Fast Data Transfer; Fast Origin Transfer shows incoming **5.95 MB**, outgoing **151.33 MB**. Those split values are shown in the respective charts and can differ slightly from rounded displayed totals.

**Critical: CDN Requests is not Vercel Function Invocations. CDN Request CPU Duration is not Vercel Active Function CPU. Transfer bytes or ISR Reads are not provisioned function memory GB-hours.** Do not feed any of those substitute counters into `--vercel-invocations`, `--vercel-active-cpu-hours`, or `--vercel-provisioned-memory-gb-hours`.

### Function Invocations follow-up (four owner screenshots, 14 October 2026)

A further four Vercel **Functions → Invocations** screenshots show the **team total of 9,329 / 1,000,000 invocations**. This counter excludes cache hits and is not interchangeable with CDN requests. Its displayed 9,329 requests break down as:

| Filter | Displayed partition | Total |
| --- | --- | ---: |
| Projects | `nexus-devops-intelligence` | **66** |
| Projects | `fraud-project-web` | 2,258 |
| Projects | `visual-qc-project` | 6,513 |
| Projects | `datneta-web-1790467796975-4zzs` (deleted) | 491 |
| Projects | `ops-copilot-developer-demo` | 1 |
| Runtime | `python3.12` | 8,771 |
| Runtime | `nodejs24.x` | 67 |
| Runtime | `edge` | 491 |
| Type | `function` | 8,838 |
| Type | `middleware` | 491 |
| Outcome | Success | 9,320 |
| Outcome | Timeout | 9 |

The project, runtime, type, and outcome partitions independently reconcile with **9,329**. The graph covers approximately 16 September to 14 October; the actual billing-period selector/reset timestamp is **not visible in this screenshot**. “Updated 20 minutes ago” is a relative timestamp, not a reliable UTC observation date. Do not treat these counters as proof of exact period alignment with the earlier Upstash current-month screenshot.

**Free invocation ceiling:** 9,329 is far below the visible 1,000,000 monthly Hobby quota; this **one observed metric** is no longer missing. However, **Active Function CPU hours and Provisioned Memory GB-hours** are separate metrics and still absent. CDN Request CPU Duration (**9 s**, earlier screenshot) is not Active Function CPU usage. Neither missing field is assumed to be zero.

## New Fluid Functions screenshot evidence — 14 October

The team-wide Fluid Active CPU display reads **23m 29s / 4h** (1,409 seconds = **0.391389 CPU-hours**, 9.78% of vendor cap). The NEXUS project uses **8 seconds**. Its project and region breakdowns reconcile to 23m 29s.

The team-wide Fluid Provisioned Memory display reads **2.0 / 360 GB-hours** (0.56% of vendor cap). NEXUS uses **0.01 GB-hours**. Per-project memory numbers are rounded; use the displayed team total for budgeting.

Combining these with the prior owner Usage screenshots gives all **six** G02 metric amounts: Upstash **118 / 500,000 monthly commands**, **0 B / 250 MB storage**, **10 KB / 10 GB bandwidth**; Vercel **9,329 / 1,000,000 invocations**, **23m29s / 4h active CPU**, **2.0 / 360 GB-hours memory**.

**Conditional offline review arithmetic:** at a purely illustrative **25** additional origin requests, the G02 assumption of four additional Redis commands per origin projects **218** Upstash commands and **9,354** team invocations. All six baseline values are below the calculator's conservative 80% review ceilings. This is **not** an agreed traffic budget or actual `capacity:offline` execution: exact vendor UTC snapshot/reset timing and a separately approved Preview origin budget are not recorded. G02 remains **pending formal owner review**; new Preview, Redis load and Production are not authorized.

### Actual G02 offline CLI run — illustrative owner-review scenario

On checked source SHA `0d33b409879a333d3143e499503e48e610e39ffa`,
the **actual** `scripts/check-free-capacity-offline.mjs` command
returned **`READY_FOR_OWNER_REVIEW`** for:
Upstash 118 commands, 0 MB displayed storage, 0.00001 GB displayed
bandwidth; team 9,329 invocations, **0.3913888889 CPU-hours** and
**2.0 GB-hours memory**, with **25 additional origin requests assumed**.

Projected values at that assumed request scope:
Upstash **218 commands vs 400,000 engineering threshold**;
storage **0 vs 200 MB**; bandwidth **0.00001 vs 8 GB**;
Vercel invocations **9,354 vs 800,000**; active CPU
**0.3913889 vs 3.2 hours**; memory **2.0 vs 288 GB-hours**.
All six checks individually reported `withinConservativeReviewCeiling:true`.

**Timestamp qualification:** `--observed-at-utc 2026-10-14T12:11:54Z`
was an **illustrative local timestamp inferred from the screenshot
filename under the assumed Türkiye UTC+3 offset**, not an authoritative
Vercel or Upstash UTC reading. Therefore the tool's success is only
an **engineering scenario**, not validated source-period alignment.
The **25-request count has not been agreed or authorized by the owner**.
Neither the local CLI call nor the screenshot authorizes real Redis
commands, a new protected Preview or Production. The measured usage
evidence can be marked collected; formal G02 release authorization
remains a separate gate.

## 3. Gate outcome

| R2 requirement | Status |
| --- | --- |
| Upstash database monthly commands, storage, bandwidth and displayed cost | **PARTIALLY OBSERVED from account UI**, source period noted, rounded values |
| Whole-team Vercel data/origin transfer, CDN and ISR | **OBSERVED**, last 30 days |
| Whole-team Vercel **Function Invocations** | **OBSERVED: 9,329 / 1,000,000**, including NEXUS project 66; exact reset window not confirmed |
| Whole-team Vercel **Active Function CPU** | **OBSERVED: 23m 29s of 4 hours**; NEXUS 8 seconds |
| Whole-team Vercel **Provisioned Function Memory GB-hours** | **OBSERVED: 2.0 of 360 GB-hours**; NEXUS 0.01 GB-hours |
| Exact UTC snapshot time, Vercel relevant quota reset window and agreed origin-GET budget | **NOT VERIFIED** |
| Combined `capacity:offline` release review | **INCOMPLETE**, cannot legitimately fill unknowns with zero |
| Protected Preview / actual Redis multi-instance / Production authorization | **NOT PROVIDED** |

Upstash appears to have ample visible headroom **for the displayed metrics**. Vercel network traffic also appears far below the two *displayed network transfer limits*. This **does not** establish a Free/zero-cost Vercel Function budget across the entire team or authorize new Preview.

## 4. Remaining owner scope and period confirmation (no more metric screenshots needed)

All six metric totals were supplied, including Functions CPU and
provisioned memory. **No further usage metric screenshot is needed**.
A production/release gate can proceed only after the owner separately
agrees to an exact protected Preview SHA, a finite live origin request
budget, and the relevant provider UTC accounting interval. The 25-request
scenario above is not permission to conduct a Redis limit/stress test.
Even a capacity review pass is **not** Production authorization.

**Reference:** [G02 full checklist](G02_CAPACITY_PREFLIGHT_2026-10-14.md), [R2 management API reader](R2_AUTOMATED_UPSTASH_MANAGEMENT_USAGE_2026-10-14.md), [master remediation plan](NEXUS_MASTER_REMEDIATION_PLAN_2026-10-14.md), [release issue #49](https://github.com/senanurcetin/nexus-devops-intelligence/issues/49).
