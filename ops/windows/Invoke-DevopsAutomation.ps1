<#
.SYNOPSIS
  NEXUS DevOps local automation tick (personal edition). One entry point, three read-only tasks.
.DESCRIPTION
  -Task Health  every few minutes: service probe, gateway lease expiry (dates only), free RAM/disk. Writes health.json and STATUS.md.
  -Task Watch   every few hours: reading order for a small list of PUBLIC repositories (jarvis-watchlist.mjs, anonymous GitHub reads)
                and a static check of every folder in the incoming-projects folder (jarvis-localcheck.mjs).
  -Task Gate    nightly: the local replacement for hosted CI (typecheck, node tests, Jarvis DevOps ruff + targeted pytest).

  Design limits (kept on purpose):
  - Read-only. No GitHub writes, no deployments, no process control, no model calls, no network except 127.0.0.1 and
    anonymous GET requests to api.github.com (the rate-limit probe here, the reads inside the repository's own CLIs).
  - Never reads signing keys, tokens or .env files. The lease file is read only for lease_id and expires_at; neither is a secret.
  - Output goes to the runtime folder only (default C:\NEXUS-AI\runtime\devops-automation). Alerts are appended once per state
    change to alerts.jsonl; nothing is sent anywhere.
  - Child processes run at BelowNormal priority with a hard timeout. Only the child started by this script is ever stopped.
  - The Gate skips (and says so) when free RAM is below -MinFreeRamMb, so it never competes with a heavy test run.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][ValidateSet('Health', 'Watch', 'Gate')][string]$Task,
  [string]$RepoRoot = '',
  [string]$RuntimeDir = 'C:\NEXUS-AI\runtime\devops-automation',
  [string]$JarvisRoot = 'C:\NEXUS-AI\jarvis-next',
  [string]$IncomingDir = 'C:\NEXUS-AI\incoming-projects',
  [string]$LeaseFile = '',
  [string]$PythonExe = 'C:\Users\MONSTER\AppData\Local\Programs\Python\Python311\python.exe',
  [ValidateRange(1024, 65535)][int]$Port = 3000,
  [ValidateRange(256, 65536)][int]$MinFreeRamMb = 1500,
  [ValidateRange(1, 48)][int]$LeaseWarnHours = 4
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'DevopsServiceIdentity.ps1')
if (-not $RepoRoot) { $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path }
if (-not $LeaseFile) { $LeaseFile = Join-Path $env:LOCALAPPDATA 'NEXUS\devops-module\gateway\lease-devops.json' }
$Utf8 = New-Object System.Text.UTF8Encoding($false)

function Get-Stamp { (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ') }
function Initialize-Dir([string]$Path) { if (-not (Test-Path -LiteralPath $Path)) { New-Item -ItemType Directory -Force -Path $Path | Out-Null } }
function Write-JsonAtomic([string]$Path, $Object) {
  $tmp = "$Path.tmp"
  [IO.File]::WriteAllText($tmp, ($Object | ConvertTo-Json -Depth 8), $Utf8)
  Move-Item -LiteralPath $tmp -Destination $Path -Force
}
function Read-JsonOrNull([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  try { return (Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json) } catch { return $null }
}
function Add-JsonLine([string]$Path, $Object, [int]$MaxLines) {
  [IO.File]::AppendAllText($Path, (($Object | ConvertTo-Json -Depth 6 -Compress) + "`n"), $Utf8)
  $lines = [IO.File]::ReadAllLines($Path)
  if ($lines.Count -gt $MaxLines) { [IO.File]::WriteAllLines($Path, ($lines | Select-Object -Last $MaxLines), $Utf8) }
}
function Add-Alert([string]$Kind, [string]$Detail) {
  Add-JsonLine (Join-Path $RuntimeDir 'alerts.jsonl') ([ordered]@{ ts = (Get-Stamp); task = $Task; kind = $Kind; detail = $Detail }) 1000
}
function Get-Redacted([string]$Text) {
  if (-not $Text) { return '' }
  $t = $Text -replace '(?i)(token|secret|password|passwd|api[_-]?key|authorization)\s*[=:]\s*\S+', '$1=[REDACTED]'
  return ($t -replace '(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,})', '[REDACTED]')
}
function Get-FreeRamMb { [int][math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1024) }
function Get-Prop($Object, [string]$Name, $Default = $null) {
  if ($null -eq $Object) { return $Default }
  $p = $Object.PSObject.Properties[$Name]
  if ($null -eq $p) { return $Default }
  return $p.Value
}

# Runs one child process (BelowNormal, hard timeout, output to temp files). Only this child is ever stopped.
function Invoke-Step([string]$Name, [string]$File, [string[]]$Arguments, [string]$WorkDir, [int]$TimeoutSec, [hashtable]$ExtraEnv = @{}) {
  $outFile = Join-Path $env:TEMP ("nexus-devops-{0}-{1}.out" -f $Task, $Name)
  $errFile = "$outFile.err"
  $argLine = ($Arguments | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }) -join ' '
  $saved = @{}
  foreach ($k in $ExtraEnv.Keys) { $saved[$k] = [Environment]::GetEnvironmentVariable($k, 'Process'); [Environment]::SetEnvironmentVariable($k, [string]$ExtraEnv[$k], 'Process') }
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $timedOut = $false
  $exit = -1
  try {
    $p = Start-Process -FilePath $File -ArgumentList $argLine -WorkingDirectory $WorkDir -WindowStyle Hidden -PassThru `
      -RedirectStandardOutput $outFile -RedirectStandardError $errFile
    # Reading Handle caches the process handle; without it Windows PowerShell 5.1 can return a null ExitCode.
    $null = $p.Handle
    try { $p.PriorityClass = 'BelowNormal' } catch { }
    if (-not $p.WaitForExit($TimeoutSec * 1000)) {
      $timedOut = $true
      & taskkill.exe /PID $p.Id /T /F 2>&1 | Out-Null
    }
    $p.WaitForExit()
    if ($null -eq $p.ExitCode) { $exit = -4 } else { $exit = [int]$p.ExitCode }
  } catch {
    $exit = -2
    [IO.File]::WriteAllText($errFile, $_.Exception.Message, $Utf8)
  } finally {
    foreach ($k in $saved.Keys) { [Environment]::SetEnvironmentVariable($k, $saved[$k], 'Process') }
  }
  $sw.Stop()
  $stdout = if (Test-Path -LiteralPath $outFile) { Get-Content -LiteralPath $outFile -Raw -Encoding UTF8 } else { '' }
  $stderr = if (Test-Path -LiteralPath $errFile) { Get-Content -LiteralPath $errFile -Raw -Encoding UTF8 } else { '' }
  $tail = (($stdout + "`n" + $stderr) -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -Last 14) -join "`n"
  return [pscustomobject]@{
    name = $Name; exit = $exit; timed_out = $timedOut; seconds = [math]::Round($sw.Elapsed.TotalSeconds, 1)
    stdout = $stdout; tail = (Get-Redacted $tail)
  }
}

function Get-NodePath {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

function Get-LeaseState {
  $res = [ordered]@{ state = 'absent'; lease_id = $null; expires_at = $null; remaining_minutes = $null; verified = $false }
  if (-not (Test-Path -LiteralPath $LeaseFile)) { return $res }
  try {
    $raw = Get-Content -LiteralPath $LeaseFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $exp = [DateTimeOffset]::Parse([string]$raw.expires_at)
    $res.lease_id = [string]$raw.lease_id
    $res.expires_at = $exp.UtcDateTime.ToString('yyyy-MM-ddTHH:mm:ssZ')
    $left = ($exp - [DateTimeOffset]::UtcNow).TotalMinutes
    $res.remaining_minutes = [int][math]::Floor($left)
    if ($left -le 0) { $res.state = 'expired' } elseif ($left -le ($LeaseWarnHours * 60)) { $res.state = 'expiring' } else { $res.state = 'valid' }
  } catch { $res.state = 'unreadable' }
  return $res
}

function Update-StatusMd {
  $h = Read-JsonOrNull (Join-Path $RuntimeDir 'health.json')
  $w = Read-JsonOrNull (Join-Path $RuntimeDir 'watch-latest.json')
  $g = Read-JsonOrNull (Join-Path $RuntimeDir 'gate-latest.json')
  $l = New-Object System.Collections.Generic.List[string]
  $l.Add('# NEXUS DevOps otomasyon durumu')
  $l.Add('')
  $l.Add('Bu dosya otomasyon turlari tarafindan yeniden yazilir. Salt okunur izleme; hicbir sey gonderilmez.')
  $l.Add('')
  if ($h) {
    $left = ''
    if ($null -ne $h.lease.remaining_minutes) { $left = ' (' + $h.lease.remaining_minutes + ' dk kaldi)' }
    $l.Add(('- Saglik ({0}): servis {1} (HTTP {2}), lease {3}{4}, bos RAM {5} MB, C: bos {6} GB' -f $h.checked_at, $h.service.state, $h.service.http, $h.lease.state, $left, $h.free_ram_mb, $h.free_disk_gb))
  }
  if ($w) {
    $sk = ''
    if ($w.watchlist.skipped) { $sk = '; izleme atlandi: ' + $w.watchlist.skipped }
    $l.Add(('- Izleme ({0}): {1} depo okundu / {2} istendi; yerel kontrol {3} klasor{4}' -f $w.checked_at, $w.watchlist.readable, $w.watchlist.requested, $w.localcheck.folders, $sk))
  }
  if ($g) {
    $rs = ''
    if ($g.reason) { $rs = ' (' + $g.reason + ')' }
    $l.Add(('- Kapi ({0}): {1}{2}' -f $g.checked_at, $g.status, $rs))
  }
  $alerts = Join-Path $RuntimeDir 'alerts.jsonl'
  if (Test-Path -LiteralPath $alerts) {
    $l.Add('')
    $l.Add('## Son uyarilar')
    foreach ($line in ([IO.File]::ReadAllLines($alerts) | Select-Object -Last 8)) {
      try { $a = $line | ConvertFrom-Json; $l.Add(('- {0} {1}: {2}' -f $a.ts, $a.kind, $a.detail)) } catch { }
    }
  }
  [IO.File]::WriteAllText((Join-Path $RuntimeDir 'STATUS.md'), (($l -join "`r`n") + "`r`n"), $Utf8)
}

Initialize-Dir $RuntimeDir

switch ($Task) {
  'Health' {
    $prev = Read-JsonOrNull (Join-Path $RuntimeDir 'health.json')
    $http = 0
    $html = ''
    try {
      $reply = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 6
      $http = [int]$reply.StatusCode
      $html = [string]$reply.Content
    } catch { $http = 0 }
    $listeners = @(Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' -or ($_.RemotePort -eq 0 -and $_.RemoteAddress -in @('0.0.0.0', '::')) })
    $identity = (Test-NexusDevopsPage -StatusCode $http -Body $html)
    $loopback = (Test-NexusDevopsLoopback -Sockets $listeners)
    $up = ($identity -and $loopback)
    $prevFails = [int](Get-Prop (Get-Prop $prev 'service') 'consecutive_failures' 0)
    $fails = 0
    if (-not $up) { $fails = $prevFails + 1 }
    $svcState = 'unconfirmed'
    if ($up) { $svcState = 'up' } elseif ($fails -ge 2) { $svcState = 'down' }
    $lease = Get-LeaseState
    $drive = Get-PSDrive -Name C -ErrorAction SilentlyContinue
    $diskGb = $null
    if ($drive) { $diskGb = [math]::Round($drive.Free / 1GB, 1) }
    $health = [ordered]@{
      checked_at = (Get-Stamp)
      service = [ordered]@{ state = $svcState; http = $http; identity_verified = $identity; loopback_only = $loopback; consecutive_failures = $fails; port = $Port }
      lease = $lease
      free_ram_mb = (Get-FreeRamMb)
      free_disk_gb = $diskGb
    }
    # Alerts only on transitions, so a long outage or an expiring lease is reported once, not every tick.
    $prevSvc = [string](Get-Prop (Get-Prop $prev 'service') 'state' 'up')
    if ($svcState -eq 'down' -and $prevSvc -ne 'down') { Add-Alert 'service_down' "127.0.0.1:$Port did not answer $fails times in a row (the NEXUS-DevOps-Local task restarts it)" }
    if ($svcState -eq 'up' -and $prevSvc -eq 'down') { Add-Alert 'service_recovered' "127.0.0.1:$Port answers again (HTTP $http)" }
    $prevLease = [string](Get-Prop (Get-Prop $prev 'lease') 'state' 'valid')
    $prevExpires = [string](Get-Prop (Get-Prop $prev 'lease') 'expires_at' '')
    if ($lease.state -eq 'expiring' -and $prevLease -ne 'expiring') { Add-Alert 'lease_expiring' ("lease {0} ends {1} ({2} min left); renewal is an explicit owner action" -f $lease.lease_id, $lease.expires_at, $lease.remaining_minutes) }
    if ($lease.state -eq 'expired' -and $prevLease -ne 'expired') { Add-Alert 'lease_expired' ("lease {0} expired {1}; gateway tools are refused until it is renewed" -f $lease.lease_id, $lease.expires_at) }
    if ($lease.state -eq 'valid' -and $prevLease -ne 'valid' -and $prevExpires -and $prevExpires -ne $lease.expires_at) { Add-Alert 'lease_renewed' ("lease {0} now valid until {1}" -f $lease.lease_id, $lease.expires_at) }
    if ($null -ne $diskGb -and $diskGb -lt 10) { Add-Alert 'disk_low' ("{0} GB free on C:" -f $diskGb) }
    Write-JsonAtomic (Join-Path $RuntimeDir 'health.json') $health
    Add-JsonLine (Join-Path $RuntimeDir 'health-history.jsonl') ([ordered]@{ ts = $health.checked_at; service = $svcState; http = $http; lease = $lease.state; ram_mb = $health.free_ram_mb }) 700
    Update-StatusMd
    Write-Output ("health: service={0} http={1} lease={2} ram={3}MB" -f $svcState, $http, $lease.state, $health.free_ram_mb)
  }

  'Watch' {
    $node = Get-NodePath
    if (-not $node) { throw 'node was not found on PATH' }
    $cfgFile = Join-Path $RuntimeDir 'watchlist.json'
    if (-not (Test-Path -LiteralPath $cfgFile)) {
      # Own public project repositories only (no forks). Edit this file to change the list; at most 10 entries are used.
      $default = [ordered]@{ repositories = @(
          'senanurcetin/nexus-devops-intelligence', 'senanurcetin/Ops-Copilot', 'senanurcetin/nexus-commerce-intelligence',
          'senanurcetin/Vision2DCS', 'senanurcetin/ot-sentinel', 'senanurcetin/PlantLog-MERN', 'senanurcetin/smart-factory-app') }
      Write-JsonAtomic $cfgFile $default
    }
    $cfg = Read-JsonOrNull $cfgFile
    $repos = @()
    foreach ($r in @(Get-Prop $cfg 'repositories' @())) {
      if ([string]$r -match '^[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}$' -and [string]$r -notmatch '(^|/)\.\.?($|/)') { $repos += [string]$r }
    }
    $repos = @($repos | Select-Object -Unique | Select-Object -First 10)

    $watch = [ordered]@{ requested = $repos.Count; readable = 0; skipped = $null; rows = @() }
    $remaining = $null
    try { $remaining = [int](Invoke-RestMethod -Uri 'https://api.github.com/rate_limit' -TimeoutSec 15).resources.core.remaining } catch { $remaining = $null }
    $needed = 2 * [math]::Max(1, $repos.Count) + 4
    if ($repos.Count -eq 0) { $watch.skipped = 'empty_list' }
    elseif ($null -ne $remaining -and $remaining -lt $needed) { $watch.skipped = "github_anonymous_budget_low ($remaining left, $needed needed)" }
    else {
      $step = Invoke-Step 'watchlist' $node (@('--import', 'tsx', 'scripts\jarvis-watchlist.mjs', '--json') + $repos) $RepoRoot 150
      $data = $null
      if ($step.exit -eq 0) { try { $data = $step.stdout | ConvertFrom-Json } catch { $data = $null } }
      if ($null -eq $data) {
        $why = "cli_failed (exit $($step.exit))"
        if ($step.timed_out) { $why = 'cli_timeout' }
        $watch.skipped = $why
      } else {
        $prevW = Read-JsonOrNull (Join-Path $RuntimeDir 'watch-latest.json')
        $prevRows = @{}
        foreach ($pr in @(Get-Prop (Get-Prop $prevW 'watchlist') 'rows' @())) { $prevRows[[string]$pr.repository] = $pr }
        $rows = @()
        foreach ($e in @($data.entries)) {
          $row = [pscustomobject][ordered]@{ repository = [string]$e.repository; readable = [bool]$e.readable; posture = [string](Get-Prop $e 'posture_state' ''); high = [int](Get-Prop $e 'high' 0); medium = [int](Get-Prop $e 'medium' 0); first_url = [string](Get-Prop $e 'first_url' '') }
          $rows += $row
          if ($row.readable) { $watch.readable++ }
          $old = $prevRows[$row.repository]
          if ($old -and $row.readable -and $old.readable) {
            if ($row.high -gt [int]$old.high) { Add-Alert 'watch_high_increase' ("{0}: high findings {1} -> {2}" -f $row.repository, $old.high, $row.high) }
            elseif ($row.posture -ne [string]$old.posture) { Add-Alert 'watch_posture_change' ("{0}: {1} -> {2}" -f $row.repository, $old.posture, $row.posture) }
          }
        }
        $watch.rows = $rows
      }
    }

    $local = [ordered]@{ folders = 0; high_total = 0; skipped = $null; rows = @() }
    if (-not (Test-Path -LiteralPath $IncomingDir)) { $local.skipped = 'incoming_dir_missing' }
    else {
      $lcDir = Join-Path $RuntimeDir 'localcheck'
      Initialize-Dir $lcDir
      $dirs = @(Get-ChildItem -LiteralPath $IncomingDir -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch '^[_.]' } | Sort-Object LastWriteTime -Descending | Select-Object -First 20)
      foreach ($d in $dirs) {
        $reportPath = Join-Path $lcDir ($d.Name + '.json')
        $before = Read-JsonOrNull $reportPath
        $oldHigh = [int](Get-Prop (Get-Prop $before 'summary') 'high' 0)
        $step = Invoke-Step 'localcheck' $node @('--import', 'tsx', 'scripts\jarvis-localcheck.mjs', '--json', $d.FullName) $RepoRoot 120
        $rep = $null
        if ($step.exit -eq 0 -or $step.exit -eq 1) { try { $rep = $step.stdout | ConvertFrom-Json } catch { $rep = $null } }
        if ($null -eq $rep) { $local.rows += [pscustomobject]@{ folder = $d.Name; status = "failed (exit $($step.exit))" }; continue }
        Write-JsonAtomic $reportPath $rep
        $high = [int]$rep.summary.high
        $local.folders++
        $local.high_total += $high
        $local.rows += [pscustomobject]@{ folder = $d.Name; status = 'ok'; files = [int]$rep.facts.files_scanned; high = $high; medium = [int]$rep.summary.medium }
        if ($before -and $high -gt $oldHigh) { Add-Alert 'localcheck_high_increase' ("{0}: high findings {1} -> {2}" -f $d.Name, $oldHigh, $high) }
      }
    }
    $result = [ordered]@{ checked_at = (Get-Stamp); github_anonymous_remaining = $remaining; watchlist = $watch; localcheck = $local }
    Write-JsonAtomic (Join-Path $RuntimeDir 'watch-latest.json') $result
    Add-JsonLine (Join-Path $RuntimeDir 'watch-history.jsonl') ([ordered]@{ ts = $result.checked_at; readable = $watch.readable; requested = $watch.requested; skipped = $watch.skipped; local_folders = $local.folders; local_high = $local.high_total }) 400
    Update-StatusMd
    $note = ''
    if ($watch.skipped) { $note = ' [' + $watch.skipped + ']' }
    Write-Output ("watch: {0}/{1} repositories readable{2}; local check {3} folder(s), {4} high" -f $watch.readable, $watch.requested, $note, $local.folders, $local.high_total)
  }

  'Gate' {
    $prevG = Read-JsonOrNull (Join-Path $RuntimeDir 'gate-latest.json')
    $free = Get-FreeRamMb
    $gate = [ordered]@{ checked_at = (Get-Stamp); status = 'pass'; reason = $null; free_ram_mb = $free; repo_head = $null; jarvis_head = $null; steps = @() }
    if ($free -lt $MinFreeRamMb) {
      $gate.status = 'skipped'; $gate.reason = "low_ram ($free MB free, $MinFreeRamMb needed)"
    } else {
      $node = Get-NodePath
      if (-not $node) { throw 'node was not found on PATH' }
      $steps = @()
      $gate.repo_head = [string](& git -C $RepoRoot rev-parse --short HEAD 2>$null | Select-Object -First 1)
      $gate.jarvis_head = [string](& git -C $JarvisRoot rev-parse --short HEAD 2>$null | Select-Object -First 1)
      $tsc = Join-Path $RepoRoot 'node_modules\typescript\bin\tsc'
      $steps += Invoke-Step 'devops-typecheck' $node @($tsc, '--noEmit') $RepoRoot 900
      $testFiles = @(Get-ChildItem -LiteralPath (Join-Path $RepoRoot 'tests') -Filter '*.test.mjs' | Sort-Object Name | ForEach-Object { 'tests\' + $_.Name })
      $steps += Invoke-Step 'devops-node-tests' $node (@('--import', 'tsx', '--test') + $testFiles) $RepoRoot 1800
      if ((Test-Path -LiteralPath $PythonExe) -and (Test-Path -LiteralPath $JarvisRoot)) {
        $pyTests = @(Get-ChildItem -LiteralPath (Join-Path $JarvisRoot 'tests') -Filter 'test_devops*.py' -ErrorAction SilentlyContinue | Sort-Object Name | ForEach-Object { 'tests\' + $_.Name })
        $envx = @{ PYTHONPATH = (Join-Path $JarvisRoot 'src'); PYTHONDONTWRITEBYTECODE = '1' }
        $steps += Invoke-Step 'jarvis-devops-ruff' $PythonExe (@('-m', 'ruff', 'check', '--no-cache', 'src\nexus_jarvis\devops') + $pyTests) $JarvisRoot 300 $envx
        $steps += Invoke-Step 'jarvis-devops-pytest' $PythonExe (@('-m', 'pytest', '-q', '-p', 'no:cacheprovider', '--tb=short') + $pyTests) $JarvisRoot 1800 $envx
      } else {
        $steps += [pscustomobject]@{ name = 'jarvis-devops-ruff'; exit = -3; timed_out = $false; seconds = 0; stdout = ''; tail = 'python or Jarvis tree not found' }
      }
      # A node test run whose ONLY failures are Windows symlink-privilege errors (EPERM on fs.symlink) is an environment limit, not a code
      # defect. It is reported as pass_env_limited with the counts and stays visible; any other failure keeps the gate red.
      $envNotes = @()
      foreach ($s in $steps) {
        $s | Add-Member -NotePropertyName env_limited -NotePropertyValue $false -Force
        if ($s.name -eq 'devops-node-tests' -and $s.exit -eq 1 -and -not $s.timed_out) {
          $failing = ($s.stdout -split 'failing tests:', 2)
          if ($failing.Count -eq 2) {
            # One block per failing test ("test at <file>:<line>"); every block must contain the symlink EPERM error and no other error.
            $blocks = @(($failing[1] -split '(?m)^test at ') | Select-Object -Skip 1)
            $testCount = $blocks.Count
            $allPerm = ($testCount -gt 0)
            foreach ($b in $blocks) {
              $errs = @(($b -split "`r?`n") | Where-Object { $_ -match '^\s+\w*Error\b' })
              if ($errs.Count -eq 0 -or @($errs | Where-Object { $_ -notmatch 'EPERM: operation not permitted, symlink' }).Count -gt 0) { $allPerm = $false }
            }
            if ($allPerm) {
              $s.env_limited = $true
              $envNotes += "$testCount node test(s) blocked by Windows symlink privilege (EPERM); enable Developer Mode to run them"
            }
          }
        }
      }
      $gate.steps = @($steps | ForEach-Object {
          $t = $_.tail
          if ($_.exit -eq 0) { $t = (($_.tail -split "`n") | Select-Object -Last 3) -join "`n" }
          [ordered]@{ name = $_.name; exit = $_.exit; timed_out = $_.timed_out; seconds = $_.seconds; env_limited = $_.env_limited; tail = $t }
        })
      $bad = @($steps | Where-Object { $_.exit -ne 0 -and -not $_.env_limited })
      if ($bad.Count -gt 0) { $gate.status = 'fail'; $gate.reason = 'failed steps: ' + (($bad | ForEach-Object { $_.name }) -join ', ') }
      elseif ($envNotes.Count -gt 0) { $gate.status = 'pass_env_limited'; $gate.reason = ($envNotes -join '; ') }
    }
    $prevStatus = [string](Get-Prop $prevG 'status' 'pass')
    if ($gate.status -eq 'fail' -and $prevStatus -ne 'fail') { Add-Alert 'gate_failed' $gate.reason }
    if ($gate.status -like 'pass*' -and $prevStatus -eq 'fail') { Add-Alert 'gate_recovered' 'no failing gate step remains' }
    Write-JsonAtomic (Join-Path $RuntimeDir 'gate-latest.json') $gate
    Add-JsonLine (Join-Path $RuntimeDir 'gate-history.jsonl') ([ordered]@{ ts = $gate.checked_at; status = $gate.status; reason = $gate.reason; repo_head = $gate.repo_head; jarvis_head = $gate.jarvis_head }) 200
    Update-StatusMd
    $note = ''
    if ($gate.reason) { $note = ' - ' + $gate.reason }
    Write-Output ("gate: {0}{1}" -f $gate.status, $note)
    if ($gate.status -eq 'fail') { exit 1 }
  }
}
