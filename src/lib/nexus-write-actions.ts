// Approval-gated GitHub write actions (gap request NG-19). Default OFF. Never acts without a verified, unspent
// approval token (see nexus-approval-token.ts). All GitHub I/O goes through an injected fetcher, so tests use no network.
import { ApprovalRefused, consumeApprovalToken, payloadHash, type ApprovalClaims, type UsedTokenStore } from './nexus-approval-token.ts';

export const WRITE_ACTION_NAMES = ['rerun_workflow', 'open_issue', 'label_pr'] as const;
export type WriteActionName = (typeof WRITE_ACTION_NAMES)[number];

export type WriteRefusal =
  | 'writes_disabled' | 'action_not_enabled' | 'unknown_action' | 'invalid_params' | 'repository_not_allowed'
  | 'github_token_missing' | 'github_error';

export class WriteActionRefused extends Error {
  readonly reason: WriteRefusal | ApprovalRefused['reason'];
  constructor(reason: WriteRefusal | ApprovalRefused['reason']) { super(reason); this.name = 'WriteActionRefused'; this.reason = reason; }
}

export type WriteConfig = {
  enabled: boolean; // NEXUS_DEVOPS_WRITE_ACTIONS=1 (default off)
  allowedActions: ReadonlySet<string>; // NEXUS_DEVOPS_WRITE_ALLOW (comma list; empty = none)
  allowedRepositories: ReadonlySet<string>; // NEXUS_DEVOPS_WRITE_REPOS (comma list owner/repo; empty = none)
  githubToken: string | undefined; // NEXUS_DEVOPS_GITHUB_WRITE_TOKEN (never logged, never returned)
  approvalSecret: string | undefined; // NEXUS_DEVOPS_APPROVAL_SECRET (>= 32 chars)
};

const list = (v: string | undefined) => new Set((v ?? '').split(',').map(s => s.trim()).filter(Boolean));

export function writeConfigFromEnv(env: Record<string, string | undefined>): WriteConfig {
  return {
    enabled: env.NEXUS_DEVOPS_WRITE_ACTIONS === '1',
    allowedActions: list(env.NEXUS_DEVOPS_WRITE_ALLOW),
    allowedRepositories: list(env.NEXUS_DEVOPS_WRITE_REPOS),
    githubToken: env.NEXUS_DEVOPS_GITHUB_WRITE_TOKEN || undefined,
    approvalSecret: env.NEXUS_DEVOPS_APPROVAL_SECRET || undefined,
  };
}

const REPO = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const LABEL = /^[^\u0000-\u001f\u007f,]{1,50}$/;
const bad = (): never => { throw new WriteActionRefused('invalid_params'); };
const str = (v: unknown, max: number, min = 1): string =>
  typeof v === 'string' && v.length >= min && v.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v) ? v : bad();
const posInt = (v: unknown): number => (typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? v : bad());
function labels(v: unknown, min: number): string[] {
  if (v === undefined && min === 0) return [];
  if (!Array.isArray(v) || v.length < min || v.length > 10) return bad();
  return v.map(x => (typeof x === 'string' && LABEL.test(x) ? x : bad()));
}
function repository(v: unknown): string {
  if (typeof v !== 'string' || !REPO.test(v) || v.split('/').some(p => p === '.' || p === '..')) return bad();
  return v;
}

export type ActionPayload = { action: WriteActionName; params: Record<string, string | number | string[]> };
export type PlannedAction = {
  payload: ActionPayload;
  payload_hash: string; // sha256(canonical_json(payload)) == jarvis approvals.store.payload_hash(payload)
  summary: string; // short, redacted-safe text for the Telegram approval card
  request: { method: 'POST'; url: string; body: Record<string, unknown> | null };
};

/** Validate + normalise. Pure, no network, no token needed: Jarvis calls this to build the approval request. */
export function planWriteAction(action: unknown, rawParams: unknown): PlannedAction {
  if (typeof action !== 'string' || !(WRITE_ACTION_NAMES as readonly string[]).includes(action)) throw new WriteActionRefused('unknown_action');
  if (!rawParams || typeof rawParams !== 'object' || Array.isArray(rawParams)) return bad();
  const p = rawParams as Record<string, unknown>;
  const allowedKeys: Record<WriteActionName, string[]> = {
    rerun_workflow: ['repository', 'run_id'],
    open_issue: ['repository', 'title', 'body', 'labels'],
    label_pr: ['repository', 'pr_number', 'labels'],
  };
  if (Object.keys(p).some(k => !allowedKeys[action as WriteActionName].includes(k))) return bad();
  const repo = repository(p.repository);
  const api = `https://api.github.com/repos/${repo}`;
  if (action === 'rerun_workflow') {
    const run = posInt(p.run_id);
    return plan('rerun_workflow', { repository: repo, run_id: run }, `Re-run failed jobs of run ${run} in ${repo}`,
      `${api}/actions/runs/${run}/rerun-failed-jobs`, null);
  }
  if (action === 'open_issue') {
    const title = str(p.title, 256);
    const body = p.body === undefined ? '' : str(p.body, 5000, 0);
    const ls = labels(p.labels, 0);
    return plan('open_issue', { repository: repo, title, body, labels: ls }, `Open issue "${title.slice(0, 80)}" in ${repo}`,
      `${api}/issues`, { title, body, labels: ls });
  }
  const pr = posInt(p.pr_number);
  const ls = labels(p.labels, 1);
  return plan('label_pr', { repository: repo, pr_number: pr, labels: ls }, `Add labels [${ls.join(', ')}] to PR ${pr} in ${repo}`,
    `${api}/issues/${pr}/labels`, { labels: ls });
}

function plan(action: WriteActionName, params: ActionPayload['params'], summary: string, url: string,
  body: Record<string, unknown> | null): PlannedAction {
  const payload: ActionPayload = { action, params };
  return { payload, payload_hash: payloadHash(payload), summary, request: { method: 'POST', url, body } };
}

export type WriteFetcher = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }) =>
  Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export type WriteResult = { ok: true; action: WriteActionName; status: number; grant: string; github: { html_url?: string; number?: number } };

export type ExecuteInput = {
  action: unknown; params: unknown; token: unknown;
  config: WriteConfig; usedTokens: UsedTokenStore; fetcher: WriteFetcher; now?: Date;
};

/**
 * Order matters and every step fails closed:
 * 1 feature flag  2 action allow-list  3 params validation + repo allow-list  4 token verify (signature, window,
 * action, payload hash)  5 burn the token (single use)  6 GitHub token present  7 the one write.
 * A failure after step 5 leaves the token burned on purpose (same burn-first rule as the Jarvis spend journal).
 */
export async function executeWriteAction(input: ExecuteInput): Promise<WriteResult> {
  const { config } = input;
  if (!config.enabled) throw new WriteActionRefused('writes_disabled');
  const planned = planWriteAction(input.action, input.params);
  if (!config.allowedActions.has(planned.payload.action)) throw new WriteActionRefused('action_not_enabled');
  if (!config.allowedRepositories.has(String(planned.payload.params.repository))) throw new WriteActionRefused('repository_not_allowed');
  if (!config.githubToken) throw new WriteActionRefused('github_token_missing'); // checked before burning: no waste
  let claims: ApprovalClaims;
  try {
    claims = consumeApprovalToken({ token: input.token, secret: config.approvalSecret, action: planned.payload.action,
      payload: planned.payload, now: input.now ?? new Date() }, input.usedTokens);
  } catch (error) {
    if (error instanceof ApprovalRefused) throw new WriteActionRefused(error.reason);
    throw new WriteActionRefused('bad_claims');
  }
  let response: Awaited<ReturnType<WriteFetcher>>;
  try {
    response = await input.fetcher(planned.request.url, {
      method: planned.request.method,
      headers: {
        Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'nexus-devops-intelligence-write', Authorization: `Bearer ${config.githubToken}`,
        ...(planned.request.body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(planned.request.body ? { body: JSON.stringify(planned.request.body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
  } catch { throw new WriteActionRefused('github_error'); }
  if (!response.ok) throw new WriteActionRefused('github_error');
  let data: { html_url?: unknown; number?: unknown } = {};
  try { data = ((await response.json()) ?? {}) as typeof data; } catch { /* 201/204 may have no JSON */ }
  return {
    ok: true, action: planned.payload.action, status: response.status, grant: claims.jti,
    github: {
      ...(typeof data.html_url === 'string' && data.html_url.startsWith('https://github.com/') ? { html_url: data.html_url } : {}),
      ...(typeof data.number === 'number' ? { number: data.number } : {}),
    },
  };
}
