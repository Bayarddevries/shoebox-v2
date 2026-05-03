# AGENTS.md — Shoebox v2

Quick-reference for AI agents (and humans) working on this project.

## Project Overview

**Shoebox v2** is the **Red River Métis Digital Archive** — a Vite + React + TypeScript web app that displays 302 historical archival photos with metadata, stories, and audio narration. It deploys to GitHub Pages at:

> https://bayarddevries.github.io/shoebox-v2/

## Key Paths

| Path | Purpose |
|------|---------|
| `vite.config.ts` | Vite configuration — **`base` must be `/shoebox-v2/`** |
| `src/App.tsx` | Main app component — all `fetch()` calls live here |
| `src/components/ArchiveGrid.tsx` | Photo grid component |
| `public/assets/shoebox/manifest.json` | Photo manifest (generated, do not edit by hand) |
| `public/assets/shoebox/stories.json` | Story metadata |
| `public/assets/shoebox/photos/` | 302 archival photos — filenames have spaces (URL-encoded at runtime, works fine) |
| `scripts/generate_manifest.js` | Node script that generates `manifest.json` with relative `src` paths |
| `.github/workflows/deploy.yml` | CI — uses `peaceiris/actions-gh-pages@v4` |

## Build

```bash
npm run build
```

- Output goes to **`shoebox/`** (not `dist/` — the outDir is overridden in `vite.config.ts`).
- **Build artifacts in `shoebox/` ARE committed to the repo.** Only `dist/` is gitignored.
- After changing the `base` path or any asset, rebuild and commit the `shoebox/` directory.

## Deploy

- **CI workflow** (`.github/workflows/deploy.yml`) uses `peaceiris/actions-gh-pages@v4` to push the `shoebox/` directory to the `gh-pages` branch.
- GitHub Pages serves from that branch.
- Live URL: https://bayarddevries.github.io/shoebox-v2/

## ⚠ Critical Rules

### GitHub Pages `build_type` is `"legacy"` — do NOT change to `"workflow"`

The repo uses `peaceiris/actions-gh-pages`, which pushes directly to the `gh-pages` branch. The `"workflow"` build type only responds to `actions/deploy-pages` API calls and **silently ignores** branch pushes. If someone switches to `"workflow"`, deployments will stop working entirely. See [`docs/GITHUB_PAGES_FIX.md`](docs/GITHUB_PAGES_FIX.md) for the full incident report.

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
- **Hed (Headline)** — `Playfair Display`, 700 weight, serif (e.g. "Red River Métis Shoebox")
- **Deck** — `Inter`, sans-serif, summary paragraph below headline

This matches professional editorial design (newspaper/magazine) where kicker → hed → deck form a visual stack.
