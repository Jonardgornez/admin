# Updates the admin console on pc-server: gets the latest code from GitHub, checks that it builds, then restarts it.
# If the new code doesn't build, it is put back and the old version keeps running.
param(
    # Restart even when there is nothing new (also starts a console that isn't running).
    [switch]$Force
)

# Not 'Stop': Windows PowerShell 5.1 would treat git's normal progress messages (written to stderr) as errors.
# Every git/dotnet/npm call checks $LASTEXITCODE instead, and cmdlets that must succeed use -ErrorAction Stop.
$ErrorActionPreference = 'Continue'
Set-Location -LiteralPath $PSScriptRoot -ErrorAction Stop
$startScript = Join-Path $PSScriptRoot 'windows\start-admin.ps1'
$taskName = 'Lykantra Admin'

function Get-AdminProcessIds {
    Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
}

function Stop-Admin {
    foreach ($id in Get-AdminProcessIds) {
        Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
    }
    $deadline = (Get-Date).AddSeconds(30)
    while ((Get-AdminProcessIds) -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 1 }
    if (Get-AdminProcessIds) { throw 'The admin console did not stop. Try again in PowerShell as administrator.' }
}

function Install-Packages {
    npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
}

$before = (git rev-parse HEAD).Trim()
git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw 'git pull failed; the admin console was not changed.' }
$after = (git rev-parse HEAD).Trim()

if ($before -eq $after -and (Get-AdminProcessIds) -and -not $Force) {
    Write-Host 'Already up to date. The admin console keeps running.'
    return
}

if ($before -ne $after) {
    # New packages can only be installed while the console is stopped (Windows locks the files it uses).
    $packagesChanged = [bool](git diff --name-only $before $after -- package-lock.json)
    if ($packagesChanged) {
        Write-Host 'Packages changed: stopping the console and installing them...'
        Stop-Admin
        Install-Packages
    }

    Write-Host 'Checking that the new version builds...'
    npm run build
    if ($LASTEXITCODE -ne 0) {
        git reset --keep $before
        if ($packagesChanged) { Install-Packages }
        if (-not (Get-AdminProcessIds)) {
            Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden `
                -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$startScript`""
        }
        throw 'The new version does not build, so it was not installed. The admin console keeps the previous version.'
    }
}

Write-Host 'Restarting the admin console...'
Stop-Admin

# The startup task ends once its console has stopped; it must not be running when it is started again.
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
    $deadline = (Get-Date).AddSeconds(15)
    while ((Get-ScheduledTask -TaskName $taskName).State -eq 'Running' -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 1 }
}

$started = $false
if ($task) {
    try {
        Start-ScheduledTask -TaskName $taskName -ErrorAction Stop
        $started = $true
    } catch {
        Write-Host 'Could not start the startup task, so the console is started directly instead.'
    }
}
if (-not $started) {
    Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden `
        -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$startScript`""
}

$deadline = (Get-Date).AddMinutes(2)
while ((Get-Date) -lt $deadline) {
    try {
        Invoke-WebRequest 'http://localhost:5173/' -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop | Out-Null
        Write-Host 'Admin console updated and running: http://localhost:5173'
        return
    } catch {
        Start-Sleep -Seconds 3
    }
}
throw "The admin console didn't answer within 2 minutes. See $(Join-Path $PSScriptRoot 'logs\admin.log') and admin-errors.log."
