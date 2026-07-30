# Shoebox v2 — Red River Métis Digital Archive

A Vite + React + TypeScript web app + standalone projector slideshow displaying 376 historical archival photos with metadata, face detection, and audio narration.

**Live sites:**
- Main archive: https://bayarddevries.github.io/shoebox-v2/
- Projector slideshow: https://bayarddevries.github.io/shoebox-v2/projector.html
- Lite viewer: https://bayarddevries.github.io/shoebox-v2/shoebox-lite.html

## Metadata Coverage

| Stat | Count |
|------|-------|
| Total photos | 376 |
| With year derived | 376 |
| With city/location | 281 |
| With people identified | 306 |
| Geocoded (GPS or community lookup) | 280 |
| Face coordinates (faceX/faceY) | 370 |

## Projector Slideshow

A standalone HTML page (`public/projector.html`) for kiosk/event use — loads the same manifest.json and provides full-screen playback with controls.

**Features:**

- **Playback** — Play/Pause, Previous/Next, auto-advance timer
- **Speed** — 3s / 5s / 7s / 10s / 15s per slide
- **Transitions** — Ken Burns (face-aware zoom), Fade, Slide, Cut, Wipe
- **Captions** — Off / Title / Full (title + year + community + people)
- **Shuffle** — randomize slide order
- **Fullscreen** — native browser fullscreen
- **Face Tracking** — toggle to center photos on detected faces
- **Filters** — sidebar panel with Communities, Families/People, Decades, Keywords (AND between categories, OR within)
- **Presets** — save/load filter combinations + settings to localStorage
- **Immersive mode** — controls + progress bar auto-hide after 3s idle; re-show on touch/mouse move
- **Smart background sizing** — portrait fills height, landscape fills width (no head cropping)
- **Face-aware Ken Burns** — zoom direction pulls toward detected faces
- **Keyboard shortcuts** — Space, Arrows, C/F/G/S/T, 1-5, F2, Esc
- **Touch support** — tap left/right edges to navigate, center to toggle play

## Manifest Generator v2 Pipeline

`scripts/generate_manifest.js` builds `public/assets/shoebox/manifest.json` from Lightroom IPTC/XMP metadata + face detection:

1. **IPTC City / Sub-location / Province-State / Country** → full location string
2. **Province normalization** — 18+ spelling variants → canonical names
3. **City normalization** — fixes common typos
4. **GPS coordinates** — `exiftool -n` for signed decimals
5. **Geocode fallback** — 30+ community lookup table
6. **People extraction** — separates names from topical keywords via stop-list
7. **Year derivation** — priority: keyword year > title year > era midpoint > EXIF scan date
8. **Face detection** — auto-runs `detect_faces.py` (OpenCV Haar Cascade), merges faceX/faceY into manifest

> **`exiftool` must be installed** on the system running the manifest generator.

### Face Detection

`scripts/detect_faces.py` uses OpenCV's Haar Cascade classifier on each photo:
- Outputs normalized faceX/faceY coordinates (0-1 range)
- Processes the first detected face per photo (largest face wins)
- Falls back to center (0.5) if no face detected
- The projector page uses these coordinates for face-aware centering and Ken Burns zoom direction

## Adding New Photos

1. Export from Lightroom with IPTC metadata (City, Province-State, Country, Keywords)
2. Copy JPGs to `public/assets/shoebox/photos/`
3. Run: `node scripts/generate_manifest.js` (auto-runs face detection)
4. If a new community isn't in the geocode table, add it to `GEOCODE_TABLE`
5. If new topical keywords appear as false-positive people names, add to `TOPICAL_KEYWORDS`
6. Run: `npm run build` (rebuilds React app)
7. Manually copy projector.html to build output: `cp public/projector.html shoebox/projector.html`
8. Commit and push both `manifest.json`, `projector.html`, and the `shoebox/` build output

## Deployment

The app deploys to **GitHub Pages** via `peaceiris/actions-gh-pages`, pushing `shoebox/` to the `gh-pages` branch.

### Base path

The site is served under `/shoebox-v2/`. The `base` option in `vite.config.ts` must match:

```ts
export default defineConfig({
  base: '/shoebox-v2/',
})
```

### Fetch paths

All `fetch()` calls must use `import.meta.env.BASE_URL`:

```ts
// ✅ Correct
fetch(`${import.meta.env.BASE_URL}assets/shoebox/manifest.json`)

// ❌ Wrong — 404s on GitHub Pages
fetch('/assets/shoebox/manifest.json')
```

### GitHub Pages build type

**`"legacy"`** — do NOT change to `"workflow"`. The project uses `peaceiris/actions-gh-pages`, which pushes directly to the `gh-pages` branch. `"workflow"` silently ignores branch pushes.

### Projector page deployment

The projector page is a standalone HTML file (not part of the Vite build). After editing:
```bash
cp public/projector.html shoebox/projector.html
git add shoebox/projector.html
git commit -m "update projector"
git push
```

### Rebuilding after changes

```bash
npm run build
cp public/projector.html shoebox/projector.html
git add shoebox/
git commit -m "Rebuild"
git push
```
