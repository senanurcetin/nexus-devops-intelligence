import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Community feedback forms prohibit secret disclosure and request actionable context', () => {
  for (const path of ['.github/ISSUE_TEMPLATE/bug_report.yml', '.github/ISSUE_TEMPLATE/feature_request.yml']) {
    const form = read(path);
    assert.match(form, /^name: /m);
    assert.match(form, /^body:/m);
    assert.match(form, /private/i);
    assert.match(form, /(?:credential|token)/i);
    assert.match(form, /required: true/);
  }
  const chooser = read('.github/ISSUE_TEMPLATE/config.yml');
  assert.match(chooser, /blank_issues_enabled: false/);
  assert.match(chooser, /contact_links:/);
  assert.match(chooser, /security\/policy/);
  assert.match(chooser, /Do not disclose exploits, tokens/);
  assert.match(chooser, /CONTRIBUTING\.md/);
});

test('Community release cannot be inferred from a doc or unverified build', () => {
  const doc = read('docs/COMMUNITY_RELEASE_CHECKLIST.md');
  assert.match(doc, /NO-GO/);
  assert.match(doc, /Docker Engine 28\+/);
  assert.match(doc, /NOT RUN/);
  assert.match(doc, /localhost/);
  assert.match(doc, /0 outside users/);
  assert.match(doc, /External pilot recruitment is optional/);
  assert.match(doc, /owner-first scorecard/);
  const pr = read('.github/PULL_REQUEST_TEMPLATE.md');
  assert.match(pr, /NOT RUN/);
  assert.match(pr, /No CI, Preview, Production/);
  assert.match(pr, /## Authorship and AI assistance/);
  assert.match(pr, /reviewing, understanding and being able to explain/);
  assert.match(pr, /do not claim tests or human review/);
});
