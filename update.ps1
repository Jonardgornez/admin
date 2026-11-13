# Updates the admin console on pc-server: gets the latest code from GitHub, checks that it builds, then restarts it.
# If the new code doesn't build, it is put back and the old version keeps running.
param(
    # Restart even when there is nothing new (also starts a console that isn't running).
    [switch]$Force
)

# Not 'Stop': Windows PowerShell 5.1 would treat git's normal progress messages (written to stderr) as errors.
# Every git/npm call checks $LASTEXITCODE instead, and cmdlets that must succeed use -ErrorAction Stop.
$ErrorActionPreference = 'Continue'
Set-Location -LiteralPath $PSScriptRoot -ErrorAction Stop
$startScript = Join-Path $PSScriptRoot 'windows\start-admin.ps1'
$taskName = 'Lykantra Admin'
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole('Administrators')

function Get-AdminProcessIds {
    Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
}

# Only processes started from this folder are stopped; anything else on the port is reported, never killed.
function Stop-Admin {
    foreach ($id in Get-AdminProcessIds) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$id" -ErrorAction SilentlyContinue
        if ("$($process.ExecutablePath) $($process.CommandLine)" -notlike "*$PSScriptRoot*") {
            throw "Port 5173 is used by another program ($($process.Name), PID $id), not by this console. Close it, then run update.ps1 again."
        }
        Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
    }
    $deadline = (Get-Date).AddSeconds(30)
    while ((Get-AdminProcessIds) -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 1 }
    if (Get-AdminProcessIds) { throw 'The admin console did not stop. Try again in PowerShell as administrator.' }
}

function Start-Admin {
    $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($task) {
        # The startup task ends once its console has stopped; it must not be running when it is started again.
        $deadline = (Get-Date).AddSeconds(15)
        while ((Get-ScheduledTask -TaskName $taskName).State -eq 'Running' -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 1 }
        try {
            Start-ScheduledTask -TaskName $taskName -ErrorAction Stop
            return
        } catch {
            # Started directly only from a normal window, so the console never runs with administrator rights.
            if ($isAdmin) { throw "Could not start the '$taskName' task: $($_.Exception.Message)" }
            Write-Host 'Could not start the startup task, so the console is started directly instead.'
        }
    }
    Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden `
        -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$startScript`""
}

function Install-Packages {
    npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
}

$before = (git rev-parse HEAD).Trim()
git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw 'git pull failed; the admin console was not changed. Run git status.' }
$after = (git rev-parse HEAD).Trim()

if ($before -eq $after -and (Get-AdminProcessIds) -and -not $Force) {
    Write-Host 'Already up to date. The admin console keeps running.'
    return
}

try {
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
            if ($LASTEXITCODE -ne 0) {
                throw "The new version does not build, and the previous code could not be put back. Run 'git status' in $PSScriptRoot and send the output to the developer."
            }
            if ($packagesChanged) { Install-Packages }
            throw 'The new version does not build, so it was not installed. The admin console keeps the previous version.'
        }
    }

    Write-Host 'Restarting the admin console...'
    Stop-Admin
} finally {
    # Whatever happened above, the console is never left stopped.
    if (-not (Get-AdminProcessIds)) { Start-Admin }
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
throw "The admin console didn't answer within 2 minutes. See $(Join-Path $PSScriptRoot 'logs\admin-errors.log') and admin.log."
