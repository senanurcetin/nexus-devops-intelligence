<#
.SYNOPSIS
  Registers a per-user, non-elevated logon task that keeps the local NEXUS DevOps service running.
.DESCRIPTION
  Task name: NEXUS-DevOps-Local. Runs as the current user (no admin, no stored password), hidden, supervises the process (restart after 5 s, storm guard) and never runs two copies. Reversible with Uninstall-NexusDevopsAutostart.ps1. Supports -WhatIf.
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [ValidateRange(1024, 65535)][int]$Port = 3000,
  [switch]$StartNow
)
$ErrorActionPreference = 'Stop'
$taskName = 'NEXUS-DevOps-Local'
$script = Join-Path $PSScriptRoot 'Start-NexusDevops.ps1'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$node = (Get-Command node -ErrorAction Stop).Source
if (-not (Test-Path (Join-Path $repo 'node_modules\next\dist\bin\next'))) { throw 'Run "npm ci --ignore-scripts" in the repository first.' }
$argument = "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`" -Port $Port -NodePath `"$node`" -RepoRoot `"$repo`""
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argument -WorkingDirectory $repo
$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$logon = New-ScheduledTaskTrigger -AtLogOn -User $user
# Safety net: re-run every 10 minutes. The start script exits at once when the service is already healthy,
# and MultipleInstances=IgnoreNew prevents a second supervisor.
$repeat = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 10) -RepetitionDuration (New-TimeSpan -Days 3650)
$trigger = @($logon, $repeat)
$settings = New-ScheduledTaskSettingsSet -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -StartWhenAvailable `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
if ($PSCmdlet.ShouldProcess($taskName, "Register logon task for $user (loopback port $Port)")) {
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
    -Description 'NEXUS DevOps Intelligence, local loopback-only service for Jarvis (read-only).' -Force | Out-Null
  Write-Host "Registered $taskName for $user."
  if ($StartNow) { Start-ScheduledTask -TaskName $taskName; Write-Host 'Started.' }
}
