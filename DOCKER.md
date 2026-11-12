# Admin console in Docker on pc-server

The admin console is built and served in **Docker Desktop**. The server keeps running directly on Windows.

- Opens at **http://localhost:5173**, on pc-server only (not from other computers, the same as before).
- The container talks to the server on Windows through `host.docker.internal:5000`.

> `C:\...\admin` below means the folder where you `git pull` today. Use your real path.

## Setup (once)

1. Set up and start the **server** first: follow `WINDOWS.md` in the **server** folder (skip its `admin` lines).
2. Install **Docker Desktop**. In its Settings → General, tick *Start Docker Desktop when you sign in*.
   (Docker Desktop starts when someone signs in to Windows, so pc-server needs automatic sign-in or someone to
   sign in after a reboot.)
3. In PowerShell:

   ```powershell
   cd C:\...\admin
   git pull
   .\update.ps1 -Force
   ```

   It ends with **`Admin console updated and running: http://localhost:5173`**. It also stops the old
   `npm run dev` console and removes its boot task if they exist.
4. Open **http://localhost:5173** on pc-server and sign in.

Docker restarts the console by itself after a reboot; there is no boot task to install.

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

**Keep pc-server's Docker for Lykantra only.** To reach the server, the console container connects as if it were a
program on pc-server itself, and every other container in Docker Desktop could do the same. They still need an
admin password to do anything, so use strong admin passwords and don't run other people's containers on pc-server.

**Different port** (only if something else needs 5173): create a file `.env` in `C:\...\admin` containing
`ADMIN_PORT=8080`, then run `.\update.ps1 -Force`. Live view also needs the server to accept that address: ask the
developer.
