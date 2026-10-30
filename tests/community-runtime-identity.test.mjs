import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyComposeConfig, verifyRuntimeInspection, verifyCommunityRuntime }
  from '../scripts/verify-community-runtime.mjs';

const probe = "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.status === 200 ? 0 : 1)).catch(() => process.exit(1))";
const healthcheck = ['CMD', '/nodejs/bin/node', '-e', probe];
const containerId = 'c'.repeat(64);
const compose = {
  services: { nexus: {
    image: 'nexus-devops-community:local',
    build: { context: process.cwd(), dockerfile: 'Dockerfile' },
    init: true, healthcheck: { test: healthcheck },
    ports: [{ host_ip: '127.0.0.1', target: 3000, published: '3000' }],
    read_only: true, cap_drop: ['ALL'], security_opt: ['no-new-privileges:true'],
    environment: { NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
  } },
};
const runtime = {
  State: { Running: true, Health: { Status: 'healthy' } },
  Config: {
    Image: 'nexus-devops-community:local', Cmd: ['server.js'],
    Healthcheck: { Test: healthcheck },
    User: '65532',
    Env: ['PATH=/bin', 'NODE_ENV=production', 'NEXT_TELEMETRY_DISABLED=1'],
  },
  HostConfig: {
    Init: true, Privileged: false, ReadonlyRootfs: true, NetworkMode: 'nexus_default',
    CapDrop: ['ALL'], SecurityOpt: ['no-new-privileges:true'],
    PortBindings: { '3000/tcp': [{ HostIp: '127.0.0.1', HostPort: '3000' }] },
  },
  NetworkSettings: { Ports: { '3000/tcp': [{ HostIp: '127.0.0.1', HostPort: '3000' }] } },
  Mounts: [],
};
const clone = value => structuredClone(value);

test('approved image, healthcheck, command and init still pass structural inspection', () => {
  assert.equal(verifyComposeConfig(clone(compose)), true);
  assert.equal(verifyRuntimeInspection(clone(runtime)), true);
});

test('Compose rejects disabled/spoofed healthcheck and disabled init', () => {
  for (const change of [
    service => { service.init = false; },
    service => { delete service.init; },
    service => { service.healthcheck = { test: ['CMD', 'true'] }; },
    service => { service.healthcheck = { disable: true }; },
    service => { delete service.healthcheck; },
  ]) {
    const doc = clone(compose);
    change(doc.services.nexus);
    assert.throws(() => verifyComposeConfig(doc));
  }
});

test('Docker inspect rejects stale image, unexpected command, or forged healthcheck', () => {
  for (const change of [
    inspected => { inspected.Config.Image = 'other-image:latest'; },
    inspected => { delete inspected.Config.Image; },
    inspected => { inspected.Config.Cmd = ['evil.js']; },
    inspected => { inspected.Config.Cmd = ['server.js', '--unsafe']; },
    inspected => { inspected.Config.Healthcheck = { Test: ['CMD', 'true'] }; },
    inspected => { delete inspected.Config.Healthcheck; },
    inspected => { inspected.HostConfig.Init = false; },
    inspected => { delete inspected.HostConfig.Init; },
  ]) {
    const inspected = clone(runtime);
    change(inspected);
    assert.throws(() => verifyRuntimeInspection(inspected));
  }
});

test('spoofed Compose healthcheck fails before inspecting the container or HTTP', async () => {
  const doc = clone(compose);
  doc.services.nexus.healthcheck.test = ['CMD', 'true'];
  const calls = [];
  const docker = args => {
    calls.push(args);
    if (args[0] === 'version') return '28.5.0';
    if (args.includes('config')) return JSON.stringify(doc);
    throw Error('unexpected Docker command');
  };
  let http = 0;
  await assert.rejects(verifyCommunityRuntime({
    docker, fetchImpl: () => { http++; },
  }), /healthcheck/);
  assert.equal(calls.length, 2);
  assert.equal(http, 0);
});

test('spoofed running command fails before port and HTTP probes', async () => {
  const inspected = clone(runtime);
  inspected.Config.Cmd = ['evil.js'];
  const calls = [];
  const docker = args => {
    calls.push(args);
    if (args[0] === 'version') return '28.5.0';
    if (args.includes('config')) return JSON.stringify(compose);
    if (args.includes('ps')) return containerId;
    if (args[0] === 'inspect') return JSON.stringify(inspected);
    throw Error('unexpected Docker command');
  };
  let http = 0;
  await assert.rejects(verifyCommunityRuntime({
    docker, fetchImpl: () => { http++; },
  }), /command/);
  assert.equal(calls.length, 4);
  assert.equal(http, 0);
});
