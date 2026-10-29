<#
.SYNOPSIS
  Read-only status check: task state, port listener, health, and (optional) one digest through the Jarvis CLI.
#>
[CmdletBinding()]
param([int]$Port = 3000, [string]$Repository = '')
$t = Get-ScheduledTask -TaskName 'NEXUS-DevOps-Local' -ErrorAction SilentlyContinue
"task: " + $(if ($t) { "$($t.State)" } else { 'not registered' })
$l = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
"listener: " + $(if ($l) { "$($l.LocalAddress):$($l.LocalPort) pid $($l.OwningProcess)" } else { 'none' })
try { $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 5; "health: $($r.StatusCode)" } catch { 'health: unreachable' }
if ($Repository) {
  Push-Location (Resolve-Path (Join-Path $PSScriptRoot '..\..'))
  $env:NEXUS_DEVOPS_BASE_URL = "http://127.0.0.1:$Port"
  $o = node --import tsx scripts/jarvis-digest.mjs $Repository
  "digest exit: $LASTEXITCODE"
  try { $d = $o | ConvertFrom-Json; "posture: $($d.posture.state); sources: $($d.sources.actions.state)/$($d.sources.pull_requests.state)" } catch { 'digest: unreadable' }
  Pop-Location
}
