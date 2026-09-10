# Métis Kin Exhibit — Networking (native Pop_OS, NOT WSL2)

This machine runs native Pop!_OS Linux. There is NO WSL2, NO netsh portproxy,
NO `.wslconfig`. The WSL2-era instructions below were deleted in this rewrite —
do not resurrect them.

## How the exhibit serves

- `scripts/exhibit-server.py` — state relay on **:8081** (holds filters /
  photoIds / speed / transition; serves `/health /state /manifest /search`).
- `scripts/serve-exhibit.py` — static no-cache server on **:8082** (serves
  `public/` — controller.html, projector.html, assets).
- Both bind `0.0.0.0` → any device on a routable network can reach them.
- Start: `cd ~/shoebox-v2/scripts && ./exhibit-start.sh` (run in BACKGROUND —
  it never exits; a foreground run times out at 60s and kills the tree).

## URLs that matter

| Device / context | URL |
|---|---|
| Big screen (stage), follows controller | `http://100.108.183.33:8082/projector.html?exhibit&server=100.108.183.33:8081` |
| Controller tablet (via Tailscale) | `http://100.108.183.33:8082/controller.html` |
| Controller tablet (same office Wi-Fi, LAN) | `http://10.0.0.127:8082/controller.html` |
| Health check | `http://100.108.183.33:8081/health` → `{"ok": true}` |

- LAN IP is `10.0.0.127` (office Wi-Fi, iface `wlxb8fbb3c4f121`).
- Tailscale IP is `100.108.183.33` (same machine, tailnet).
- `controller.html` / `projector.html` auto-derive the state server from the
  host they were loaded from (`getServerUrl()`). The `?exhibit&server=` flags
  make the big screen follow the controller instead of running standalone.

## ⚠️ Firewall (REQUIRED before showtime)

- **ufw is ACTIVE with `DEFAULT_INPUT_POLICY="DROP"`** on this machine.
- `ufw status` needs sudo and there is NO passwordless sudo — the assistant
  cannot check or change it without Bayard running:
  ```bash
  sudo ufw allow 8080,8081,8082/tcp
  # or: sudo ufw disable   (only if you accept an open machine on the network)
  ```
- Same-host probes (`curl localhost:8082`) pass even when ufw blocks the
  ports, so a healthy local test does NOT prove the tablet can connect.
- Verify from an actual remote device once opened.

## Tailscale caveat

- Bayard's exhibit tablet is **TAILNET-ONLY** — it has no LAN route to
  `10.0.0.127` (times out). Use the tailnet address
  `http://100.108.183.33:8082/controller.html` for that tablet.
- Office Wi-Fi may have client isolation (guest/enterprise APs block
  device-to-device). Fallback: phone hotspot or Tailscale on the tablet.

## Refresh after archive additions

The exhibit reads a generated snapshot (`manifest.json`), NOT a live link to
Lightroom. Refresh path:

```bash
cd ~/shoebox-v2
node scripts/generate_manifest.js          # rebuilds manifest from photos/ EXIF
.venv-faces/bin/python scripts/detect_faces.py public/assets/shoebox/photos public/assets/shoebox/face_coords.json
# restart exhibit-server.py (it loads the manifest once at startup)
```

Face detection needs the `.venv-faces` venv (opencv-python-headless v5).
See the `metis-kin-exhibit` skill for the full pipeline + known pitfalls.
