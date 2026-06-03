# Deploy contract: shoebox-v2

## Live site
https://bayarddevries.github.io/shoebox-v2/

## How it deploys
- Branch: `main`
- CI: `.github/workflows/deploy.yml`
- Uses `peaceiris/actions-gh-pages@v4`
- Pushes build output in `shoebox/` to `gh-pages` branch
- GitHub Pages serves from `gh-pages`

## Build locally
```bash
cd ~/shoebox-v2
npm run build
ls shoebox/
```

## Verification
- Routes resolve on `/shoebox-v2/` base path
- Manifest + photos load without 404s
- No polyfill/runtime build errors

## Rollback
```bash
git revert HEAD
git push main
# gh-pages build will redeploy
```
