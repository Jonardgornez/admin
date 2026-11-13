#Requires -RunAsAdministrator
# Makes the admin console start by itself when Windows boots, even before anyone signs in. Run once, as administrator.
# The task runs as the Windows user running this script, the same as starting the console by hand.
$ErrorActionPreference = 'Stop'
$startScript = Join-Path $PSScriptRoot 'start-admin.ps1'
$user = "$env:USERDOMAIN\$env:USERNAME"

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$startScript`""
$trigger = New-ScheduledTaskTrigger -AtStartup
# S4U: runs whether or not the user is signed in, without storing their password.
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType S4U -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName 'Lykantra Admin' -Action $action -Trigger $trigger -Principal $principal `
    -Settings $settings -Description 'Starts the Lykantra admin console (npm run dev) at boot.' -Force | Out-Null
Write-Host "Done. The admin console now starts at boot as $user. Start it now with: .\update.ps1 -Force"
