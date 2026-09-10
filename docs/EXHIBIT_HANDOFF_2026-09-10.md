# Métis Kin Exhibit — Session Handoff (2026-09-10 evening)

Bayard wrapped the session with three NEW pieces of feedback plus known open
items. Next agent: read this, then read the `metis-kin-exhibit` skill (it has
the full architecture, the rejected-design list, and the face-detection saga).

## Servers / links (as of handoff, all LIVE)

- State relay :8081 + static :8082 running (uptime ~19k s), healthy.
- Controller: `http://100.108.183.33:8082/controller.html` (tailnet)
- Big screen: `http://100.108.183.33:8082/projector.html?exhibit&server=100.108.183.33:8081`
- Repo: `~/shoebox-v2` — clean tree except `scripts/consent-register-import.csv`
  (touched by ANOTHER workflow — leave it out of commits) and
  `scripts/__pycache__/` (gitignore it or leave unstaged).
- Committed + pushed today: `c460adb` (exhibit fixes) + `72f87d3` (build sync).
  `public/` == `shoebox/` byte-identical for controller/projector/manifest/face_coords.

## NEW feedback from Bayard (tonight) — priority items

### 1. Screensaver STILL leaves a lot to be desired — explore other options
- Bayard reviewed the Scanning Table and is NOT satisfied: "still leaves a lot
  to be desired. We might need to explore other options."
- Context: direction A (Scanning Table) was his pick, but the execution is not
  museum-quality enough. He is now open to OTHER CONCEPTS, not just polish.
- Hard constraints that have NOT changed: photos keep ORIGINAL aspect ratio
  (crop = instant rejection), professional/calm/museum, must show the RANGE of
  the archive (many photos at once — single-photo carousel rejected as
  redundant with the big screen), no gimmick animation, must look good on a
  small tablet AND read as intentional.
- References: `metis-kin-exhibit` skill → "Screensaver" section (rejected
  designs list — DO NOT resurrect any), `references/screensaver-museum-review-2026-09-10.md`
  (5 concepts; A=Scanning Table was chosen, B=Portrait of a Family rejected
  for redundancy — but Bayard's mind is now open, so revisit B and the others
  with the dual-screen rationale in mind).
- Suggested approach: BEFORE building, run a fresh concept brainstorm with
  explicit museum-standard references (real kiosk/tablet attract screens),
  present 2-3 polished directions as static mockups, let Bayard pick, THEN
  build ONE. Do not iterate blindly on the table again.

### 2. Projector page — images are JUMPY, needs to be buttery smooth ✅ FIXED 2026-09-10 night
- ~~"images can appear jumpy on the projector page... it sometimes jumps quickly
  from one image to the next even without changing the speed. This needs to be
  bullet proof for display."~~
- Root causes found + fixed (commit `f8eb50d` + correction `87cd9b5`):
  1. **No crossfade at all** — incoming layer opacity forced to 1 instantly,
     outgoing zeroed instantly (hard cut every slide).
  2. **Ken Burns interrupted mid-zoom** — animation was `speedMs + 1500` while
     the advance timer fired at `speedMs`, cutting every zoom at ~77%.
  3. **Double-advance bug** — the self-scheduled timer pre-incremented
     `activePhotoIdx` and `nextSlide` incremented again (counter jumped
     2→4→6, skipping every other photo).
  4. **Zoom swing** — transform-origin used the face% even when faceTrack was
     off while background-position stayed center (origin now always matches
     bg-position: face% only when faceTrack, else center).
- Fix: each slide animation (`kenBurnsFade`/`fadeInOut`/`slideInOut`) lasts
  EXACTLY one advance interval with fade-in at 0-14% and fade-out at 86-100%;
  the next slide's fade-in overlaps the current fade-out = continuous
  crossfade. Single `scheduleAdvance()` helper (advance interval == animation
  duration).
- ⚠️ ARCHITECTURE (corrected after `f8eb50d` froze the show — commit `87cd9b5`):
  the PROJECTOR is the DRIVER of the slideshow. It auto-advances through the
  SERVER's photoIds order (same order as the controller's thumbnail gallery)
  and posts each new currentIndex to the state server (`reportIndex`), so the
  controller's active thumb + now-showing highlight the same photo. The
  controller has NO auto-advance — it only posts currentIndex on user taps
  (jumpTo / prev / next / swipe). Do NOT remove the projector's timer or
  reportIndex "to stop the fight" — that desyncs the screens.
- Verified live: projector advances (timer active), server index moves
  0→2→4, controller's 1.5s poll picks it up, woken gallery highlights
  activeIdx == server currentIndex with the matching photo. Remote taps still
  jump + restart the countdown for a full display cycle.
- ⚠️ BAYARD to confirm the feel on the real big screen/tablet (his acceptance:
  no visible jump at any speed). Speeds 3s/5s/7s/10s/15s all animate at the
  same cadence now.

### 3. Related-photos popup (click active image on controller) — pixelated, unclear
- When an image is active and you click it, a menu pops up showing RELATED
  photos. Bayard: "the photos are all pixelated and it is hard to tell how they
  are related."
- Fix: use higher-res thumbnails (or full images at small size) instead of the
  tiny thumbs; add a visible relationship label (shared people / community /
  year / keyword) so the connection is legible; check the popup's layout on the
  tablet (overlap, size, ordering).

## Known open items (carried over)

- **ufw firewall** — REQUIRED before showtime. Bayard must run
  `sudo ufw allow 8080,8081,8082/tcp` (no passwordless sudo; assistant cannot
  do it). See `docs/EXHIBIT_NETWORKING.md`.
- **UI layout review items** (from the Sep 10 controller pass, skill section
  "UI layout review"): record card has no photo; selected thumbnail blank; bottom
  bar cramped; theme tile "Métis Families" no bg image; strip edge-cutoff.
- **Docs**: `docs/EXHIBIT_NETWORKING.md` was rewritten for Pop_OS tonight —
  already committed? (verify git status). `scripts/fix-portproxy-and-start.bat`
  is obsolete WSL2 — safe to delete if Bayard approves.
- **Face data**: 349/544 have correct coords (fixed tonight). 195 no-face is
  EXPECTED (fall back to centered Ken Burns). If a photo visibly lacks a face
  anchor, re-run detection, do NOT hand-edit coords.

## What was completed today (2026-09-10) — for the record

- Screensaver rebuilt as "Scanning Table" (contain, no crop, tabletop surface,
  overlap, captions, 90s rotation, wordmark top-center w/ clip fix).
  COMMITTED. Bayard has now reviewed it and wants further exploration (item 1).
- Rubber-banding in gallery strip FIXED (never auto-scroll on state polls).
- detect_faces.py FIXED (3 bugs: OpenCV 5 input-size, float32 JSON, coordinate
  space) — old face_coords were OFF-FACE (visual proof: point on a child's hip
  vs new point on the woman's face). Re-ran: 349/544 in-range coords.
- manifest.json regenerated (544 photos, 349 with faces, generatedAt
  2026-09-10T18:25:31Z), 4 missing thumbs regenerated.
- Deploy sync: `npm run build` → shoebox/ rebuilt → pushed. public/ == shoebox/
  for the 4 critical files.
- Projector: exhibit-mode input gating + hidden progress bar + face-anchored
  Ken Burns + staged captions (from earlier today, all in c460adb).
