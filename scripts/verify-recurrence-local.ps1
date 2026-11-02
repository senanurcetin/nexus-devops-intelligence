# Local-only verification of the historical recurrence test regression.
# Run from a standard, non-elevated Windows user session. No npm install,
# Git fetch, CI workflow trigger, push, deploy, or application server.
[CmdletBinding()]
param(
    [ValidatePattern('^$|^[0-9a-f]{40}$')]
    [string]$ExpectedHead = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Stop-Verification([string]$Reason, [int]$Code) {
    Write-Output ("VERIFICATION_BLOCKED: " + $Reason)
    exit $Code
}

# The SentinelX Windows agent is SYSTEM. Never run repository tests from that
# service, a LocalService/NetworkService account, or an elevated admin token.
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$sid = $identity.User.Value
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if ($sid -in @('S-1-5-18', 'S-1-5-19', 'S-1-5-20') -or
    $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Stop-Verification 'requires a non-elevated interactive user' 30
}

$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$git = Get-Command git -CommandType Application -ErrorAction SilentlyContinue
$node = Get-Command node -CommandType Application -ErrorAction SilentlyContinue
if (-not $git -or -not $node) {
    Stop-Verification 'Git and Node.js must already be installed' 31
}

# Git checks are read-only. Do not turn on unsafe global safe.directory.
$top = & $git.Source -C $root rev-parse --show-toplevel 2>$null
if ($LASTEXITCODE -ne 0 -or -not $top) {
    Stop-Verification 'this path is not a trusted Git checkout' 32
}
$actualRoot = [IO.Path]::GetFullPath([string]$top).TrimEnd('\')
if (-not [string]::Equals($root, $actualRoot, [StringComparison]::OrdinalIgnoreCase)) {
    Stop-Verification 'script must be inside the exact repository root' 33
}
$origin = & $git.Source -C $root config --get remote.origin.url 2>$null
if ($LASTEXITCODE -ne 0 -or
    $origin -notmatch '^(https://github\.com/|git@github\.com:|ssh://git@github\.com/)senanurcetin/nexus-devops-intelligence(\.git)?/?$') {
    Stop-Verification 'unverified repository origin; no code will be executed' 41
}
$head = (& $git.Source -C $root rev-parse --verify HEAD 2>$null)
if ($LASTEXITCODE -ne 0 -or $head -notmatch '^[0-9a-f]{40}$') {
    Stop-Verification 'cannot verify current Git HEAD' 34
}
if ($ExpectedHead -and $head -cne $ExpectedHead) {
    Stop-Verification 'repository HEAD has changed since review' 35
}
& $git.Source -C $root merge-base --is-ancestor 2521af937d97b529a818bff14ff350c9fd03b0a7 HEAD 2>$null
if ($LASTEXITCODE -ne 0) {
    Stop-Verification 'required historical recurrence fix is absent from this HEAD' 36
}

$dirty = @(& $git.Source -C $root status --porcelain=v1 --untracked-files=all 2>$null)
if ($LASTEXITCODE -ne 0 -or $dirty.Count -gt 0) {
    Stop-Verification 'working tree is not clean; preserve other agents changes' 37
}
if (-not (Test-Path -LiteralPath (Join-Path $root 'node_modules\tsx\package.json') -PathType Leaf)) {
    Stop-Verification 'tsx dependency missing; no package install will be attempted' 38
}
$version = & $node.Source --version
if ($LASTEXITCODE -ne 0 -or $version -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 22) {
    Stop-Verification 'Node.js 22+ is required' 39
}

$oldCI = $env:CI
$oldTelemetry = $env:NEXT_TELEMETRY_DISABLED
$oldNodeOptions = $env:NODE_OPTIONS
$exitStatus = 99
try {
    $env:CI = 'true'
    $env:NEXT_TELEMETRY_DISABLED = '1'
    $env:NODE_OPTIONS = ''
    Push-Location -LiteralPath $root
    try {
        # Narrow regression only; this is not a full-suite or release proof.
        & $node.Source --import tsx --test tests/nexus-workflow-recurrence.test.mjs
        $exitStatus = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
}
finally {
    $env:CI = $oldCI
    $env:NEXT_TELEMETRY_DISABLED = $oldTelemetry
    $env:NODE_OPTIONS = $oldNodeOptions
}
$after = @(& $git.Source -C $root status --porcelain=v1 --untracked-files=all 2>$null)
if ($LASTEXITCODE -ne 0 -or $after.Count -gt 0) {
    Stop-Verification 'tests changed the repository; inspect the isolated checkout' 40
}
if ($exitStatus -ne 0) {
    Write-Output 'REGRESSION_FAILED: tests did not pass; do not claim fix verification'
    exit $exitStatus
}
Write-Output 'TARGETED_REGRESSION_PASSED: current local HEAD only, not hosted CI or release approval'
exit 0
