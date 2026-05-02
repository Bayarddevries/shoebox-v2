# Shoebox v2 — Red River Métis Digital Archive

A Vite + React + TypeScript web app displaying historical archival photos with metadata, stories, and audio narration.

**Live site:** [https://bayarddevries.github.io/shoebox-v2/](https://bayarddevries.github.io/shoebox-v2/)

## Current Metadata Coverage

| Stat | Count |
|------|-------|
| Total photos | 302 |
| Geocoded (GPS or community lookup) | 195 |
| With people identified | 227 |
| With location string | 196 |

## Manifest Generator v2 Pipeline

`scripts/generate_manifest.js` is the **standard pipeline** for building `public/assets/shoebox/manifest.json`. It extracts structured IPTC/XMP metadata written by Adobe Lightroom:

1. **IPTC City / Sub-location / Province-State / Country** → full location string ("Community, Province, Canada")
2. **Province normalization** — 18 spelling variants → canonical full names
3. **City normalization** — fixes common typos (Winniepg → Winnipeg, etc.)
4. **GPS coordinates** — `exiftool -n` for signed decimals (fixes the Western Canada longitude sign bug)
5. **Geocode fallback** — if no GPS in EXIF, looks up coordinates from a 30+ community table
6. **People extraction** — separates person names from topical keywords using a curated stop-list
7. **Year from IPTC DateCreated** (more reliable than filename parsing)

> **`exiftool` must be installed** on the system running the manifest generator. It is used for all metadata extraction.

## Adding New Photos

1. Copy photos to `public/assets/shoebox/photos/`
2. Ensure Lightroom has written IPTC metadata (City, Province-State, Country, Keywords with people names)
3. Run: `node scripts/generate_manifest.js`
4. If a new community isn't in the geocode table, add it to `GEOCODE_TABLE` in the script
5. If new topical keywords appear as false-positive people names, add them to `TOPICAL_KEYWORDS`
6. Rebuild: `npm run build`
7. Commit and push both `public/assets/shoebox/manifest.json` and the `shoebox/` build output

## Deployment

The app deploys to **GitHub Pages** via [`peaceiris/actions-gh-pages`](https://github.com/peaceiris/actions-gh-pages), which pushes the `shoebox/` directory to the `gh-pages` branch.

### Base path

The site is served under `/shoebox-v2/`. The `base` option in `vite.config.ts` must match:

```ts
export default defineConfig({
  base: '/shoebox-v2/',
  // ...
})
```

### Fetch paths

All `fetch()` calls must use `import.meta.env.BASE_URL` instead of hardcoded absolute paths:

```ts
// ✅ Correct
fetch(`${import.meta.env.BASE_URL}assets/shoebox/manifest.json`)

// ❌ Wrong — 404s on GitHub Pages
fetch('/assets/shoebox/manifest.json')
```

### GitHub Pages build type

The GitHub Pages `build_type` is **`"legacy"`** — do NOT change to `"workflow"`. The project uses `peaceiris/actions-gh-pages`, which pushes directly to the `gh-pages` branch. The `"workflow"` build type only responds to `actions/deploy-pages` and silently ignores branch pushes, breaking deployments entirely.

> **Do not change the Pages build type to `"workflow"` unless you also switch the CI pipeline to use `actions/deploy-pages`.**

See [`docs/GITHUB_PAGES_FIX.md`](docs/GITHUB_PAGES_FIX.md) for the full incident report.

### Rebuilding after changes

```bash
npm run build
# Output goes to shoebox/ (not dist/) — commit this directory
git add shoebox/
git commit -m "Rebuild after changes"
git push
```
