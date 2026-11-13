# Running the Lykantra admin console on pc-server (Windows)

The admin console runs directly on Windows, the same as `npm run dev`. The scripts here do the starting and
updating for you:

| Script | What it does | When |
|---|---|---|
| `windows\install-autostart.ps1` | Starts the console automatically when Windows boots | once |
| `update.ps1` | Gets the latest code, checks it builds, restarts | every time changes are pushed |

The console needs the **server** to be running too (it talks to it on port 5000). The server has its own
`update.ps1` and `windows\install-autostart.ps1`; see `WINDOWS.md` in the `server` folder.

> `C:\...\admin` below means the folder where you `git pull` today. Use your real path.

---

## Setup (once)

### 1. Stop Docker, if you used it

If the console ever ran in Docker, stop it so it doesn't hold port 5173. In **PowerShell**:

```powershell
cd C:\...\admin; docker compose down
```

(Don't add `-v`. Red error text just means there was nothing to stop.)
Also close any window still running `npm run dev`.

### 2. Get the latest code

```powershell
cd C:\...\admin; git pull
```

### 3. Turn on automatic start

Open **PowerShell as administrator** (Start → type `PowerShell` → right-click → *Run as administrator*).
Use the **same Windows account** you normally run the console with. Then:

```powershell
cd C:\...\admin
powershell -ExecutionPolicy Bypass -File .\windows\install-autostart.ps1
```

It ends with **`Done. The admin console now starts at boot as ...`**

If you'd rather allow scripts for good, run this once, then use `.\windows\install-autostart.ps1` directly:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### 4. Start it now

In **PowerShell** (normal is fine):

```powershell
cd C:\...\admin; .\update.ps1 -Force
```

It ends with **`Admin console updated and running: http://localhost:5173`**.
If scripts are blocked, use `powershell -ExecutionPolicy Bypass -File .\update.ps1 -Force`.

### 5. Check

1. Open **http://localhost:5173** on pc-server and sign in.
2. Restart pc-server, wait 2 minutes **without running anything**, then open http://localhost:5173 again.
   It should open by itself.

Setup is finished.

---

## Installing an update

When new changes are on GitHub, in **PowerShell**:

```powershell
cd C:\...\admin; .\update.ps1
```

- **Nothing new:** it says *Already up to date* and leaves the console running.
- **New version:** it installs packages if they changed, checks that the new code builds, then restarts the
  console. This takes about a minute.
- **The new code doesn't build:** it puts the code back and keeps the old version running. Tell the developer.

---

## If something goes wrong

| What you see | What to do |
|---|---|
| *running scripts is disabled on this system* | Run the script as `powershell -ExecutionPolicy Bypass -File .\update.ps1`, or do the `Set-ExecutionPolicy` line in step 3. |
| *cannot be run because it contains a "#requires" statement for running as Administrator* | Open PowerShell as administrator (step 3). Only `install-autostart.ps1` needs this. |
| *Port 5173 is used by another program* | Something else holds the port, often a Docker container: `docker compose down` in `admin`. |
| *did not stop. Try again in PowerShell as administrator* | Run the same `update.ps1` in PowerShell as administrator. |
| *git pull failed* | Someone changed files on pc-server. Run `git status` in that folder and send the output to the developer. |
| *didn't answer within 2 minutes* | Open `C:\...\admin\logs\admin-errors.log` and `admin.log`. |
| The page opens but sign-in or data fails | The server isn't running. In the `server` folder run `.\update.ps1 -Force`. |
| http://localhost:5173 doesn't open after a reboot | Run `.\update.ps1 -Force` in `admin`. If that works but the next reboot fails again, redo step 3. |

**To start by hand** (for example, after you stopped it): `.\update.ps1 -Force`.

**Logs:** `admin\logs\`. The previous run's logs are kept as `*.previous.log`.

**To turn off automatic start:**
`Unregister-ScheduledTask -TaskName 'Lykantra Admin' -Confirm:$false` (PowerShell as administrator).

---

## Good to know

- Without the boot task, `update.ps1` still starts the console, but it stops when Windows restarts. You'd have to
  run `.\update.ps1 -Force` again.
- The console runs as your normal Windows user, never with administrator rights.
- It only opens on pc-server itself (http://localhost:5173).
- The Docker files (`Dockerfile`, `compose.yaml`, `DOCKER.md`) are no longer used for running the console.
