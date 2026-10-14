import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const runner = fileURLToPath(new URL('../scripts/manual-browser-f01-f05.mjs', import.meta.url));

test('manual browser regression denies production, preview, and non-loopback origins before launch', () => {
  for (const value of [
    'https://nexus-devops-intelligence.vercel.app/',
    'https://nexus-devops-intelligence-qwftzbzic-senanurs-projects-102fb36c.vercel.app/',
    'http://example.com:3000/',
    'http://127.0.0.1:3000/api/public-actions',
    'http://user:password@127.0.0.1:3000/',
    'http://127.0.0.1:3000/?token=unwanted',
  ]) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', runner], {
      env: {...process.env, NEXUS_BROWSER_BASE_URL: value},
      encoding:'utf8', timeout:7000,
    });
    assert.notEqual(result.status, 0, value);
    assert.match(result.stderr, /Browser regression is loopback-only/);
    assert.doesNotMatch(result.stdout, /scenario|PASSED/);
  }
});

test('manual multi-engine runner refuses unsupported browser engines before any launch', () => {
  for (const value of ['safari','chromium --unsafe','WebKit','', '../webkit']) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', runner], {
      env: {...process.env, NEXUS_BROWSER_BASE_URL:'http://127.0.0.1:3000/',
        NEXUS_BROWSER_ENGINE:value || 'unsupported-empty'},
      encoding:'utf8', timeout:7000,
    });
    assert.notEqual(result.status,0,value);
    assert.match(result.stderr,/NEXUS_BROWSER_ENGINE must be chromium, firefox or webkit/);
    assert.doesNotMatch(result.stdout,/scenario|PASSED/);
  }
});
