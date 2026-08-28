# Photo Intake Runbook - Shoebox v2 (Red River Métis Digital Archive)

This is the defined, repeatable procedure for adding new archival photos to the
archive. It is written for the archive admin (Bayard) or an AI agent working on
their behalf. Follow it top to bottom. Do not skip the dry run.

The current archive holds 450 photos. The source of truth folder is
`public/assets/shoebox/photos/`. The live site is built from the committed
`shoebox/` build folder and deployed to GitHub Pages by CI on every push to
`main`.

---

## The pipeline in one picture

```
Lightroom export (with IPTC metadata)
        |
        v
intake source (folder or .zip on this machine)
        |
        v  1. dry run  -> review the plan, handle collisions
        v  2. --do-it  -> copy files into public/assets/shoebox/photos/
        v  3.          -> node scripts/generate_manifest.js  (reads IPTC via exiftool)
        v  4.          -> python3 scripts/generate_thumbs.py  (~320px thumbnails)
        v  5.          -> npm run build                       (copies public -> shoebox/)
        v  6.          -> verification summary (counts)
        v
commit + push (YOU decide when)  -> CI rebuilds and deploys to GitHub Pages
```

The one-command wrapper for steps 2 through 6 is `scripts/ingest_photos.js`.
It never commits or pushes. You stay in control of publishing.

---

## Before you start: what a photo needs

Photos come from Adobe Lightroom exports. For the archive to be useful, each
photo should carry IPTC metadata written by Lightroom:

| Field | Where Lightroom writes it | What the manifest uses it for |
|-------|---------------------------|-------------------------------|
| Title | IPTC Object Name | the photo's title |
| Caption / description | IPTC Caption-Abstract | the photo's caption |
| City | IPTC City | the community field |
| Province | IPTC Province-State | the province field |
| Country | IPTC Country | the country field |
| GPS | from the camera, if any | map pin |
| Keywords | IPTC Keywords | people names and topical tags, and the photo's year |

**GPS gotcha (Ste. Madeleine 2026 batch):** Lightroom stores GPS in XMP on the
camera raw (CR2) files, but when those raws are exported as JPGs, the GPS is
NOT carried to the JPG unless the export metadata template includes it. Scans
made from an EPSON V800/V850 (TIF source) exported through Lightroom also drop
GPS. Symptom: the GPS you set in Lightroom shows on the CR2/TIF but the exported
JPGs have `exiftool -GPS*` empty. The generator falls back to a geocode lookup
table (by IPTC City, then by keyword, case-insensitive) which puts the photo at
the community center. If you need the precise pin, either export with GPS
included, or patch the manifest `lat`/`lng` directly (as done for the 25
Ste. Madeleine scans on 2026-08-28 → 50.58111, -101.43139 = Ste. Madeleine
Cemetery).

A photo with NO metadata still gets added, but it appears as an untitled,
unlocated, undated entry. The generator falls back to the filename for the
title (e.g. `IMG_2346.jpg` becomes "Img 2346"), which is not useful for an
archive. So: if a batch lacks metadata, either export it again from Lightroom
with metadata, or accept that those photos will need manual curation.

For historical photos specifically, make sure the keywords include a specific
year (e.g. `1925`) or an era range (e.g. `1925-1950`) so the manifest records
the real photo date instead of the scan date. Recognized era ranges:
`1900-1925`, `1925-1950`, `1950-1975`, `1975-2000`, `2000-2025`.

---

## Step 1. Get the photos onto this machine

1. If the photos were shared as a Google Drive link, download the folder or
   zip to this machine. The script cannot open a Drive link directly; it needs
   a local folder or a local `.zip`.
2. Put the download somewhere easy, for example:
   `/home/bayarddevries/intake/` (create it if needed).
   A good spot is a folder next to the repo, never inside the repo.
3. Look at the file names. Mixed names (IMG_*, _MG_*, Stemadeleine_*,
   UUID-like names) are fine, but descriptive names are much better for an
   archive. Renaming is optional and done outside this pipeline; the archive
   keeps whatever name the file arrives with.
4. Do not rename files to fix the archive "later". The manifest references
   filenames as-is, and old names should never be reused for different photos.

---

## Step 2. Dry run (always do this first)

From the repo folder `/home/bayarddevries/shoebox-v2`:

```bash
cd /home/bayarddevries/shoebox-v2
node scripts/ingest_photos.js /home/bayarddevries/intake/my_new_batch.zip
```

or, if the source is a folder:

```bash
node scripts/ingest_photos.js /home/bayarddevries/intake/my_new_batch/
```

The dry run writes NOTHING. It prints:

- preflight checks (exiftool, Python + PIL, node)
- how many photos are already in the archive (450)
- how many of your files are new, how many are identical duplicates, and how
  many collide (same name, different content)
- a warning if exiftool is missing

Read the plan before going further. Especially look at the collision section.

---

## Step 3. Handle collisions

A collision means your batch has a file whose name already exists in the
archive, but the content is different. The script stops and makes you decide.

Two situations:

- **The incoming file is the better version** (for example it carries the
  metadata and the archived copy does not). This happened with IMG_2332.jpg,
  IMG_2337.jpg and IMG_2346.jpg: the right call was to overwrite with the
  metadata-rich versions. Run with `--overwrite`.
- **The archived copy is the good one** (the incoming file is a stray). Remove
  that file from your source folder and re-run the dry run. The archive copy
  stays untouched.

Never overwrite blindly. Look at the file sizes the script prints; a huge
size gap usually means one of them is the wrong file.

If your source has two different files with the same name in different
subfolders, the script refuses and asks you to resolve it (rename one).

---

## Step 4. Run the intake

Once the dry run shows the plan you want:

```bash
node scripts/ingest_photos.js /home/bayarddevries/intake/my_new_batch.zip --do-it
```

If collisions exist and the incoming files are the better versions:

```bash
node scripts/ingest_photos.js /home/bayarddevries/intake/my_new_batch.zip --do-it --overwrite
```

This runs, in order:

1. copies new files (and overwrites colliding ones only if you passed
   `--overwrite`) into `public/assets/shoebox/photos/`
2. regenerates `public/assets/shoebox/manifest.json` (reads IPTC via exiftool,
   merges approved community contributions, merges face coordinates)
3. regenerates thumbnails into `public/assets/shoebox/thumbs/`
4. runs `npm run build` so the committed `shoebox/` folder matches

The script refuses to start if exiftool is not on PATH, because that is the
exact failure that silently stripped metadata last time. Only add
`--allow-no-exiftool` if you genuinely want a metadata-free ingest (you almost
never do).

---

## Step 5. Read the verification summary

The script prints a summary at the end. Confirm all of these:

- `Manifest count` equals `Photos on disk`. If not, re-run the generator.
- `Thumbs on disk` covers all photos.
- `Build copy thumbs` covers all photos. This check exists because the live
  site once shipped with no thumbnails when the build folder was not updated.
- `Faces in manifest` is informational. Face detection needs OpenCV, which is
  not installed on this machine, so expect "0" or a partial count from an older
  run. This does not block the intake.

---

## Step 6. Commit and push (you decide)

The script does not commit or push. Review what changed, then:

```bash
cd /home/bayarddevries/shoebox-v2
git status                      # review the changed and new files
git add public/assets/shoebox/photos
git add public/assets/shoebox/manifest.json
git add public/assets/shoebox/face_coords.json
git add public/assets/shoebox/thumbs
git add shoebox
git commit -m "Add N new archival photos"
git push origin main
```

Pushing to `main` triggers the GitHub Actions workflow, which rebuilds and
pushes `shoebox/` to the `gh-pages` branch.

---

## Step 7. Verify the live site

1. Wait 1 to 3 minutes for the CDN to catch up.
2. Open https://bayarddevries.github.io/shoebox-v2/ and hard-refresh
   (Ctrl+Shift+R) to bypass the cache. If a particular image looks stale, add
   a cache-buster query string manually, e.g. `?cb=<timestamp>`.
3. Check: new photos appear in the grid, thumbnails load in the gallery and
   search results, and the new manifest count is what you expect.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Dry run says `exiftool MISSING` | exiftool not on PATH for this shell | Run `export PATH="$HOME/bin/exiftool:$PATH"` then re-run. |
| Ingest aborts with "collision(s) need --overwrite" | same-name, different-content files in the batch | Decide per Step 3, then re-run with `--overwrite` or remove the file. |
| Ingest aborts with "exiftool is not on PATH" | same as first row | Fix PATH. Do not force with `--allow-no-exiftool` unless intentional. |
| Verification says manifest does not match photos dir | generator failed partway | Run `node scripts/generate_manifest.js` alone, then re-check. |
| Verification says missing thumbnails | thumbs step did not finish | Run `python3 scripts/generate_thumbs.py` alone, then `npm run build`. |
| Live site has no thumbnails | build folder was not rebuilt or not committed | Re-run `npm run build`, then `git add shoebox` and commit. |
| No captions on new photos | source files have no IPTC metadata | Re-export from Lightroom with metadata, or curate manually later. |
| Face count is 0 | OpenCV not installed | Expected. Not a blocker. Install opencv-python if face tracking matters. |
| Approved community captions seem wrong after intake | contribution was keyed to a photo id that shifted | See the caution below. |

---

## Known cautions and current gaps (read once)

1. **exiftool is a PATH dependency.** The generator warns per file and keeps
   going when exiftool is missing, so a missing exiftool silently strips all
   IPTC metadata. The orchestrator now blocks on this; the generator itself
   still does not. Keep `~/bin/exiftool` on PATH.
2. **Thumbnails are a separate manual step.** `generate_thumbs.py` is not
   called by the manifest generator and not part of CI. That is why the live
   site once shipped without thumbnails. The orchestrator runs it every time,
   but if you ever do the steps by hand, do not forget thumbs and the build.
3. **Contributions merge uses positional photo ids.** Approved community
   contributions in `public/assets/shoebox/contributions.json` are matched to
   photos by `photoId` (e.g. `photo_123`), and those ids are assigned by sort
   position, not by filename. Adding or removing photos shifts positions, so an
   approved contribution can silently land on the wrong photo after an intake.
   Right now `contributions.json` only contains example rows on non-existent
   ids (`photo_9998`/`photo_9999`), so nothing real is at risk yet. Before you
   rely on real contributions, this should be changed to key on filename.
4. **Face detection errors are mislabeled.** The generator prints "Face
   detection skipped (OpenCV not available)" for any failure of the face
   script, including a timeout. Treat it as "face detection did not run".
5. **No naming convention is enforced.** Files arrive as IMG_*, _MG_*,
   Stemadeleine_*, UUID names. All are accepted. Descriptive names are better
   for an archive; enforce them at export time if you care.
6. **The zip approach is ad-hoc but now handled.** The orchestrator accepts a
   folder or a `.zip` and recurses into subfolders. A Google Drive link must be
   downloaded to a local file first.

---

## Manual procedure (fallback, if you ever do it by hand)

Only if the orchestrator cannot be used. Do all of these in order:

```bash
# 1. copy files (watch for collisions yourself)
cp /home/bayarddevries/intake/batch/*.jpg public/assets/shoebox/photos/

# 2. metadata (requires exiftool on PATH)
node scripts/generate_manifest.js

# 3. thumbnails (easy to forget!)
python3 scripts/generate_thumbs.py

# 4. rebuild so the committed build output matches
npm run build

# 5. verify counts match: photos dir vs manifest photoCount vs thumbs
ls public/assets/shoebox/photos | wc -l
ls public/assets/shoebox/thumbs | wc -l

# 6. commit and push (Step 6 above)
```

Prefer the orchestrator. It does all of this in one command and refuses to
start on the failure modes that burned the archive before.
