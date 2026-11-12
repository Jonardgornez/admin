# Running the admin console in Docker on pc-server

The admin console runs next to the server container, under Docker Engine inside WSL2. The full pc-server setup
(WSL, Docker, moving the server data, backups) is in the server repo's `DOCKER.md`; do that first.

The container builds the console and serves it with nginx at **http://localhost:5173**, reachable on pc-server
only. nginx forwards `/api` (including live view) to the server's admin port on `127.0.0.1:5000`.

Start it (from this folder):

```powershell
wsl -d Ubuntu --exec docker compose up -d
```

Update it after changes are pushed to GitHub:

```powershell
.\deploy.ps1
```

To use another port, set `ADMIN_PORT` for both containers, for example in a `.env` file next to each
`compose.yaml`: `ADMIN_PORT=8080`. The server needs it too, so live view accepts the console's address.
