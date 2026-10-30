<#
.SYNOPSIS
  Read-only status check: task state, task triggers, port listener, health, running-build freshness, and (optional) one digest through the Jarvis CLI.
.DESCRIPTION
  Exit code 0 when the task is registered, the listener is loopback-only and health is 200; 1 otherwise.
  A STALE build is reported but does not fail the check: it means the served `.next` build is older than the
  checked-out commit, so recent source changes are not yet visible in the running service.
#>
[CmdletBinding()]
param([int]$Port = 3000, [string]$Repository = '')
$ok = $true
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$t = Get-ScheduledTask -TaskName 'NEXUS-DevOps-Local' -ErrorAction SilentlyContinue
"task: " + $(if ($t) { "$($t.State)" } else { 'not registered' })
if (-not $t) { $ok = $false } else {
  $trig = ($t.Triggers | ForEach-Object { $_.CimClass.CimClassName -replace '^MSFT_Task', '' -replace 'Trigger$', '' }) -join '+'
  "triggers: $trig; restart on failure: $($t.Settings.RestartCount)x every $($t.Settings.RestartInterval); instances: $($t.Settings.MultipleInstances)"
}
# On some Windows builds Get-NetTCPConnection reports an empty State for a listening socket (the socket still answers), so a
# listener is also recognised by its unconnected remote endpoint instead of relying on -State Listen alone.
$l = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' -or ($_.RemotePort -eq 0 -and $_.RemoteAddress -in @('0.0.0.0', '::')) } | Select-Object -First 1
"listener: " + $(if ($l) { "$($l.LocalAddress):$($l.LocalPort) pid $($l.OwningProcess)" } else { 'none' })
if (-not $l) { $ok = $false }
elseif ($l.LocalAddress -notin @('127.0.0.1', '::1')) { 'listener: NOT loopback-only'; $ok = $false }
try { $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 5; "health: $($r.StatusCode)"; if ($r.StatusCode -ne 200) { $ok = $false } } catch { 'health: unreachable'; $ok = $false }
$buildId = Join-Path $repoRoot '.next\BUILD_ID'
if (Test-Path $buildId) {
  $built = (Get-Item $buildId).LastWriteTimeUtc
  # Only commits that can change the served app count (docs, tests, scripts, ops files and package.json scripts do not make a build stale).
  $appPaths = @('src', 'public', 'package-lock.json', 'next.config.ts', 'next.config.js', 'next.config.mjs', 'postcss.config.mjs', 'tsconfig.json') |
    Where-Object { Test-Path (Join-Path $repoRoot $_) }
  $headUnix = (& git -C $repoRoot log -1 --format=%ct -- @appPaths 2>$null)
  if ($headUnix) {
    $head = [DateTimeOffset]::FromUnixTimeSeconds([int64]$headUnix).UtcDateTime
    $state = if ($built -ge $head) { 'current' } else { 'STALE (rebuild and restart to serve the checked-out commit)' }
    "build: $state; built $($built.ToString('u')), last app change committed $($head.ToString('u'))"
  } else { 'build: present (git not available to compare)' }
} else { 'build: none (the start script builds once on first run)' }
if ($Repository) {
  Push-Location $repoRoot
  $env:NEXUS_DEVOPS_BASE_URL = "http://127.0.0.1:$Port"
  $o = node --import tsx scripts/jarvis-digest.mjs $Repository
  "digest exit: $LASTEXITCODE"
  try { $d = $o | ConvertFrom-Json; "posture: $($d.posture.state); sources: $($d.sources.actions.state)/$($d.sources.pull_requests.state)" } catch { 'digest: unreadable' }
  Pop-Location
}
"result: " + $(if ($ok) { 'OK' } else { 'ATTENTION' })
exit $(if ($ok) { 0 } else { 1 })
