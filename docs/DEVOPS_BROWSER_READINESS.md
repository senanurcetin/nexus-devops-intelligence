# Offline Playwright browser asset readiness

This verifies cached browser files and declared runtime dependencies only.
It does not launch a browser, run UI tests, execute a build, access the
internet, install packages or grant release permission.

This Windows host currently has Python Playwright 1.63.0 with matching
Chromium (revision 1243), Firefox (1543) and WebKit (2359) cached
executables. The Node F01-F05 runner still imports playwright-core and
axe-core, neither of which is installed in the project's node_modules.
Python's embedded driver does not automatically resolve the Node imports.

## Read-only asset inventory

Update the source SHA whenever the local branch changes; do not reuse
historical acceptance for a different commit.

~~~powershell
$repo = 'C:\NEXUS-AI\nexus-devops-intelligence'
$sha = (& git -C $repo rev-parse HEAD).Trim()
$driver = 'C:\Users\MONSTER\AppData\Local\Programs\Python\Python311\Lib\site-packages\playwright\driver\package'
$cache = 'C:\Users\MONSTER\AppData\Local\ms-playwright'
python -B scripts\inspect-browser-cache-offline.py --repo $repo --expect-sha $sha --python-driver-package $driver --browser-cache $cache
~~~

The all_expected_browser_executables_present field checks expected cached
Windows executables are nonempty files; it does not prove successful
browser launch. The manual_node_browser_runner_dependencies_present
field checks two required Node imports with no installation.

Chromium, Firefox, WebKit fixtures and human accessibility always remain
NOT_RUN. Only actual execution of the F01-F05 integration scenario against
a new exact-SHA isolated Next.js production build, with loopback-only
network interception and independent per-engine evidence, can support
a fixture PASS. This preflight is not one of those receipts.

## Outstanding boundaries

- The new exact-SHA production build, local HTTP and MCP acceptance are pending.
- Node playwright-core and axe-core are optional manual test dependencies,
  separate from the Python Playwright install.
- Installing missing packages needs a separate owner-approved,
  resource-safe, dependency-locked procedure; this tool never installs.
- Browser caches belong to the interactive user. Never delete, modify
  or launch them below the approved RAM thresholds.
- Protected preview, Redis cross-instance, human accessibility,
  native Ubuntu, rollback and owner release approval remain separate.

## Offline tests

~~~powershell
python -B tests\test_inspect_browser_cache.py
node --test tests\browser-cache-readiness.test.mjs
~~~
