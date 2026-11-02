#!/usr/bin/env node
// MCP stdio transport for cross-provider commit diagnostics. Run only on demand.
// node scripts/jarvis-commit-checks-mcp.mjs
import readline from 'node:readline';
import { createCommitChecksMcpHandler, handleCommitChecksMcpLine } from '../src/lib/nexus-commit-checks-mcp.mjs';

const handle = createCommitChecksMcpHandler();
const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
let queue = Promise.resolve();
lines.on('line', line => {
  queue = queue.then(async () => {
    const response = await handleCommitChecksMcpLine(handle, line);
    if (response) process.stdout.write(JSON.stringify(response) + '\n');
  }).catch(() => {
    // Preserve stdio framing; never print stack traces or secrets to stdout.
    process.stderr.write('NEXUS DevOps MCP request failed\n');
  });
});
lines.on('close', () => { queue.then(() => { process.exitCode = 0; }); });
