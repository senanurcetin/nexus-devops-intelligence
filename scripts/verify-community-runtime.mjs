#!/usr/bin/env node
/**
 * Opt-in, READ-ONLY acceptance for an ALREADY RUNNING NEXUS Community
 * Docker container. Never builds, starts, pulls, restarts or changes it.
 * Does not touch GitHub/Redis: HTTP probes use only invalid repository IDs.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { verifyCommunityLocalhost } from './verify-community-localhost.mjs';

const COMPOSE_FILE = 'compose.yaml';
const EXPECTED_ENV = new Set([
  'PATH', 'NODE_VERSION', 'YARN_VERSION', 'SSL_CERT_FILE', 'NODE_ENV',
  'NEXT_TELEMETRY_DISABLED', 'HOSTNAME', 'PORT',
]);

export function parseEngineVersion(raw) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+][A-Za-z0-9_.-]+)?$/.exec(String(raw).trim());
  if (!match || !match.slice(1, 4).every(v => Number.isSafeInteger(Number(v)))) {
    throw new Error('Unable to verify the Docker Engine version.');
  }
  const major = Number(match[1]);
  assert.ok(major >= 28, 'Docker Engine 28.0.0+ is required for localhost port security.');
  return match[0];
}

export function verifyComposeConfig(doc) {
  assert.ok(doc && typeof doc === 'object', 'Invalid Compose configuration');
  assert.deepEqual(Object.keys(doc.services || {}).sort(), ['nexus'], 'Unexpected Compose services');
  const service = doc.services.nexus;
  assert.deepEqual(service.ports?.length, 1, 'Exactly one host port is required');
  const port = service.ports[0];
  assert.equal(port.host_ip, '127.0.0.1', 'Compose host port must bind only to IPv4 loopback');
  assert.equal(Number(port.target), 3000);
  assert.equal(Number(port.published), 3000);
  assert.equal(service.read_only, true, 'Container root filesystem must be read-only');
  assert.deepEqual(service.cap_drop, ['ALL']);
  assert.ok(service.security_opt?.includes('no-new-privileges:true'));
  assert.ok(!service.privileged && service.network_mode !== 'host');
  assert.ok(!service.volumes?.length && !service.devices?.length);
  assert.deepEqual(Object.keys(service.environment || {}).sort(),
    ['NEXT_TELEMETRY_DISABLED', 'NODE_ENV']);
  return true;
}

export function verifyRuntimeInspection(container) {
  assert.equal(container.State?.Running, true, 'NEXUS container is not running');
  assert.equal(container.State?.Health?.Status, 'healthy', 'NEXUS container is not healthy');
  assert.ok(['node', '1000', '1000:1000', '65532', '65532:65532'].includes(container.Config?.User),
    'NEXUS must run as non-root node user');
  const host = container.HostConfig || {};
  assert.equal(host.Privileged, false, 'Privileged container is forbidden');
  assert.equal(host.ReadonlyRootfs, true, 'Container root filesystem must be read-only');
  assert.notEqual(host.NetworkMode, 'host', 'Host networking is forbidden');
  assert.deepEqual(host.CapDrop, ['ALL']);
  assert.ok(host.SecurityOpt?.includes('no-new-privileges:true'));
  assert.ok(!host.Binds?.length && !host.Mounts?.length && !container.Mounts?.length,
    'Unexpected host mounts');
  assert.deepEqual(Object.keys(host.PortBindings || {}), ['3000/tcp'],
    'Exactly one published TCP port is permitted');
  assert.deepEqual(host.PortBindings['3000/tcp'],
    [{ HostIp: '127.0.0.1', HostPort: '3000' }],
    'Host port binding must be 127.0.0.1:3000 only');
  assert.deepEqual(container.NetworkSettings?.Ports?.['3000/tcp'],
    [{ HostIp: '127.0.0.1', HostPort: '3000' }],
    'Runtime network port binding differs from host configuration');
  const environment = container.Config?.Env;
  assert.ok(Array.isArray(environment), 'Missing container environment');
  const keys = new Set();
  for (const line of environment) {
    assert.equal(typeof line, 'string');
    const equals = line.indexOf('=');
    assert.ok(equals > 0, 'Malformed environment entry');
    const key = line.slice(0, equals);
    assert.ok(EXPECTED_ENV.has(key), 'Unexpected container environment variable');
    assert.ok(!keys.has(key), 'Repeated environment variable');
    keys.add(key);
    if (key === 'NODE_ENV') assert.equal(line.slice(equals + 1), 'production');
    if (key === 'NEXT_TELEMETRY_DISABLED') assert.equal(line.slice(equals + 1), '1');
  }
  assert.ok(keys.has('NODE_ENV') && keys.has('NEXT_TELEMETRY_DISABLED'));
  return true;
}

export function runDocker(args) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8', timeout: 15_000, maxBuffer: 2 * 1024 * 1024,
    windowsHide: true,
  });
  // Never print raw Docker stderr: environment-specific content may be sensitive.
  if (result.error || result.status !== 0 || typeof result.stdout !== 'string') {
    throw new Error('A required read-only Docker inspection command failed.');
  }
  return result.stdout.trim();
}

export async function verifyCommunityRuntime({
  docker = runDocker,
  fetchImpl = fetch,
} = {}) {
  // Preflight: Engine version first; never proceed to container inspection for
  // older daemons with unsafe localhost publishing semantics.
  const engine = parseEngineVersion(docker(['version', '--format', '{{.Server.Version}}']));
  const composeArgs = ['compose', '-f', COMPOSE_FILE];
  verifyComposeConfig(JSON.parse(docker([...composeArgs, 'config', '--format', 'json'])));
  const containerId = docker([...composeArgs, 'ps', '-q', 'nexus']);
  if (!/^[a-f0-9]{12,64}$/i.test(containerId)) {
    throw new Error('Expected exactly one existing NEXUS container.');
  }
  // Inspect the ID returned by *this project's* Compose, never an arbitrary
  // user-supplied container or a remotely provided URL.
  const inspected = JSON.parse(docker(['inspect', '--format', '{{json .}}', containerId]));
  verifyRuntimeInspection(inspected);
  assert.equal(docker([...composeArgs, 'port', 'nexus', '3000']),
    '127.0.0.1:3000', 'Docker Compose reports a non-localhost published port');
  const requests = await verifyCommunityLocalhost({ port: 3000, fetchImpl });
  assert.equal(requests.length, 6);
  return { engine, checks: requests.length, localhostOnly: true };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await verifyCommunityRuntime();
    console.log('PASS: existing NEXUS Community container; Docker Engine ' +
      result.engine + '; loopback port and non-root runtime verified; ' +
      result.checks + ' local HTTP checks. No container lifecycle or upstream GitHub requests.');
  } catch {
    console.error('FAIL: Community runtime acceptance incomplete or unsafe. ' +
      'Verify Docker Engine 28+, a running healthy NEXUS container, localhost binding and permissions. ' +
      'Do not label this a release PASS.');
    process.exitCode = 1;
  }
}
