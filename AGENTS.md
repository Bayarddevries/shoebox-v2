# AGENTS.md — Shoebox v2

Quick-reference for AI agents (and humans) working on this project.

## Project Overview

**Shoebox v2** is the **Red River Métis Digital Archive** — a Vite + React + TypeScript web app that displays 302 historical archival photos with metadata, stories, and audio narration. It deploys to GitHub Pages at:

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
| `public/assets/shoebox/photos/` | 302 archival photos — filenames have spaces (URL-encoded at runtime, works fine) |
| `public/assets/mmf_logo_rrm.png` | MMF RRM logo for navbar and hero |
| `scripts/generate_manifest.js` | Node script that generates `manifest.json` with relative `src` paths |
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

The 302 photos in `public/assets/shoebox/photos/` have filenames with spaces (e.g., `"Old Photo 001.jpg"`). These are URL-encoded automatically by the browser and work fine. Do **not** rename them — the manifest references the original filenames.

### Manifest is generated

`public/assets/shoebox/manifest.json` is built by `scripts/generate_manifest.js`. All `src` paths in the manifest are **relative** (e.g., `assets/shoebox/photos/Old Photo 001.jpg`). To regenerate:

```bash
node scripts/generate_manifest.js [SOURCE_DIR] [OUTPUT_FILE]
# Defaults: ./public/assets/shoebox/photos → ./public/assets/shoebox/manifest.json
```

### Manifest Generator v2 Pipeline

The manifest generator is the **standard pipeline** for when new images are added. It reads structured IPTC/XMP metadata written by Adobe Lightroom:

**Extraction steps:**
1. **IPTC City / Sub-location / Province-State / Country** → builds full location string ("Community, Province, Canada")
2. **Province normalization** — 18 spelling variants (MB, Mb, Saskachewan, etc.) → canonical full names
3. **City normalization** — fixes typos (Winniepg → Winnipeg, etc.)
4. **GPS coordinates** — uses `exiftool -n` for signed decimals (fixes the old bug where Western Canada longitudes were positive → Siberia)
5. **Geocode fallback** — if no GPS in EXIF, looks up coordinates from a 30+ community table (Duck Bay, St. Eustache, Selkirk, etc.)
6. **People extraction** — separates person names from topical keywords using a curated stop-list
7. **Year derivation** — derives the *historical* photo date from keywords and title, falling back to the EXIF scan date. See "Year Derivation System" below.

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

### Current distribution (302 photos)

- **89** from keyword-specific years (1890–1993)
- **18** from title-parsed years (1910–2019)
- **84** from era-range midpoints (1913–1988)
- **111** fallback to scan date (2007–2026)

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
