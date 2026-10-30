// Static, read-only check of a project folder on this computer (personal edition).
// Usage: node --import tsx scripts/jarvis-localcheck.mjs [--json] <folder>
// Never runs project code, package scripts, git or network requests; never prints secret values.
// Exit codes: 0 report written (no high findings), 1 report written with at least one high finding, 2 bad arguments.
import { collectLocalFacts } from '../src/lib/nexus-local-check-collect.ts';
import { analyzeLocalProject, localCheckMarkdown } from '../src/lib/nexus-local-check.ts';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const rest = args.filter(a => a !== '--json');
if (rest.length !== 1) {
  process.stderr.write('Usage: jarvis-localcheck [--json] <folder>\n');
  process.exit(2);
}
let facts;
try {
  facts = collectLocalFacts(rest[0]);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'cannot read the folder'}\n`);
  process.exit(2);
}
const report = analyzeLocalProject(facts, new Date());
process.stdout.write(asJson ? JSON.stringify(report, null, 2) + '\n' : localCheckMarkdown(report));
process.exitCode = report.summary.high > 0 ? 1 : 0;
