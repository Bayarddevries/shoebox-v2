# Shoebox v2 — Tasks

## Build & Deploy
- [x] Verify build/deploy pipeline post-MM F rebrand (2026-05-19)
- [x] Confirm GitHub Pages serves correctly at bayarddevries.github.io/shoebox-v2/

## Submitter Follow-up System
- [x] Photo intake: 74 new archival photos added (manifest 376 -> 450, Ste. Madeleine + Victory at Frog Plain 2026)
- [x] Claim view: private `?claim=<token>` links render a submitter's own photos (`src/components/ClaimView.tsx`)
- [x] Form fields: people, city/province/community split, year, era, occasion, story, caption, keywords, required consent checkbox (attribution removed)
- [x] Notification emails: on contribution, emails metisshoebox@mmf.mb.ca + bayard.devries@mmf.mb.ca via `gmail.send` scope (MailApp)
- [x] Live submissions: CH-001 (Cheryl Haas) and MH-001 (May Hupe) created and sent
- [ ] OPEN: find + ingest the 6 missing Cheryl Haas images (Stemadeleine 21, 22, 23, 24, 28, 29 `.tif`), then add them to her CH-001 submission

## Map / Geocoding
- [x] Fix geocoding: keyword + case-insensitive city lookup in `generate_manifest.js` (was missing photos with no IPTC City but event keyword)
- [x] Precise GPS applied to 25 Ste. Madeleine scans (50.58111, -101.43139 = Ste. Madeleine Cemetery); all 60 new event photos now map
- [x] Event keyword "Ste. Madeleine Métis Days 2026" no longer misclassified as a person
- [ ] NOTE: 2 photos still have no location at all (photo_386 Joanhadfield 23, photo_411 Img 2336) — acceptable, not all images have location
- [ ] EVENT TOMORROW (Aug 29): verify map + projector on the event display before showing

## UI / UX Polish
- [ ] Mobile nav polish — hamburger, full-screen overlay, z-index hierarchy
- [ ] Archive grid filter UX pass — verify search, community/family/decade/keyword filters all work
- [ ] Hero section cross-browser test (Safari, Firefox)

## Archive & Content
- [ ] Build admin upload portal — drag-and-drop photo intake using the `scripts/ingest_photos.js` workflow (preflight, copy, manifest regen, thumbnails, build; never auto-commits)
- [ ] Improve tagging workflow (keywords, people, year derivation)
- [ ] Verify year derivation for all 302 photos (keyword → title → era midpoint → EXIF fallback)
- [ ] Plan community visits/interviews for new photo collection

## Integration
- [ ] Plan Homeland Map integration — link archive photos to settlement locations
- [ ] Cross-link with RRMNHC website navigation

## Outreach
- [ ] Market the project — social media, community board posts
- [ ] Document collection workflow for family contributions
