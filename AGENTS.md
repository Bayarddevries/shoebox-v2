# AGENTS.md — Shoebox v2

Quick-reference for AI agents (and humans) working on this project.

## Project Overview

**Shoebox v2** is the **Red River Métis Digital Archive** — a Vite + React + TypeScript web app that displays 544 historical archival photos with metadata, stories, and audio narration. It deploys to GitHub Pages at:

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
| `public/assets/shoebox/photos/` | 540 archival photos — filenames have spaces (URL-encoded at runtime) |
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

The 544 photos in `public/assets/shoebox/photos/` have filenames with spaces (e.g., `"Old Photo 001.jpg"`). These are URL-encoded automatically by the browser and work fine. Do **not** rename them — the manifest references the original filenames.

### Photo IDs are STABLE (hash of filename) — never index-based

⚠️ **CRITICAL:** Photo IDs are `photo_<sha1(filename).slice(0,10)>` — derived from the FILENAME, NOT the array index. The old scheme (`photo_1` ... `photo_544`, assigned by scan/sort order) was **unstable**: adding photos renumbered everything, breaking submission, consent, and claim-link references.

- Adding/removing photos NEVER changes existing photo IDs (filenames unchanged).
- Renaming a file changes its ID → any submission/consent/contribution referencing it breaks.
- **Never** reintroduce index-based IDs in `scripts/generate_manifest.js` (`stablePhotoId()` is the only ID source).
- To update an image's metadata, replace the file content but KEEP the filename (ID stays stable, metadata refreshes).

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

## Situational feature reference

Projector slideshow internals, typography system, hero/MMF branding details, and the JS masonry archive grid live in **`docs/AGENTS-reference-features.md`**. Load it only when a session touches those features (projector.html, hero/branding CSS, ArchiveGrid.tsx).

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
