# Attract screen exploration — findings (2026-09-11)

**Outcome: no replacement concept beat the existing collage attract screen.** Five concepts were
built and six adversarial critics run against them. The verdict from the client was that none felt
better than what shipped. This file records what was tried and what is worth keeping, so the effort
is not repeated.

## Why every replacement lost

The existing attract screen (Scanning Table collage, `enterAttract` / `#attractCollage` in
`controller.html`) shows ~21 uncropped prints at once, rotates them, and costs almost nothing. Every
replacement traded that asset away:

- **The Wall** — justified rows of 25 prints. Clean alignment, but at 1280x800 each print is ~130px,
  so it reads as wallpaper texture rather than photographs.
- **The Timeline** — photographs hung on a real year axis from metadata. Conceptually the most
  interesting, visually the least resolved; labels collided and the axis did not carry the design.
- **The Light Table** — prints on dark glass lit from beneath, one hero print. Promising, but sepia
  scans on near-black need an object edge or they vanish, and the composition needed a geometry
  rebuild.
- **The Names Roll** — every named person in the archive scrolling past in type. Beautiful data
  (387 names, 204 families) but the client did not love the idea and it is undeniably a wall of type
  rather than a lure.
- **The Shoebox Ajar** — a wooden box, type and light only, that creaks open on its own. The
  mechanics all worked (hinge foreshortens correctly, light spill, photograph rising, creak synced to
  the movement, hand-over bloom into the controller palette), but the box itself read as flat brown
  rectangles. Materiality is what CSS geometry is bad at, and gradients read as vector shapes.

## The one-line lesson

Faces pull people across a room; concepts do not. Any attract screen for this archive should lead
with many faces, large enough to read, and keep everything else quiet.

## Worth keeping, regardless of what the attract screen ends up being

1. **Consent gate.** No photograph should appear at the exhibit entrance without the family's
   permission. The repo already tracks submission/consent. The attract pool should be filtered on an
   explicit display-consent flag, and which photographs represent 544 should be a community decision,
   not a designer's.
2. **Rotate across all eras.** Showing only pre-1950 tells Métis visitors the archive is a dead past.
   It spans 1890 to 2015 and the families are living.
3. **A persistent permission cue.** Older visitors will not touch a machine that appears to be
   performing on its own. An always-visible line such as "Touch a light to look inside" (plus a
   physical label on the pedestal) costs nothing and is the single cheapest improvement to the
   existing attract screen.
4. **Hand over through motion, not a cut.** On touch, expand the light and crossfade the interface in
   at peak, so the visitor's touch amplifies what is already happening. Never make them wait for
   something to finish first.
5. **The box as a cold open, not a screensaver.** If the box is used at all, use it once: a three
   second opening that resolves INTO the existing collage. Administered once per exhibit session it
   is a threshold moment; on a loop it is a gimmick that seals shut in front of a visitor.
6. **Sound rules.** A creak is fine on the opening only, never on a loop, always accompanied by the
   light moving. The close should be silent: a sub-150Hz thud is inaudible or distorting on a tablet
   speaker. CC0 sources only, never personal-use libraries (BBC RemArc is not licensed for a public
   exhibit). Four CC0 candidates are on disk in `sound-candidates/`.
   The archive already contains oral history recordings (`public/assets/shoebox/audio/`). A real
   family voice is a stronger lure than foley and needs no new licence.
7. **The box needs materiality.** If a box is ever built, it should not be CSS geometry. Use a real
   photograph of an actual shoebox as the object.

## Real bugs found in the existing controller, worth fixing either way

- `collageRefresh`'s 800ms setTimeout is unguarded: a touch inside that window repaints the collage
  over the freshly woken interface.
- The relay-down watchdog reloads the page every ~12-17s when the state relay is unreachable, because
  `fetchState` only updates `lastStateTime` on success. A relay outage is not a wedged page; the 1.5s
  poll already retries in place.
- The click-suppression window is a fixed 500ms and is consumed by a single click, so a fast second
  tap after a longer hand-over animation lands on a live control.
- No `prefers-reduced-motion` path, and no autoplay/gesture handling for kiosk audio.

## Dead ends, do not rebuild

Static grid tiles, per-tile borders or shadows, per-print animation loops, particles, drifting photo
strips, uniform-cell cover-cropped mosaics, type-only attract screens, a permanently lit seam
standing in for a box.