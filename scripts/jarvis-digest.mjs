// One-shot read-only digest for automation (n8n, scheduler, Jarvis shell tools).
// Usage: node --import tsx scripts/jarvis-digest.mjs owner/name   (env NEXUS_DEVOPS_BASE_URL)
// Exit codes: 0 digest with evidence, 2 bad arguments/config, 3 no verified source.
import { createJarvisMcpHandler } from '../src/lib/nexus-jarvis-mcp.ts';

const repository = process.argv[2];
if (!repository || process.argv.length !== 3) {
  process.stderr.write('Usage: jarvis-digest owner/name\n');
  process.exit(2);
}
let handle;
try {
  handle = createJarvisMcpHandler({ baseUrl: process.env.NEXUS_DEVOPS_BASE_URL });
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'invalid configuration'}\n`);
  process.exit(2);
}
const response = await handle({
  jsonrpc: '2.0', id: 1, method: 'tools/call',
  params: { name: 'devops_repo_digest', arguments: { repository } },
});
const result = response?.result;
process.stdout.write((result?.content?.[0]?.text ?? '{"error":"no_result"}') + '\n');
// Do not call process.exit() here: on Windows it can race the closing fetch handles (libuv assertion).
process.exitCode = result && !result.isError ? 0 : (result?.content?.[0]?.text?.includes('invalid_arguments') ? 2 : 3);
