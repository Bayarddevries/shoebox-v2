# GitHub Pages Fix — Incident Report

> **Status:** Resolved. Rule now enforced in `AGENTS.md` and `CONTRIBUTING.md`.
> **Incident date:** 2026-05 (initial build + deployment of Shoebox V2).

## The incident

GitHub Pages deployments for Shoebox V2 were breaking on the base path and then
threatened to break silently. Two distinct failure modes, both tied to how this
repo deploys:

### 1. Base-path / subpath mismatch (recurring, "many base-path fixes")

The app is served at `https://bayarddevries.github.io/shoebox-v2/` (a subpath,
not the root). When Vite's `base` config or any `fetch()` used a hardcoded
`/assets/...` path instead of the configured base, assets 404'd on GitHub Pages
because the subpath was missing.

**Fix:** `vite.config.ts` sets `base: '/shoebox-v2/'`, and every `fetch()` in the
app must use `import.meta.env.BASE_URL` (never a hardcoded `/assets/...` path).

### 2. GitHub Pages `build_type` — `legacy` vs `workflow` (the silent killer)

This repo deploys with `peaceiris/actions-gh-pages@v4`, which pushes the
`shoebox/` build directory directly to the `gh-pages` branch. That only works
when the Pages `build_type` is **`legacy`** (branch-push driven).

If the `build_type` is switched to **`workflow`**, Pages stops responding to
branch pushes entirely and instead waits for `actions/deploy-pages` API calls.
The peaceiris workflow makes no such calls, so **deployments silently stop**:
the workflow reports success, the `gh-pages` branch updates, and the live site
goes stale with no error.

## The fix (current state)

- `.github/workflows/deploy.yml` uses `peaceiris/actions-gh-pages@v4` with
  `publish_dir: ./shoebox`, `enable_jekyll: false`.
- GitHub Pages `build_type` must stay **`legacy`**. Do NOT change it to
  `workflow`.
- `vite.config.ts` keeps `base: '/shoebox-v2/'`.
- CI rebuilds `shoebox/` fresh from source on every push (npm ci + npm run
  build); the committed `shoebox/` exists for the local `:8080` symlink.

## Verification

After any deploy, confirm the live site's hashed asset names match the local
`shoebox/index.html`:

```bash
# Live
curl -s https://bayarddevries.github.io/shoebox-v2/ | grep -oE 'index-[A-Za-z0-9_-]+\.(js|css)'
# Local
grep -oE 'index-[A-Za-z0-9_-]+\.(js|css)' shoebox/index.html
```

Mismatch = stale deploy (allow 1-3 min CDN lag before concluding failure).

---

*Reconstructed 2026-08-28 from CHANGELOG.md deploy notes and the rules in
AGENTS.md / CONTRIBUTING.md. Original incident doc was lost; this restores the
reference the two files point to.*
