import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// These are public navigation entry points, not a claim that every legacy doc
// has been audited. Links are checked entirely offline during npm test.
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PUBLIC_DOCUMENTS = [
  'README.md',
  'CONTRIBUTING.md',
  'AGENTS.md',
  'docs/CODEX_AMBASSADOR_PUBLIC_PORTFOLIO_20261030.md',
  'docs/CODEX_TIMESTAMP_10_MIN_WORKSHOP_TR.md',
  'docs/CODEX_TIMESTAMP_PUBLICATION_KIT.md',
  'docs/CODEX_TIMESTAMP_REGRESSION_TUTORIAL_TR.md',
  'docs/CODEX_CONTENT_ROADMAP_2026_2027.md',
  'docs/CODEX_WATCHLIST_TRUST_BOUNDARY_TUTORIAL_TR.md',
];

function markdownTargets(markdown) {
  const targets = [];
  let fence = null;
  for (const line of markdown.split(/\r?\n/)) {
    const opener = /^\s{0,3}(\x60{3,}|~{3,})/.exec(line);
    if (opener) {
      const marker = opener[1];
      if (fence === null) fence = { char: marker[0], length: marker.length };
      else if (marker[0] === fence.char && marker.length >= fence.length) fence = null;
      continue;
    }
    if (fence !== null) continue;

    // Ignore illustrative inline code and code fences, but include Markdown
    // image and document links. Fragment anchors themselves are out of scope.
    const prose = line.replace(/\x60[^\x60\n]*\x60/g, '');
    const pattern = /!?\[[^\]\n]*\]\((<[^>\n]+>|[^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'))?\)/g;
    for (const match of prose.matchAll(pattern)) {
      const raw = match[1];
      targets.push(raw.startsWith('<') ? raw.slice(1, -1) : raw);
    }
  }
  return targets;
}

function linkProblems(documentPath, markdown, exists = existsSync) {
  const failures = [];
  const fileDir = dirname(resolve(ROOT, documentPath));
  for (const href of markdownTargets(markdown)) {
    if (href.startsWith('#') || /^https?:\/\//i.test(href) || /^mailto:/i.test(href)) continue;
    if (href.startsWith('//') || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(href)) {
      failures.push({ documentPath, href, reason: 'unsupported or unsafe URL scheme' });
      continue;
    }
    let target;
    try {
      target = decodeURIComponent(href.split(/[?#]/)[0]);
    } catch {
      failures.push({ documentPath, href, reason: 'malformed percent encoding' });
      continue;
    }
    if (!target || target.includes('\\') || isAbsolute(target)) {
      failures.push({ documentPath, href, reason: 'empty, absolute or nonportable target' });
      continue;
    }
    const resolved = resolve(fileDir, target);
    const inside = relative(ROOT, resolved);
    if (inside === '..' || inside.startsWith('..' + sep) || isAbsolute(inside)) {
      failures.push({ documentPath, href, reason: 'target escapes repository' });
      continue;
    }
    if (!exists(resolved)) {
      failures.push({ documentPath, href, reason: 'target file not found' });
      continue;
    }
  }
  return failures;
}

test('public Codex education and contributor links resolve without network', () => {
  const failures = [];
  let inspected = 0;
  for (const doc of PUBLIC_DOCUMENTS) {
    const source = resolve(ROOT, doc);
    assert.equal(statSync(source).isFile(), true, doc);
    const markdown = readFileSync(source, 'utf8');
    inspected += markdownTargets(markdown).length;
    failures.push(...linkProblems(doc, markdown));
  }
  assert.ok(inspected >= 100, 'expected to check public navigation, not an empty fixture');
  assert.deepEqual(failures, []);
});

test('code fences, inline code, external HTTPS and fragment links are not local files', () => {
  const text = [
    '# Example',
    '[real](CONTRIBUTING.md) and [section](#overview)',
    '[external](https://github.com/example/repo) [mail](mailto:author@example.com)',
    '~~~md',
    '[example only](not-a-real-document.md)',
    '~~~',
    'Inline ' + String.fromCharCode(96) + '[example](missing-inline.md)' + String.fromCharCode(96),
  ].join('\n');
  assert.deepEqual(linkProblems('README.md', text), []);
});

test('missing and escaping local paths are rejected even if a caller says they exist', () => {
  const text = [
    '[missing](no-such-file.md)',
    '[escape](../../../../outside.md)',
    '[bad absolute](/etc/passwd)',
  ].join('\n');
  const problems = linkProblems('docs/CODEX_TIMESTAMP_10_MIN_WORKSHOP_TR.md', text, () => false);
  assert.deepEqual(problems.map(item => item.reason),
    ['target file not found', 'target escapes repository', 'empty, absolute or nonportable target']);
});

test('unsafe link schemes and malformed percent encoding fail closed', () => {
  const text = '[js](javascript:alert) [file](file:///tmp/something) [encoded](no-such-%ZZ.md)';
  const problems = linkProblems('README.md', text);
  assert.deepEqual(problems.map(item => item.reason),
    ['unsupported or unsafe URL scheme', 'unsupported or unsafe URL scheme', 'malformed percent encoding']);
});
