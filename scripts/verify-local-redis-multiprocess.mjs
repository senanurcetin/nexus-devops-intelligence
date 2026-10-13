/**
 * CI-free, quota-free Redis integration test. RUN MANUALLY ONLY in a disposable sandbox.
 * Runs a *real local* redis6-server, with two separately initialized Next route processes,
 * and a loopback-only REST adapter that maps the unchanged Upstash EVAL into local Redis.
 *
 * No Upstash account credentials are read; no requests go to an external Redis endpoint.
 * This proves local cross-process Redis atomic behavior, NOT Vercel/Upstash cross-instance
 * enforcement in production, edge WAF behavior or Free-tier command usage.
 */
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { fork } from 'node:child_process';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const cli = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = fileURLToPath(import.meta.url);
const REDIS_BINARY = process.env.NEXUS_LOCAL_REDIS_BINARY || 'redis6-server';
const REDIS_CLI = process.env.NEXUS_LOCAL_REDIS_CLI || 'redis6-cli';
const FIXTURE_TOKEN = 'strictly-local-fixture-not-an-upstash-secret';
const FIXTURE_URL = 'https://nexus-test-only.upstash.io';
const LOOPBACK = '127.0.0.1';
const IP_ONE = '198.51.100.71';
const IP_TWO = '198.51.100.72';

const closeServer = server => new Promise(resolve => server.close(resolve));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function freePort() {
  const s = createTcpServer();
  await new Promise((resolve, reject) => s.once('error', reject).listen(0, LOOPBACK, resolve));
  const port = s.address().port;
  await new Promise(resolve => s.close(resolve));
  return port;
}

async function runRedis(port) {
  const child = spawn(REDIS_BINARY, [
    '--bind', LOOPBACK, '--port', String(port), '--save', '',
    '--appendonly', 'no', '--protected-mode', 'yes',
  ], { stdio: 'ignore' });
  let failure;
  child.on('error', err => { failure = err; });
  for (let i = 0; i < 60; i++) {
    if (failure) throw failure;
    try {
      const { stdout } = await cli(REDIS_CLI, ['--raw', '-h', LOOPBACK,
        '-p', String(port), 'PING'], { timeout: 1500 });
      if (stdout.trim() === 'PONG') return child;
    } catch { /* wait for local Redis readiness */ }
    await delay(60);
  }
  child.kill('SIGTERM');
  throw new Error('Local test Redis was not ready; no external fallback attempted');
}

async function redisEval(port, command) {
  assert.ok(Array.isArray(command) && command.length === 5);
  const [verb, script, numkeys, key, seconds] = command;
  assert.equal(verb, 'EVAL');
  assert.equal(numkeys, 1);
  assert.equal(seconds, 60);
  assert.match(key, /^nexus:public-github:ip:[a-f0-9]{64}$/);
  const { stdout } = await cli(REDIS_CLI, [
    '--raw', '-h', LOOPBACK, '-p', String(port), 'EVAL',
    script, '1', key, String(seconds),
  ], { timeout: 2000, maxBuffer: 8192 });
  const lines = stdout.trim().split(/\r?\n/);
  assert.equal(lines.length, 2);
  const numbers = lines.map(Number);
  assert.ok(numbers.every(Number.isSafeInteger));
  return numbers;
}

async function makeBridge(redisPort) {
  let commands = 0;
  const server = createHttpServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/redis' ||
        req.headers.authorization !== 'Bearer ' + FIXTURE_TOKEN) {
      res.writeHead(403).end();
      return;
    }
    let body = '';
    try {
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 4096) throw new Error('Oversized fixture');
      }
      const command = JSON.parse(body);
      const result = await redisEval(redisPort, command);
      commands++;
      res.writeHead(200, { 'content-type': 'application/json',
        'cache-control': 'no-store' });
      res.end(JSON.stringify({ result }));
    } catch {
      res.writeHead(503, { 'content-type': 'application/json' })
        .end('{"error":"local-fixture-failed"}');
    }
  });
  await new Promise((resolve, reject) =>
    server.once('error', reject).listen(0, LOOPBACK, resolve));
  return { server, port: server.address().port, commandCount: () => commands };
}

async function workerMain() {
  const { NextRequest } = await import('next/server');
  const { GET: actionsGET } = await import('../src/app/api/public-actions/route.ts');
  const { GET: prsGET } = await import('../src/app/api/public-prs/route.ts');

  const port = Number(process.env.NEXUS_LOCAL_BRIDGE_PORT);
  if (!Number.isSafeInteger(port) || port < 1) throw new Error('Local bridge is not configured');
  globalThis.fetch = async (input, options) => {
    const target = String(input);
    if (target === FIXTURE_URL) {
      // Intentional local adapter: production source still validates .upstash.io
      // but all test requests terminate at loopback with a synthetic bearer key.
      return fetchLocal('http://' + LOOPBACK + ':' + port + '/redis', options);
    }
    if (target === 'https://api.github.com/repos/owner/example/actions/runs?per_page=10&page=1') {
      return Response.json({ total_count: 0, workflow_runs: [] });
    }
    if (target === 'https://api.github.com/repos/owner/example/pulls?state=open&per_page=6&page=1') {
      return Response.json([]);
    }
    throw new Error('Unexpected network target in offline integration fixture');
  };
  // Capture the *real* global fetch before replacing it with the strict mapper.
  async function fetchLocal(url, options) { return originalFetch(url, options); }
  const originalFetch = globalThis.__nexusOriginalFetch;
  delete globalThis.__nexusOriginalFetch;

  process.on('message', async job => {
    const { id, route, ip } = job;
    try {
      const target = route === 'actions' ? actionsGET : prsGET;
      const path = route === 'actions' ? '/api/public-actions' : '/api/public-prs';
      const request = new NextRequest(
        'http://localhost:3000' + path + '?repository=owner%2Fexample',
        { headers: { 'x-vercel-forwarded-for': ip } });
      const reply = await target(request);
      process.send({
        id, pid: process.pid, status: reply.status,
        mode: reply.headers.get('x-nexus-rate-limit-mode'),
        source: reply.headers.get('x-nexus-rate-limit-source'),
        wait: reply.headers.get('retry-after'),
        noStore: reply.headers.get('cache-control')?.includes('no-store') ?? false,
      });
    } catch {
      process.send({ id, pid: process.pid, error: 'offline-test-route-failed' });
    }
  });
  process.send({ ready: true, pid: process.pid });
}

async function startWorker(bridgePort) {
  const child = fork(SCRIPT, ['--worker'], {
    execArgv: ['--import', 'tsx'],
    cwd: resolve(HERE, '..'),
    env: {
      ...process.env,
      VERCEL: '1',
      UPSTASH_REDIS_REST_URL: FIXTURE_URL,
      UPSTASH_REDIS_REST_TOKEN: FIXTURE_TOKEN,
      NEXUS_LOCAL_BRIDGE_PORT: String(bridgePort),
    },
    stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
  });
  const pending = new Map();
  let readyResolve, readyReject;
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve; readyReject = reject;
  });
  child.on('message', data => {
    if (data.ready) return readyResolve(data.pid);
    const item = pending.get(data.id);
    if (item) { pending.delete(data.id); item.resolve(data); }
  });
  child.on('error', err => { readyReject(err); });
  child.on('exit', code => {
    readyReject(new Error('Offline worker exited before ready: ' + code));
    for (const p of pending.values()) p.reject(new Error('Offline worker exited'));
    pending.clear();
  });
  await ready;
  let nextId = 0;
  return {
    child,
    request(route, ip) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        child.send({ id, route, ip }, err => {
          if (err) { pending.delete(id); reject(err); }
        });
      });
    },
  };
}

async function integrationMain() {
  let redis, bridge;
  const workers = [];
  const watchdog = setTimeout(() => {
    process.stderr.write('Offline Redis verification timed out\n');
    process.exit(1);
  }, 35_000).unref();
  try {
    const redisPort = await freePort();
    redis = await runRedis(redisPort);
    bridge = await makeBridge(redisPort);
    workers.push(await startWorker(bridge.port));
    workers.push(await startWorker(bridge.port));
    assert.notEqual(workers[0].child.pid, workers[1].child.pid);

    // Concurrent admission from separate Node processes and *real* local EVAL.
    const first20 = await Promise.all(Array.from({ length: 20 }, (_, n) =>
      workers[n % 2].request(n % 2 === 0 ? 'actions' : 'prs', IP_ONE)));
    assert.ok(first20.every(r => r.status === 200 &&
      r.mode === 'shared-redis' && !r.error), 'First 20 must all be admitted');
    assert.equal(new Set(first20.map(r => r.pid)).size, 2);

    const blocked = await workers[1].request('prs', IP_ONE);
    assert.equal(blocked.status, 429);
    assert.equal(blocked.source, 'shared-redis');
    assert.equal(blocked.noStore, true);
    assert.ok(Number(blocked.wait) >= 1 && Number(blocked.wait) <= 60);

    const secondIp = await workers[0].request('actions', IP_TWO);
    assert.equal(secondIp.status, 200);
    assert.equal(secondIp.mode, 'shared-redis');
    assert.equal(bridge.commandCount(), 22);

    // Exactly two opaque buckets: one for the 21-count IP, one for a separate IP.
    const { stdout } = await cli(REDIS_CLI, [
      '--raw', '-h', LOOPBACK, '-p', String(redisPort),
      'KEYS', 'nexus:public-github:ip:*',
    ], { timeout: 1200 });
    const keys = stdout.trim().split(/\r?\n/).filter(Boolean);
    assert.equal(keys.length, 2);
    assert.ok(keys.every(k => !k.includes(IP_ONE) && !k.includes(IP_TWO)));
    console.log(JSON.stringify({
      state: 'passed',
      backend: 'real-local-redis6',
      workers: 2,
      independentPids: true,
      first20: 'all-200',
      twentyFirst: '429-shared-redis',
      secondClient: 'allowed',
      localRedisCommands: bridge.commandCount(),
      upstashCommands: 0,
      productionRequests: 0,
      previewRequests: 0,
      liveVercelMultiInstanceVerified: false,
    }));
  } finally {
    clearTimeout(watchdog);
    for (const w of workers) w.child.kill('SIGTERM');
    if (bridge) await closeServer(bridge.server);
    if (redis) redis.kill('SIGTERM');
  }
}

if (process.argv.includes('--worker')) {
  // Capture native fetch before installing the fixture-only mapper.
  globalThis.__nexusOriginalFetch = globalThis.fetch;
  await workerMain();
} else {
  await integrationMain().catch(err => {
    console.error('OFFLINE_REDIS_INTEGRATION_FAILED:', err.message);
    process.exitCode = 1;
  });
}
