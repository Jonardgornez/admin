# Admin console in Docker on pc-server

The admin console is built and served in **Docker Desktop**. The server keeps running directly on Windows.

- Opens at **http://localhost:5173**, on pc-server only (not from other computers, the same as before).
- The container talks to the server on Windows through `host.docker.internal:5000`.

**First time?** Follow `WINDOWS.md` in the **server** folder. It sets up the server and this console together.

> `C:\...\admin` below means the folder where you `git pull` today. Use your real path.

## Installing an update

When new changes are on GitHub, in PowerShell:

```powershell
cd C:\...\admin
.\update.ps1
```

- **Nothing new:** it says *Already up to date*.
- **New version:** it builds it in Docker (1-2 minutes), then swaps it in.
- **The new code doesn't build:** it puts the code back and the running console isn't touched. Tell the developer.

> `git pull` on its own isn't enough. The console only changes when `update.ps1` rebuilds it.

## If something goes wrong

| What you see | What to do |
|---|---|
| *Docker Desktop is not running* | Start Docker Desktop, wait for *Engine running*, then run `update.ps1` again. |
| *cannot reach the server* | Start the server: `cd C:\...\server; .\update.ps1 -Force` |
| *Port 5173 is used by another program* | Close that program, or restart pc-server, then run `update.ps1` again. |
| *The old 'Lykantra Admin' boot task still exists* | Once, in PowerShell as administrator: `Unregister-ScheduledTask 'Lykantra Admin' -Confirm:$false` |
| http://localhost:5173 doesn't open after a reboot | Sign in to Windows and wait for Docker Desktop to start. Still nothing? Run `.\update.ps1 -Force`. |
| Anything else | Logs: `docker compose logs --tail 50 admin` (from `C:\...\admin`). |

`docker compose down` stops the console; `.\update.ps1 -Force` starts it again.

**Different port** (only if something else needs 5173): create a file `.env` in `C:\...\admin` containing
`ADMIN_PORT=8080`, then run `.\update.ps1 -Force`. Live view also needs the server to accept that address: ask the
developer.
