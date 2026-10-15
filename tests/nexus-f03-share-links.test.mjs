import test from 'node:test';
import assert from 'node:assert/strict';
import { readRepositoryLink, buildRepositoryShareUrl, canonicalRepositoryPageUrl } from '../src/lib/nexus-repository-link.ts';
import { readFileSync } from 'node:fs';

test('F-03: missing repo parameter preserves explicit default-selection route', () => {
  assert.deepEqual(readRepositoryLink(''), { kind: 'absent' });
  assert.deepEqual(readRepositoryLink('?utm_campaign=test&source=search'), { kind: 'absent' });
  assert.deepEqual(readRepositoryLink('?repository=owner/repo'), { kind: 'absent' });
});

test('F-03: canonical, URL-encoded and case-sensitive public repository selections', () => {
  const valid = ['?repo=owner%2Frepo', '?repo=Owner-1%2FRepo.Name_2', '?repo=owner/repo', '?tab=metrics&repo=o%2Fr'];
  for (const search of valid) {
    const expected = new URLSearchParams(search).get('repo');
    assert.deepEqual(readRepositoryLink(search), { kind: 'valid', repository: expected });
  }
});

test('F-03: reject duplicate, empty, malformed or special URL parameters before any fetch', () => {
  const invalid = [
    '?repo=', '?repo=owner%2F', '?repo=%2Frepo', '?repo=.', '?repo=owner%2F..',
    '?repo=owner%2Frepo%2Fextra', '?repo=https%3A%2F%2Fevil.invalid%2Fget',
    '?repo=owner%40evil.invalid%2Frepo', '?repo=%0Aowner%2Frepo',
    '?repo=%20owner%2Frepo', '?repo=owner%2Frepo%20', '?repo=owner%2Frepo&repo=owner%2Fother',
    '?repo=owner%2Frepo&repo=', '?repo=%EF%BF%BD%2Frepo',
    '?repo=owner%252Frepo', '?repo=owner%2Frepo%3Ftoken%3Dprivate',
    '?repo=' + 'r'.repeat(205), '?repo=owner%2Frepo%23fragment',
    '?repo=owner%2Frepo%26token%3Dabc', '?repo=owner%5Crepo',
  ];
  for (const search of invalid) {
    assert.deepEqual(readRepositoryLink(search), { kind: 'invalid' }, search);
  }
});

test('F-03: generated link contains only public owner/repo and not unrelated query or hash', () => {
  const url = buildRepositoryShareUrl(
    'https://nexus.example/?utm_token=discard&repo=old%2Frepo#investigations',
    'Owner/Repo.One',
  );
  assert.equal(url, 'https://nexus.example/?repo=Owner%2FRepo.One');
  assert.deepEqual(readRepositoryLink(new URL(url).search), {
    kind: 'valid', repository: 'Owner/Repo.One',
  });
  assert.doesNotMatch(url, /utm|token|investigations/);
});

test('F-03: reject invalid generated repository, URL schemes and missing host', () => {
  assert.throws(() => buildRepositoryShareUrl('https://nexus.example/', '../file'));
  assert.throws(() => buildRepositoryShareUrl('https://nexus.example/', 'owner/repo?token=123'));
  assert.throws(() => buildRepositoryShareUrl('javascript:alert(1)', 'owner/repo'));
  assert.throws(() => buildRepositoryShareUrl('file:///etc/passwd', 'owner/repo'));
  assert.throws(() => buildRepositoryShareUrl('about:blank', 'owner/repo'));
});

test('F-03: source does not use storage, remote URL fetch or privileged integration', () => {
  const helper = readFileSync('src/lib/nexus-repository-link.ts', 'utf8');
  const page = readFileSync('src/app/page.tsx', 'utf8');
  assert.ok(page.includes("window.addEventListener('popstate', syncLocation)"));
  assert.ok(page.includes("window.removeEventListener('popstate', syncLocation)"));
  assert.ok(page.includes('activeRepositoryRef.current !== nextRepo'));
  assert.ok(page.includes("window.history.pushState(null, '', shareUrl)"));
  assert.ok(page.includes("window.history.replaceState(null, '', shareUrl)"));
  assert.ok(page.includes("Invalid repository in shared link."));
  assert.ok(page.includes('Copy repository link'));
  assert.ok(page.includes('Shareable repository link'));
  assert.ok(page.includes('navigator.clipboard.writeText(url)'));
  assert.ok(!helper.includes('fetch('));
  assert.ok(!helper.includes('localStorage'));
  assert.ok(!helper.includes('sessionStorage'));
  assert.ok(!helper.includes('Authorization'));
});

test('F-03: loaded valid share strips untrusted search keys and fragments without changing repo', () => {
  const current='https://nexus.example/?token=PRIVATE&repo=owner%2Frepo&extra=1#secret';
  const selected=readRepositoryLink(new URL(current).search);
  assert.deepEqual(selected,{kind:'valid',repository:'owner/repo'});
  const canonical=canonicalRepositoryPageUrl(current,selected);
  assert.equal(canonical,'https://nexus.example/?repo=owner%2Frepo');
  assert.equal(readRepositoryLink(new URL(canonical).search).kind,'valid');
  assert.doesNotMatch(canonical,/token|PRIVATE|extra|secret/);
  assert.equal(canonicalRepositoryPageUrl(canonical,selected),canonical,
    'canonicalization must be idempotent; no repeated history edits');
});

test('F-03: invalid and absent selections scrub URL without selecting a new repo', () => {
  const invalid='https://nexus.example/?repo=owner%2Frepo&repo=other%2Frepo&secret=token#s';
  const parsed=readRepositoryLink(new URL(invalid).search);
  assert.equal(parsed.kind,'invalid');
  assert.equal(canonicalRepositoryPageUrl(invalid,parsed),'https://nexus.example/');
  const absent='https://nexus.example/?utm_campaign=campaign&api_key=DO-NOT-RETAIN#secret';
  assert.equal(readRepositoryLink(new URL(absent).search).kind,'absent');
  assert.equal(canonicalRepositoryPageUrl(absent,{kind:'absent'}),'https://nexus.example/');
  assert.throws(()=>canonicalRepositoryPageUrl('javascript:alert(1)',{kind:'absent'}));
  assert.throws(()=>canonicalRepositoryPageUrl('file:///tmp/token',{kind:'absent'}));
  assert.throws(()=>canonicalRepositoryPageUrl('https://user:pw@nexus.example/',{kind:'absent'}));
});
