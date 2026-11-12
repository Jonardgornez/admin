# Admin console in Docker on pc-server

> **Not in use.** pc-server runs Lykantra directly on Windows: see `WINDOWS.md`. Docker Desktop can't run this
> server correctly (it hides the lab PCs' real IP addresses), and the Ubuntu + Docker Engine setup below was too
> involved. This guide is kept only for reference.

The admin console runs in Docker next to the server and opens at **http://localhost:5173**, on pc-server only.

**First time?** Follow the full guide in the **server** folder: `server\DOCKER.md`. It sets up Docker, moves
the data, and starts both the server and this console. There's nothing extra to do here.

## Install an update

When new changes are on GitHub, in PowerShell:

```powershell
cd C:\...\admin
.\deploy.ps1
```

`C:\...\admin` is the folder where you `git pull` today. The script gets the new code, builds it, and swaps it
in. If anything fails, the old version keeps running.

> `git pull` on its own is no longer enough. The console only changes when `deploy.ps1` rebuilds it.

## If something goes wrong

| What you see | What to do |
|---|---|
| http://localhost:5173 doesn't open | Run `wsl -d Ubuntu --exec docker ps` and check that two containers are listed. If not, from this folder: `wsl -d Ubuntu --exec docker compose up -d`. |
| Page opens but sign-in or data fails | The server isn't running: see the troubleshooting table in `server\DOCKER.md`. |
| Logs | From this folder: `wsl -d Ubuntu --exec docker compose logs --tail 50 admin` |

## Using a different port

Only if something else already uses port 5173. Create a file named `.env` containing `ADMIN_PORT=8080` (your
port) in **both** the `admin` and `server` folders, then run `.\deploy.ps1` in both. Live view only works if the
two match.
