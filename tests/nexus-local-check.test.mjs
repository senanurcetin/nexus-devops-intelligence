import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, parse } from 'node:path';
import { analyzeLocalProject, localCheckMarkdown, LOCAL_CHECK_SCOPE_NOTE } from '../src/lib/nexus-local-check.ts';
import { collectLocalFacts, assertScannableRoot, MAX_FILES } from '../src/lib/nexus-local-check-collect.ts';

const now = new Date('2026-10-30T12:00:00.000Z');
// Credential-shaped values are built at run time so this file itself contains no secret-looking literal.
const GH = 'gh' + 'p_' + 'a1B2c3D4e5'.repeat(4);
const AWS = 'AK' + 'IA' + 'ABCDEFGHIJKLMNOP';
const PEM = '-----BEGIN ' + 'RSA PRIVATE KEY-----';
const SHA = 'a'.repeat(40);
const LOOSE = ['an-actual-looking', 'long-value-123'].join('-');
const assign = (name, value) => `${name} = "${value}"`;

const facts = (text, extraFiles = [], git = { present: false, headRef: null, detached: false, remoteUrls: [] }) => ({
  rootName: 'proj', filesScanned: Object.keys(text).length + extraFiles.length, truncated: false, skippedLarge: 0,
  files: [...Object.keys(text), ...extraFiles], text, git,
});
const run = (text, extra, git) => analyzeLocalProject(facts(text, extra, git), now);
const ids = r => r.findings.map(f => f.id.split('#')[0]);
const find = (r, rule) => r.findings.find(f => f.id.startsWith(rule + '#'));

test('workflow: pull_request_target with PR head is high, without it medium', () => {
  const risky = run({ '.github/workflows/a.yml':
    'on:\n  pull_request_target:\njobs:\n  b:\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n' });
  assert.equal(find(risky, 'wf-pull-request-target').severity, 'high');
  const plain = run({ '.github/workflows/a.yml': 'on:\n  pull_request_target:\npermissions:\n  contents: read\njobs: {}\n' });
  assert.equal(find(plain, 'wf-pull-request-target').severity, 'medium');
});

test('workflow: script injection is flagged in run blocks but not in env (the safe pattern)', () => {
  const bad = run({ '.github/workflows/i.yml':
    'on: issues\npermissions: {}\njobs:\n  j:\n    steps:\n      - run: |\n          echo "${{ github.event.issue.title }}"\n' });
  assert.equal(find(bad, 'wf-script-injection').severity, 'high');
  assert.equal(find(bad, 'wf-script-injection').line, 7);
  const inline = run({ '.github/workflows/i.yml': 'on: issues\npermissions: {}\njobs:\n  j:\n    steps:\n      - run: echo ${{ github.head_ref }}\n' });
  assert.ok(find(inline, 'wf-script-injection'));
  const safe = run({ '.github/workflows/i.yml':
    'on: issues\npermissions: {}\njobs:\n  j:\n    steps:\n      - name: x\n        env:\n          TITLE: ${{ github.event.issue.title }}\n        run: |\n          echo "$TITLE"\n' });
  assert.equal(find(safe, 'wf-script-injection'), undefined);
});

test('workflow: permissions, unpinned actions, pipe to shell, timeouts', () => {
  const r = run({ '.github/workflows/w.yml':
    `on: push\njobs:\n  j:\n    steps:\n      - uses: actions/checkout@v4\n      - uses: some/thing@v1\n      - uses: pinned/x@${SHA}\n      - run: curl -fsSL https://x.example/i.sh | bash\n` });
  assert.ok(find(r, 'wf-no-permissions'));
  assert.equal(find(r, 'wf-unpinned-actions').severity, 'low');
  assert.match(find(r, 'wf-unpinned-actions').detail, /2 action reference/);
  assert.ok(find(r, 'wf-pipe-to-shell'));
  assert.ok(find(r, 'wf-no-timeout'));
  const clean = run({ '.github/workflows/w.yml':
    `on: push\npermissions:\n  contents: read\njobs:\n  j:\n    timeout-minutes: 5\n    steps:\n      - uses: actions/checkout@${SHA}\n` });
  assert.deepEqual(ids(clean).filter(i => i.startsWith('wf-')), []);
});

test('secrets: detected by kind and line, value never present in any output', () => {
  const r = run({
    'src/a.js': `const t = '${GH}';\nconst k = '${AWS}';\n`,
    'keys/id': PEM,
    'src/b.py': assign('password', LOOSE) + '\n' + assign('api_key', 'your_api_key_here_please_replace') + '\n',
    'package-lock.json': `{"x":"${GH}"}`,
  }, ['keys/id']);
  const kinds = r.findings.filter(f => f.id.startsWith('secret-'));
  assert.ok(kinds.some(f => f.id.startsWith('secret-github-token') && f.file === 'src/a.js' && f.line === 1));
  assert.ok(kinds.some(f => f.id.startsWith('secret-aws-access-key') && f.line === 2));
  assert.ok(kinds.some(f => f.id.startsWith('secret-private-key')));
  assert.ok(kinds.some(f => f.id.startsWith('secret-generic-secret') && f.file === 'src/b.py' && f.line === 1));
  assert.equal(kinds.filter(f => f.file === 'src/b.py').length, 1); // placeholder line ignored
  assert.equal(kinds.filter(f => f.file === 'package-lock.json').length, 0); // lockfiles skipped
  const inTests = run({ 'tests/a.test.mjs': 'const ' + assign('token', LOOSE) + ';\n' + `const k = '${AWS}';\n` });
  assert.equal(inTests.findings.find(f => f.id.startsWith('secret-generic-secret')).severity, 'low'); // fixture noise
  assert.equal(inTests.findings.find(f => f.id.startsWith('secret-aws-access-key')).severity, 'medium'); // real shape in a test file: one step down, still listed
  const outsideTests = run({ 'src/a.test-helper.js': `const k = '${AWS}';\n`, 'latest/a.js': `const k = '${AWS}';\n` });
  assert.ok(outsideTests.findings.filter(f => f.id.startsWith('secret-aws-access-key')).every(f => f.severity === 'high')); // "latest/" is not a test folder
  const envRead = run({ 'src/x.py': 'api_key = "os.getenv(\'SOME_KEY_NAME_FOR_X\')"\napi_key : "process.env.SOME_KEY_NAME_X"\n' });
  assert.equal(envRead.findings.filter(f => f.id.startsWith('secret-')).length, 0); // reading from the environment is the safe pattern
  const out = JSON.stringify(r) + localCheckMarkdown(r);
  for (const secret of [GH, AWS, LOOSE]) assert.ok(!out.includes(secret));
});

test('collector: root files are read first even when a huge sub-folder exhausts the budget', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nexus-lc-bfs-'));
  try {
    mkdirSync(join(dir, '.aaa-huge'), { recursive: true });
    for (let i = 0; i < MAX_FILES + 50; i += 1) writeFileSync(join(dir, '.aaa-huge', `f${i}.txt`), 'x');
    writeFileSync(join(dir, 'pyproject.toml'), '[project]\nname = "x"\n');
    writeFileSync(join(dir, 'README.md'), 'hi');
    const f = collectLocalFacts(dir);
    assert.equal(f.truncated, true);
    assert.ok(f.files.includes('pyproject.toml') && f.files.includes('README.md')); // sorts after the huge folder but is read first
    const r = analyzeLocalProject(f, now);
    assert.deepEqual(r.facts.ecosystems, ['python']);
    assert.ok(r.limits.some(l => /not scanned/.test(l)));
    assert.ok(!r.findings.some(x => x.id.startsWith('no-readme')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('env file and gitignore', () => {
  const loose = run({ '.env': 'A=1\n', '.gitignore': 'dist/\n' });
  assert.equal(find(loose, 'env-file').severity, 'high');
  const ignored = run({ '.env': 'A=1\n', '.env.example': 'A=\n', '.gitignore': '.env\nnode_modules/\n' });
  assert.equal(find(ignored, 'env-file').severity, 'info');
  assert.equal(ignored.findings.filter(f => f.id.startsWith('env-file#')).length, 1); // .env.example is fine
  const none = run({ 'package.json': '{"scripts":{"test":"x"}}', 'package-lock.json': '{}' });
  assert.ok(find(none, 'no-gitignore'));
  const missingModules = run({ 'package.json': '{"scripts":{"test":"x"}}', '.gitignore': 'dist/\n' });
  assert.ok(find(missingModules, 'gitignore-node-modules'));
});

test('git remote with embedded credentials is high and never echoed', () => {
  const secretUrl = `https://octo:${GH}@github.com/o/r.git`;
  const r = run({}, [], { present: true, headRef: 'main', detached: false, remoteUrls: [secretUrl, 'git@github.com:o/r.git', 'ssh://git@github.com/o/r.git'] });
  assert.equal(r.findings.filter(f => f.id.startsWith('git-remote-credentials#')).length, 1);
  const out = JSON.stringify(r) + localCheckMarkdown(r);
  assert.ok(!out.includes(GH) && !out.includes('octo:'));
  assert.ok(r.facts.git.remotes.includes('https://github.com/o/r.git'));
});

test('package.json: install scripts, missing test and lockfile', () => {
  const r = run({ 'package.json': '{"scripts":{"postinstall":"node x.js","test":"echo \\"Error: no test specified\\" && exit 1"}}', '.gitignore': 'node_modules\n' });
  assert.equal(find(r, 'pkg-install-scripts').severity, 'medium');
  assert.ok(find(r, 'pkg-no-test'));
  assert.ok(find(r, 'pkg-no-lockfile'));
  const bad = run({ 'package.json': '{oops' });
  assert.ok(find(bad, 'pkg-invalid'));
});

test('Dockerfile rules', () => {
  const r = run({ Dockerfile: 'FROM node:latest\nADD https://x.example/a.tgz /a\nRUN curl -sSL https://x.example/i | sh\nCOPY . .\n' });
  for (const rule of ['docker-floating-base', 'docker-add-url', 'docker-pipe-to-shell', 'docker-runs-as-root', 'docker-no-dockerignore']) {
    assert.ok(find(r, rule), rule);
  }
  const ok = run({ Dockerfile: 'FROM node:22.4.0-slim AS build\nFROM node:22.4.0-slim\nUSER app\nCOPY . .\n', '.dockerignore': '.git\n' });
  assert.deepEqual(ids(ok).filter(i => i.startsWith('docker-')), []);
});

test('findings are ordered by severity and hostile text is neutralised in Markdown', () => {
  const evil = 'src/a|b\u202e\nINJECT.js';
  const r = run({ [evil]: `x = '${AWS}'`, 'README.md': 'hi' });
  assert.equal(r.findings[0].severity, 'high');
  assert.ok(!r.findings[0].file.includes('\u202e'));
  const md = localCheckMarkdown(r);
  const row = md.split('\n').find(l => l.startsWith('| high |'));
  assert.ok(row);
  assert.equal(row.split(' | ').length, 5);
  assert.ok(md.includes(LOCAL_CHECK_SCOPE_NOTE));
  assert.match(md, /clean result does not mean the project is safe/i); // never claims safety, only disclaims it
  assert.doesNotMatch(md.replace(/does not mean the project is safe/gi, ''), /\b(is|are) safe\b|no issues found/i);
});

test('collector: skips vendor folders, parses .git HEAD and remotes, refuses a drive root', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nexus-lc-'));
  try {
    mkdirSync(join(dir, 'node_modules', 'dep'), { recursive: true });
    mkdirSync(join(dir, '.git'), { recursive: true });
    mkdirSync(join(dir, '.github', 'workflows'), { recursive: true });
    writeFileSync(join(dir, 'node_modules', 'dep', 'index.js'), `x='${GH}'`);
    writeFileSync(join(dir, '.git', 'HEAD'), 'ref: refs/heads/feature/x\n');
    writeFileSync(join(dir, '.git', 'config'), '[remote "origin"]\n\turl = https://github.com/o/r.git\n');
    writeFileSync(join(dir, '.github', 'workflows', 'ci.yml'), 'on: push\n');
    writeFileSync(join(dir, 'a.bin'), Buffer.from([0, 1, 2]));
    writeFileSync(join(dir, 'big.js'), 'x'.repeat(300 * 1024));
    writeFileSync(join(dir, 'ok.js'), 'const a = 1;\n');
    const f = collectLocalFacts(dir);
    assert.ok(f.files.includes('ok.js') && f.files.includes('.github/workflows/ci.yml'));
    assert.ok(!f.files.some(p => p.startsWith('node_modules/') || p.startsWith('.git/')));
    assert.equal(f.skippedLarge, 1);
    assert.equal(f.git.headRef, 'feature/x');
    assert.deepEqual(f.git.remoteUrls, ['https://github.com/o/r.git']);
    assert.equal(f.text['ok.js'], 'const a = 1;\n');
    assert.equal(f.text['a.bin'], undefined);
    const r = analyzeLocalProject(f, now);
    assert.equal(r.findings.filter(x => x.id.startsWith('secret-')).length, 0); // vendor folder never scanned
    assert.equal(r.facts.ci_workflows, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
  assert.throws(() => assertScannableRoot(parse(process.cwd()).root), /filesystem root/);
  assert.throws(() => assertScannableRoot(join(tmpdir(), 'definitely-missing-nexus-dir')), /does not exist/);
  assert.ok(MAX_FILES > 0);
});

test('CLI: bad arguments exit 2; a folder with a secret exits 1 and prints no secret', () => {
  const cli = args => spawnSync(process.execPath, ['--import', 'tsx', 'scripts/jarvis-localcheck.mjs', ...args], { encoding: 'utf8' });
  assert.equal(cli([]).status, 2);
  assert.equal(cli(['a', 'b']).status, 2);
  assert.equal(cli([join(tmpdir(), 'definitely-missing-nexus-dir')]).status, 2);
  const dir = mkdtempSync(join(tmpdir(), 'nexus-lc-cli-'));
  try {
    writeFileSync(join(dir, 'a.js'), `const t = '${GH}';\n`);
    const res = cli(['--json', dir]);
    assert.equal(res.status, 1);
    assert.ok(!res.stdout.includes(GH));
    const json = JSON.parse(res.stdout);
    assert.equal(json.schema, 'nexus.devops.local-check/v1');
    assert.ok(json.summary.high >= 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
