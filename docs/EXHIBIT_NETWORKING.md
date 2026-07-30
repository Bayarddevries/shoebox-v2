# Métis Kin Exhibit — Tailscale / Network Setup

The servers run inside WSL2 (ports 8081 state, 8082 static files).
By default, WSL2 ports are only accessible via `localhost` on Windows.
To reach them from a tablet via Tailscale (or any network device), one of these options is needed.

## Option A: Port proxy rules (per session, requires admin)

The `Start Métis Kin Exhibit.bat` batch file handles this automatically when run as administrator.
Right-click → "Run as administrator".

It runs:
```
netsh interface portproxy add v4tov4 listenport=8081 listenaddress=0.0.0.0 connectport=8081 connectaddress=<WSL_IP>
netsh interface portproxy add v4tov4 listenport=8082 listenaddress=0.0.0.0 connectport=8082 connectaddress=<WSL_IP>
```

## Option B: WSL2 mirrored networking (permanent, no admin needed)

This makes WSL2 ports available on all Windows interfaces including Tailscale.
No port proxy rules needed.

1. Create/edit `%USERPROFILE%\.wslconfig`:
   ```
   [wsl2]
   networkingMode=mirrored
   ```

2. Restart WSL:
   ```cmd
   wsl --shutdown
   ```
   Then reopen your WSL terminal.

3. After this, WSL2 ports are directly accessible via the Windows Tailscale IP
   — no proxy rules needed, no admin required.

## Accessing the exhibit

| Device | URL |
|--------|-----|
| **Big screen (Windows)** | `http://localhost:8082/projector.html?exhibit` |
| **Tablet via Tailscale** | `http://100.65.25.105:8082/controller.html` |
| **Tablet via local WiFi** | `http://<WINDOWS_WIFI_IP>:8082/controller.html` |
