# Métis Kin Exhibit — Controller + Display Plan

## Architecture

```
┌─────────────────┐       HTTP POST       ┌──────────────────┐
│  Pedestal Tablet │  ──────────────────►  │  State Server     │
│  (controller)    │  { filters, speed,    │  (Python,         │
│                  │    transition, cmd }   │   ThreadingHTTPServer)
│  touch web UI    │  ◄──────────────────  │  CORS enabled     │
│  "Ember Archive" │       HTTP GET         │  holds current    │
└─────────────────┘     "current state"    │  state in memory  │
                                            └────────┬─────────┘
                                                     │ HTTP GET
                                                     │ every 2s
                                                     ▼
                                            ┌──────────────────┐
                                            │  Big Screen       │
                                            │  (projector.html  │
                                            │   exhibit mode)   │
                                            │                   │
                                            │  full-screen      │
                                            │  no local UI      │
                                            │  shows connection │
                                            │  status dot       │
                                            └──────────────────┘
```

All three on the same local WiFi. The server can run on the same machine as the display (e.g. a Raspberry Pi 5 behind the big screen).

---

## Files

| File | What it is | New/Modify |
|------|-----------|------------|
| `scripts/exhibit-server.py` | HTTP state relay server (ThreadingHTTPServer, CORS) | **New** |
| `public/controller.html` | Pedestal tablet UI — "Ember Archive" design with search | **New** |
| `public/projector.html` | Big screen display — add exhibit remote mode | **Modify** |
| `scripts/exhibit-themes.json` | Configurable theme presets for the controller | **New** |
| `scripts/exhibit-start.sh` | Launch script for the exhibit | **New** |

---

## 1. State Server (`scripts/exhibit-server.py`)

### Technical fixes vs the basic version:

| Issue | Fix |
|-------|-----|
| No CORS → browser blocks cross-machine fetch | Added `Access-Control-Allow-Origin: *` + preflight handler |
| Single-threaded → request queuing | `ThreadingHTTPServer` so polling doesn't block POSTs |
| Server dies → black screen | systemd unit with auto-restart (documented, not scripted) |
| Config hardcoded | Loads `exhibit-themes.json` for curated presets |

### Endpoints:

| Route | Method | Body | Response |
|-------|--------|------|----------|
| `/state` | GET | — | Full state JSON: `{ filters, photoIds, currentIndex, speed, transition, captionMode, shuffle, faceTrack, playing, serverTime }` |
| `/state` | POST | Partial state | Updates server state, returns new full state |
| `/presets` | GET | — | Array of theme objects from `exhibit-themes.json` |
| `/manifest` | GET | — | The full manifest.json (so controller doesn't need direct access) |
| `/search?q=name` | GET | — | Search `people` field across manifest, return matching photos |
| `/health` | GET | — | `{ ok: true, uptime: seconds }` |

### Why `/manifest` and `/search` on the server?

The controller page loads from a different origin than wherever the manifest lives. Rather than deal with cross-origin manifest access (which would need CORS on the GitHub Pages CDN, which we don't control), the server proxies the manifest and provides a search endpoint. The controller just calls `/search?q=Lafferty` and gets results back as JSON.

### State shape:

```python
state = {
    "filters": {},           # { community: [...], people: [...], decade: [...], keyword: [...] }
    "photoIds": [],          # resolved photo IDs matching filters
    "currentIndex": 0,
    "speed": 5000,
    "transition": "kenburns",
    "captionMode": 0,
    "shuffle": False,
    "faceTrack": False,
    "playing": True,
    "serverTime": timestamp
}
```

The server loads `manifest.json` at startup and recomputes `photoIds` whenever filters change.

---

## 2. Controller Page (`public/controller.html`) — "Ember Archive" Design

### Visual concept

**Passerby experience (10-15 ft away):**
- The tablet glows against a dimly lit pedestal — warm amber-crimson light radiating upward
- Photos slowly cross-fade full-screen on the tablet itself
- A line of text in Cinzel at the bottom: *"THE RED RIVER MÉTIS SHOEBOX"* in crimson
- Subtle particle motes float like dust in archival light
- The search bar cycles family names when idle: `"FIND A NAME · Lafferty · Chartrand · Mercredi · Anderson···"`
- People walking past see faces changing, catch a glimpse of a century-old portrait, double back

**At the tablet (interaction range):**
- The idle photo montage dissolves into the interface on first touch
- Background: `#0a0a0a` with a radial crimson glow from the bottom center
- A beadwork divider pattern separates sections

### Layout (portrait tablet orientation — more natural on a pedestal)

The controller has one fixed layout with two zones. The top half is the **Now Showing** panel — always mirrors what's on the big screen. The bottom half holds the controls. The visitor never leaves this view; everything happens in place.

```
╔══════════════════════════╗
║  FIND A NAME ···         ║  ← Cinzel label, search input
║  ═══ beadwork ════       ║      cycling family names when idle
║                          ║
║  ┌─── Now Showing ─────┐ ║  ← always mirrors the big screen
║  │   [current photo]    │ ║     crossfades when screen advances
║  │                      │ ║
║  │ Marie Laliberte      │ ║     caption in Playfair
║  │ c.1890 · Lafferty    │ ║     year · people
║  │ "Only known photo of │ ║     full description
║  │  Marie Laliberte..." │ ║
║  │  [Listen]            │ ║     if oral history available
║  └──────────────────────┘ ║
║                          ║
║  ═══ beadwork ════       ║
║                          ║
║  Story Piles:            ║
║  ┌────┐ ┌────┐ ┌────┐  ║  ← 3 large photo stacks
║  │    │ │    │ │    │  ║     with tinted shadows
║  │ ❚  │ │ ❚  │ │ ❚  │  ║
║  └────┘ └────┘ └────┘  ║
║ Families  Land & Life   ║  ← Playfair Display italic
║            Ceremonies   ║
║                          ║
║  ═══ beadwork ════       ║
║                          ║
║  ← ⏸  5s  Ken  Captns → ║  ← glass-morphism playback bar
║                          ║
║  ● 142 photos  ● connected ║  ← status line
╚══════════════════════════╝
```

### How it works in practice:

1. **Visitor approaches** → attract mode shows full-screen crossfading photos. Cycling placeholder: "FIND A NAME · Lafferty · Chartrand · Mercredi · Anderson···"
2. **First touch** → interface appears. The "Now Showing" box starts showing the current big-screen photo with its caption, year, and people.
3. **Tap a Story Pile** → big screen switches to that theme. The Now Showing box updates to the first photo in that set.
4. **Big screen advances** → tablet's Now Showing box crossfades to the new photo's details automatically. The visitor can read the caption while watching the slide on the big screen.
5. **Tap the Now Showing photo** → optional detail overlay expands for the full description + audio player. Big screen keeps playing (doesn't jump).
6. **Type a name in search** → results appear as portrait thumbnails below the search bar, grouped by family. Tap a result → that person's photos become the active set on the big screen.
7. **Walk away** → after 60s, returns to attract mode.

### Features:

**Now Showing panel (always visible):**
- Shows the current photo from the big screen — thumbnail, title, year, community, people
- Full description/caption below (scrollable if long)
- Crossfades smoothly when the big screen advances to the next slide
- Powered by the server's `/state` endpoint — the display reports `currentIndex` and the server resolves the photo data
- Tap to expand into full detail view (larger photo + full description + audio)
- If the photo has an oral history recording, shows a "Listen" button

**Search ("FIND A NAME"):**
- Tap opens the tablet keyboard
- As you type, results appear as portrait thumbnails with names and eras
- Tap a result → that person's photos become the active set on the big screen
- If a name matches multiple people, shows them grouped by community
- Cycling placeholder names when idle (from the manifest's people data)
- Server endpoint: `/search?q=Lafferty`

**Idle state (attract mode):**
- Full-screen crossfading photos (all photos, shuffled)
- Cycling search placeholder: "FIND A NAME · Lafferty · Chartrand · ..."
- Any touch wakes into the full interface
- After 60s of no interaction, returns to attract mode
- The big screen keeps playing regardless of tablet state

**Story Piles (main navigation):**
- Three visual photo stacks — "Métis Families", "Land & Daily Life", "Celebrations & Ceremonies"
- Each stack has a different tinted shadow (warm gold, crimson, cool silver)
- Labels underneath in Playfair Display italic
- Contents defined in `exhibit-themes.json` (editable without touching code)
- Tap a pile → its filters apply instantly to the big screen, Now Showing updates
- The pile subtly fans open as feedback
- "Explore All" option below the piles — translucent, shows a scrollable grid of all photos

**Playback controls (glass-morphism bar):**
- Play/Pause, Speed (3/5/7/10/15s), Transition (Ken/Fade/Slide/Cut/Wipe)
- Captions toggle, Shuffle toggle, Face Track toggle
- Each change sends immediately to the server → display updates

**Connection indicator:**
- Top-right corner: pulsing green dot when connected, red when disconnected
- On disconnect: shows "Screen offline" message, continues cycling photos on the tablet itself

---

## 3. Display — Projector Exhibit Mode

### Changes to `public/projector.html`:

- **New URL parameter**: `?exhibit` enables remote mode
- **Polling loop**: fetches `/state` every 2 seconds with a 3-second timeout
- **On state change**: updates photo set (if `photoIds` changed), speed, transition, etc.
- **On disconnect** (3 failed polls): falls back to local slideshow of all photos, shows disconnected indicator
- **Hidden controls**: no control bar, no buttons, no progress bar
- **Status indicator**: tiny dot bottom-right — green pulsing = connected, red = disconnected, hidden = local fallback
- **Server address**: tries `window.location.hostname` + port 8081, fallback `localhost:8081`, override via `?server=IP:PORT`
- **Immersive mode always on**: since there are no controls, the photos are always full-bleed

### On first load:
1. Check for `?exhibit` param
2. If present, set `exhibitMode = true`
3. Try to reach the server
4. If server responds, start polling and hide UI
5. If no server, fall back to normal local mode with all photos

---

## 4. Theme Configuration (`scripts/exhibit-themes.json`)

Themes are defined as a JSON file so Bayard (or exhibit staff) can add/change them without editing code:

```json
{
  "themes": [
    {
      "id": "families",
      "title": "Métis Families",
      "subtitle": "Portraits and family groups",
      "filters": { "people": [] },
      "photoIds": [],
      "speed": 7000,
      "transition": "kenburns",
      "captionMode": 2
    },
    {
      "id": "fort-smith",
      "title": "Fort Smith",
      "subtitle": "Life in the north",
      "filters": { "community": ["Fort Smith"] },
      "speed": 5000,
      "transition": "fade"
    }
  ]
}
```

Each theme can specify any subset of state — filters, speed, transition, caption mode, and/or explicit `photoIds` for hand-curated selections (e.g. "Top 20 Highlights"). If `filters` is empty, it pulls all photos.

---

## 5. Hardware & Operations

### Suggested hardware:
| Component | Recommendation | Notes |
|-----------|---------------|-------|
| Big screen driver | Raspberry Pi 5 (4GB+) | Runs the server + display browser in kiosk mode |
| Pedestal tablet | Any 8-10" Android or iPad | Web browser in kiosk/guided access mode |
| Network | Dedicated WiFi (no internet required) | Or a wired ethernet drop for the Pi, tablet on WiFi |
| Tablet power | Hidden cable through pedestal | USB-C, vandal-resistant mount |
| Audio | 3.5mm jack on pedestal with over-ear headphones | For oral history playback |

### Kiosk lockdown:
- **Raspberry Pi**: `chromium-browser --kiosk --app=http://localhost:8080/projector.html?exhibit` via Openbox autostart
- **Android tablet**: Fully Kiosk Browser or similar — locks to one URL, hides navigation
- **iPad**: Guided Access mode or Kiosk Pro app

### Startup sequence:
1. Pi powers on → systemd starts `exhibit-server.py`
2. After server is ready, systemd starts Chromium in kiosk mode pointing at projector page
3. Projector page loads, connects to server, starts polling
4. Tablet boots → kiosk browser → loads controller page → finds server → ready

### Shutdown:
- Power off both devices
- The server has no persistent state — everything resets on next boot
- No data loss (all state is ephemeral)

### Failure recovery:
| Failure | Behavior |
|---------|----------|
| Server dies | systemd auto-restarts (3 attempts, 5s delay). Display detects missing server → falls back to local slideshow |
| Tablet dies | Display keeps showing the current photo set on loop. New tablet connects when it boots |
| Display dies | Controller still works, just shows "Screen offline". Server keeps state |
| Network drops | Display falls back to local slideshow. Tablet shows "Screen offline", keeps cycling photos locally |
| All power lost | On restore, everything auto-starts (systemd + kiosk browser auto-launch) |

---

## 6. Accessibility

| Feature | Implementation |
|---------|---------------|
| Screen reader | Semantic HTML, `aria-label` on all interactive elements, `role` attributes |
| Color contrast | Caption text is warm cream `#e8e2d6` on dark backgrounds — passes WCAG AA |
| Touch targets | Minimum 48x48px, ideally 64x64px for all interactive elements |
| Font size | Minimum 16px body text, no `user-scalable=no` on controller |
| Focus indicators | Visible focus ring on all interactive elements for keyboard navigation |

---

## 7. Phase 2 (Post-Launch)

| Feature | Why wait |
|---------|----------|
| WebSocket | Upgrading from HTTP polling to WebSocket for instant response. Not needed for v1 |
| QR pairing | Tablet scans a QR on the display to auto-configure server IP. Nice-to-have |
| Analytics dashboard | Logging which themes/photos are used most. Requires a lightweight DB or log file |
| Language toggle | English / French / Michif captions. Content translation is a separate project |
| Headphone audio for oral histories | Requires curated audio clips from the 4 existing recordings + mounting hardware |
| Proximity sensor wake | Motion sensor triggers the tablet out of sleep. Hardware-dependent |

---

## Implementation Order

| Step | What | Depends on |
|------|------|-----------|
| 1 | Write `exhibit-server.py` — ThreadingHTTPServer, CORS, /state /search /manifest /presets /health | — |
| 2 | Write `exhibit-themes.json` — define 3 starter themes | Bayard defines content |
| 3 | Modify `projector.html` — exhibit mode, polling, remote state application | Step 1 (to test) |
| 4 | Build `controller.html` — search, story piles, attract mode, playback controls | Steps 1-2 (to test) |
| 5 | Write `exhibit-start.sh` + systemd unit docs | Steps 1-4 |
| 6 | End-to-end test — controller → server → display on local machine | Steps 1-5 |
| 7 | Deploy and test on actual exhibit hardware | Step 6 |

**Estimated build time:** ~6-8 hours (server: 45m, display mods: 1h, controller UI: 3-4h, themes config: 15m, testing: 1-2h)

The subagent's estimate of 15-20 hours is inflated — the complex piece is the controller's visual design and search UX, not the server logic. The server is ~80 lines of Python with stdlib only.

---

## 8. Deferred / Next Session (2026-07-31)

Bayard explicitly deferred these. Do NOT pick them up without his say-so.

| Item | Status / context |
|------|------------------|
| **Audio story integration** | Deferred by Bayard ("not ready for it"). 4 m4a files EXIST at `public/assets/shoebox/audio/` (Mabel's Story.m4a, etc.). Listen buttons already in controller.html (lines 345, 385) but hardcoded hidden (line 602). Wiring = `<audio>` element + stories.json mapping. Separate consideration, revisit next session |
| SSE push upgrade | Conditional: only if lag persists after ThreadingHTTPServer + keep-alive + thumbnails are verified on the phone |
| Explore All grid | EXHIBIT_PLAN.md line 188 promises it. May be covered by the thumbnail gallery (shows full current set). Decide after gallery is built |
