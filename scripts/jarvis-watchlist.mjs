// Read-only reading order for several PUBLIC repositories (personal edition).
// Usage: node --import tsx scripts/jarvis-watchlist.mjs [--json] owner/a owner/b ...
//        node --import tsx scripts/jarvis-watchlist.mjs [--json] --file repos.txt   (one owner/name per line, # comments)
// Env: NEXUS_DEVOPS_BASE_URL (local service). Up to 10 repositories; sequential requests.
// Exit codes: 0 at least one repository had a verified source, 2 bad arguments/config, 3 none readable.
import { readFileSync } from 'node:fs';
import { createJarvisMcpHandler } from '../src/lib/nexus-jarvis-mcp.ts';
import { parsePublicRepository } from '../src/lib/github-public-actions.ts';
import { triageWatchlist, watchlistMarkdown, WATCHLIST_MAX_REPOSITORIES } from '../src/lib/nexus-watchlist-triage.ts';

const fail = message => { process.stderr.write(`${message}\n`); process.exit(2); };

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const rest = args.filter(a => a !== '--json');
let names = [];
const fileAt = rest.indexOf('--file');
if (fileAt >= 0) {
  if (rest.length !== 2 || fileAt !== 0) fail('Usage: jarvis-watchlist [--json] (--file repos.txt | owner/a owner/b ...)');
  try {
    names = readFileSync(rest[1], 'utf8').split(/\r?\n/).map(l => l.replace(/#.*/, '').trim()).filter(Boolean);
  } catch { fail('cannot read the repository list file'); }
} else {
  names = rest;
}
if (names.length === 0 || names.length > WATCHLIST_MAX_REPOSITORIES) {
  fail(`Give 1 to ${WATCHLIST_MAX_REPOSITORIES} repositories (owner/name).`);
}
for (const name of names) {
  try { parsePublicRepository(name); } catch { fail(`invalid repository: ${String(name).slice(0, 80)}`); }
}

let handle;
try {
  handle = createJarvisMcpHandler({ baseUrl: process.env.NEXUS_DEVOPS_BASE_URL });
} catch (error) {
  fail(error instanceof Error ? error.message : 'invalid configuration');
}

const inputs = [];
for (const repository of names) {
  let digest = null;
  try {
    const response = await handle({
      jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: { name: 'devops_repo_digest', arguments: { repository } },
    });
    const result = response?.result;
    if (result && !result.isError) digest = JSON.parse(result.content?.[0]?.text ?? 'null');
  } catch { digest = null; }
  inputs.push({ repository, digest });
}

const triage = triageWatchlist(inputs, new Date());
process.stdout.write(asJson ? JSON.stringify(triage, null, 2) + '\n' : watchlistMarkdown(triage));
// Do not call process.exit() on success: on Windows it can race the closing fetch handles (libuv assertion).
process.exitCode = triage.readable > 0 ? 0 : 3;
