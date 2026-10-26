import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

/**
 * Docker Compose only parses local configuration here. This must never
 * build/pull/start a container or require the Docker daemon to be running.
 * On contributors' machines without Docker CLI, the test is an honest SKIP.
 */
test('Community Compose CLI resolves a loopback-only least-privilege service', t => {
  const version = spawnSync('docker', ['compose', 'version'], {
    encoding: 'utf8', timeout: 15_000, maxBuffer: 1024 * 1024,
  });
  if (version.error?.code === 'ENOENT' ||
      (version.status !== 0 && /unknown command|not recognized|not found/i.test(version.stderr || ''))) {
    t.skip('Docker Compose CLI is not installed in this environment.');
    return;
  }
  assert.equal(version.status, 0, 'Installed Docker Compose CLI must report its version');

  const check = spawnSync('docker', ['compose', 'config', '--format', 'json'], {
    encoding: 'utf8', timeout: 20_000, maxBuffer: 1024 * 1024,
  });
  assert.equal(check.status, 0, 'Compose config should parse without contacting a daemon: ' + check.stderr);
  const doc = JSON.parse(check.stdout);
  assert.deepEqual(Object.keys(doc.services).sort(), ['nexus']);
  const service = doc.services.nexus;
  assert.ok(service.build, 'The service must build locally from this checkout');
  assert.equal(service.privileged, undefined);
  assert.notEqual(service.network_mode, 'host');
  assert.ok(!service.volumes?.length, 'Unexpected bind mount');
  assert.ok(!service.devices?.length, 'Unexpected device access');
  assert.deepEqual(service.cap_drop, ['ALL']);
  assert.ok(service.security_opt.includes('no-new-privileges:true'));
  assert.equal(service.ports.length, 1);
  const port = service.ports[0];
  assert.equal(port.host_ip, '127.0.0.1', 'Never publish to a public host address');
  assert.equal(Number(port.target), 3000);
  assert.equal(Number(port.published), 3000);
  assert.equal(service.environment.NODE_ENV, 'production');
  assert.equal(service.environment.NEXT_TELEMETRY_DISABLED, '1');
  for (const key of Object.keys(service.environment)) {
    assert.doesNotMatch(key, /TOKEN|PASSWORD|SECRET|CREDENTIAL|API_KEY/i);
  }
});
