import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  createCommitChecksMcpHandler, handleCommitChecksMcpLine, COMMIT_CHECKS_MCP_TOOL,
} from '../src/lib/nexus-commit-checks-mcp.mjs';

const repository = 'owner/example';
const sha = 'b'.repeat(40);
const args = { repository, sha };
const sample = {
  schema: 'nexus.devops.commit-checks/v1', repository, commit_sha: sha,
  coverage: 'both_sources', counts: { failure: 1, pending: 0, success: 2, other: 0 },
  access: { mode: 'read_only', write_actions: [], paid_api_used: false },
  sources: { checks: 'verified', commit_statuses: 'verified' },
  items: [], attention: [],
};
const call = (handle, name, values) => handle({
  jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name, arguments: values },
});

test('MCP tools/list exposes the explicitly read-only cross-provider tool', async () => {
  const handle = createCommitChecksMcpHandler({ collect: async () => sample });
  const init = await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } });
  assert.equal(init.result.protocolVersion, '2025-03-26');
  const listed = await handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.equal(listed.result.tools.length, 1);
  assert.equal(listed.result.tools[0].name, COMMIT_CHECKS_MCP_TOOL.name);
  assert.equal(listed.result.tools[0].annotations.readOnlyHint, true);
  const response = await call(handle, 'devops_commit_checks', args);
  assert.equal(response.result.isError, false);
  assert.deepEqual(response.result.structuredContent, sample);
  assert.equal(JSON.parse(response.result.content[0].text).coverage, 'both_sources');
});

test('invalid argument shapes and unwanted methods never trigger upstream reads', async () => {
  let calls = 0;
  const handle = createCommitChecksMcpHandler({ collect: async () => { calls++; return sample; } });
  for (const input of [{ repository, sha: 'main' }, { repository }, { ...args, extra: true }, null, [], 'bad']) {
    const response = await call(handle, 'devops_commit_checks', input);
    assert.equal(response.result.isError, true);
    assert.equal(response.result.structuredContent, undefined);
  }
  const unknown = await call(handle, 'unknown', args);
  assert.equal(unknown.error.code, -32602);
  assert.equal(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  assert.equal((await handleCommitChecksMcpLine(handle, '{')).error.code, -32700);
  assert.equal(calls, 0);
});

test('cached commit queries do not consume repeated GitHub budgets', async () => {
  let time = 1_800_000;
  let called = 0;
  const handle = createCommitChecksMcpHandler({
    now: () => time, maxRequestsPerHour: 1, cacheTtlMs: 60_000,
    collect: async () => { called++; return sample; },
  });
  assert.equal((await call(handle, 'devops_commit_checks', args)).result.isError, false);
  time += 30_000;
  assert.equal((await call(handle, 'devops_commit_checks', args)).result.isError, false);
  assert.equal(called, 1);
  const other = await call(handle, 'devops_commit_checks', { repository: 'owner/other', sha });
  assert.equal(other.result.isError, true);
  assert.equal(JSON.parse(other.result.content[0].text).error, 'github_request_budget_exhausted');
  assert.equal(called, 1);
  time += 3_700_000;
  // The injected return value is deliberately for another repo, so the contract must reject it.
  const invalid = await call(handle, 'devops_commit_checks', { repository: 'owner/other', sha });
  assert.equal(JSON.parse(invalid.result.content[0].text).error, 'invalid_upstream_result');
  assert.equal(called, 2);
});

test('unavailable or fabricated upstream results do not become successful MCP evidence', async () => {
  const unavailable = createCommitChecksMcpHandler({ collect: async () => ({ ...sample, coverage: 'none' }) });
  const result = await call(unavailable, 'devops_commit_checks', args);
  assert.equal(result.result.isError, true);
  assert.equal('structuredContent' in result.result, false);
  const bad = createCommitChecksMcpHandler({ collect: async () => ({
    ...sample, access: { mode: 'read_write', write_actions: ['merge'], paid_api_used: true },
  }) });
  const denial = await call(bad, 'devops_commit_checks', args);
  assert.equal(JSON.parse(denial.result.content[0].text).error, 'invalid_upstream_result');
});

test('standalone MCP process supports framed stdio even with the dashboard stopped', async () => {
  const child = spawn(process.execPath, ['scripts/jarvis-commit-checks-mcp.mjs'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let received = '';
  child.stdout.on('data', buffer => { received += buffer.toString(); });
  try {
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }) + '\n');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) + '\n');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: { name: 'devops_commit_checks', arguments: { repository, sha: 'invalid' } } }) + '\n');
    child.stdin.end();
    const [code] = await once(child, 'exit');
    assert.equal(code, 0);
    const frames = received.trim().split('\n').map(line => JSON.parse(line));
    assert.deepEqual(frames.map(x => x.id), [1, 2, 3]);
    assert.equal(frames[1].result.tools[0].name, 'devops_commit_checks');
    assert.equal(frames[2].result.isError, true);
  } finally {
    if (child.exitCode === null) child.kill();
  }
});


test('concurrent identical commit reads share one upstream query and one budget slot', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let calls = 0;
  const handle = createCommitChecksMcpHandler({
    maxRequestsPerHour: 1,
    now: () => 3_600_000,
    collect: async () => {
      calls += 1;
      await gate;
      return sample;
    },
  });
  const first = call(handle, 'devops_commit_checks', args);
  const second = call(handle, 'devops_commit_checks', args);
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(calls, 1, 'one outstanding GitHub read per exact commit');
  assert.equal(a.result.isError, false);
  assert.equal(b.result.isError, false, 'coalesced request must not receive budget_exhausted');
  assert.deepEqual(a.result.structuredContent, sample);
  assert.deepEqual(b.result.structuredContent, sample);
  const separate = await call(handle, 'devops_commit_checks', { repository: 'owner/other', sha });
  assert.equal(JSON.parse(separate.result.content[0].text).error, 'github_request_budget_exhausted');
  assert.equal(calls, 1);
});

test('a failed in-flight read does not become reusable successful evidence', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let calls = 0;
  const handle = createCommitChecksMcpHandler({
    maxRequestsPerHour: 2,
    collect: async () => {
      calls += 1;
      await gate;
      throw new Error('synthetic upstream outage');
    },
  });
  const first = call(handle, 'devops_commit_checks', args);
  const second = call(handle, 'devops_commit_checks', args);
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.equal(a.result.isError, true);
  assert.equal(b.result.isError, true);
  assert.equal(JSON.parse(a.result.content[0].text).error, 'github_check_collection_failed');
  assert.equal(JSON.parse(b.result.content[0].text).error, 'github_check_collection_failed');
  const retry = await call(handle, 'devops_commit_checks', args);
  assert.equal(retry.result.isError, true);
  assert.equal(calls, 2, 'failure cleared in-flight state and allows a separately budgeted retry');
});


test('cached requests with repository letter-case aliases retain the exact requested target', async () => {
  let called = 0;
  const handle = createCommitChecksMcpHandler({
    maxRequestsPerHour: 2,
    collect: async ({ repository: requested }) => {
      called++;
      return { ...sample, repository: requested };
    },
  });
  const first = await call(handle, 'devops_commit_checks', { repository: 'Owner/Example', sha });
  const second = await call(handle, 'devops_commit_checks', { repository: 'owner/example', sha });
  assert.equal(first.result.isError, false);
  assert.equal(second.result.isError, false);
  assert.equal(first.result.structuredContent.repository, 'Owner/Example');
  assert.equal(second.result.structuredContent.repository, 'owner/example');
  assert.equal(called, 2, 'distinct request spellings must not share a response with the wrong repository field');
});

test('concurrent repository case aliases do not share a mismatched structured result', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let called = 0;
  const handle = createCommitChecksMcpHandler({
    maxRequestsPerHour: 2,
    collect: async ({ repository: requested }) => {
      called++;
      await gate;
      return { ...sample, repository: requested };
    },
  });
  const first = call(handle, 'devops_commit_checks', { repository: 'Owner/Example', sha });
  const second = call(handle, 'devops_commit_checks', { repository: 'owner/example', sha });
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.result.isError, false);
  assert.equal(b.result.isError, false);
  assert.equal(a.result.structuredContent.repository, 'Owner/Example');
  assert.equal(b.result.structuredContent.repository, 'owner/example');
  assert.equal(called, 2);
});
