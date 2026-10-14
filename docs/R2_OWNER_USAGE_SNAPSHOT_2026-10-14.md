# R2 — Owner-supplied Upstash and Vercel usage screenshots: partial verified evidence

**Date supplied:** 14 October 2026.  
**Project:** `senanurcetin/nexus-devops-intelligence`.  
**Source:** Six owner-uploaded screenshots reviewed within the NEXUS development conversation. The screenshots have not been published in the repository. This record stores **only non-secret displayed totals**; it does not contain private API tokens or dashboard links.
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

## 3. Gate outcome

| R2 requirement | Status |
| --- | --- |
| Upstash database monthly commands, storage, bandwidth and displayed cost | **PARTIALLY OBSERVED from account UI**, source period noted, rounded values |
| Whole-team Vercel data/origin transfer, CDN and ISR | **OBSERVED**, last 30 days |
| Whole-team Vercel **Function Invocations** | **MISSING** |
| Whole-team Vercel **Active Function CPU** | **MISSING** |
| Whole-team Vercel **Provisioned Function Memory GB-hours** | **MISSING** |
| Exact UTC snapshot time, Vercel relevant quota reset window and agreed origin-GET budget | **NOT VERIFIED** |
| Combined `capacity:offline` release review | **INCOMPLETE**, cannot legitimately fill unknowns with zero |
| Protected Preview / actual Redis multi-instance / Production authorization | **NOT PROVIDED** |

Upstash appears to have ample visible headroom **for the displayed metrics**. Vercel network traffic also appears far below the two *displayed network transfer limits*. This **does not** establish a Free/zero-cost Vercel Function budget across the entire team or authorize new Preview.

## 4. One remaining screenshot to reduce burden

In the **same Vercel team's Usage tab** (not the individual NEXUS project), leave project filter at **All Projects**, select the current usage/billing period, then scroll/search the page for **Function Invocations**, **Active CPU** and **Provisioned Memory**. One or more screenshots showing the three readings and the period will suffice. No API keys, finance data, personal email, log token, Redis details or paid plan are needed. Do not enable Observability Plus, a paid WAF, or any plan upgrade. The existing connected Vercel billing API returned `404 costs_not_found`, which was **not** zero usage; team Observability advanced metrics have paid-tier requirements.

When received, use the **actual function** totals, exact period and planned origin-GET count together with the currently supplied Upstash readings (subject to data freshness and alignment) in `npm run capacity:offline` for **READY_FOR_OWNER_REVIEW / HOLD / INCOMPLETE**. Even a READY review remains **not Preview or Production deployment authorization**.

**Reference:** [G02 full checklist](G02_CAPACITY_PREFLIGHT_2026-10-14.md), [R2 management API reader](R2_AUTOMATED_UPSTASH_MANAGEMENT_USAGE_2026-10-14.md), [master remediation plan](NEXUS_MASTER_REMEDIATION_PLAN_2026-10-14.md), [release issue #49](https://github.com/senanurcetin/nexus-devops-intelligence/issues/49).
