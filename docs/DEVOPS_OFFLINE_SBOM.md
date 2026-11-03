# Reproducible local npm lockfile SBOM

This offline helper produces a deterministic CycloneDX 1.6-shaped JSON
inventory of npm lockfile v3 package metadata. It requires a clean checkout
at the exact 40-character Git HEAD, and will not overwrite existing output.

It does not install packages, download tarballs, verify package bytes, query
a vulnerability advisory database, scan a Docker image, run CI, deploy or
authorize a release. CycloneDX schema conformance has not been independently
validated. A valid inventory is **not** a successful npm audit.

## Run (local Windows)

Use Python 3.11+ in the primary clean checkout. The output directory must
be a new direct child of the local runtime evidence area.

~~~powershell
$repo = 'C:\NEXUS-AI\nexus-devops-intelligence'
$sha = (& git -C $repo rev-parse HEAD).Trim()
$out = "C:\NEXUS-AI\runtime\devops-automation\sbom-$($sha.Substring(0,12))-manual-$(Get-Date -Format yyyyMMddTHHmmss)"
python -B scripts\generate-sbom-offline.py --repo $repo --expect-sha $sha --out-dir $out
~~~

Output contains sbom.cdx.json, provenance.json and SHA256SUMS.txt. Verify
the SHA256SUMS.txt ledger before consuming or copying the inventory.
Never modify a previously saved result. A new source commit requires a new
SBOM and a unique output directory.

The component list includes npm package identity, version, install-path,
registry distribution URL, SHA-512 *metadata*, dev/optional flags and OS/CPU
selectors where supplied. SHA-512 values are extracted from the lockfile;
they are NOT recomputed from the actual package tarballs.

The same source SHA and unmodified package-lock.json produce byte-identical
sbom.cdx.json. The provenance file states:
npm_audit=NOT_RUN, image_cve_scan=NOT_RUN, release_authorized=false.
These are separate gates controlled by verify-release-evidence.mjs.

## Tests

~~~powershell
python -B tests\test_generate_sbom_offline.py
node --test tests\sbom-offline-contract.test.mjs
~~~

Rejections include dirty source, wrong SHA, inconsistent dependencies,
duplicate JSON keys, incomplete SHA-512 metadata, nonstandard registry,
invalid package names, unsupported link entries, unsafe output locations
and attempts to overwrite existing evidence.

This helper is a reproducible diagnostic utility only. It does not increase
the source, self-hosted or production PASS counts without their independently
collected exact-SHA acceptance evidence.
