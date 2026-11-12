# Updates the admin console on pc-server: gets the latest code from GitHub, builds it in Docker, then swaps it in.
# If the new code doesn't build, it is put back and the running console isn't touched.
param(
    # Rebuild and restart even when there is nothing new (also starts a console that isn't running).
    [switch]$Force
)

# Not 'Stop': Windows PowerShell 5.1 would treat the normal progress messages git and docker write to stderr as errors.
# Every git/docker call checks $LASTEXITCODE instead, and cmdlets that must succeed use -ErrorAction Stop.
$ErrorActionPreference = 'Continue'
Set-Location -LiteralPath $PSScriptRoot -ErrorAction Stop
$oldTaskName = 'Lykantra Admin'
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole('Administrators')

docker info --format '{{.ServerVersion}}' *> $null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker Desktop is not running. Start it, wait until it shows "Engine running", then run update.ps1 again.'
}

$before = (git rev-parse HEAD).Trim()
git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw 'git pull failed; the admin console was not changed. Run git status.' }
$after = (git rev-parse HEAD).Trim()

$isRunning = [bool](docker compose ps --status running --quiet admin)
if ($before -eq $after -and $isRunning -and -not $Force) {
    Write-Host 'Already up to date. The admin console keeps running.'
    return
}

Write-Host 'Building the admin console in Docker (1-2 minutes)...'
docker compose build
if ($LASTEXITCODE -ne 0) {
    if ($before -ne $after) {
        git reset --keep $before
        if ($LASTEXITCODE -ne 0) {
            throw "The new version does not build, and the previous code could not be put back. Run 'git status' in $PSScriptRoot and send the output to the developer."
        }
    }
    throw 'The new version does not build, so it was not installed. The admin console keeps running the previous version.'
}

# Before Docker, the console ran as `npm run dev` from this folder, started by a boot task. Both are retired here.
if (Get-ScheduledTask -TaskName $oldTaskName -ErrorAction SilentlyContinue) {
    if ($isAdmin) {
        Unregister-ScheduledTask -TaskName $oldTaskName -Confirm:$false
        Write-Host "Removed the old '$oldTaskName' boot task (Docker now starts the console)."
    } else {
        Write-Warning "The old '$oldTaskName' boot task still exists and would start the old console at boot. Remove it once in PowerShell as administrator: Unregister-ScheduledTask '$oldTaskName' -Confirm:`$false"
    }
}
foreach ($id in Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$id" -ErrorAction SilentlyContinue
    if ($process.Name -like 'node*' -and "$($process.CommandLine)" -like "*$PSScriptRoot*") {
        Write-Host 'Stopping the old npm run dev console...'
        Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    } elseif ($process.Name -notlike 'com.docker*' -and $process.Name -notlike 'wslrelay*' -and $process.Name -notlike 'vpnkit*') {
        throw "Port 5173 is used by another program ($($process.Name), PID $id). Close it, then run update.ps1 again."
    }
}

docker compose up -d
if ($LASTEXITCODE -ne 0) { throw 'docker compose up failed. See: docker compose logs admin' }

# Removes only untagged images left over from earlier builds.
docker image prune -f *> $null

$deadline = (Get-Date).AddMinutes(1)
while ((Get-Date) -lt $deadline) {
    try {
        Invoke-WebRequest 'http://localhost:5173/' -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop | Out-Null
        try {
            Invoke-WebRequest 'http://localhost:5173/api/health' -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop | Out-Null
            Write-Host 'Admin console updated and running: http://localhost:5173'
        } catch {
            Write-Warning 'The admin console is running, but it cannot reach the server. Start the server: in the server folder run .\update.ps1 -Force'
        }
        return
    } catch {
        Start-Sleep -Seconds 2
    }
}
throw "The admin console didn't answer within 1 minute. See: docker compose logs admin"
