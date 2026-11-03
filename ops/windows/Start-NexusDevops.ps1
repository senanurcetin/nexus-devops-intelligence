<#
.SYNOPSIS
  Starts the NEXUS DevOps Intelligence Community service on loopback only (127.0.0.1) and keeps it in the foreground.
.DESCRIPTION
  Intended to be launched by the per-user logon task (see Install-NexusDevopsAutostart.ps1) but safe to run by hand.
  - Binds 127.0.0.1 only; there is no parameter to change the bind address.
  - Exits 0 without starting a second copy only for a loopback-only NEXUS page with the expected title.
  - Refuses stale/unverifiable builds; an absent build may be created only with >=4096 MB free RAM.
  - Writes a size-rotated log to %LOCALAPPDATA%\NEXUS\devops\logs. No secrets are read or written.
#>
[CmdletBinding()]
param(
  [ValidateRange(1024, 65535)][int]$Port = 3000,
  [string]$NodePath = '',
  [string]$RepoRoot = ''
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'DevopsServiceIdentity.ps1')
. (Join-Path $PSScriptRoot 'DevopsBuildStatus.ps1')
if (-not $RepoRoot) { $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path }
if (-not $NodePath) { $NodePath = (Get-Command node -ErrorAction Stop).Source }
$logDir = Join-Path $env:LOCALAPPDATA 'NEXUS\devops\logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir 'service.log'
if ((Test-Path $log) -and (Get-Item $log).Length -gt 5MB) { Move-Item -Force $log "$log.1" }

function Write-Log([string]$m) { Add-Content -Path $log -Encoding UTF8 -Value ("{0:o} {1}" -f (Get-Date), $m) }
# Windows PowerShell 5.1 would write UTF-16 with *>>; keep the log plain UTF-8 text.
function Add-ToLog { process { Add-Content -Path $log -Encoding UTF8 -Value ([string]$_) } }

function Test-Health {
  $listeners = @(Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' -or ($_.RemotePort -eq 0 -and $_.RemoteAddress -in @('0.0.0.0', '::')) })
  if (-not (Test-NexusDevopsLoopback -Sockets $listeners)) { return $false }
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 3
    return (Test-NexusDevopsPage -StatusCode $r.StatusCode -Body ([string]$r.Content))
  } catch { return $false }
}

$build = Get-NexusDevopsBuildStatus -RepoRoot $RepoRoot
if ($build.State -in @('stale', 'unknown')) {
  Write-Log "refusing to use unverified/stale production build: $($build.State); $($build.Detail)"
  exit 4
}
if (Test-Health) {
  if ($build.State -ne 'current') { Write-Log 'refusing health short-circuit without a confirmed build'; exit 4 }
  Write-Log "already healthy on 127.0.0.1:$Port; not starting a second copy"
  exit 0
}
# On some Windows builds Get-NetTCPConnection reports an empty State for a listening socket (the socket still answers), so a
# listener is also recognised by its unconnected remote endpoint instead of relying on -State Listen alone.
$listener = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' -or ($_.RemotePort -eq 0 -and $_.RemoteAddress -in @('0.0.0.0', '::')) }
if ($listener) { Write-Log "port $Port is used by pid $($listener.OwningProcess) and is not a healthy NEXUS service; refusing to start"; exit 3 }

Set-Location $RepoRoot
$ErrorActionPreference = 'Continue'   # native stderr lines must not become terminating errors in PS 5.1
$env:NEXT_TELEMETRY_DISABLED = '1'
$env:NODE_ENV = 'production'
# The scheduled task can start this script at BelowNormal priority; the node child inherits it and, on a loaded machine,
# `next start` then needed ~9 minutes to become ready. Run at Normal (never higher) so a restart is not starved.
try { (Get-Process -Id $PID).PriorityClass = [System.Diagnostics.ProcessPriorityClass]::Normal } catch { Write-Log "could not set Normal priority: $($_.Exception.Message)" }
if ($build.State -eq 'missing') {
  # The first-build path must never run under RAM pressure or on a dirty app tree.
  $freeRamMb = try { [math]::Floor((Get-CimInstance Win32_OperatingSystem -ErrorAction Stop).FreePhysicalMemory / 1024) } catch { 0 }
  if ($freeRamMb -lt 4096) { Write-Log "first build blocked: only $freeRamMb MB free RAM (4096 MB required)"; exit 4 }
  Write-Log 'no production build found; running a guarded first build'
  & $NodePath (Join-Path $RepoRoot 'node_modules\next\dist\bin\next') build 2>&1 | Add-ToLog
  if ($LASTEXITCODE -ne 0) { Write-Log "build failed (exit $LASTEXITCODE)"; exit 4 }
  $build = Get-NexusDevopsBuildStatus -RepoRoot $RepoRoot
  if ($build.State -ne 'current') {
    Write-Log "first build completed but source freshness could not be verified: $($build.State)"
    exit 4
  }
}

# Supervise: Task Scheduler does not restart a task whose action merely exits non-zero, so restart here with a
# storm guard (max 8 starts per 10 minutes). The task's repetition trigger retries later after a give-up.
$starts = New-Object 'System.Collections.Generic.Queue[datetime]'
while ($true) {
  $now = Get-Date
  while ($starts.Count -gt 0 -and ($now - $starts.Peek()).TotalMinutes -gt 10) { [void]$starts.Dequeue() }
  if ($starts.Count -ge 8) { Write-Log 'restart storm: 8 starts within 10 minutes; giving up until the next scheduled attempt'; exit 5 }
  # A scheduled restart must not serve a now-stale app or pressure other
  # NEXUS notebooks when the workstation is short of free memory.
  $restartBuild = Get-NexusDevopsBuildStatus -RepoRoot $RepoRoot
  if ($restartBuild.State -ne 'current') {
    Write-Log "restart blocked: build freshness is $($restartBuild.State); $($restartBuild.Detail)"
    exit 4
  }
  $restartFreeRamMb = try { [math]::Floor((Get-CimInstance Win32_OperatingSystem -ErrorAction Stop).FreePhysicalMemory / 1024) } catch { 0 }
  if ($restartFreeRamMb -lt 2048) {
    Write-Log "restart blocked: only $restartFreeRamMb MB free RAM (2048 MB required)"
    exit 6
  }
  $starts.Enqueue($now)
  Write-Log "starting next on 127.0.0.1:$Port with $NodePath"
  & $NodePath (Join-Path $RepoRoot 'node_modules\next\dist\bin\next') start -H 127.0.0.1 -p $Port 2>&1 | Add-ToLog
  Write-Log "next exited with code $LASTEXITCODE; restarting in 5 s"
  Start-Sleep -Seconds 5
}
