import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseEngineVersion, verifyComposeConfig, verifyRuntimeInspection,
  verifyCommunityRuntime,
} from '../scripts/verify-community-runtime.mjs';

const id = 'c'.repeat(64);
const compose = {
  services: {
    nexus: {
      ports: [{ host_ip: '127.0.0.1', target: 3000, published: '3000' }],
      read_only: true,
      cap_drop: ['ALL'],
      security_opt: ['no-new-privileges:true'],
      environment: { NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
    },
  },
};
const inspection = {
  State: { Running: true, Health: { Status: 'healthy' } },
  Config: { User: 'node', Env: [
    'PATH=/usr/local/sbin:/usr/local/bin',
    'NODE_VERSION=22.18.0', 'YARN_VERSION=1.22.22',
    'HOSTNAME=0.0.0.0', 'PORT=3000',
    'NODE_ENV=production', 'NEXT_TELEMETRY_DISABLED=1',
  ] },
  HostConfig: {
    Privileged: false, ReadonlyRootfs: true, NetworkMode: 'nexus_default',
    CapDrop: ['ALL'], SecurityOpt: ['no-new-privileges:true'],
    PortBindings: { '3000/tcp': [{ HostIp: '127.0.0.1', HostPort: '3000' }] },
  },
  NetworkSettings: { Ports: { '3000/tcp': [{ HostIp: '127.0.0.1', HostPort: '3000' }] } },
  Mounts: [],
};
const clone = value => structuredClone(value);
function fixtures({ engine = '28.5.0', config = compose, container = inspection,
  port = '127.0.0.1:3000', containerId = id } = {}) {
  const calls = [];
  const docker = args => {
    calls.push(args);
    const line = args.join(' ');
    if (line === 'version --format {{.Server.Version}}') return engine;
    if (line === 'compose -f compose.yaml config --format json') return JSON.stringify(config);
    if (line === 'compose -f compose.yaml ps -q nexus') return containerId;
    if (line === 'inspect --format {{json .}} ' + id) return JSON.stringify(container);
    if (line === 'compose -f compose.yaml port nexus 3000') return port;
    throw new Error('Unexpected Docker command: ' + line);
  };
  let fetches = 0;
  const fetchImpl = async url => {
    fetches++;
    assert.match(url, /^http:\/\/127\.0\.0\.1:3000\//);
    const target = new URL(url);
    const isHome = target.pathname === '/';
    if (!isHome) assert.equal(target.searchParams.get('repository'), 'invalid-repo');
    return {
      status: isHome ? 200 : 400,
      headers: new Headers({
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
        'cache-control': 'no-store',
      }),
    };
  };
  return { docker, fetchImpl, calls, getFetches: () => fetches };
}

test('read-only container acceptance checks an existing healthy container and six local HTTP responses', async () => {
  const fake = fixtures();
  assert.deepEqual(await verifyCommunityRuntime(fake), {
    engine: '28.5.0', checks: 6, localhostOnly: true,
  });
  assert.equal(fake.getFetches(), 6);
  assert.deepEqual(fake.calls.map(args => args[0]),
    ['version', 'compose', 'compose', 'inspect', 'compose']);
  const source = readFileSync('scripts/verify-community-runtime.mjs', 'utf8');
  assert.doesNotMatch(source, /['"](?:up|build|pull|start|restart|down|push|create)['"]/);
});

test('Engine 27 and unverifiable engine versions stop before any inspection or HTTP request', async () => {
  for (const engine of ['27.9.9', 'unknown', '', '28', 'v28.0.0', '28.0.0\n29.0.0']) {
    const f = fixtures({ engine });
    await assert.rejects(verifyCommunityRuntime(f));
    assert.equal(f.calls.length, 1);
    assert.equal(f.getFetches(), 0);
  }
  assert.equal(parseEngineVersion('28.0.0'), '28.0.0');
});

test('Compose rejects public port, extra services, credentials and privilege escalation before inspect', async () => {
  const cases = [
    x => { x.services.nexus.ports[0].host_ip = '0.0.0.0'; },
    x => { x.services.nexus.ports.push({ host_ip: '::', target: 3000, published: 3000 }); },
    x => { x.services.nexus.ports[0].published = 8080; },
    x => { x.services.sidecar = {}; },
    x => { x.services.nexus.volumes = ['/root:/data']; },
    x => { x.services.nexus.privileged = true; },
    x => { x.services.nexus.read_only = false; },
    x => { x.services.nexus.cap_drop = []; },
    x => { x.services.nexus.environment.GITHUB_TOKEN = 'not-a-real-token'; },
  ];
  for (const mutate of cases) {
    const config = clone(compose);
    mutate(config);
    const fake = fixtures({ config });
    await assert.rejects(verifyCommunityRuntime(fake));
    assert.equal(fake.calls.length, 2);
    assert.equal(fake.getFetches(), 0);
  }
  assert.equal(verifyComposeConfig(compose), true);
});

test('invalid/multiple IDs never reach Docker inspect', async () => {
  for (const containerId of ['not-an-id', '', id + '\n' + id, 'a'.repeat(65)]) {
    const f = fixtures({ containerId });
    await assert.rejects(verifyCommunityRuntime(f));
    assert.equal(f.calls.length, 3);
    assert.equal(f.getFetches(), 0);
  }
});

test('container runtime refuses unexpected ports, root, unsafe security settings and secrets', async () => {
  const cases = [
    x => { x.State.Running = false; },
    x => { x.State.Health.Status = 'starting'; },
    x => { x.Config.User = 'root'; },
    x => { x.Config.User = ''; },
    x => { x.HostConfig.Privileged = true; },
    x => { x.HostConfig.ReadonlyRootfs = false; },
    x => { x.HostConfig.NetworkMode = 'host'; },
    x => { x.HostConfig.CapDrop = []; },
    x => { x.HostConfig.SecurityOpt = []; },
    x => { x.HostConfig.Binds = ['/private:/private']; },
    x => { x.Mounts = [{ Source: '/home/secret', Destination: '/app/secrets' }]; },
    x => { x.HostConfig.PortBindings['3000/tcp'][0].HostIp = '0.0.0.0'; },
    x => { x.NetworkSettings.Ports['3000/tcp'][0].HostIp = '::'; },
    x => { x.HostConfig.PortBindings['9999/tcp'] = [{ HostIp:'127.0.0.1', HostPort: '9999' }]; },
    x => { x.Config.Env.push('GH_TOKEN=mock'); },
    x => { x.Config.Env.push('NODE_ENV=development'); },
  ];
  for (const mutate of cases) {
    const container = clone(inspection);
    mutate(container);
    const f = fixtures({ container });
    await assert.rejects(verifyCommunityRuntime(f));
    assert.equal(f.getFetches(), 0);
  }
  assert.equal(verifyRuntimeInspection(inspection), true);
});

test('runtime rejects a different Compose port before local HTTP probes', async () => {
  for (const port of ['0.0.0.0:3000', '192.168.1.20:3000', '[::]:3000', '127.0.0.1:3000\n127.0.0.1:3001']) {
    const f = fixtures({ port });
    await assert.rejects(verifyCommunityRuntime(f));
    assert.equal(f.getFetches(), 0);
  }
});

test('invalid local HTTP results never produce a successful runtime acceptance', async () => {
  const f = fixtures();
  await assert.rejects(verifyCommunityRuntime({
    docker: f.docker,
    fetchImpl: async url => ({
      status: url.endsWith('/') ? 200 : 503,
      headers: new Headers({ 'x-frame-options': 'DENY', 'x-content-type-options': 'nosniff' }),
    }),
  }));
});

test('distroless UID 65532 with CA bundle path remains accepted but root remains denied', () => {
  const container = clone(inspection);
  container.Config.User = '65532';
  container.Config.Env.push('SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt');
  assert.equal(verifyRuntimeInspection(container), true);
  container.Config.User = '0';
  assert.throws(() => verifyRuntimeInspection(container));
});
