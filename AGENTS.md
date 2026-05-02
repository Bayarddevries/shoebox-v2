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
node scripts/generate_manifest.js
```
