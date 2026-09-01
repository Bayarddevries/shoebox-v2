# AGENTS.md — Shoebox v2

Quick-reference for AI agents (and humans) working on this project.

## Project Overview

**Shoebox v2** is the **Red River Métis Digital Archive** — a Vite + React + TypeScript web app that displays 450 historical archival photos with metadata, stories, and audio narration. It deploys to GitHub Pages at:

> https://bayarddevries.github.io/shoebox-v2/

**Local dev server:** http://100.108.183.33:8080/shoebox-v2/index.html (via RRMNHC website server, port 8080)

## Key Paths

| Path | Purpose |
|------|---------|
| `vite.config.ts` | Vite configuration — **`base` must be `/shoebox-v2/`** |
| `src/App.tsx` | Main app component — all `fetch()` calls live here |
| `src/components/ArchiveGrid.tsx` | Photo grid component |
| `src/components/HeroCarousel.tsx` | Ken Burns carousel (pre-1950 photos) |
| `src/components/Navbar.tsx` | Top nav with MMF logo |
| `src/index.css` | All styles including hero split layout |
| `public/assets/shoebox/manifest.json` | Photo manifest (generated, do not edit by hand) |
| `public/assets/shoebox/stories.json` | Story metadata |
| `public/assets/shoebox/photos/` | 450 archival photos — filenames have spaces (URL-encoded at runtime) |
| `public/assets/mmf_logo_rrm.png` | MMF RRM logo for navbar and hero |
| `public/projector.html` | Standalone projector slideshow (kiosk/event mode) — NOT built by Vite |
| `scripts/generate_manifest.js` | Node script that generates `manifest.json` with relative `src` paths |
| `scripts/detect_faces.py` | OpenCV Haar Cascade face detection, outputs faceX/faceY |
| `.github/workflows/deploy.yml` | CI — uses `peaceiris/actions-gh-pages@v4` |

## Build

```bash
npm run build
```

- Output goes to **`shoebox/`** (not `dist/` — the outDir is overridden in `vite.config.ts`).
- **Build artifacts in `shoebox/` ARE committed to the repo.** Only `dist/` is gitignored.
- After changing the `base` path or any asset, rebuild and commit the `shoebox/` directory.

## Local Dev Server (RRMNHC Website)

Shoebox is served alongside the RRMNHC website via a symlink:

```bash
# Symlink: RRMNHC website root → Shoebox build output
ln -s /home/bayarddevries/shoebox-v2/shoebox /home/bayarddevries/rrmnhc-website/shoebox-v2
```

The RRMNHC website server runs on port 8080:
```bash
cd /home/bayarddevries/rrmnhc-website && python3 -m http.server 8080
```

**⚠️ IMPORTANT:** The symlink must point to `shoebox-v2/shoebox/` (the build output), NOT `shoebox-v2/` (the source directory). Pointing to the source directory will serve broken/incomplete files.

## Deploy

- **CI workflow** (`.github/workflows/deploy.yml`) uses `peaceiris/actions-gh-pages@v4` to push the `shoebox/` directory to the `gh-pages` branch.
- GitHub Pages serves from that branch.
- Live URL: https://bayarddevries.github.io/shoebox-v2/

## Projector Slideshow

A standalone HTML page (`public/projector.html`) for kiosk/event full-screen slideshow. Deployed at:
> https://bayarddevries.github.io/shoebox-v2/projector.html

### Architecture

One self-contained HTML file — no build step, no dependencies. Loads `manifest.json` at runtime via `fetch()`. Deployed by copying to `shoebox/projector.html` (the build output directory).

### Control bar sections (labeled)

| Section | Buttons |
|---------|---------|
| **Playback** | ⏸ pause/play, ◀ prev, ▶ next |
| **Speed** | 3s, 5s, 7s, 10s, 15s — sets auto-advance interval |
| **Transition** | Ken (Ken Burns), Fade, Slide, Cut, Wipe |
| **Display** | Captions (toggle: Off/Title/Full), Shuffle, Face (face-aware centering), Fullscreen |
| **Filter** | Tags (opens filter panel), photo counter |

### Immersive mode

After 3s of mouse/touch inactivity, `body` gets class `.immersed` which hides controls + progress bar via CSS (`opacity: 0; pointer-events: none`). Captions stay visible during immersive mode. Any mouse move or touch restores the UI and resets the 3s timer.

### Smart background sizing

In `applyImageToLayer()`, each photo gets a `background-size` based on its aspect ratio vs the viewport using manifest `width`/`height`:
- **Portrait** (imgAspect < screenAspect) → `auto 100%` (full height, sides cropped)
- **Landscape** → `100% auto` (full width, top/bottom cropped)
- **No dimensions** → falls back to `cover`

### Face-aware features

- **Face Track toggle** — when ON, `background-position` uses `photo.faceX`/`photo.faceY` (0-1 normalized). Default OFF (center-crop).
- **Face-aware Ken Burns** — `getKenBurns(idx, faceX, faceY)` computes translate direction toward the face. Half zoom-in, half zoom-out for variety. Falls back to gentle random pan when no face data.

### Filter panel

- Slide-out from left (`#filterPanel` with `.open` class)
- Content scrolls in `div.filter-scroll`, action buttons pinned in `div.filter-actions-sticky` at bottom
- Categories: Communities, Families/People, Decades, Keywords
- AND logic between categories, OR within
- Keywords searchable via text input (`filterKeywordChecks`)
- Presets saved to localStorage (`shoebox_presets` key)

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| Space | Toggle play/pause |
| ← / → | Prev / Next slide |
| C | Cycle captions (Off → Title → Full) |
| F | Toggle fullscreen |
| G | Toggle face tracking |
| S | Toggle shuffle |
| T | Cycle transitions |
| 1-5 | Set speed (3/5/7/10/15s) |
| F2 | Toggle filter panel |
| Esc | Close filter panel |

### Touch

Tap left 25% → prev, right 25% → next, center → toggle play. Passive listener (doesn't block scroll).

### Common pitfalls

- **`let` redeclarations**: All state variables are declared at the top of the `<script>` block. Do NOT re-declare `captionMode`, `shuffle`, or `transition` with `let` elsewhere in the file — it throws a SyntaxError.
- **Arrow function bodies**: Multi-statement arrow functions must use `{ }` (e.g., `setTimeout(() => { nextSlide(); updateTimerIdx(); }, speedMs)`).
- **Deployment**: `projector.html` is NOT part of the Vite build. After editing, must be manually copied: `cp public/projector.html shoebox/projector.html`. Then commit both files.
- **CDN cache**: GitHub Pages CDN takes 1-3 minutes to propagate. Use `?_cb=<timestamp>` for cache-busting during testing.

## ⚠ Critical Rules

### GitHub Pages `build_type` is `"legacy"` — do NOT change to `"workflow"`

The repo uses `peaceiris/actions-gh-pages`, which pushes directly to the `gh-pages` branch. The `"workflow"` build type only responds to `actions/deploy-pages` API calls and **silently ignores** branch pushes. If someone switches to `"workflow"`, deployments will stop working entirely. See [`docs/GITHUB_PAGES_FIX.md`](docs/GITHUB_Pages_FIX.md) for the full incident report.

### All `fetch()` paths must use `import.meta.env.BASE_URL`

```ts
// ✅ Correct — works locally and on GitHub Pages
fetch(`${import.meta.env.BASE_URL}assets/shoebox/manifest.json`)

// ❌ Wrong — breaks on GitHub Pages (subpath mismatch)
fetch('/assets/shoebox/manifest.json')
```

`import.meta.env.BASE_URL` is injected by Vite at build time and resolves to the configured `base` (e.g., `/shoebox-v2/`).

### Photo filenames contain spaces

The 450 photos in `public/assets/shoebox/photos/` have filenames with spaces (e.g., `"Old Photo 001.jpg"`). These are URL-encoded automatically by the browser and work fine. Do **not** rename them — the manifest references the original filenames.

### Manifest is generated

`public/assets/shoebox/manifest.json` is built by `scripts/generate_manifest.js`. All `src` paths in the manifest are **relative** (e.g., `assets/shoebox/photos/Old Photo 001.jpg`). To regenerate:

```bash
node scripts/generate_manifest.js [SOURCE_DIR] [OUTPUT_FILE]
# Defaults: ./public/assets/shoebox/photos → ./public/assets/shoebox/manifest.json
```

### Manifest Generator v3 Pipeline

The manifest generator is the **standard pipeline** for when new images are added. It reads structured IPTC/XMP metadata written by Adobe Lightroom with **one bulk exiftool pass** over the whole directory (group-qualified tags, cached by filename — not one spawn per file):

**Extraction steps:**
1. **IPTC City / Sub-location / Province-State / Country** → builds full location string ("Community, Province, Canada")
2. **Province normalization** — 18 spelling variants (MB, Mb, Saskachewan, etc.) → canonical full names
3. **City normalization** — fixes typos (Winniepg → Winnipeg, etc.)
4. **GPS coordinates** — uses `exiftool -n` for signed decimals (fixes the old bug where Western Canada longitudes were positive → Siberia)
5. **Geocode fallback** — if no GPS in EXIF, looks up coordinates from a 30+ community table (Duck Bay, St. Eustache, Selkirk, etc.)
6. **People extraction** — separates person names from topical keywords using a curated stop-list
7. **Year derivation** — derives the *historical* photo date from keywords and title, falling back to the EXIF scan date. See "Year Derivation System" below.
8. **Submitter** — parsed from IPTC Copyright "© Submitted by <Name>" (the intake attribution workflow)

**Lightroom field coverage (v3) — every field is captured, nothing dropped:**

| Manifest field | Lightroom / exif source | Notes |
|---|---|---|
| `title` | IPTC ObjectName / XMP-dc:Title | falls back to filename |
| `caption` | IPTC Caption-Abstract / XMP-dc:Description | |
| `keywords` | IPTC Keywords / XMP-dc:Subject | split people vs topical |
| `people` | person-name keywords | |
| `location` / `community` / `province` / `sublocation` / `countryCode` | IPTC City / Sub-location / Province-State / Country / CountryCode | |
| `year` / `scanYear` / `photoYearSource` | derived + IPTC DateCreated / DateTimeOriginal | |
| `lat` / `lng` | EXIF GPS (+ geocode fallback) | |
| `rating` | XMP-xmp:Rating | Lightroom star rating |
| `label` | XMP-xmp:Label | Lightroom color label |
| `creator` | XMP-dc:Creator / IPTC By-line / Artist | photographer |
| `credit` | XMP-photoshop:Credit / IPTC Credit | |
| `source` | XMP-photoshop:Source / IPTC Source | |
| `headline` | XMP-photoshop:Headline / IPTC Headline | |
| `instructions` | XMP-photoshop:Instructions / IPTC Instructions | |
| `scannerMake` / `scannerModel` | EXIF Make / Model | EPSON Perfection V800 etc. |
| `scannerSerial` | EXIF SerialNumber / XMP-aux:SerialNumber | |
| `software` | EXIF Software / XMP-tiff:Software | Adobe Lightroom version |
| `metadata.dateCreated` / `timeCreated` / `dateTimeOriginal` / `createDate` / `copyright` / `rights` / `gpsLatitude` / `gpsLongitude` | raw, group-qualified | full preservation |

**exiftool resolution:** generator + ingest preflight try `$EXIFTOOL` env, then `exiftool-bin`, then `exiftool`. On this machine `~/bin/exiftool` is a directory (the real binary is `~/bin/exiftool-bin`) — the code resolves it automatically.

**When adding new photos:**
1. Copy photos to `public/assets/shoebox/photos/`
2. Ensure Lightroom has written IPTC metadata (City, Province-State, Country, Keywords with people names)
3. Run: `node scripts/generate_manifest.js`
4. If the new community isn't in the geocode table, add it to `GEOCODE_TABLE` in the script
5. If new topical keywords appear as false-positive people names, add them to `TOPICAL_KEYWORDS`
6. Rebuild: `npm run build`
7. Commit and push both `public/assets/shoebox/manifest.json` and the `shoebox/` build output

## Year Derivation System

**Problem:** The manifest's `year` field was originally populated from EXIF `DateCreated`/`DateTimeOriginal`, which records when the *digital file* was created (scan/digitization date). For historical photos, this gives 2024–2026 instead of the actual photo date (e.g. 1925).

**Solution:** The `derivePhotoYear()` function in `scripts/generate_manifest.js` now uses a priority chain:

| Priority | Source | Example | Output |
|----------|--------|---------|--------|
| 1 | Specific year keyword | `"1925"`, `"1948"` | `1925` (exact) |
| 2 | Year in photo title | `"Sister Darie (1910)"` | `1910` (exact) |
| 3 | Era range keyword → midpoint | `"1925-1950"` → `1938` | `1938` (approximate) |
| 4 | EXIF scan date (fallback) | `DateCreated: 2024` | `2024` (labelled "scanned") |

### Manifest fields

- **`year`** — the derived historical photo date (what the frontend displays and filters by)
- **`scanYear`** — the raw EXIF scan/digitization date (for reference only)
- **`photoYearSource`** — one of: `keyword-specific`, `title`, `keyword-era`, `scan-date`, `unknown`

### Frontend display conventions

- Exact years (from keywords or title) display as: `📅 1925`
- Approximate years (era midpoint) display as: `📅 ≈1938`
- Scan-date fallbacks display as: `📅 2024 (scanned)`

This logic lives in `formatYearBadge()` in `src/components/PhotoDetail.tsx`.

### Current distribution (450 photos)

- **154** from keyword-specific years (1890–2015)
- **27** from title-parsed years (1892–2019)
- **87** from era-range midpoints (1913–1988)
- **182** fallback to scan date (2007–2026)

### When adding new photos

If adding historical photos, make sure their **keywords include a specific year** (e.g. `1960`) or an **era range** (e.g. `1950-1975`) so the manifest generator picks up the real photo date. The era ranges recognized are the 25-year buckets used in Lightroom: `1900-1925`, `1925-1950`, `1950-1975`, `1975-2000`, `2000-2025`.

## Typography System

The hero and page headers use an editorial typographic hierarchy:

- **Kicker** — `Cinzel`, all-caps, small, above headline (e.g. "DIGITAL PHOTO ARCHIVE")
- **Hed (Headline)** — `EB Garamond`, 700 weight, serif (e.g. "Red River Métis Shoebox")
- **Deck** — `Inter`, sans-serif, summary paragraph below headline

This matches professional editorial design (newspaper/magazine) where kicker → hed → deck form a visual stack.

## Hero Section & MMF Branding (2026-05-19/20)

### Split Hero Layout
The hero section uses a two-column split layout on desktop:
- **Left column (35%):** MMF RRM logo (`assets/mmf_logo_rrm.png`), right-aligned, `max-height: 320px`
- **Right column (65%):** Kicker → Hed → Deck → CTA button, left-aligned
- **Gap:** 4rem between columns
- **Max-width:** 1200px, centered

### Mobile Behavior
- Hero section is `100vh` (full screen) on mobile (`< 768px`)
- Logo scales dynamically at `max-height: 25vh`
- Content stacks vertically: logo on top, text below
- Text is center-aligned on mobile
- Text-side uses symmetric horizontal padding (`padding: 0 1.5rem`)

### CSS Classes
- `.hero-section` — `width: 100%`, `height: 60vh` (desktop) / `100vh` (mobile), `overflow: hidden`
- `.hero-content-split` — flex container for the two-column layout
- `.hero-logo-side` — `flex: 0 0 35%`, `justify-content: flex-end`, no background (transparent)
- `.hero-text-side` — `flex: 1 1 65%`, flex column, `padding: 0 2.5rem 0 1.5rem` (desktop), no gradient background
- `.hero-mmf-logo` — `max-height: 320px` (desktop) / `25vh` (mobile), `filter: drop-shadow(...)` for readability against carousel

### Text Readability
- Title text uses text-shadows exclusively (no dark gradient bar behind text):
  ```
  text-shadow:
    0 1px 4px rgba(0, 0, 0, 0.9),
    0 4px 16px rgba(0, 0, 0, 0.6),
    0 12px 40px rgba(0, 0, 0, 0.4);
  ```
- Global dark overlay on carousel image provides baseline contrast
- MMF logo uses `drop-shadow` filter for pop against carousel photos

### Color Palette
- Primary: `--color-crimson: #8b0000` (dark crimson, NOT MMF bright red `#cf152d`)
- MMF logo is layered in as an image asset; the color palette remains the original crimson
- Background: `--color-parchment: #fdfcf9`

### Key Implementation Notes
- The hero section uses a React fragment (`<>...</>`) to wrap both the `hero-section` div and the stats section as siblings
- The `HeroCarousel` component renders absolutely positioned Ken Burns layers with `inset: -5%`
- The `hero-overlay` is a self-closing div (sibling of carousel and content, NOT a parent)
- The stats section lives OUTSIDE `hero-section` (was previously nested inside, causing layout bugs)
- A stray `<div className="relative">` wrapper was removed from App.tsx — it was constraining the carousel width
- **No dark gradient bar behind text:** The `.hero-text-side` previously had a `background: linear-gradient(to right, ...)` that created a semi-transparent black panel behind the title. Removed 2026-05-20 — text-shadows + global overlay provide sufficient contrast.

## Archive Grid — JS Masonry Layout (2026-05-20)

**Replaced CSS `columns` with JS shortest-column masonry** to fix the "column 4 shows newer photos" problem.

### The Problem

CSS `columns` uses column-major fill (top-to-bottom, left-to-right). With chronological sort, this puts the newest 25% of photos at the top of column 4. No amount of array reordering can fix this — it's hardcoded in the CSS spec.

### The Solution

**ArchiveGrid.tsx** now uses a custom JS masonry algorithm:

1. **Measure container width** via `ResizeObserver` → derive column count (2/3/4 based on breakpoints matching old CSS)
2. **Shortest-column placement** — for each chronologically sorted photo, find the column with the least total height and place it there. This naturally distributes oldest photos across all columns
3. **Height estimation from metadata** — photos have `width`/`height` in the manifest, so card height is estimated as `colWidth / aspectRatio + contentEstimate` before render
4. **Absolute positioning** — each tile is `position: absolute` with computed `top`/`left`/`width`/`height`

### Why this fixes it

With 450 photos and 4 columns, the first 4 photos (oldest) go to columns 1-4 since they all start at height 0. Every column starts with an old photo. As items fill in, the algorithm keeps columns balanced — all columns progress through time at roughly the same rate.

### Key files

| File | Purpose |
|------|---------|
| `src/components/ArchiveGrid.tsx` | JS masonry component — `computeMasonry()`, `estimateCardHeight()`, shortest-column algorithm |
| `src/index.css` | `.archive-grid-container`, `.archive-grid-inner` (no more `columns` or `break-inside`) |

### What didn't work (history)

- ❌ **CSS columns + chronological sort** — column-major fill puts newest photos in col 4
- ❌ **CSS columns + chunk reorder** — clever array reordering still can't overcome column-major fill with masonry heights
- ❌ **CSS Grid** — gives row-major but no masonry (wasted space)
- ✅ **JS masonry with shortest-column** — correct era distribution + masonry packing

## Engineering Discipline (from Karpathy's CLAUDE.md)

Bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that *your* changes made unused.
- Don't remove pre-existing dead code unless asked.

**Test:** Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

