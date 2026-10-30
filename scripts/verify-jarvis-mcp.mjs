// Repeatable end-to-end check of the Jarvis MCP adapter against a RUNNING loopback NEXUS DevOps service.
// Run: npm run jarvis:verify                      (no GitHub request: protocol, tool surface, health, negative cases)
//      npm run jarvis:verify -- --repository owner/name   (also asks for one digest; the local service then calls GitHub)
// Env/flag: NEXUS_DEVOPS_BASE_URL or --base-url (literal loopback only; the adapter itself enforces this).
// Exit code 0 = every check passed, 1 = a check failed, 2 = the adapter could not be started.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const baseUrl = flag('--base-url') || process.env.NEXUS_DEVOPS_BASE_URL || 'http://127.0.0.1:3000';
const repository = flag('--repository');
if (repository !== undefined && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
  console.error('--repository must look like owner/name');
  process.exit(2);
}

const server = fileURLToPath(new URL('./jarvis-mcp-server.mjs', import.meta.url));
const child = spawn(process.execPath, ['--import', 'tsx', server], {
  env: { ...process.env, NEXUS_DEVOPS_BASE_URL: baseUrl },
  stdio: ['pipe', 'pipe', 'pipe'],
});
let stderr = '';
child.stderr.on('data', chunk => { stderr += chunk; });
child.on('error', error => { console.error('cannot start the adapter: ' + error.message); process.exit(2); });

const pending = new Map();
let buffer = '';
let nextId = 1;
child.stdout.on('data', chunk => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    let message;
    try { message = JSON.parse(line); } catch { results.push(['stdout carries only JSON-RPC lines', false, line.slice(0, 60)]); continue; }
    if (message.id != null && pending.has(message.id)) pending.get(message.id)(message);
  }
});
const call = (method, params, timeoutMs = 60_000) => new Promise((resolve, reject) => {
  const id = nextId++;
  const timer = setTimeout(() => reject(new Error('timeout waiting for ' + method)), timeoutMs);
  const onExit = code => { clearTimeout(timer); reject(new Error('adapter exited with code ' + code + (stderr ? ': ' + stderr.trim().slice(0, 120) : ''))); };
  child.once('exit', onExit);
  pending.set(id, message => { clearTimeout(timer); child.off('exit', onExit); resolve(message); });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
});

const results = [];
const check = (name, ok, detail = '') => results.push([name, Boolean(ok), detail]);
const rejected = message => Boolean(message.error || message.result?.isError);

try {
  const init = await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'jarvis-verify', version: '1' } });
  check('initialize negotiates 2025-06-18', init.result?.protocolVersion === '2025-06-18', String(init.result?.protocolVersion));
  check('server identifies itself', init.result?.serverInfo?.name === 'nexus-devops-intelligence');
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  const list = await call('tools/list', {});
  const tools = list.result?.tools ?? [];
  check('exactly the two expected tools', JSON.stringify(tools.map(t => t.name).sort()) === JSON.stringify(['devops_health', 'devops_repo_digest']), tools.map(t => t.name).join(','));
  check('every tool is read-only and non-destructive', tools.length > 0 && tools.every(t => t.annotations?.readOnlyHint === true && t.annotations?.destructiveHint === false));
  check('every tool declares an output schema', tools.length > 0 && tools.every(t => t.outputSchema && typeof t.outputSchema === 'object'));

  const health = await call('tools/call', { name: 'devops_health', arguments: {} });
  const h = health.result?.structuredContent;
  check('devops_health reports the local service healthy', health.result?.isError !== true && h?.ok === true && h?.http_status === 200, JSON.stringify(h));

  check('invalid repository name is rejected', rejected(await call('tools/call', { name: 'devops_repo_digest', arguments: { repository: 'not a repo; rm -rf' } })));
  check('extra arguments are rejected', rejected(await call('tools/call', { name: 'devops_repo_digest', arguments: { repository: 'owner/name', url: 'http://example.com' } })));
  check('unknown tool is rejected', rejected(await call('tools/call', { name: 'devops_write_everything', arguments: {} })));

  if (repository) {
    const digest = await call('tools/call', { name: 'devops_repo_digest', arguments: { repository } }, 90_000);
    const d = digest.result?.structuredContent;
    check('digest returned without error', digest.result?.isError !== true && Boolean(d), JSON.stringify(digest.error ?? digest.result?.content?.[0]?.text ?? '').slice(0, 80));
    check('digest schema is nexus.devops.jarvis-digest/v1', d?.schema === 'nexus.devops.jarvis-digest/v1');
    check('digest is for the requested repository', d?.repository === repository);
    check('digest access is read-only with no approval', d?.access?.mode === 'read_only' && Array.isArray(d?.access?.write_actions) && d.access.write_actions.length === 0 && d.access.release_authorized === false && d.access.merge_approval === false);
    check('digest queue is bounded', Array.isArray(d?.investigations) && d.investigations.length <= 5);
  }
} catch (error) {
  check('adapter session completed', false, error instanceof Error ? error.message : String(error));
}

child.stdin.end();
setTimeout(() => child.kill(), 500).unref();
check('adapter wrote nothing to stderr', stderr.length === 0, stderr.slice(0, 80));
let failed = 0;
for (const [name, ok, detail] of results) {
  if (!ok) failed += 1;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (!ok && detail ? ' :: ' + detail : ''));
}
console.log(failed === 0 ? `RESULT=PASS (${results.length} checks, base ${baseUrl}${repository ? ', digest ' + repository : ', no GitHub request'})` : `RESULT=FAIL (${failed} of ${results.length} failed)`);
process.exitCode = failed === 0 ? 0 : 1;
