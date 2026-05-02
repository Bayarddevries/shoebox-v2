# Contributing to Shoebox v2

Hey! So you want to add photos or work on the Red River Métis Digital Archive — great. Here's how things work around here.

---

## Adding New Photos

### 1. Copy the photo files

Drop your photos into `public/assets/shoebox/photos/`. Keep the original filenames — even if they have spaces. The app handles URL-encoding automatically, and renaming would break existing manifest references.

### 2. Set IPTC metadata in Lightroom

The manifest generator reads structured metadata straight out of the files. Before running it, make sure each photo has these IPTC fields filled in via Lightroom:

- **City** — the community name (e.g. "Duck Bay", "St. Eustache")
- **Province-State** — the province (abbreviations like "MB" or "SK" are fine — the script normalizes them)
- **Country** — typically "Canada"
- **Keywords** — include both people's names and topical tags. The script will sort them into the right buckets.

If the photo has GPS coordinates embedded in EXIF, those will be used. Otherwise the script falls back to its geocode lookup table.

### 3. Run the manifest generator

```bash
node scripts/generate_manifest.js
```

That reads all the photos, pulls their IPTC/XMP data, and writes `public/assets/shoebox/manifest.json`. **Don't edit manifest.json by hand** — it'll get overwritten next time you run the generator.

**You'll need [exiftool](https://exiftool.org/) installed** — the script shells out to it to extract metadata. On macOS: `brew install exiftool`. On Ubuntu: `sudo apt install libimage-exiftool-perl`.

### 4. Add new communities to the geocode table

If your new photos are from a community that isn't in `GEOCODE_TABLE` (in `scripts/generate_manifest.js`), the script won't be able to assign coordinates. Add an entry like:

```js
'Your Town': { lat: 50.1234, lng: -97.5678 },
```

All longitudes in Western Canada are **negative** (west of the prime meridian). The existing table covers ~30 Métis communities across Manitoba, Saskatchewan, Alberta, and the NWT — check it before adding a duplicate.

### 5. Add new topical keywords if needed

The script separates people's names from descriptive keywords using `TOPICAL_KEYWORDS` (also in `generate_manifest.js`). If a new descriptive keyword keeps getting picked up as a person's name, add it to the set:

```js
const TOPICAL_KEYWORDS = new Set([
  // ...existing entries...
  'Your New Tag',
])
```

### 6. Rebuild and push

```bash
npm run build
git add public/assets/shoebox/manifest.json shoebox/
git commit -m "Add new photos from [community/year]"
git push
```

Yes, the `shoebox/` build output is committed to the repo — that's intentional. The CI pipeline deploys from that directory.

---

## Technical Conventions

### Vite base path

The Vite `base` is set to `/shoebox-v2/` in `vite.config.ts`. **Don't change it.** The app lives at a subpath on GitHub Pages, and everything depends on this being right.

### Fetch paths must use `import.meta.env.BASE_URL`

```ts
// ✅ Works everywhere
fetch(`${import.meta.env.BASE_URL}assets/shoebox/manifest.json`)

// ❌ Breaks on GitHub Pages
fetch('/assets/shoebox/manifest.json')
```

`import.meta.env.BASE_URL` is replaced at build time with the configured base path. Hard-coded absolute paths will work locally but 404 in production.

### Build output goes to `shoebox/`

The Vite `outDir` is overridden to `shoebox/` (not the default `dist/`). Only `dist/` is in `.gitignore` — the `shoebox/` directory **is committed**. After any change that affects the build, rebuild and commit the output.

### GitHub Pages build type is `legacy`

The repo uses `peaceiris/actions-gh-pages` to push the `shoebox/` directory to the `gh-pages` branch. The GitHub Pages `build_type` is set to `"legacy"`, which means it serves from branch pushes. **Do not change it to `"workflow"`** — that only responds to `actions/deploy-pages` API calls and will silently break deployments. (We learned this the hard way — see `docs/GITHUB_PAGES_FIX.md`.)

### Photo filenames have spaces

Files like `w-agatha fishing.jpg` and `laffertys sunday best.jpg` are normal. Don't rename them. The browser URL-encodes spaces automatically, and the manifest references the original filenames.

### Manifest is generated

`public/assets/shoebox/manifest.json` is built by the script. Never edit it by hand — your changes will be overwritten. Always use `node scripts/generate_manifest.js`.

### The Photo type

Photos in the app are typed in `src/types.ts`:

```ts
interface Photo {
  id: number
  src: string
  alt: string
  title?: string
  caption?: string
  people?: string
  location?: string
  community?: string     // e.g. "Duck Bay"
  province?: string      // e.g. "Manitoba"
  sublocation?: string   // IPTC sub-location
  keywords?: string[]
  storyIds?: string[]
  lat?: number
  lng?: number
  // ...a few more optional fields
}
```

The `community`, `province`, and `sublocation` fields come from IPTC metadata. If you're working on the frontend and need location info, use these — don't try to parse it out of the `location` string.

---

## Quick checklist for new photos

- [ ] Photos copied to `public/assets/shoebox/photos/`
- [ ] IPTC City, Province-State, Country, and Keywords set in Lightroom
- [ ] `exiftool` installed
- [ ] `node scripts/generate_manifest.js` ran successfully
- [ ] New communities added to `GEOCODE_TABLE` (if any)
- [ ] New topical keywords added to `TOPICAL_KEYWORDS` (if needed)
- [ ] `npm run build` ran
- [ ] `shoebox/` and `manifest.json` committed and pushed

That's it! Thanks for helping preserve this history. 🧡
