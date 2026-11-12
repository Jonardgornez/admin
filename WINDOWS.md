# Running the admin console on pc-server (Windows)

The admin console runs on Windows (`npm run dev`) and opens at **http://localhost:5173**, on pc-server only.

**First time?** Follow `WINDOWS.md` in the **server** folder. It covers the admin console too.

## Installing an update

When new changes are on GitHub, in PowerShell:

```powershell
cd C:\...\admin
.\update.ps1
```

`C:\...\admin` is the folder where you `git pull` today. The script:

1. gets the latest code
2. installs new packages if there are any
3. checks that it builds
4. restarts the console

If the new code doesn't build, it puts the code back and the old version keeps running.

Logs are in `logs\admin.log` and `logs\admin-errors.log`.
