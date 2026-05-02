# Shoebox v2 — Incident Report: Deployment & Metadata Bugs

**Date:** 2026-05-02  
**Scope:** Four independent bugs discovered and fixed during initial deployment and data-quality review of the Red River Métis Digital Archive.

---

## Commit Timeline

| Hash | Time | Description |
|------|------|-------------|
| `56c751a` | 11:25 | Fix base path for GitHub Pages |
| `412a2de` | 12:41 | Add deployment docs and incident report |
| `2229c7b` | 14:01 | Rewrite manifest generator v2: IPTC location, GPS sign fix, people extraction |
| `3a714e2` | 14:14 | Update AGENTS.md with manifest generator v2 pipeline documentation |

---

## Bug 1 — GitHub Pages 404s (base path + build_type)

### Symptoms

After deploying to GitHub Pages, the site was completely broken:

- **All 302 photos returned 404** — every `img` URL pointed to `/assets/...` instead of `/shoebox-v2/assets/...`.
- **`manifest.json` 404'd** — `fetch('/assets/shoebox/manifest.json')` resolved to the domain root, not the Pages subpath.
- **Stories and audio paths similarly broken** — any `fetch()` to an absolute `/assets/` path failed.
- **GitHub Pages never redeployed** — pushes to `gh-pages` were silently ignored.

### Root Causes

Three independent issues combined:

1. **`base: '/'` in `vite.config.ts`** — Vite uses `base` to prefix all asset URLs. GitHub Pages serves this repo at `/shoebox-v2/`, not the domain root. With `base: '/'`, every generated `<script>`, `<link>`, and `img` URL was wrong.

2. **Hardcoded absolute fetch paths in `src/App.tsx`** — The app used `fetch('/assets/shoebox/manifest.json')` etc., bypassing Vite's URL rewriting entirely. Even with a correct `base`, these hand-written paths would still be wrong.

3. **GitHub Pages `build_type: "workflow"` mismatch** — The Pages setting was configured for the `actions/deploy-pages` API signal, but the project uses `peaceiris/actions-gh-pages@v4`, which pushes directly to the `gh-pages` branch. The "workflow" build type ignores branch pushes entirely, so every deployment was silently dropped.

### Fix

- **`vite.config.ts`**: `base: '/'` → `base: '/shoebox-v2/'`
- **`src/App.tsx`**: All `fetch()` calls changed to use `import.meta.env.BASE_URL`:
  ```ts
  // Before (broken)
  fetch('/assets/shoebox/manifest.json')
  // After (works locally and on Pages)
  fetch(`${import.meta.env.BASE_URL}assets/shoebox/manifest.json`)
  ```
- **GitHub Pages**: `build_type` switched from `"workflow"` to `"legacy"` via `gh api`, so branch pushes are served immediately.

---

## Bug 2 — IPTC City field never read

### Symptoms

Only 0 of 302 photos had a city/community in their manifest entry, despite 195 of 302 photos having `IPTC:City` properly filled by Lightroom. The `location` field showed only `"Province, Country"` — e.g., `"Manitoba, Canada"` instead of `"Winnipeg, Manitoba, Canada"`.

### Root Cause

The original `extractExifMetadata()` function did not request the `-City` flag from exiftool:

```js
// Before — no -City, no -Sub-location, no -DateCreated
`exiftool -j -ImageDescription -ObjectName -Caption-Abstract -Keywords
  -DateTimeOriginal -GPSLatitude -GPSLongitude -Province-State
  -Country-PrimaryLocationName "${filepath}"`
```

Exiftool only returns the fields you ask for. Without `-City` and `-Sub-location`, those IPTC fields were never extracted, and the location-building code only had `Province-State` and `Country-PrimaryLocationName` to work with. The result was a location string that always omitted the community name — the most specific and important part.

### Fix

Added all missing IPTC location fields to the exiftool command, plus `-DateCreated` (more reliable than `DateTimeOriginal` for archival photos):

```js
`exiftool -j -n ` +
  `-ImageDescription -ObjectName -Caption-Abstract -Keywords ` +
  `-DateTimeOriginal -DateCreated ` +
  `-GPSLatitude -GPSLongitude -GPSLatitudeRef -GPSLongitudeRef ` +
  `-City -Sub-location -Province-State -Country-PrimaryLocationName ` +
  `"${filepath}"`
```

**Result:** 195/302 photos now have a city in their manifest (up from 0). The location string is now `"Community, Province, Canada"`.

---

## Bug 3 — GPS sign bug (Western Canada → Siberia)

### Symptoms

37 of 302 photos had GPS coordinates that placed them in Siberia instead of Western Canada. For example, a photo from Duck Bay, Manitoba (latitude ~52.8, longitude ~-100.9) appeared at latitude 52.8, longitude **+100.9** — a point in central Russia.

### Root Cause

Without the `-n` flag, exiftool outputs GPS coordinates as DMS (degrees-minutes-seconds) strings:

```
"GPSLongitude": "100 deg 9' 14.22\" W"
```

The manifest generator then parsed these with `parseFloat()`:

```js
// Before — parseFloat on DMS string
lng = typeof exif.GPSLongitude === 'number'
  ? exif.GPSLongitude
  : parseFloat(exif.GPSLongitude)
```

`parseFloat("100 deg 9' 14.22\" W")` returns `100` — it stops at the first non-numeric character. The `"W"` suffix (indicating West / negative) is silently discarded. For Western Canada, all longitudes are West, so every photo east of the prime meridian got a **positive** longitude, placing them in Siberia or Central Asia.

The `GPSLongitudeRef` field (which contains `"W"` or `"E"`) was never read, so there was no fallback to apply the sign.

### Fix

Added the `-n` flag to the exiftool command. With `-n`, exiftool outputs GPS coordinates as **signed decimal numbers**: `-100.15395` instead of `"100 deg 9' 14.22\" W"`. The `parseFloat()` call then works correctly without any sign correction logic.

Additionally, a sanity-check range filter was added to `geocode()` to reject coordinates outside Western Canada (lat 45–70, lng −140 to −80), providing a second layer of protection:

```js
if (exifLat >= 45 && exifLat <= 70 && exifLng >= -140 && exifLng <= -80) {
  return { lat: exifLat, lng: exifLng }
}
```

A geocode lookup table for 30+ known Métis communities was added as a fallback for photos without EXIF GPS data.

**Result:** 0 photos with wrong longitude sign (down from 37). 195/302 photos now geocoded (up from 37).

---

## Bug 4 — People field always empty

### Symptoms

All 302 photos had `people: ''` in the manifest. Despite Lightroom having 227/302 photos with person names in their IPTC Keywords, none appeared in the `people` field.

### Root Cause

The `people` field was **hardcoded to an empty string** — the code never attempted to extract person names from keywords:

```js
// Before — people was never populated
people: '',
keywords: keywords,  // all keywords dumped here indiscriminately
```

The old code extracted the `Keywords` IPTC field but treated every keyword identically — person names, date ranges, event tags, place names, and Lightroom edit flags (HR, LR) were all lumped into `keywords`. There was no classification step.

### Fix

Added a keyword classification system that separates person names from topical (non-person) keywords:

- A curated `TOPICAL_KEYWORDS` set of ~100 known non-person tags: date ranges (`1950-1975`), event names (`AGA 2024`), descriptive tags (`Winter`, `Portrait`, `outdoor`), place names (`Duck Bay`, `Selkirk`), street addresses, and Lightroom flags (`HR`, `LR`).
- `TOPICAL_PATTERNS` regex list for structural matches: pure years (`1964`), year ranges (`1950-1975`), addresses starting with numbers (`200 Main St.`), decades (`1950s`).
- A heuristic: single-word all-lowercase keywords are treated as topical (real person names are capitalized in Lightroom).

```js
const people = keywords.filter(kw => !isTopicalKeyword(kw))
const topicalKeywords = keywords.filter(kw => isTopicalKeyword(kw))
```

Person names go to `people` (joined with `; `), everything else goes to `keywords`.

**Result:** 227/302 photos now have people names extracted (up from 0).

---

## Prevention Measures

### For deployment

- **`build_type` must stay `"legacy"`** — documented in `AGENTS.md` with a warning. If someone switches to `"workflow"`, deployments stop silently. A comment in `.github/workflows/deploy.yml` reinforces this.
- **All `fetch()` paths must use `import.meta.env.BASE_URL`** — never hardcode absolute paths. This is enforced by convention and documented in `AGENTS.md`.

### For metadata extraction

- **Always use `exiftool -n`** for GPS coordinates. Without it, you get DMS strings that `parseFloat()` truncates to unsigned integers. This is a well-known exiftool pitfall — the `-n` flag should be the default for any programmatic use.
- **Explicitly list every IPTC field you need** — exiftool only returns requested fields. If you forget `-City`, the field is simply absent (no error, no warning). After adding a new metadata field to the pipeline, verify it appears in the exiftool JSON output before assuming the code handles it.
- **Never hardcode a field you intend to compute** — the `people: ''` bug was invisible until someone looked at the manifest and noticed every entry was identical. If a field is meant to be derived, derive it; if it's a placeholder, mark it with `null` so it's obviously missing rather than deceptively empty.

### For the manifest pipeline

- **Run the generator with `--stats`** after any changes — the v2 generator prints coverage stats (`With city: 195/302`, `Geocoded: 195/302`, `With people: 227/302`). Zeroes are immediately visible.
- **Sanity-check GPS ranges** — the `geocode()` function now rejects coordinates outside the expected region. This catches sign errors, swapped lat/lng, or corrupt EXIF data before it reaches the map.
- **Add new communities to the geocode table** — if a new photo set includes a community not in `GEOCODE_TABLE`, it won't get coordinates. Check the stats line `Geocoded (total)` after each run.
