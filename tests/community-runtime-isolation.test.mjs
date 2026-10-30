import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyComposeConfig, verifyRuntimeInspection, verifyCommunityRuntime } from '../scripts/verify-community-runtime.mjs';

const id = 'c'.repeat(64);
const baselineConfig = {
  services: { nexus: {
    image: 'nexus-devops-community:local',
    build: { context: process.cwd(), dockerfile: 'Dockerfile' },
    ports: [{ host_ip: '127.0.0.1', target: 3000, published: '3000' }],
    read_only: true, cap_drop: ['ALL'], security_opt: ['no-new-privileges:true'],
    environment: { NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
  } },
};
const baselineRuntime = {
  State: { Running: true, Health: { Status: 'healthy' } },
  Config: { User: '65532', Env: ['PATH=/bin', 'NODE_ENV=production', 'NEXT_TELEMETRY_DISABLED=1'] },
  HostConfig: { Privileged: false, ReadonlyRootfs: true, NetworkMode: 'nexus_default',
    CapDrop: ['ALL'], SecurityOpt: ['no-new-privileges:true'],
    PortBindings: { '3000/tcp': [{ HostIp: '127.0.0.1', HostPort: '3000' }] } },
  NetworkSettings: { Ports: { '3000/tcp': [{ HostIp: '127.0.0.1', HostPort: '3000' }] } }, Mounts: [],
};
const clone = x => structuredClone(x);

test('valid approved Compose and runtime remain accepted', () => {
  assert.equal(verifyComposeConfig(clone(baselineConfig)), true);
  assert.equal(verifyRuntimeInspection(clone(baselineRuntime)), true);
  const config = clone(baselineConfig);
  const runtime = clone(baselineRuntime);
  config.services.nexus.cap_add = [];
  runtime.HostConfig.CapAdd = [];
  runtime.HostConfig.PidMode = '';
  runtime.HostConfig.IpcMode = 'private';
  runtime.HostConfig.CgroupnsMode = 'private';
  assert.equal(verifyComposeConfig(config), true);
  assert.equal(verifyRuntimeInspection(runtime), true);
  // Compose project-specific bridge networks remain valid; empty sysctl map is harmless.
  runtime.HostConfig.NetworkMode = 'project-name_default';
  runtime.HostConfig.Sysctls = {};
  assert.equal(verifyRuntimeInspection(runtime), true);
});

test('Compose rejects capability re-grants and extra security options', () => {
  for (const mutate of [
    s => { s.cap_add = ['SYS_ADMIN']; },
    s => { s.cap_add = ['NET_ADMIN']; },
    s => { s.cap_add = { NET_ADMIN: true }; },
    s => { s.security_opt.push('seccomp=unconfined'); },
    s => { s.security_opt.push('apparmor=unconfined'); },
    s => { s.security_opt = ['no-new-privileges:false']; },
    s => { s.security_opt.push('no-new-privileges:true'); },
  ]) {
    const obj = clone(baselineConfig);
    mutate(obj.services.nexus);
    assert.throws(() => verifyComposeConfig(obj));
  }
});

test('Compose rejects sharing host namespaces, groups and kernel settings', () => {
  const changes = [
    ['network_mode', 'host'], ['network_mode', 'container:other'],
    ['pid', 'host'], ['ipc', 'host'], ['uts', 'host'], ['cgroup', 'host'],
    ['userns_mode', 'host'], ['device_cgroup_rules', ['c 1:3 rmw']],
    ['group_add', ['root']], ['sysctls', { 'net.ipv4.ip_forward': 1 }],
  ];
  for (const [field, value] of changes) {
    const obj = clone(baselineConfig);
    obj.services.nexus[field] = value;
    assert.throws(() => verifyComposeConfig(obj), field);
  }
});

test('Docker inspect rejects capabilities, insecure profiles, host namespaces and device access', () => {
  const changes = [
    ['CapAdd', ['SYS_ADMIN']], ['CapAdd', ['NET_ADMIN']],
    ['SecurityOpt', ['no-new-privileges:true', 'seccomp=unconfined']],
    ['NetworkMode', 'host'], ['NetworkMode', 'container:another-container'],
    ['NetworkMode', 'service:other'], ['NetworkMode', 'none'],
    ['NetworkMode', 'bridge/unsafe'], ['NetworkMode', ''], ['NetworkMode', null],
    ['Sysctls', { 'net.ipv4.ip_forward': '1' }],
    ['Sysctls', ['net.ipv4.ip_forward=1']],
    ['PidMode', 'host'], ['IpcMode', 'host'], ['UTSMode', 'host'],
    ['CgroupnsMode', 'host'], ['UsernsMode', 'host'],
    ['Devices', [{ PathOnHost: '/dev/kvm' }]],
    ['DeviceRequests', [{ Driver: 'nvidia' }]], ['GroupAdd', ['root']],
    ['DeviceCgroupRules', ['c 1:3 rmw']],
  ];
  for (const [field, value] of changes) {
    const obj = clone(baselineRuntime);
    obj.HostConfig[field] = value;
    assert.throws(() => verifyRuntimeInspection(obj), field);
  }
});

test('unsafe Compose configuration aborts before Docker inspect and HTTP probes', async () => {
  const obj = clone(baselineConfig);
  obj.services.nexus.cap_add = ['SYS_ADMIN'];
  const calls = [];
  const docker = args => {
    calls.push(args);
    if (args[0] === 'version') return '28.5.0';
    if (args[0] === 'compose' && args.includes('config')) return JSON.stringify(obj);
    throw new Error('Unexpected Docker command');
  };
  let fetches = 0;
  await assert.rejects(verifyCommunityRuntime({ docker, fetchImpl: () => { fetches++; } }), /capabilities/);
  assert.equal(calls.length, 2);
  assert.equal(fetches, 0);
});

test('unsafe Docker inspection aborts before networking and HTTP probes', async () => {
  const obj = clone(baselineRuntime);
  obj.HostConfig.CapAdd = ['SYS_ADMIN'];
  const calls = [];
  const docker = args => {
    calls.push(args);
    if (args[0] === 'version') return '28.5.0';
    if (args.includes('config')) return JSON.stringify(baselineConfig);
    if (args.includes('ps')) return id;
    if (args[0] === 'inspect') return JSON.stringify(obj);
    throw new Error('Unexpected Docker command');
  };
  let fetches = 0;
  await assert.rejects(verifyCommunityRuntime({ docker, fetchImpl: () => { fetches++; } }), /capabilities/);
  assert.equal(calls.length, 4);
  assert.equal(fetches, 0);
});
