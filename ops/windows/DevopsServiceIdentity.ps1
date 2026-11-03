# Shared read-only, fail-closed identity checks for the local DevOps dashboard.
# A foreign service on the same port is not healthy even if it returns HTTP 200.
function Test-NexusDevopsPage {
  param([int]$StatusCode, [AllowNull()][string]$Body)
  if ($StatusCode -ne 200 -or [string]::IsNullOrEmpty($Body)) { return $false }
  return ($Body -cmatch '<title>\s*NEXUS DevOps Intelligence\s*</title>')
}
function Test-NexusDevopsLoopback {
  param([object[]]$Sockets)
  if ($null -eq $Sockets -or $Sockets.Count -eq 0) { return $false }
  foreach ($socket in $Sockets) {
    if ($socket.LocalAddress -notin @('127.0.0.1', '::1')) { return $false }
  }
  return $true
}
