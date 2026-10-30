import { sanitizeDigestText } from './nexus-jarvis-digest.ts';

/**
 * Personal-edition local project check. STATIC analysis only: it reads file text that a
 * collector gathered and applies fixed rules. It never runs project code, package
 * scripts, git, or a network request, and it never prints a secret value (only the kind,
 * the file and the line). Rules are heuristics: they can miss problems and can over-report.
 * Not a security audit, not CI, not approval to merge, release or install.
 */
export const LOCAL_CHECK_SCHEMA = 'nexus.devops.local-check/v1' as const;
export const MAX_LOCAL_FINDINGS = 200;

export const LOCAL_CHECK_SCOPE_NOTE =
  'Static read-only check of files on this computer. No project code, package script or git command was run and no ' +
  'network request was made. Rules are heuristics and can miss real problems or flag harmless ones. Secret values are ' +
  'never printed. This is not a security audit, not a CI run and not approval to install, merge or release.';

export type Severity = 'high' | 'medium' | 'low' | 'info';
export type LocalFinding = {
  id: string; severity: Severity; title: string; file: string | null; line: number | null;
  detail: string; recommendation: string;
};
export type LocalFacts = {
  rootName: string;
  filesScanned: number;
  truncated: boolean;
  skippedLarge: number;
  files: string[]; // relative POSIX paths
  text: Record<string, string>; // relative path -> content of analysed text files
  git: { present: boolean; headRef: string | null; detached: boolean; remoteUrls: string[] };
};
export type LocalCheckReport = {
  schema: typeof LOCAL_CHECK_SCHEMA;
  generated_at_utc: string;
  root_name: string;
  scope_note: string;
  facts: {
    files_scanned: number; truncated: boolean; skipped_large: number;
    git: { present: boolean; head_ref: string | null; detached: boolean; remotes: string[] };
    ecosystems: string[]; ci_workflows: number; dockerfiles: number;
  };
  summary: Record<Severity, number>;
  findings: LocalFinding[];
  findings_truncated: boolean;
  limits: string[];
};

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2, info: 3 };

const SECRET_RULES: { id: string; label: string; re: RegExp; severity: Severity }[] = [
  { id: 'private-key', label: 'private key block', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/, severity: 'high' },
  { id: 'aws-access-key', label: 'AWS access key id', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/, severity: 'high' },
  { id: 'github-token', label: 'GitHub token', re: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/, severity: 'high' },
  { id: 'slack-token', label: 'Slack token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, severity: 'high' },
  { id: 'google-api-key', label: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/, severity: 'high' },
  { id: 'anthropic-key', label: 'Anthropic-style key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/, severity: 'high' },
  { id: 'openai-key', label: 'OpenAI-style key', re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/, severity: 'high' },
  { id: 'generic-secret', label: 'hard-coded secret-looking assignment',
    re: /\b(?:api[_-]?key|secret|token|passw(?:or)?d|private[_-]?key)\w*\s*[:=]\s*['"][^'"\s]{16,}['"]/i, severity: 'medium' },
];
const PLACEHOLDER = /(example|placeholder|your[_-]|xxxx|changeme|dummy|sample|<[^>]+>|\$\{|os\.getenv|os\.environ|getenv\(|process\.env|import\.meta\.env)/i;
const TEST_PATH = /(^|\/)(tests?|__tests__|spec|fixtures?|__fixtures__|examples?)\/|\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)test_[^/]+\.py$|_test\.(py|go)$/i;
const NO_SECRET_SCAN = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|poetry\.lock|uv\.lock|Cargo\.lock)$|\.min\.(js|css)$|\.map$/;
const MAX_FINDINGS_PER_RULE_FILE = 5;

const INJECTION =
  /github\.event\.(?:issue\.(?:title|body)|pull_request\.(?:title|body|head\.(?:ref|label))|comment\.body|review\.body|review_comment\.body|discussion\.(?:title|body)|head_commit\.(?:message|author\.(?:email|name))|commits\[[^\]]*\]\.(?:message|author\.(?:email|name)))|github\.head_ref|github\.event\.workflow_run\.(?:head_branch|head_commit\.message)/;

const indentOf = (line: string): number => line.length - line.trimStart().length;
const isWorkflow = (p: string) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(p);
const isDockerfile = (p: string) => /(^|\/)(Dockerfile(\..+)?|[^/]+\.dockerfile)$/i.test(p);
const maskUrl = (u: string) => u.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/@\s]+@/i, '$1');

type Add = (f: Omit<LocalFinding, 'id'> & { rule: string }) => void;

function checkWorkflow(path: string, content: string, add: Add): void {
  const lines = content.split(/\r?\n/);
  const f = (rule: string, severity: Severity, title: string, line: number | null, detail: string, recommendation: string) =>
    add({ rule, severity, title, file: path, line, detail, recommendation });

  const hasPrt = lines.findIndex(l => /(^|\s)-?\s*pull_request_target\b/.test(l) && !/^\s*#/.test(l));
  if (hasPrt >= 0) {
    const headCheckout = /github\.event\.pull_request\.head\.(?:sha|ref)|github\.head_ref/.test(content);
    f('wf-pull-request-target', headCheckout ? 'high' : 'medium', 'pull_request_target trigger', hasPrt + 1,
      headCheckout
        ? 'Runs with repository secrets and also references the pull request head, which can run untrusted fork code with secrets.'
        : 'Runs with repository secrets in the base context; confirm no untrusted pull request code is checked out or executed.',
      'Prefer pull_request, or never check out or run the PR head in a pull_request_target job.');
  }
  if (!/^permissions\s*:/m.test(content) && !/^\s+permissions\s*:/m.test(content)) {
    f('wf-no-permissions', 'medium', 'No permissions block', null,
      'GITHUB_TOKEN gets the repository default permissions, which may be read-write.',
      'Add a top-level `permissions:` block with the minimum needed (for example `contents: read`).');
  }
  // expression injection inside run scripts
  let runIndent: number | null = null;
  lines.forEach((raw, i) => {
    const line = raw;
    if (runIndent !== null) {
      if (line.trim() === '' || indentOf(line) > runIndent) {
        if (INJECTION.test(line) && /\$\{\{/.test(line)) {
          f('wf-script-injection', 'high', 'Untrusted GitHub context used inside a run script', i + 1,
            'A user-controllable value (title, body, branch name or message) is expanded directly into shell code.',
            'Pass it through an environment variable and quote it in the script instead of expanding it inline.');
        }
        return;
      }
      runIndent = null;
    }
    const m = /^(\s*)(?:-\s+)?run\s*:\s*(.*)$/.exec(line);
    if (m) {
      const rest = m[2].trim();
      if (/^[|>][+-]?\d*$/.test(rest) || rest === '') {
        // Column of the `run` key itself: block-scalar content must be indented deeper than it, while sibling keys
        // such as `env:` (the safe place for untrusted values) sit at the same column and end the block.
        runIndent = m[1].length + (/^\s*-\s/.test(line) ? 2 : 0);
      } else if (INJECTION.test(rest) && /\$\{\{/.test(rest)) {
        f('wf-script-injection', 'high', 'Untrusted GitHub context used inside a run script', i + 1,
          'A user-controllable value (title, body, branch name or message) is expanded directly into shell code.',
          'Pass it through an environment variable and quote it in the script instead of expanding it inline.');
      }
    }
  });
  lines.forEach((l, i) => {
    if (/^\s*#/.test(l)) return;
    if (/\b(?:curl|wget)\b[^\n|]*\|\s*(?:sudo\s+)?(?:ba|z)?sh\b/.test(l)) {
      f('wf-pipe-to-shell', 'medium', 'Downloads and pipes a script to a shell', i + 1,
        'The downloaded script is executed without any integrity check.',
        'Pin a release, verify a checksum or signature, or use a maintained action.');
    }
    if (/^\s*secrets\s*:\s*inherit\b/.test(l)) {
      f('wf-secrets-inherit', 'low', 'secrets: inherit', i + 1,
        'Passes every repository secret to the called workflow.', 'Pass only the secrets that workflow needs.');
    }
  });
  if (/runs-on\s*:\s*\[?\s*['"]?self-hosted/.test(content) && /\bpull_request(?:_target)?\b/.test(content)) {
    f('wf-self-hosted-pr', 'medium', 'Self-hosted runner reachable from pull requests', null,
      'Pull request code can run on your own machine.', 'Use GitHub-hosted runners for pull requests or restrict who can trigger the workflow.');
  }
  let unpinned = 0; let thirdParty = 0; let firstLine: number | null = null;
  lines.forEach((l, i) => {
    const m = /^\s*(?:-\s+)?uses\s*:\s*['"]?([^'"\s#]+)/.exec(l);
    if (!m || m[1].startsWith('./') || m[1].startsWith('docker://')) return;
    const [name, ref = ''] = m[1].split('@');
    if (/^[0-9a-f]{40}$/.test(ref)) return;
    unpinned += 1;
    if (firstLine === null) firstLine = i + 1;
    if (!/^(actions|github)\//.test(name)) thirdParty += 1;
  });
  if (unpinned > 0) {
    f('wf-unpinned-actions', thirdParty > 0 ? 'low' : 'info', 'Actions not pinned to a commit SHA', firstLine,
      `${unpinned} action reference(s) use a tag or branch (${thirdParty} from outside actions/ and github/).`,
      'Pin third-party actions to a full commit SHA and update them deliberately.');
  }
  if (!/timeout-minutes\s*:/.test(content)) {
    f('wf-no-timeout', 'info', 'No timeout-minutes', null,
      'A stuck job runs until the 6-hour GitHub default.', 'Set `timeout-minutes` on jobs.');
  }
}

function checkDockerfile(path: string, content: string, hasDockerignore: boolean, add: Add): void {
  const lines = content.split(/\r?\n/);
  const f = (rule: string, severity: Severity, title: string, line: number | null, detail: string, recommendation: string) =>
    add({ rule, severity, title, file: path, line, detail, recommendation });
  const instr = lines.map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  lines.forEach((l, i) => {
    const t = l.trim();
    const from = /^FROM\s+(?:--platform=\S+\s+)?(\S+)/i.exec(t);
    if (from && !/^(scratch|\$|\$\{)/i.test(from[1]) && !/ AS /i.test(' ' + from[1]) &&
        (!from[1].includes(':') || /:latest$/.test(from[1])) && !from[1].includes('@sha256:')) {
      f('docker-floating-base', 'low', 'Base image is not pinned', i + 1,
        'FROM uses an untagged or :latest image, so builds can change without notice.', 'Pin a version tag or digest.');
    }
    if (/^ADD\s+https?:\/\//i.test(t)) {
      f('docker-add-url', 'low', 'ADD from a URL', i + 1, 'Remote content is added without verification.', 'Use COPY plus a verified download.');
    }
    if (/\b(?:curl|wget)\b[^\n|]*\|\s*(?:ba|z)?sh\b/.test(t)) {
      f('docker-pipe-to-shell', 'medium', 'Downloads and pipes a script to a shell', i + 1,
        'The script runs during the build without an integrity check.', 'Verify a checksum or signature first.');
    }
    if (/chmod\s+(?:-R\s+)?0?777\b/.test(t)) {
      f('docker-chmod-777', 'low', 'World-writable permissions', i + 1, 'chmod 777 widens access inside the image.', 'Use the narrowest mode.');
    }
  });
  if (!instr.some(l => /^USER\s+(?!root\b|0\b)\S+/i.test(l))) {
    f('docker-runs-as-root', 'medium', 'Container runs as root', null,
      'No non-root USER instruction was found.', 'Create and switch to an unprivileged user.');
  }
  if (!hasDockerignore && instr.some(l => /^COPY\s+\.\s+\S+/i.test(l))) {
    f('docker-no-dockerignore', 'low', 'COPY . without .dockerignore', null,
      'The whole project directory, including secrets or .git, may be copied into the image.', 'Add a .dockerignore.');
  }
}

export function analyzeLocalProject(facts: LocalFacts, now: Date): LocalCheckReport {
  const findings: LocalFinding[] = [];
  const counters = new Map<string, number>();
  const add: Add = ({ rule, ...rest }) => {
    const n = (counters.get(rule) ?? 0) + 1;
    counters.set(rule, n);
    findings.push({ id: `${rule}#${n}`, ...rest });
  };
  const has = (p: string) => facts.files.includes(p);
  const base = (p: string) => p.slice(p.lastIndexOf('/') + 1);
  const rootFiles = facts.files.filter(p => !p.includes('/'));
  const workflows = facts.files.filter(isWorkflow);
  const dockerfiles = facts.files.filter(isDockerfile);
  const ecosystems: string[] = [];

  // secrets
  for (const [path, content] of Object.entries(facts.text)) {
    if (NO_SECRET_SCAN.test(path)) continue;
    const perRule = new Map<string, number>();
    content.split(/\r?\n/).forEach((line, i) => {
      if (line.length > 2000) return;
      for (const rule of SECRET_RULES) {
        if (!rule.re.test(line)) continue;
        if (rule.id === 'generic-secret' && PLACEHOLDER.test(line)) continue;
        const seen = perRule.get(rule.id) ?? 0;
        if (seen >= MAX_FINDINGS_PER_RULE_FILE) continue;
        perRule.set(rule.id, seen + 1);
        // Inside test/fixture paths credential-shaped text is usually a fake value (redaction and scanner tests
        // are full of them). Loose "name = value" matches drop to low and provider-shaped keys (AWS, GitHub,
        // private-key headers...) drop one step to medium, so a real key pasted into a test is still listed.
        const inTestPath = TEST_PATH.test(path);
        const severity: Severity = !inTestPath ? rule.severity : rule.id === 'generic-secret' ? 'low' : 'medium';
        add({
          rule: `secret-${rule.id}`, severity, title: `Possible ${rule.label}`, file: path, line: i + 1,
          detail: inTestPath
            ? 'A credential-shaped value sits in a test or fixture file; it is often a fake value, but check once that it is not a real one. The value is deliberately not shown.'
            : 'A value that looks like a credential is stored in this file. The value is deliberately not shown.',
          recommendation: 'Treat it as exposed: revoke or rotate it, remove it from the file and from git history, and load it from the environment.',
        });
        break;
      }
    });
  }

  // env files and .gitignore
  const gitignore = facts.text['.gitignore'] ?? null;
  const ignoreLines = (gitignore ?? '').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const ignoresEnv = ignoreLines.some(l => /^\/?\*?\*?\/?\.env(\*|\.\*)?$/.test(l) || l === '.env*' || l === '*.env');
  for (const p of facts.files) {
    const b = base(p);
    if (/^\.env(\..+)?$/.test(b) && !/\.(example|sample|template|dist|defaults?)$/.test(b)) {
      add({
        rule: 'env-file', severity: ignoresEnv ? 'info' : 'high', title: 'Environment file present', file: p, line: null,
        detail: ignoresEnv
          ? 'The file exists locally and .gitignore appears to ignore it.'
          : '.gitignore does not appear to ignore environment files, so this file could be committed.',
        recommendation: 'Keep real environment files out of git and commit only a `.env.example` without values.',
      });
    }
  }
  if (gitignore === null && (facts.git.present || has('package.json'))) {
    add({ rule: 'no-gitignore', severity: 'medium', title: 'No .gitignore', file: null, line: null,
      detail: 'Generated folders, environment files and local data may be committed by accident.', recommendation: 'Add a .gitignore for this ecosystem.' });
  } else if (gitignore !== null && has('package.json') && !ignoreLines.some(l => /^\/?node_modules\/?$/.test(l))) {
    add({ rule: 'gitignore-node-modules', severity: 'medium', title: '.gitignore does not list node_modules', file: '.gitignore', line: null,
      detail: 'Installed dependencies may be committed.', recommendation: 'Add `node_modules/`.' });
  }

  // git config
  for (const url of facts.git.remoteUrls) {
    const m = /^[a-z][a-z0-9+.-]*:\/\/([^/@\s]+)@/i.exec(url);
    if (m && (m[1].includes(':') || /^(gh[pousr]_|github_pat_)/.test(m[1]))) {
      add({ rule: 'git-remote-credentials', severity: 'high', title: 'Git remote URL contains credentials', file: '.git/config', line: null,
        detail: 'A password or token is embedded in a remote URL (value not shown).',
        recommendation: 'Revoke that token, then use a credential helper or SSH instead of embedding it in the URL.' });
    }
  }

  // package.json
  const pkgText = facts.text['package.json'];
  if (pkgText !== undefined) {
    ecosystems.push('node');
    let pkg: { scripts?: Record<string, unknown> } | null = null;
    try { pkg = JSON.parse(pkgText); } catch { pkg = null; }
    if (!pkg || typeof pkg !== 'object') {
      add({ rule: 'pkg-invalid', severity: 'low', title: 'package.json is not valid JSON', file: 'package.json', line: null,
        detail: 'The file could not be parsed.', recommendation: 'Fix the syntax.' });
    } else {
      const scripts = pkg.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {};
      const lifecycle = ['preinstall', 'install', 'postinstall', 'prepare'].filter(k => typeof scripts[k] === 'string');
      if (lifecycle.length) {
        add({ rule: 'pkg-install-scripts', severity: 'medium', title: 'Install-time scripts', file: 'package.json', line: null,
          detail: `Defines ${lifecycle.join(', ')}: these run automatically on npm install, before you have reviewed the code.`,
          recommendation: 'Read these scripts before installing a project you do not trust; consider `npm ci --ignore-scripts`.' });
      }
      const test = typeof scripts.test === 'string' ? scripts.test : '';
      if (!test || /no test specified/i.test(test)) {
        add({ rule: 'pkg-no-test', severity: 'low', title: 'No real test script', file: 'package.json', line: null,
          detail: 'There is no `test` script, so CI has nothing to run.', recommendation: 'Add a test command.' });
      }
    }
    if (!['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb', 'bun.lock'].some(has)) {
      add({ rule: 'pkg-no-lockfile', severity: 'low', title: 'No dependency lockfile', file: 'package.json', line: null,
        detail: 'Installs can resolve different versions on different days.', recommendation: 'Commit the lockfile.' });
    }
  }
  if (rootFiles.some(f => /^(requirements.*\.txt|pyproject\.toml|setup\.py|Pipfile)$/.test(f))) ecosystems.push('python');
  if (has('go.mod')) ecosystems.push('go');
  if (has('Cargo.toml')) ecosystems.push('rust');
  const req = facts.text['requirements.txt'];
  if (req !== undefined) {
    const loose = req.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#') && !l.startsWith('-') && !/[=<>~!]=?|@/.test(l));
    if (loose.length) {
      add({ rule: 'py-unpinned', severity: 'info', title: 'Unpinned Python requirements', file: 'requirements.txt', line: null,
        detail: `${loose.length} requirement(s) have no version constraint.`, recommendation: 'Pin versions or use a lock file.' });
    }
  }

  // workflows and docker
  for (const p of workflows) if (facts.text[p] !== undefined) checkWorkflow(p, facts.text[p], add);
  const hasDockerignore = has('.dockerignore');
  for (const p of dockerfiles) if (facts.text[p] !== undefined) checkDockerfile(p, facts.text[p], hasDockerignore, add);
  if (workflows.length === 0 && (ecosystems.length > 0 || dockerfiles.length > 0)) {
    add({ rule: 'no-ci', severity: 'info', title: 'No GitHub Actions workflow', file: null, line: null,
      detail: 'No .github/workflows file was found, so nothing runs automatically on push.', recommendation: 'Add a minimal test workflow if you want CI.' });
  }
  if (!rootFiles.some(f => /^README(\..+)?$/i.test(f))) {
    add({ rule: 'no-readme', severity: 'info', title: 'No README', file: null, line: null,
      detail: 'A README helps you and others run the project.', recommendation: 'Add one.' });
  }

  findings.sort((a, b) =>
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
    (a.file ?? '').localeCompare(b.file ?? '') || (a.line ?? 0) - (b.line ?? 0));
  const truncated = findings.length > MAX_LOCAL_FINDINGS;
  const kept = findings.slice(0, MAX_LOCAL_FINDINGS).map(x => ({
    ...x,
    title: sanitizeDigestText(x.title, 120),
    file: x.file === null ? null : sanitizeDigestText(x.file, 200),
    detail: sanitizeDigestText(x.detail, 300),
    recommendation: sanitizeDigestText(x.recommendation, 300),
  }));
  const summary: Record<Severity, number> = { high: 0, medium: 0, low: 0, info: 0 };
  for (const x of findings) summary[x.severity] += 1;

  const limits = [
    'Rules are fixed heuristics; a clean result does not mean the project is safe.',
    'Git state is read from .git files only (branch and remote URLs); uncommitted changes, history and tracked-file status are not inspected.',
    'Dependency vulnerabilities (npm audit and similar) are not checked: that needs a network call.',
    'Files larger than 256 KB, binary files and ignored build/vendor folders are skipped.',
  ];
  if (facts.truncated) limits.push('The file-count or size limit was reached, so part of the project was not scanned (the project root and shallow folders are read first).');
  if (facts.skippedLarge > 0) limits.push(`${facts.skippedLarge} large file(s) were skipped.`);
  if (truncated) limits.push(`Only the first ${MAX_LOCAL_FINDINGS} findings are listed.`);

  return {
    schema: LOCAL_CHECK_SCHEMA,
    generated_at_utc: now.toISOString(),
    root_name: sanitizeDigestText(facts.rootName, 80),
    scope_note: LOCAL_CHECK_SCOPE_NOTE,
    facts: {
      files_scanned: facts.filesScanned, truncated: facts.truncated, skipped_large: facts.skippedLarge,
      git: {
        present: facts.git.present,
        head_ref: facts.git.headRef === null ? null : sanitizeDigestText(facts.git.headRef, 120),
        detached: facts.git.detached,
        remotes: facts.git.remoteUrls.map(u => sanitizeDigestText(maskUrl(u), 200)),
      },
      ecosystems, ci_workflows: workflows.length, dockerfiles: dockerfiles.length,
    },
    summary, findings: kept, findings_truncated: truncated, limits,
  };
}

const cell = (v: string) => v.replace(/\|/g, '/').replace(/[\r\n]+/g, ' ');

export function localCheckMarkdown(r: LocalCheckReport): string {
  const g = r.facts.git;
  const lines = [
    `# Local project check: ${cell(r.root_name)}`, '',
    `Generated (UTC): ${r.generated_at_utc}. Files scanned: ${r.facts.files_scanned}. Ecosystems: ${r.facts.ecosystems.join(', ') || 'none detected'}. ` +
      `Workflows: ${r.facts.ci_workflows}. Dockerfiles: ${r.facts.dockerfiles}.`,
    `Git: ${g.present ? `branch ${g.head_ref ?? 'unknown'}${g.detached ? ' (detached)' : ''}; remotes ${g.remotes.join(', ') || 'none'}` : 'no .git folder'}.`,
    `Findings: ${r.summary.high} high, ${r.summary.medium} medium, ${r.summary.low} low, ${r.summary.info} info.`, '',
    `Scope: ${r.scope_note}`, '',
  ];
  if (r.findings.length === 0) lines.push('No findings from the fixed rules (this is not a safety claim).', '');
  else {
    lines.push('| Severity | Finding | Where | What | Suggested fix |', '| --- | --- | --- | --- | --- |');
    for (const x of r.findings) {
      lines.push(`| ${x.severity} | ${cell(x.title)} | ${cell(x.file ?? '-')}${x.line ? `:${x.line}` : ''} | ${cell(x.detail)} | ${cell(x.recommendation)} |`);
    }
    lines.push('');
  }
  lines.push('Limits:', ...r.limits.map(l => `- ${l}`), '');
  return lines.join('\n');
}
