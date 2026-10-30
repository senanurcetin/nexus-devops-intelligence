<#
.SYNOPSIS
  Removes the NEXUS-DevOps-Local logon task and stops the service it started. Leaves the repository and logs untouched.
#>
[CmdletBinding(SupportsShouldProcess)]
param([ValidateRange(1024, 65535)][int]$Port = 3000)
$taskName = 'NEXUS-DevOps-Local'
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
  if ($PSCmdlet.ShouldProcess($taskName, 'Stop and unregister')) {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "Removed $taskName."
  }
} else { Write-Host "$taskName is not registered." }
$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener -and $PSCmdlet.ShouldProcess("pid $($listener.OwningProcess)", "Stop process listening on 127.0.0.1:$Port")) {
  $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
  if ($p.CommandLine -match 'next') { Stop-Process -Id $listener.OwningProcess -Force; Write-Host 'Stopped the local service.' }
  else { Write-Host "Port $Port is held by a non-NEXUS process; left alone." }
}
