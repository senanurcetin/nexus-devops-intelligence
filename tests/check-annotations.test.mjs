import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collectCheckAnnotations, validateAnnotationTarget } from '../src/lib/nexus-check-annotations.mjs';

const repository = 'owner/example';
const sha = 'a'.repeat(40);
const checkRunId = 1729;
const run = { id: checkRunId, head_sha: sha, output: { annotations_count: 2 } };
const message = 'Failure: type mismatch';
const annotations = [
  { path: 'src/index.ts', start_line: 12, end_line: 12, annotation_level: 'failure',
    title: 'Typecheck', message },
  { path: 'src/lib/x.js', start_line: 21, end_line: 23, annotation_level: 'warning',
    title: 'Build warning', message: 'Consider a patch' },
];
const json = (body, code = 200, headers = {}) => new Response(JSON.stringify(body), {
  status: code, headers: { 'Content-Type': 'application/json', ...headers },
});
function fakeFetch(targetRun = run, entries = annotations, seen = []) {
  return async (url, options) => {
    seen.push({ url, options });
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, undefined);
    assert.match(url, /^https:\/\/api\.github\.com\/repos\/owner\/example\/check-runs\/1729/);
    return json(url.includes('/annotations?') ? entries : targetRun);
  };
}
const get = (fetcher, opts = {}) => collectCheckAnnotations({
  repository, sha, checkRunId, fetcher, now: () => new Date('2026-11-02T10:00:00.000Z'), ...opts,
});

test('selects only annotations for the exact requested commit, without tokens or full logs', async () => {
  const seen = [];
  const result = await get(fakeFetch(run, annotations, seen));
  assert.equal(result.ok, true);
  assert.equal(result.schema, 'nexus.devops.check-annotations/v1');
  assert.equal(result.annotation_count, 2);
  assert.equal(result.annotations[0].path, 'src/index.ts');
  assert.equal(result.annotations[0].start_line, 12);
  assert.equal(result.annotations[0].message, message);
  assert.equal(result.access.authentication_used, false);
  assert.equal(result.access.paid_api_used, false);
  assert.equal(result.source_url, 'https://github.com/owner/example/commit/' + sha + '/checks');
  assert.equal(seen.length, 2);
  assert.match(seen[1].url, /\/annotations\?per_page=20&page=1$/);
  assert.equal(JSON.stringify(result).includes('raw_details'), false);
});

test('mismatched run identity stops before reading annotations', async () => {
  const seen = [];
  const result = await get(fakeFetch({ ...run, head_sha: 'b'.repeat(40) }, annotations, seen));
  assert.equal(result.ok, false);
  assert.equal(result.state, 'identity_mismatch');
  assert.equal(seen.length, 1);
});

test('zero annotations does not waste a second GitHub request', async () => {
  const seen = [];
  const result = await get(fakeFetch({ ...run, output: { annotations_count: 0 } }, [], seen));
  assert.equal(result.ok, true);
  assert.equal(result.sampled_annotations, 0);
  assert.equal(seen.length, 1);
});

test('credential-shaped message content is redacted before truncation', async () => {
  const secret = 'ghp_' + 'x'.repeat(35);
  const payload = [{ ...annotations[0], message: 'x'.repeat(400) + secret }];
  const result = await get(fakeFetch({ ...run, output: { annotations_count: 1 } }, payload));
  assert.equal(result.ok, true);
  assert.equal(result.annotations[0].message, '[redacted: possible credential]');
  assert.equal(JSON.stringify(result).includes(secret), false);
});

test('malicious path traversal or credential-shaped file path fails closed', async () => {
  for (const path of ['../secret.env', 'C:\\private\\id', '/etc/passwd', 'a//b', 'ghp_' + 'x'.repeat(35)]) {
    const response = await get(fakeFetch({ ...run, output: { annotations_count: 1 } }, [
      { ...annotations[0], path },
    ]));
    assert.equal(response.ok, false, path);
    assert.equal(response.state, 'invalid');
  }
});

test('more than 20 returned annotations and incorrect GitHub response fail closed', async () => {
  const many = await get(fakeFetch({ ...run, output: { annotations_count: 100 } },
    Array.from({ length: 21 }, () => annotations[0])));
  assert.equal(many.ok, false);
  assert.equal(many.state, 'invalid');
  const response = await get(async () => new Response('<html/>', {
    status: 200, headers: { 'Content-Type': 'text/html' },
  }));
  assert.equal(response.ok, false);
  assert.equal(response.state, 'invalid');
});

test('bounded samples mark truncation instead of pretending all annotations were checked', async () => {
  const result = await get(fakeFetch({ ...run, output: { annotations_count: 35 } }, annotations));
  assert.equal(result.ok, true);
  assert.equal(result.truncated, true);
});

test('rate limits, network failures and invalid check-run target do not become success', async () => {
  assert.deepEqual(await get(async () => json({}, 429)), { ok: false, state: 'rate_limited' });
  assert.deepEqual(await get(async () => { throw new Error('offline'); }), { ok: false, state: 'unavailable' });
  for (const id of [0, -1, 'NaN', '123x', 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => validateAnnotationTarget(repository, sha, id));
  }
  assert.throws(() => validateAnnotationTarget('owner/../evil', sha, 123));
  assert.throws(() => validateAnnotationTarget(repository, 'main', 123));
});

test('CLI refuses malformed target before making any network request', () => {
  const file = fileURLToPath(new URL('../scripts/jarvis-check-annotations.mjs', import.meta.url));
  const processResult = spawnSync(process.execPath, [file, '--json', repository, sha, 'invalid'], {
    encoding: 'utf8',
  });
  assert.equal(processResult.status, 2);
  assert.match(processResult.stderr, /check run ID/i);
});
