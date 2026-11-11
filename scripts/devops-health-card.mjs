// Daily health card CLI. Prints JSON (default) or text. Sources are optional; missing = "unknown".
// Run: node --import tsx scripts/devops-health-card.mjs [--repo owner/name] [--offline] [--text]
// Env: NEXUS_DEVOPS_HEALTH_ORACLE_HEARTBEAT / _KAGGLE_QUOTA / _PROVIDER_QUOTA / _NEON_USAGE (file path or http(s) URL)
import { readFile, stat } from 'node:fs/promises';
import { buildHealthCard, healthSourcesFromEnv } from '../src/lib/nexus-health-card.ts';

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const repoIdx = args.indexOf('--repo');
const repository = repoIdx >= 0 ? args[repoIdx + 1] : process.env.NEXUS_DEVOPS_HEALTH_REPOSITORY;

async function read(spec) {
  if (/^https?:\/\//i.test(spec)) {
    const res = await fetch(spec, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error('http ' + res.status);
    return { text: (await res.text()).slice(0, 200000) };
  }
  const [text, info] = await Promise.all([readFile(spec, 'utf8'), stat(spec)]);
  return { text: text.slice(0, 200000), mtime: info.mtime };
}

const card = await buildHealthCard({
  repository, sources: healthSourcesFromEnv(process.env), read,
  fetcher: flag('--offline') ? undefined : fetch, now: new Date(),
});
process.stdout.write(flag('--text') ? card.text + '\n' : JSON.stringify(card, null, 2) + '\n');
