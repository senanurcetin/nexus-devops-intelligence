// Daily health card (gap request NG-19): GitHub Actions + open PRs + stale branches + optional free-infrastructure
// checks (Oracle A1 heartbeat, Kaggle quota, provider quotas, Neon usage). Every source is optional: not configured,
// unreadable or malformed => status "unknown" with a reason, never a guess. All I/O is injected (no network in tests).
import { githubGet, loadPublicActions, loadPublicPulls, type GitHubFetcher } from './github-public-client.ts';
import { parsePublicRepository } from './github-public-actions.ts';

export const HEALTH_CARD_SCHEMA = 'nexus.devops.health-card/v1';
export type Status = 'ok' | 'warn' | 'critical' | 'unknown';
export type CheckResult = { id: string; label: string; status: Status; detail: string };

/** A source is a local file path or an http(s) URL. Anything else is treated as unconfigured. */
export type SourceSpec = string | undefined;
export type HealthSources = {
  oracleHeartbeat?: SourceSpec; kaggleQuota?: SourceSpec; providerQuota?: SourceSpec; neonUsage?: SourceSpec;
};
export type SourceReader = (spec: string) => Promise<{ text: string; mtime?: Date }>;

export function healthSourcesFromEnv(env: Record<string, string | undefined>): HealthSources {
  const v = (k: string) => (env[k] && env[k]!.trim() ? env[k]!.trim() : undefined);
  return {
    oracleHeartbeat: v('NEXUS_DEVOPS_HEALTH_ORACLE_HEARTBEAT'), kaggleQuota: v('NEXUS_DEVOPS_HEALTH_KAGGLE_QUOTA'),
    providerQuota: v('NEXUS_DEVOPS_HEALTH_PROVIDER_QUOTA'), neonUsage: v('NEXUS_DEVOPS_HEALTH_NEON_USAGE'),
  };
}

const unknown = (id: string, label: string, detail: string): CheckResult => ({ id, label, status: 'unknown', detail });
const worst = (statuses: Status[]): Status =>
  statuses.includes('critical') ? 'critical' : statuses.includes('warn') ? 'warn' : statuses.includes('ok') ? 'ok' : 'unknown';

/** used/limit ratio -> status. 75% warns, 90% is critical. Invalid numbers are unknown. */
export function quotaStatus(used: unknown, limit: unknown): { status: Status; pct: number | null } {
  if (typeof used !== 'number' || typeof limit !== 'number' || !Number.isFinite(used) || !Number.isFinite(limit) ||
      limit <= 0 || used < 0) return { status: 'unknown', pct: null };
  const pct = Math.round((used / limit) * 1000) / 10;
  return { status: pct >= 90 ? 'critical' : pct >= 75 ? 'warn' : 'ok', pct };
}

async function load(spec: SourceSpec, read: SourceReader): Promise<{ text: string; mtime?: Date } | string> {
  if (!spec) return 'not configured';
  try { return await read(spec); } catch { return 'source unreadable'; }
}
function parseJson(text: string): unknown { try { return JSON.parse(text); } catch { return undefined; } }
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export async function checkOracleHeartbeat(spec: SourceSpec, read: SourceReader, now: Date, maxAgeMinutes = 15): Promise<CheckResult> {
  const id = 'oracle_a1', label = 'Oracle A1 heartbeat';
  const src = await load(spec, read);
  if (typeof src === 'string') return unknown(id, label, src);
  const body = parseJson(src.text);
  const raw = isObj(body) ? body.ts ?? body.timestamp : src.text.trim().split(/\r?\n/)[0];
  const parsed = typeof raw === 'string' ? Date.parse(raw) : NaN;
  const when = Number.isNaN(parsed) ? src.mtime?.getTime() : parsed; // plain "touch" heartbeat files use mtime
  if (when === undefined || Number.isNaN(when)) return unknown(id, label, 'no timestamp in heartbeat');
  const ageMin = Math.max(0, Math.round((now.getTime() - when) / 60000));
  const status: Status = ageMin <= maxAgeMinutes ? 'ok' : ageMin <= maxAgeMinutes * 4 ? 'warn' : 'critical';
  return { id, label, status, detail: `last heartbeat ${ageMin} min ago (max ${maxAgeMinutes})` };
}

export async function checkKaggleQuota(spec: SourceSpec, read: SourceReader): Promise<CheckResult> {
  const id = 'kaggle_quota', label = 'Kaggle GPU quota';
  const src = await load(spec, read);
  if (typeof src === 'string') return unknown(id, label, src);
  const b = parseJson(src.text);
  if (!isObj(b)) return unknown(id, label, 'malformed quota JSON');
  const q = quotaStatus(b.gpu_hours_used, b.gpu_hours_limit ?? 30);
  return q.pct === null ? unknown(id, label, 'quota fields missing or invalid')
    : { id, label, status: q.status, detail: `${b.gpu_hours_used}/${b.gpu_hours_limit ?? 30} GPU h (${q.pct}%)` };
}

/** Accepts {providers:[{name,used,limit}]} or {name:{used,limit}}. Overall status is the worst provider. */
export async function checkProviderQuota(spec: SourceSpec, read: SourceReader): Promise<CheckResult> {
  const id = 'provider_quota', label = 'LLM provider quotas';
  const src = await load(spec, read);
  if (typeof src === 'string') return unknown(id, label, src);
  const b = parseJson(src.text);
  let entries: Array<[string, unknown, unknown]> = [];
  if (isObj(b) && Array.isArray(b.providers)) {
    entries = b.providers.filter(isObj).map(p => [String(p.name ?? '?'), p.used, p.limit]);
  } else if (isObj(b)) {
    entries = Object.entries(b).filter(([, v]) => isObj(v)).map(([k, v]) => [k, (v as Record<string, unknown>).used, (v as Record<string, unknown>).limit]);
  }
  if (entries.length === 0) return unknown(id, label, 'no providers in quota JSON');
  const results = entries.map(([name, used, limit]) => ({ name: name.slice(0, 40), ...quotaStatus(used, limit) }));
  const known = results.filter(r => r.status !== 'unknown');
  if (known.length === 0) return unknown(id, label, 'provider quota values invalid');
  const detail = results.map(r => `${r.name} ${r.pct === null ? '?' : r.pct + '%'}`).join(', ');
  return { id, label, status: worst(known.map(r => r.status)), detail };
}

export async function checkNeonUsage(spec: SourceSpec, read: SourceReader): Promise<CheckResult> {
  const id = 'neon_usage', label = 'Neon usage';
  const src = await load(spec, read);
  if (typeof src === 'string') return unknown(id, label, src);
  const b = parseJson(src.text);
  if (!isObj(b)) return unknown(id, label, 'malformed usage JSON');
  const parts = [
    { name: 'storage GB', ...quotaStatus(b.storage_gb_used, b.storage_gb_limit ?? 0.5), u: b.storage_gb_used, l: b.storage_gb_limit ?? 0.5 },
    { name: 'compute h', ...quotaStatus(b.compute_hours_used, b.compute_hours_limit ?? 100), u: b.compute_hours_used, l: b.compute_hours_limit ?? 100 },
  ].filter(p => p.status !== 'unknown');
  if (parts.length === 0) return unknown(id, label, 'usage fields missing or invalid');
  return { id, label, status: worst(parts.map(p => p.status)), detail: parts.map(p => `${p.name} ${p.u}/${p.l} (${p.pct}%)`).join(', ') };
}

async function repoSection(repository: string, fetcher: GitHubFetcher, now: Date, staleDays: number): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  const actions = await loadPublicActions(repository, fetcher);
  if (actions.status === 200 && 'failed_runs' in actions.body) {
    const a = actions.body;
    out.push({ id: 'actions', label: 'GitHub Actions', status: a.failed_runs > 0 ? (a.failed_runs >= 3 ? 'critical' : 'warn') : 'ok',
      detail: `${a.failed_runs} failed / ${a.pending_runs} pending / ${a.successful_runs} ok of last ${a.inspected_runs} runs` });
  } else out.push(unknown('actions', 'GitHub Actions', 'GitHub unavailable'));
  const pulls = await loadPublicPulls(repository, fetcher);
  if (pulls.status === 200 && 'conflicts' in pulls.body) {
    const p = pulls.body;
    out.push({ id: 'open_prs', label: 'Open pull requests', status: p.conflicts > 0 ? 'warn' : 'ok',
      detail: `${p.inspected_prs}${p.more_open_prs ? '+' : ''} open, ${p.needs_attention} need attention, ${p.conflicts} conflicts` });
  } else out.push(unknown('open_prs', 'Open pull requests', 'GitHub unavailable'));
  out.push(await staleBranches(repository, fetcher, now, staleDays));
  return out;
}

/** One list GET plus at most 10 commit GETs. Default branch and protected branches are never "stale". */
async function staleBranches(repository: string, fetcher: GitHubFetcher, now: Date, staleDays: number): Promise<CheckResult> {
  const id = 'stale_branches', label = 'Stale branches';
  let owner: string, name: string;
  try { [owner, name] = parsePublicRepository(repository); } catch { return unknown(id, label, 'invalid repository'); }
  const base = `https://api.github.com/repos/${owner}/${name}`;
  const list = await githubGet(`${base}/branches?per_page=30`, fetcher);
  if (list.kind !== 'ok' || !Array.isArray(list.data)) return unknown(id, label, 'GitHub unavailable');
  const candidates = (list.data as Array<{ name?: unknown; protected?: unknown; commit?: { sha?: unknown } }>)
    .filter(b => typeof b.name === 'string' && b.protected !== true && typeof b.commit?.sha === 'string' &&
      /^[a-f0-9]{40}$/.test(b.commit.sha as string) && !['main', 'master', 'trunk'].includes(b.name as string));
  const checked = candidates.slice(0, 10);
  let stale = 0, resolved = 0;
  for (const b of checked) {
    const c = await githubGet(`${base}/commits/${b.commit!.sha}`, fetcher);
    const date = c.kind === 'ok' ? (c.data as { commit?: { committer?: { date?: unknown } } })?.commit?.committer?.date : undefined;
    const t = typeof date === 'string' ? Date.parse(date) : NaN;
    if (Number.isNaN(t)) continue;
    resolved++;
    if (now.getTime() - t > staleDays * 86400000) stale++;
  }
  if (checked.length > 0 && resolved === 0) return unknown(id, label, 'branch dates unavailable');
  const more = candidates.length > checked.length ? ` (checked ${checked.length} of ${candidates.length})` : '';
  return { id, label, status: stale > 0 ? 'warn' : 'ok', detail: `${stale} branches older than ${staleDays} days${more}` };
}

export type HealthCard = {
  schema: typeof HEALTH_CARD_SCHEMA; generated_at: string; repository: string | null;
  overall: Status; unknown_count: number; checks: CheckResult[]; text: string;
};

export type HealthInput = {
  repository?: string; sources: HealthSources; read: SourceReader; fetcher?: GitHubFetcher; now: Date; staleDays?: number;
};

export async function buildHealthCard(input: HealthInput): Promise<HealthCard> {
  const checks: CheckResult[] = [];
  if (input.repository && input.fetcher) checks.push(...await repoSection(input.repository, input.fetcher, input.now, input.staleDays ?? 30));
  else for (const [id, label] of [['actions', 'GitHub Actions'], ['open_prs', 'Open pull requests'], ['stale_branches', 'Stale branches']])
    checks.push(unknown(id, label, input.repository ? 'GitHub checks skipped (offline)' : 'no repository configured'));
  checks.push(
    await checkOracleHeartbeat(input.sources.oracleHeartbeat, input.read, input.now),
    await checkKaggleQuota(input.sources.kaggleQuota, input.read),
    await checkProviderQuota(input.sources.providerQuota, input.read),
    await checkNeonUsage(input.sources.neonUsage, input.read),
  );
  const overall = worst(checks.map(c => c.status));
  const icon: Record<Status, string> = { ok: 'OK', warn: 'WARN', critical: 'CRIT', unknown: 'UNKNOWN' };
  const text = [`NEXUS health ${input.now.toISOString().slice(0, 10)}: ${icon[overall]}`,
    ...checks.map(c => `- [${icon[c.status]}] ${c.label}: ${c.detail}`)].join('\n');
  return { schema: HEALTH_CARD_SCHEMA, generated_at: input.now.toISOString(), repository: input.repository ?? null, overall,
    unknown_count: checks.filter(c => c.status === 'unknown').length, checks, text };
}
