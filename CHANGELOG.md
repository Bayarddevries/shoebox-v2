# Changelog

All notable changes to the **Red River Métis Digital Archive (Shoebox v2)**.

Project: static Vite + React + TypeScript archive site, deployed to GitHub Pages,
with a Google Apps Script + Sheet backend for submitter metadata (see
[docs/SUBMITTER_SYSTEM.md](docs/SUBMITTER_SYSTEM.md)).

Format follows [Keep a Changelog](https://keepachangelog.com/) loosely; versions
are milestone dates rather than semver (this is a continuous single-site deploy).

---

## [2026-08-28] — Submitter Follow-up System: live (v1.0 milestone)

Private claim links + crowdsourced community metadata, fully live.

### Added
- **Submitter claim view** (`?claim=<token>` URL) — a submitter opens their private
  link and sees ONLY their own photos, not the archive. Built on
  `src/components/ClaimView.tsx` + `MetadataForm.tsx`.
- **Metadata form** with fields: people (left to right), city / town, province,
  community, year, era, occasion, story, caption, keywords, and a required consent
  checkbox. All metadata fields optional; users can submit with partial info.
  Attribution field removed; location split into city / province / community.
- **Google Sheet backend** `Shoebox Submitter Metadata` (tabs Submissions +
  Contributions) via a Google Apps Script web app (`scripts/apps-script/Code.gs`).
  Submissions land as `pending` and are admin-reviewed before merging.
- **Email notifications** on every submission — emails
  `metisshoebox@mmf.mb.ca` + `bayard.devries@mmf.mb.ca` with who submitted, which
  photo, and the details provided (minimal `gmail.send` scope, recipients in
  `NOTIFY_EMAILS`).
- **Inline text editing** — all claim-page copy lives in `public/claim_text.json`
  (single source of truth; fallback defaults in `src/claimText.ts`). Edit the
  JSON, rebuild, deploy.
- **Citizen walkthrough** embedded in the claim view ("How to help document your
  photo") + `docs/SUBMITTER_WALKTHROUGH.html`.
- **Photo intake runbook + orchestrator** (`docs/PHOTO_INTAKE_RUNBOOK.md`,
  `scripts/ingest_photos.js`) — `--dry-run`/`--do-it`, hard-blocks if exiftool
  missing, never commits/pushes automatically.
- **74 new archival photos** (Ste. Madeleine Métis Days 2026 + Victory at Frog
  Plain 2026): manifest 376 → 450, with thumbnails.
- **Admin API** actions: create/update/get/list submissions, list/get/update/
  delete contributions, submitter-facing `submission` action. Admin token is a
  secret capability key.

### Fixed
- Claim link loaded the archive instead of the claim view — App URL-sync effect
  was stripping `?claim=`; now preserved in all URL rewrites.
- Claim view showed placeholder titles — now resolves photo id → real src/title
  against the manifest.
- Thumbnails missing from live deploy — build-copy thumbs now committed.
- Duplicate submissions from double-click — submit guard added.
- Apps Script `setHttpStatusCode` crash — replaced with proper JSON response.

### Known issue
- **6 missing Cheryl Haas images** (Stemadeleine 21, 22, 23, 24, 28, 29 `.tif`)
  not yet in archive; CH-001 currently holds 19 of her 25 photos.

---

## [2026-07-28 to 2026-07-31] — Métis Kin Exhibit mode

Standalone kiosk/exhibit projection for events.

### Added
- **Projector slideshow** (`public/projector.html`) — full-screen kiosk mode:
  Ken Burns, face-aware centering, captions, filters, presets, touch + keyboard
  shortcuts, immersive auto-hide.
- **Métis Kin exhibit** — state server, controller page, projector exhibit mode
  (`f7b42e6`), controller v2 with timeline/gallery/related/swipe (`c03a9d3`).
- Face-aware slideshow centering via `scripts/detect_faces.py` pipeline
  (370/376 photos with face coordinates).
- Windows batch launcher, Tailscale/WSL networking docs for exhibit.

---

## [2026-06-03] — Lightroom export refresh

- Full Lightroom export with updated IPTC metadata (376 photos, `761dbed`).
- Admin upload portal task + issue templates + DEPLOY.md (`ba7dbf9`).

---

## [2026-05-19 to 2026-05-21] — Archive site features

### Added
- Ken Burns hero carousel (pre-1950 photos), rewritten multiple times for
  seamless crossfade (no blank flash, two-layer DOM, preload wait).
- Admin dashboard with story editor and deploy (`b55af52`).
- Shared sandwich nav — links to Heritage Centre + Homeland Map.
- Artifacts, News, Contact nav links.
- Masonry archive grid (portrait photos not cropped), JS shortest-column.
- Filter + Search v2: horizontal pill bar, mobile sheet, multi-select, URL state.
- People extraction from metadata, story texts, favicon, crimson hero title
  treatments (several attempts), MMF branding (EB Garamond, logo).
- Added stories: Jessie Anderson + Alfred Anderson.
- New archival photos (Joan Hadfield collection) + manifest updates.
- LICENSE (CC0), CONTRIBUTING.md, expanded incident report, README.

---

## [2026-05-01 to 2026-05-15] — Initial build + deployment

### Added
- Initial commit — Shoebox V2 Red River Métis Digital Archive (`43cd1c4`).
- GitHub Pages workflow + many base-path fixes (peaceiris/gh-pages, legacy
  build type — do NOT switch to `workflow`).
- Manifest generator v2: IPTC location, GPS sign fix, people extraction.
- Deployment docs + incident report for the GitHub Pages fix.
- Project documentation (CONTRIBUTING.md, AGENTS.md, README).

---

## Deploy note

CI (`peaceiris/actions-gh-pages`) pushes the `shoebox/` build directory to the
`gh-pages` branch; GitHub Pages serves from there. CDN can lag 1-5 min after a
deploy. The GitHub Pages `build_type` must stay `legacy` (not `workflow`) or
deployments stop silently.
