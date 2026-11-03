<#
.SYNOPSIS
  Read-only status check: task state, task triggers, port listener, health, running-build freshness, and (optional) one digest through the Jarvis CLI.
.DESCRIPTION
  Exit code 0 requires the task, a loopback-only listener, the expected HTTP 200 NEXUS page and a current local build.
  STALE/missing/unverifiable build evidence returns exit code 1, even if an existing page answers HTTP 200.
#>
[CmdletBinding()]
param([int]$Port = 3000, [string]$Repository = '')
$ok = $true
. (Join-Path $PSScriptRoot 'DevopsServiceIdentity.ps1')
. (Join-Path $PSScriptRoot 'DevopsBuildStatus.ps1')
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$t = Get-ScheduledTask -TaskName 'NEXUS-DevOps-Local' -ErrorAction SilentlyContinue
"task: " + $(if ($t) { "$($t.State)" } else { 'not registered' })
if (-not $t) { $ok = $false } else {
  $trig = ($t.Triggers | ForEach-Object { $_.CimClass.CimClassName -replace '^MSFT_Task', '' -replace 'Trigger$', '' }) -join '+'
  "triggers: $trig; restart on failure: $($t.Settings.RestartCount)x every $($t.Settings.RestartInterval); instances: $($t.Settings.MultipleInstances)"
}
# On some Windows builds Get-NetTCPConnection reports an empty State for a listening socket (the socket still answers), so a
# listener is also recognised by its unconnected remote endpoint instead of relying on -State Listen alone.
$listeners = @(Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' -or ($_.RemotePort -eq 0 -and $_.RemoteAddress -in @('0.0.0.0', '::')) })
$l = $listeners | Select-Object -First 1
"listener: " + $(if ($l) { "$($l.LocalAddress):$($l.LocalPort) pid $($l.OwningProcess)" } else { 'none' })
if (-not $l) { $ok = $false }
elseif (-not (Test-NexusDevopsLoopback -Sockets $listeners)) { 'listener: NOT loopback-only'; $ok = $false }
try {
  $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 5
  if (Test-NexusDevopsPage -StatusCode $r.StatusCode -Body ([string]$r.Content)) { 'health: HTTP 200 and verified NEXUS page' }
  else { 'health: unexpected service identity'; $ok = $false }
} catch { 'health: unreachable'; $ok = $false }
$build = Get-NexusDevopsBuildStatus -RepoRoot $repoRoot
"build: $($build.State); $($build.Detail)"
if ($build.State -ne 'current') { $ok = $false }
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
