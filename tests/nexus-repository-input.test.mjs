import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeRepositoryInput,
  buildRepositoryShareUrl,
  readRepositoryLink,
} from '../src/lib/nexus-repository-link.ts';

test('repository search: accepts owner/repo and canonical HTTPS GitHub repository root links', () => {
  for (const [input, expected] of [
    ['owner/repo', 'owner/repo'],
    ['  Owner-1/Repo.Name_2  ', 'Owner-1/Repo.Name_2'],
    ['https://github.com/owner/repo', 'owner/repo'],
    ['https://github.com/Owner-1/Repo.Name_2/', 'Owner-1/Repo.Name_2'],
    ['  https://github.com/owner/repo/  ', 'owner/repo'],
    ['HTTPS://GITHUB.COM/owner/repo', 'owner/repo'],
  ]) {
    assert.equal(normalizeRepositoryInput(input), expected, input);
    const link = buildRepositoryShareUrl('https://nexus.example/', expected);
    assert.deepEqual(readRepositoryLink(new URL(link).search), { kind: 'valid', repository: expected });
    assert.doesNotMatch(link, /github\.com|credential|token/);
  }
});

test('repository search: rejects credential URLs, lookalike hosts, HTTP, redirects and deep links', () => {
  const untrusted = [
    'http://github.com/owner/repo',
    'https://github.com.evil.example/owner/repo',
    'https://evil.example/github.com/owner/repo',
    'https://user:password@github.com/owner/repo',
    'https://github.com:444/owner/repo',
    'https://github.com/owner/repo?token=secret',
    'https://github.com/owner/repo#readme',
    'https://github.com/owner/repo/issues',
    'https://github.com/owner/repo/pull/1',
    'https://github.com/owner%2Frepo',
    'https://github.com/owner/%2Frepo',
    'https://github.com/owner/repo//',
    'https://github.com/owner/repo/../other',
    'https://github.com/owner',
    'https://github.com/owner/repo/extra',
    'owner/repo?token=secret',
    'owner/repo#fragment',
    'javascript:alert(1)',
    'file:///etc/passwd',
    '',
    'https://github.com/owner/repo\nsecret',
  ];
  for (const input of untrusted) assert.throws(() => normalizeRepositoryInput(input), input);
});

test('share URLs never retain credentials from a caller-supplied origin', () => {
  assert.throws(() => buildRepositoryShareUrl('https://user:password@nexus.example/', 'owner/repo'));
  assert.throws(() => buildRepositoryShareUrl('http://user@nexus.example/', 'owner/repo'));
  assert.equal(
    buildRepositoryShareUrl('http://localhost:3000/?secret=1#anything', 'owner/repo'),
    'http://localhost:3000/?repo=owner%2Frepo',
  );
});

test('search URL normalization is client-only; API/share URLs remain strict owner/repo', () => {
  const helper = readFileSync('src/lib/nexus-repository-link.ts', 'utf8');
  const page = readFileSync('src/app/page.tsx', 'utf8');
  assert.doesNotMatch(helper, /(?:^|\W)fetch\s*\(/);
  assert.match(page, /nextRepo = normalizeRepositoryInput\(repository\)/);
  assert.match(page, /buildRepositoryShareUrl\(window\.location\.href, nextRepo\)/);
  assert.match(page, /load\(nextRepo\)/);
  assert.deepEqual(readRepositoryLink('?repo=https%3A%2F%2Fgithub.com%2Fowner%2Frepo'), { kind: 'invalid' });
});
