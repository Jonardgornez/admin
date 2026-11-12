# Starts the admin console in the background, the same as `npm run dev`, with its output in logs\.
# Used by the "Lykantra Admin" startup task and by update.ps1. Does nothing if the console is already running.
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$logs = Join-Path $repo 'logs'

if (Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue) {
    Write-Host 'The admin console is already running.'
    return
}

# The previous run's logs are kept once, as *.previous.log.
New-Item -ItemType Directory -Force -Path $logs | Out-Null
foreach ($name in 'admin', 'admin-errors') {
    $log = Join-Path $logs "$name.log"
    if (Test-Path -LiteralPath $log) {
        Move-Item -LiteralPath $log -Destination (Join-Path $logs "$name.previous.log") -Force
    }
}

# --strictPort: fail instead of quietly moving to another port when 5173 is taken.
Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'dev', '--', '--strictPort' -WorkingDirectory $repo -NoNewWindow -Wait `
    -RedirectStandardOutput (Join-Path $logs 'admin.log') `
    -RedirectStandardError (Join-Path $logs 'admin-errors.log')
