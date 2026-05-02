# GitHub Pages Fix — Root-Cause Analysis

**Commit:** `56c751a` — *"Fix base path for GitHub Pages"*

---

## Symptoms

After deploying the Shoebox v2 app to GitHub Pages, the site was broken:

- **Images failed to load** — all 302 archival photos returned 404 errors.
- **`manifest.json` 404'd** — the `fetch()` call for the photo manifest returned a 404, so the entire grid was empty.
- **Stories and audio paths similarly broken** — any `fetch()` to an absolute path under `/assets/` failed.
- **GitHub Pages did not redeploy** after pushing to the `gh-pages` branch — the Pages site was stuck on an old version or showed nothing at all.

## Root Causes

Three independent issues combined to break the deployment:

### 1. `base: '/'` in `vite.config.ts`

Vite uses the `base` config option to prefix all asset URLs in the built output. GitHub Pages serves this repo at **`/shoebox-v2/`**, not at the domain root. With `base` set to `'/'`, every generated `<script>`, `<link>`, and `img` URL pointed to `/assets/...` instead of `/shoebox-v2/assets/...`, resulting in 404s for virtually every resource.

### 2. Hardcoded absolute fetch paths in `src/App.tsx`

The app's data-fetching code used hardcoded absolute paths:

```ts
// Before (broken on GitHub Pages)
fetch('/assets/shoebox/manifest.json')
fetch('/assets/shoebox/stories.json')
```

These paths resolved to `https://bayarddevries.github.io/assets/...` instead of `https://bayarddevries.github.io/shoebox-v2/assets/...`. Even if Vite's `base` had been correct, these hand-written `fetch()` calls bypassed Vite's URL rewriting entirely.

### 3. GitHub Pages `build_type: "workflow"` mismatch

The GitHub Pages setting was configured to `build_type: "workflow"`, which tells GitHub to only deploy from a **GitHub Actions workflow that uses the official `actions/deploy-pages` action**. However, the project uses **`peaceiris/actions-gh-pages@v4`**, which works by pushing directly to the `gh-pages` branch. GitHub's "workflow" build type **ignores** branch pushes — it only listens for the `actions/deploy-pages` API signal. This meant every push to `gh-pages` was silently ignored, and the Pages site never updated.

## The Fix

### `vite.config.ts` — change `base`

```ts
// Before
base: '/',

// After
base: '/shoebox-v2/',
```

This ensures Vite prefixes all asset URLs with the correct subpath.

### `src/App.tsx` — use `import.meta.env.BASE_URL` for all fetches

```ts
// Before
fetch('/assets/shoebox/manifest.json')

// After
fetch(`${import.meta.env.BASE_URL}assets/shoebox/manifest.json`)
```

The same pattern was applied to `stories.json` and audio file paths. `import.meta.env.BASE_URL` is injected by Vite at build time and always matches the configured `base`, so the app works both locally (where `BASE_URL` is `/`) and on GitHub Pages (where it's `/shoebox-v2/`).

### GitHub Pages — switch `build_type` to `"legacy"`

```bash
gh api repos/Bayarddevries/shoebox-v2/pages \
  --method PUT \
  --field build_type=legacy
```

The **"legacy"** build type tells GitHub Pages to serve whatever is on the `gh-pages` branch — which is exactly how `peaceiris/actions-gh-pages` works. After this change, pushing to `gh-pages` immediately triggered a new Pages build.

A manual rebuild was also triggered to unblock the stuck deployment:

```bash
gh api repos/Bayarddevries/shoebox-v2/pages/builds --method POST
```

## Key Lesson

> **When using `peaceiris/actions-gh-pages`, the GitHub Pages `build_type` must be `"legacy"`, not `"workflow"`.**
>
> The `"workflow"` type is exclusively for projects that use `actions/deploy-pages` inside their CI pipeline. It does **not** respond to branch pushes. If you push to `gh-pages` via any other mechanism (including `peaceiris/actions-gh-pages`), GitHub will ignore those pushes entirely, and the site will never update.
