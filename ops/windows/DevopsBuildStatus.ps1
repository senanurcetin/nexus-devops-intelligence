# Shared, read-only source-recency guard for the local Next.js build.
# A matching timestamp is an operational check, not signed build provenance.
# Fail closed when Git cannot confirm the source or when app paths are dirty.
function Get-NexusDevopsBuildStatus {
  [CmdletBinding()]
  param([Parameter(Mandatory=$true)][string]$RepoRoot)

  $buildId = Join-Path $RepoRoot '.next\BUILD_ID'
  $buildPresent = Test-Path -LiteralPath $buildId -PathType Leaf
  # Keep an actual array even when only one source path exists: native Git
  # argument splatting of a scalar may silently omit the intended path.
  $paths = @(@('src', 'public', 'package-lock.json', 'next.config.ts', 'next.config.js',
               'next.config.mjs', 'postcss.config.mjs', 'tsconfig.json') |
             Where-Object { Test-Path -LiteralPath (Join-Path $RepoRoot $_) })
  if (@($paths).Count -eq 0) {
    return [pscustomobject]@{ State='unknown'; Detail='no source paths to inspect'; BuildUtc=$null; SourceUtc=$null }
  }
  try {
    $dirty = @(& git -C $RepoRoot status --porcelain=v1 -- @paths 2>$null)
    if ($LASTEXITCODE -ne 0) { throw 'git status unavailable' }
    $built = if ($buildPresent) { (Get-Item -LiteralPath $buildId -ErrorAction Stop).LastWriteTimeUtc } else { $null }
    if (@($dirty | Where-Object { $_ -and $_.Trim() }).Count -gt 0) {
      return [pscustomobject]@{ State='stale'; Detail='uncommitted application changes'; BuildUtc=$built; SourceUtc=$null }
    }
    if (-not $buildPresent) {
      return [pscustomobject]@{ State='missing'; Detail='no production BUILD_ID (source clean)'; BuildUtc=$null; SourceUtc=$null }
    }
    $unix = @(& git -C $RepoRoot log -1 --format=%ct -- @paths 2>$null)
    if ($LASTEXITCODE -ne 0 -or @($unix).Count -ne 1 -or [string]::IsNullOrWhiteSpace([string]$unix[0])) {
      throw 'git application history unavailable'
    }
    $sourceUtc = [DateTimeOffset]::FromUnixTimeSeconds([int64]$unix[0]).UtcDateTime
    $state = if ($built -ge $sourceUtc) { 'current' } else { 'stale' }
    $detail = if ($state -eq 'current') { 'build is newer than last committed application change' } else { 'application commit is newer than BUILD_ID' }
    return [pscustomobject]@{ State=$state; Detail=$detail; BuildUtc=$built; SourceUtc=$sourceUtc }
  } catch {
    return [pscustomobject]@{ State='unknown'; Detail='unable to verify local build/source freshness'; BuildUtc=$null; SourceUtc=$null }
  }
}
