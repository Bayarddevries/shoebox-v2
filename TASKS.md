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

## UI / UX Polish
- [ ] Mobile nav polish — hamburger, full-screen overlay, z-index hierarchy
- [ ] Archive grid filter UX pass — verify search, community/family/decade/keyword filters all work
- [ ] Hero section cross-browser test (Safari, Firefox)

## Archive & Content
- [ ] Build admin upload portal — drag-and-drop photo intake using the scripts/add-photos.py workflow (IPTC metadata extraction, surgical append, auto-build)
- [ ] Improve tagging workflow (keywords, people, year derivation)
- [ ] Verify year derivation for all 302 photos (keyword → title → era midpoint → EXIF fallback)
- [ ] Plan community visits/interviews for new photo collection

## Integration
- [ ] Plan Homeland Map integration — link archive photos to settlement locations
- [ ] Cross-link with RRMNHC website navigation

## Outreach
- [ ] Market the project — social media, community board posts
- [ ] Document collection workflow for family contributions
