# Gets the latest admin console from GitHub and rebuilds/restarts its container. Run on pc-server from this folder.
param(
    # The WSL distro that runs Docker Engine.
    [string]$Distro = 'Ubuntu'
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw 'git pull failed; nothing was rebuilt.' }

# Built first, so a failed build leaves the running console untouched.
wsl.exe -d $Distro --exec docker compose build
if ($LASTEXITCODE -ne 0) { throw 'Build failed; the running admin console was not changed.' }

wsl.exe -d $Distro --exec docker compose up -d
if ($LASTEXITCODE -ne 0) { throw "docker compose up failed. Check: wsl -d $Distro --exec docker compose logs admin" }

# Removes only untagged images left over from earlier builds.
wsl.exe -d $Distro --exec docker image prune -f | Out-Null
Write-Host 'Admin console updated: http://localhost:5173'
