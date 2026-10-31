<#
.SYNOPSIS
  Registers (or removes) the three per-user NEXUS DevOps automation tasks: Health, Watch, Gate.
.DESCRIPTION
  NEXUS-DevOps-Health  every 5 minutes   service probe, lease expiry dates, free RAM/disk
  NEXUS-DevOps-Watch   every 4 hours     public-repository reading order + incoming-folder static check
  NEXUS-DevOps-Gate    daily at 03:40    local replacement for hosted CI (typecheck, node tests, Jarvis DevOps ruff + pytest)

  All tasks run as the current user, non-elevated, hidden, with no stored password and MultipleInstances=IgnoreNew.
  They are read-only (see Invoke-DevopsAutomation.ps1). Idempotent: running it again replaces the tasks.
  Remove them with -Uninstall. Supports -WhatIf.
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [switch]$Uninstall,
  [string]$GateTime = '03:40',
  [ValidateRange(5, 60)][int]$HealthMinutes = 5,
  [ValidateRange(1, 24)][int]$WatchHours = 4
)
$ErrorActionPreference = 'Stop'
$names = @('NEXUS-DevOps-Health', 'NEXUS-DevOps-Watch', 'NEXUS-DevOps-Gate')

if ($Uninstall) {
  foreach ($n in $names) {
    if (Get-ScheduledTask -TaskName $n -ErrorAction SilentlyContinue) {
      if ($PSCmdlet.ShouldProcess($n, 'Unregister')) { Unregister-ScheduledTask -TaskName $n -Confirm:$false; Write-Host "Removed $n." }
    }
  }
  return
}

if ($GateTime -notmatch '^([01]\d|2[0-3]):[0-5]\d$') { throw 'GateTime must be HH:mm (24 h).' }
$script = Join-Path $PSScriptRoot 'Invoke-DevopsAutomation.ps1'
if (-not (Test-Path -LiteralPath $script)) { throw "Missing $script" }
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$null = Get-Command node -ErrorAction Stop
$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited

function New-TaskAction([string]$Task) {
  $arg = "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`" -Task $Task -RepoRoot `"$repo`""
  return New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg -WorkingDirectory $repo
}
function New-Settings([int]$LimitMinutes) {
  return New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes $LimitMinutes) -MultipleInstances IgnoreNew `
    -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
}
$start = (Get-Date).AddMinutes(2)
$defs = @(
  @{ Name = 'NEXUS-DevOps-Health'; Task = 'Health'; Limit = 5
     Trigger = (New-ScheduledTaskTrigger -Once -At $start -RepetitionInterval (New-TimeSpan -Minutes $HealthMinutes) -RepetitionDuration (New-TimeSpan -Days 3650))
     Desc = 'NEXUS DevOps health tick (read-only, local).' },
  @{ Name = 'NEXUS-DevOps-Watch'; Task = 'Watch'; Limit = 20
     Trigger = (New-ScheduledTaskTrigger -Once -At $start.AddMinutes(1) -RepetitionInterval (New-TimeSpan -Hours $WatchHours) -RepetitionDuration (New-TimeSpan -Days 3650))
     Desc = 'NEXUS DevOps watchlist + local check (read-only, anonymous GitHub reads).' },
  @{ Name = 'NEXUS-DevOps-Gate'; Task = 'Gate'; Limit = 150
     Trigger = (New-ScheduledTaskTrigger -Daily -At $GateTime)
     Desc = 'NEXUS DevOps local gate, the replacement for hosted CI (read-only, BelowNormal, RAM-guarded).' }
)
foreach ($d in $defs) {
  if ($PSCmdlet.ShouldProcess($d.Name, "Register for $user")) {
    Register-ScheduledTask -TaskName $d.Name -Action (New-TaskAction $d.Task) -Trigger $d.Trigger -Settings (New-Settings $d.Limit) `
      -Principal $principal -Description $d.Desc -Force | Out-Null
    Write-Host "Registered $($d.Name)."
  }
}
