import { collectCommitChecks, validateCommitTarget } from './nexus-commit-checks.mjs';

// Independent MCP JSON-RPC entry point: JARVIS can run this stdio server even
// when the optional Next.js dashboard is stopped. Public GitHub GETs only.
const VERSION = '2025-06-18';
const SUPPORTED = new Set([VERSION, '2025-03-26']);
const error = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
const success = (id, result) => ({ jsonrpc: '2.0', id, result });
const asToolResult = (payload, isError) => ({
  content: [{ type: 'text', text: JSON.stringify(payload) }],
  ...(!isError ? { structuredContent: payload } : {}),
  isError,
});

export const COMMIT_CHECKS_MCP_TOOL = {
  name: 'devops_commit_checks',
  title: 'Cross-provider commit checks',
  description: 'Inspect GitHub Actions, Vercel and CircleCI check/status records for a public GitHub commit. ' +
    'Only provider records published to GitHub are visible; no job logs, writes or paid APIs.',
  inputSchema: {
    type: 'object',
    properties: {
      repository: { type: 'string', pattern: '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$', maxLength: 200 },
      sha: { type: 'string', pattern: '^(?:[0-9a-f]{40}|[0-9a-f]{64})$' },
    },
    required: ['repository', 'sha'], additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      schema: { const: 'nexus.devops.commit-checks/v1' },
      repository: { type: 'string' },
      commit_sha: { type: 'string' },
      coverage: { type: 'string' },
      counts: { type: 'object' },
      access: { type: 'object' },
      sources: { type: 'object' },
      items: { type: 'array' },
      attention: { type: 'array' },
    },
    required: ['schema', 'repository', 'commit_sha', 'coverage', 'counts', 'access', 'sources', 'items', 'attention'],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
};

export function createCommitChecksMcpHandler({
  collect = collectCommitChecks,
  now = () => Date.now(),
  cacheTtlMs = 60_000,
  maxRequestsPerHour = 8,
} = {}) {
  const cache = new Map();
  const requests = [];
  const ttl = Math.max(0, Math.min(600_000, cacheTtlMs));
  const budget = Math.max(1, Math.min(20, maxRequestsPerHour));

  return async function handle(message) {
    if (!message || typeof message !== 'object' || Array.isArray(message) ||
        message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
      return error(message?.id, -32600, 'Invalid request');
    }
    if (message.id === undefined || message.id === null) return null; // notification
    const { id, method, params } = message;
    if (method === 'initialize') {
      const asked = params?.protocolVersion;
      return success(id, {
        protocolVersion: SUPPORTED.has(asked) ? asked : VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'nexus-devops-commit-checks', version: '0.1.0' },
      });
    }
    if (method === 'ping') return success(id, {});
    if (method === 'tools/list') return success(id, { tools: [COMMIT_CHECKS_MCP_TOOL] });
    if (method !== 'tools/call') return error(id, -32601, 'Method not found');
    if (params?.name !== COMMIT_CHECKS_MCP_TOOL.name) return error(id, -32602, 'Unknown tool');
    const args = params?.arguments;
    if (!args || typeof args !== 'object' || Array.isArray(args) ||
        Object.keys(args).length !== 2 || !Object.hasOwn(args, 'repository') || !Object.hasOwn(args, 'sha')) {
      return success(id, asToolResult({ error: 'invalid_arguments' }, true));
    }
    try { validateCommitTarget(args.repository, args.sha); }
    catch { return success(id, asToolResult({ error: 'invalid_arguments' }, true)); }

    const tick = now();
    const key = args.repository.toLowerCase() + '@' + args.sha;
    const hit = cache.get(key);
    if (hit && tick >= hit.timestamp && tick - hit.timestamp < ttl) {
      return success(id, asToolResult(hit.payload, false));
    }
    while (requests.length && (tick < requests[0] || tick - requests[0] >= 3_600_000)) requests.shift();
    if (requests.length >= budget) {
      return success(id, asToolResult({
        error: 'github_request_budget_exhausted',
        retry_after_seconds: Math.max(1, Math.ceil((requests[0] + 3_600_000 - tick) / 1000)),
      }, true));
    }
    requests.push(tick);
    try {
      const result = await collect({ repository: args.repository, sha: args.sha });
      const verified = result?.coverage && result.coverage !== 'none';
      if (!result || result.schema !== 'nexus.devops.commit-checks/v1' ||
          result.repository !== args.repository || result.commit_sha !== args.sha ||
          result.access?.mode !== 'read_only' || result.access?.paid_api_used !== false ||
          !Array.isArray(result.access.write_actions) || result.access.write_actions.length > 0) {
        return success(id, asToolResult({ error: 'invalid_upstream_result' }, true));
      }
      if (verified) cache.set(key, { timestamp: tick, payload: result });
      return success(id, asToolResult(result, !verified));
    } catch {
      return success(id, asToolResult({ error: 'github_check_collection_failed' }, true));
    }
  };
}

export async function handleCommitChecksMcpLine(handle, line) {
  if (!line.trim()) return null;
  let parsed;
  try { parsed = JSON.parse(line); }
  catch { return error(null, -32700, 'Parse error'); }
  return handle(parsed);
}
