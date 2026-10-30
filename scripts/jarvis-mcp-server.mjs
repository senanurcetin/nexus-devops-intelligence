// Read-only MCP stdio server for the Jarvis orchestrator. Talks ONLY to a loopback NEXUS DevOps service.
// Run: node --import tsx scripts/jarvis-mcp-server.mjs   (env NEXUS_DEVOPS_BASE_URL, default http://127.0.0.1:3000)
import readline from 'node:readline';
import { createJarvisMcpHandler, handleJarvisLine } from '../src/lib/nexus-jarvis-mcp.ts';

let handle;
try {
  handle = createJarvisMcpHandler({ baseUrl: process.env.NEXUS_DEVOPS_BASE_URL });
} catch (error) {
  process.stderr.write(`nexus-devops-intelligence MCP: ${error instanceof Error ? error.message : 'invalid configuration'}\n`);
  process.exit(2);
}

const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
let queue = Promise.resolve();
lines.on('line', line => {
  // Keep request/response order stable even when a tool call is slow.
  queue = queue.then(async () => {
    const response = await handleJarvisLine(handle, line);
    if (response) process.stdout.write(JSON.stringify(response) + '\n');
  }).catch(() => {});
});
// Let the event loop drain after stdin closes; process.exit() can race closing fetch handles on Windows.
lines.on('close', () => { queue.then(() => { process.exitCode = 0; }); });
