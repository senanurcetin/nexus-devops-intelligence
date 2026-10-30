import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/verify-jarvis-mcp.mjs', import.meta.url));

function run(args) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [script, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { out += d; });
    child.on('close', code => resolve({ code, out }));
  });
}

function fakeService(status) {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => { res.statusCode = status; res.end('ok'); });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

test('jarvis:verify passes against a healthy loopback service and makes no GitHub request', async () => {
  const server = await fakeService(200);
  try {
    const { code, out } = await run(['--base-url', 'http://127.0.0.1:' + server.address().port]);
    assert.equal(code, 0, out);
    assert.match(out, /RESULT=PASS \(10 checks/);
    assert.match(out, /no GitHub request/);
  } finally { server.close(); }
});

test('jarvis:verify fails when the local service is unhealthy', async () => {
  const server = await fakeService(503);
  try {
    const { code, out } = await run(['--base-url', 'http://127.0.0.1:' + server.address().port]);
    assert.equal(code, 1, out);
    assert.match(out, /FAIL devops_health/);
  } finally { server.close(); }
});

test('jarvis:verify refuses a non-loopback base URL and a malformed repository flag', async () => {
  const remote = await run(['--base-url', 'http://example.com']);
  assert.equal(remote.code, 1, remote.out);
  assert.match(remote.out, /literal-loopback/);
  const bad = await run(['--repository', 'x;y']);
  assert.equal(bad.code, 2, bad.out);
});
