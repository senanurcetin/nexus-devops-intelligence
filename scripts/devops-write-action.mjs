// Approval-gated write action CLI. Default OFF (NEXUS_DEVOPS_WRITE_ACTIONS=1 required).
//   plan : node --import tsx scripts/devops-write-action.mjs plan <action> '<params-json>'      (no token, no network)
//   run  : node --import tsx scripts/devops-write-action.mjs run  <action> '<params-json>'      (token via env/stdin)
// Env: NEXUS_DEVOPS_WRITE_ACTIONS=1, NEXUS_DEVOPS_WRITE_ALLOW=rerun_workflow,open_issue,label_pr,
//      NEXUS_DEVOPS_WRITE_REPOS=owner/repo, NEXUS_DEVOPS_GITHUB_WRITE_TOKEN, NEXUS_DEVOPS_APPROVAL_SECRET[_FILE],
//      NEXUS_DEVOPS_APPROVAL_TOKEN (or --token-stdin), NEXUS_DEVOPS_STATE_DIR (used-token markers).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { planWriteAction, executeWriteAction, writeConfigFromEnv, WriteActionRefused } from '../src/lib/nexus-write-actions.ts';
import { FileUsedTokenStore } from '../src/lib/nexus-approval-token.ts';

const [mode, action, paramsJson] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const out = (obj, code = 0) => { process.stdout.write(JSON.stringify(obj) + '\n'); process.exit(code); };
const refuse = e => out({ ok: false, refused: e instanceof WriteActionRefused ? e.reason : 'invalid_params' }, 3);

let params;
try { params = JSON.parse(paramsJson ?? ''); } catch { out({ ok: false, refused: 'invalid_params' }, 2); }
if (mode === 'plan') {
  try { const p = planWriteAction(action, params); out({ ok: true, payload: p.payload, payload_hash: p.payload_hash, summary: p.summary }); }
  catch (e) { refuse(e); }
}
if (mode !== 'run') out({ ok: false, refused: 'usage: plan|run <action> <params-json>' }, 2);

const env = { ...process.env };
if (!env.NEXUS_DEVOPS_APPROVAL_SECRET && env.NEXUS_DEVOPS_APPROVAL_SECRET_FILE) {
  try { env.NEXUS_DEVOPS_APPROVAL_SECRET = readFileSync(env.NEXUS_DEVOPS_APPROVAL_SECRET_FILE, 'utf8').trim(); } catch { /* verify refuses */ }
}
const token = process.argv.includes('--token-stdin') ? readFileSync(0, 'utf8').trim() : env.NEXUS_DEVOPS_APPROVAL_TOKEN;
const stateDir = env.NEXUS_DEVOPS_STATE_DIR || join(tmpdir(), 'nexus-devops-state');
try {
  const r = await executeWriteAction({ action, params, token, config: writeConfigFromEnv(env),
    usedTokens: new FileUsedTokenStore(join(stateDir, 'used-approvals')), fetcher: fetch });
  out(r);
} catch (e) { refuse(e); }
