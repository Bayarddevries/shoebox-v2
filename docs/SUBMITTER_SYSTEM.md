# Shoebox v2 Submitter Metadata Follow-up System

Authoritative technical + operational reference for the submitter follow-up system
("private claim links + crowdsourced community metadata") in the Red River Métis
Digital Archive (Shoebox v2).

Status: LIVE. First live submissions CH-001 (Cheryl Haas) and MH-001 (May Hupe)
are in the system. One open item remains (6 missing Cheryl Haas images, see
"Current open item" below).

Other docs you may want: [SUBMITTER_WALKTHROUGH.html](../docs/SUBMITTER_WALKTHROUGH.html)
(plain-language guide shown to submitters), [shoebox-submitter-workflow.html](../docs/shoebox-submitter-workflow.html)
(overview of the intake + link workflow), [PHOTO_INTAKE_RUNBOOK.md](../docs/PHOTO_INTAKE_RUNBOOK.md)
(how new archival photos are added to the archive), and
[scripts/apps-script/DEPLOY.md](../scripts/apps-script/DEPLOY.md) (Apps Script
deployment + curl tests for every endpoint).

---

## Architecture

Three parts work together:

1. **Static GitHub Pages site** (repo `Bayarddevries/shoebox-v2`, branch `main`).
   Vite + React + TypeScript. Live at https://bayarddevries.github.io/shoebox-v2/.
   The claim view is part of this app: a URL like `?claim=<token>` renders ONLY
   the claim view (`src/components/ClaimView.tsx` + `src/components/MetadataForm.tsx`,
   routed in `src/App.tsx`). The app resolves each photo id against the committed
   `public/assets/shoebox/manifest.json` to show real image paths.
2. **Google Apps Script web app** (`scripts/apps-script/Code.gs`). The small API
   between the site and the sheet. Deployed "Execute as: Me" and "Who has access:
   Anyone". It validates claim tokens, reads submissions, appends contribution
   rows, and sends notification emails.
3. **Google Sheet backend** `Shoebox Submitter Metadata`
   (spreadsheet ID `1DSu7arfh8xnQmYm7JIphImPjBhmeCrADAD8AOhpCy9g`), with two tabs:
   `Submissions` and `Contributions`. The sheet stays private; only the Apps
   Script touches it.

The frontend never touches the sheet directly. Everyone hitting the Apps Script
endpoint only sees what their token grants.

---

## Data flow (end to end)

```
submitter opens claim link (?claim=<token>)
        |  ClaimView fetches ?action=submission&token=<token>
        v
sees THEIR photos (ids resolved against manifest.json)
        |  fills the per-photo metadata form
        v
POST (form-encoded) to the Apps Script /exec URL
        |  doPost validates token + photoId, looks up the submission
        v
row appended to Contributions tab with status "pending"
        |  email notification fires to the archive team
        v
admin reviews / edits / approves each contribution
        |  approved rows merge into manifest / contributions.json
        v
export for Lightroom (review-gated, approved + admin-edited text only)
```

Detail on each hop:

- **Claim link**: `https://bayarddevries.github.io/shoebox-v2/?claim=<token>`.
  The token is the ONLY thing in the link. The app preserves it through all URL
  rewrites (a past bug stripped it, which made the claim view fall back to the
  archive; fixed in commit `32d6f3c`).
- **Submission fetch**: ClaimView calls
  `https://script.google.com/macros/s/.../exec?action=submission&token=<token>`.
  The Apps Script returns `{ submitterName, photos[], contributions[] }`. An
  unknown token returns HTTP 403 `invalid_token`.
- **Contribution POST**: form-encoded (`application/x-www-form-urlencoded`),
  NOT JSON. Apps Script web apps do not answer CORS preflight (`OPTIONS`), so a
  JSON `Content-Type` from the browser fails. Required fields: `token` and
  `photoId`; all metadata fields optional (see "Form field layout"). The script
  generates a unique contribution id
  (`Utilities.getUuid()` + 8-char suffix) and appends the row with status
  `pending`. The frontend guards against duplicate submits for the same photo.
- **Notification**: after the row lands, the script emails the archive team
  (see "Email notification").
- **Admin review**: the admin reviews rows in the Contributions tab of the
  sheet, edits any field, and flips status from `pending` to `approved` (and
  later `merged`). This is the caption-review gate: nothing a submitter writes
  reaches the archive or Lightroom un-reviewed.
- **Merge**: approved contributions live in
  `public/assets/shoebox/contributions.json` (persistent, never rewritten by the
  scripts). `scripts/generate_manifest.js` merges approved rows into
  `manifest.json` after its exiftool pass, so the live app shows them. See
  `scripts/merge_contributions.js`.
- **Export for Lightroom**: `scripts/export_lightroom.js` exports approved
  (admin-reviewed) rows as CSV/JSON for Lightroom import. The raw submitter text
  is never what lands in Lightroom; the reviewed version is.

---

## Google Sheet tabs

### `Submissions` (one row per submitter / event intake)

Columns: `submissionId, event, submitterName, email, phone, familyName,
mmfNumber, consentRef, photoIds, status, token, inviteSentAt, notes`.

- `submissionId`: e.g. `CH-001`, `MH-001`, `SM-001` (Ste. Madeleine).
- `photoIds`: comma-separated manifest ids, linked as images are processed.
- `status`: lifecycle such as `created` -> `linked` -> `invited` -> `complete`.
- `token`: the private claim token (>= 16 char random string, unique). This is
  the only thing exposed in a claim link. Never PII.
- `consentRef`: paper consent/release form reference. Consent stays in person,
  unchanged.

### `Contributions` (one row per photo-metadata submission)

Columns: `id, submissionId, photoId, submittedAt, people, location, community,
province, country, dateYear, dateEra, occasion, story, caption, attribution,
keywords, status`.

- Written by `doPost` when a submitter saves a photo's details.
- `status`: `pending` (new) -> `approved` (admin reviewed) -> `merged` (into the
  manifest).
- These fields map 1:1 to the paper PhotoSlip used at events and to the
  Archival Standards.

---

## Claim tokens

- Claim tokens are **private capability keys**, not authentication. Photos are
  public anyway; the token scopes the view to one submission and gates writes to
  that submission. Fine at this threat level.
- Format: `Utilities.getUuid()` based, 16+ chars, generated when an admin
  creates a submission. Stored only in the Submissions tab `token` column.
- Anyone with the token can view that submitter's photos and add metadata to
  them, so treat links as private. Send each submitter only their own link
  (via MMF Outlook by hand).
- Tokens are never logged and never placed in analytics.

---

## Caption-review gate (PRIORITY)

Submitter text NEVER reaches Lightroom without admin approval.

- Contributions arrive as `pending` (proposed) metadata.
- The admin reviews each in the Contributions tab: edit caption / people /
  location / date / occasion / anything before it is final.
- `scripts/export_lightroom.js` (the Lightroom write-back) is review-gated: it
  only exports approved rows, with the admin-edited values.
- The live app may display approved contributions immediately (community
  sourced), but Lightroom (the archive's source of truth) always receives the
  admin-reviewed version.

---

## Email notification

When a submitter saves photo details, `doPost` calls
`sendContributionNotification(...)` which emails the archive team a summary
(submitter, submission id, photo id, and the details provided).

- Uses Apps Script `MailApp.sendEmail` (minimal `gmail.send` scope; no Gmail API
  calls).
- Recipients are the `NOTIFY_EMAILS` constant at the top of
  `scripts/apps-script/Code.gs`:
  `['metisshoebox@mmf.mb.ca', 'bayard.devries@mmf.mb.ca']`.
- Notification failure must not block the submission: it is wrapped in
  try/catch and only logs a warning.
- The email body tells the team to review in the Contributions tab and approve
  or edit before the text merges into the archive.

Note on scopes: if the script ever needs a NEW Google service/scope beyond
`gmail.send` (e.g. a new advanced service), the owner must re-approve the
`/exec` URL after the next deploy, otherwise the web app calls will fail auth.

---

## Inline text editing (claim-page copy)

All user-facing claim-page text lives in **one file**:
`public/claim_text.json`. This is the single editable source of truth for
claim-page copy (heading, walkthrough text, form labels, placeholders, done
state, footer).

- `src/claimText.ts` exports `DEFAULT_CLAIM_TEXT` (the fallback defaults used
  only if the JSON fails to load) and the `useClaimText()` hook, which fetches
  `claim_text.json` at runtime.
- **Workflow to change claim-page text**: edit `public/claim_text.json`, then
  rebuild and deploy (CI deploys on push to `main`; locally `npm run build` /
  `bun run build` writes the `shoebox/` build folder which is committed).
  No code change needed for copy edits.
- The JSON supports `{placeholder}` substitutions such as `{total}` and
  `{completed}` (see the `fmt()` helper in `src/claimText.ts`).
- Editing the JSON requires a rebuild because the built site copies `public/`
  into the `shoebox/` output folder.

---

## Form field layout

The per-photo metadata form (`src/components/MetadataForm.tsx`) has these
fields, in this order:

- People (left to right)
- Approx. year (`dateYear`)
- Era (`dateEra`)
- City / town (`city`)
- Province (`province`)
- Community (`community`)
- Occasion or event
- Story
- Caption
- Keywords (comma-separated)
- Consent checkbox (REQUIRED): "I confirm I completed the photo consent form,
  giving permission to scan and archive this image."

Rules:

- **Every metadata field is optional except the consent checkbox.** A partial
  answer is accepted and encouraged. `country` is hardcoded to `Canada` in the
  form submit.
- The **attribution / credit field was removed** (commit `eb0d0d1`); the
  location field was split into City / Province / Community at the same time.
- The form-encoded POST sends: token, photoId, people, location (city),
  community, province, country, dateYear, dateEra, occasion, story, caption,
  keywords, consent.
- Without consent, the form blocks submit and shows the consent alert.

---

## Apps Script deployment

- **Script project ID**: `1Jy2Hd1PjoEr1UikN1QI1eXmogPB4If8AJ-7Li7klBgqmXzhXIAi8-5Lq`
  (open at
  `https://script.google.com/macros/edit?lib=<project-id>`).
- **Live web app URL (v2, current)**:
  `https://script.google.com/macros/s/AKfycbwx0l2LijEV5MkodZcKMWPGNj5ADiZvS0Yfj9zUsITaEhhoFn_1mzd3jLi-w42qduNe/exec`
- **Deployment model**: "Execute as: Me" (the owner's Google account), "Who has
  access: Anyone". The sheet stays private; only the script touches it.
- **Re-deploy process** (keeps the URL stable): push updated code to the script
  project via the Apps Script API, create a new version, then update the
  existing deployment to point at that version. Re-deploying to the SAME
  deployment keeps the `/exec` URL unchanged. Creating a brand-new deployment
  produces a new URL.
- **OAuth scope change**: if a new OAuth scope is added (e.g. a new advanced
  Google service), the owner must re-approve the `/exec` URL, otherwise calls
  fail. See "Email notification" above.
- **End-to-end was verified live** (2026-08-27): admin create submission -> GET
  submission by token -> POST contribution -> row lands in the sheet with status
  `pending`. Full curl tests for every endpoint are in
  `scripts/apps-script/DEPLOY.md`.

### Admin actions (all in `Code.gs`, all require the admin token)

Submitter-facing:

- `submission` (GET, `?action=submission&token=<token>`) -> the submitter's
  photos + existing contributions. This is the ONLY non-admin action.

Admin (`?action=<name>&admin_token=<token>`, routed through `doGet` with query
params; `doPost` is reserved for the submitter contribution POST):

- `admin_create_submission` (POST) -> creates a submission row, generates and
  returns a random claim token.
- `admin_update_submission` (POST) -> update photoIds / status / email /
  invitedAt.
- `admin_get_submission` (GET) -> full submission by id.
- `admin_list_submissions` (GET) -> all submissions.
- `admin_list_contributions` (GET) -> all contributions.
- `admin_get_contribution` (GET) -> one contribution by id.
- `admin_update_contribution` (POST) -> edit any contribution field or status.
- `admin_delete_contribution` (POST) -> delete a contribution row.

### Admin token

- A secret capability key, stored in the `ADMIN_TOKEN` constant at the top of
  `scripts/apps-script/Code.gs`. It is NOT exposed to submitters, never appears
  in claim links, and must not be reproduced in public docs, logs, or commits.
  Keep it out of public-facing code and rotate it if it ever leaks.
- (Do not paste the token value into docs, issue trackers, or chat logs.)

---

## Live submissions

| Submission | Submitter | Contact | Photos | Token (claim link) | State |
|---|---|---|---|---|---|
| CH-001 | Cheryl Haas | Chaas9@yahoo.ca | 19 (6 still missing, see below) | b2e29303-86a8-4bc4-b5aa-eb7b6601818c-539d | Live; missing images |
| MH-001 | May Hupe | mayhupe1980@gmail.com | 6 | 5f2d5e94-6d85-4f1b-9325-14d17ce91aef-815e | Live; fully sent and working |

Claim links are `https://bayarddevries.github.io/shoebox-v2/?claim=<token>`.

### Current open item

Cheryl Haas (CH-001) is missing **6 photos** from her submission:

- Stemadeleine 21, 22, 23, 24, 28, 29 (`.tif`)

These have NOT yet been found and ingested into the archive. They are absent
from `public/assets/shoebox/manifest.json` (present in the manifest at the same
range: Stemadeleine 20, 25, 26, 27). To close the item: locate the source `.tif`
files, ingest them via the photo intake pipeline (see
[PHOTO_INTAKE_RUNBOOK.md](../docs/PHOTO_INTAKE_RUNBOOK.md)), regenerate the
manifest, and add them to the CH-001 submission (`admin_update_submission` with
the photo ids in `photoIds`).

---

## How to operate (quick reference)

1. **New event intake**: scan on site + paper consent slip (offline-first; wifi
   unreliable at Ste. Madeleine). Process scans in Lightroom, export to
   `public/assets/shoebox/photos/`, regenerate the manifest.
2. **Register a submitter**: `admin_create_submission` -> returns a token.
3. **Send the link**: paste
   `https://bayarddevries.github.io/shoebox-v2/?claim=<token>` into MMF Outlook
   and send to that submitter only.
4. **When they fill the form**: a notification email arrives; review the row in
   the Contributions tab; edit and approve.
5. **Publish**: approved rows merge via `contributions.json` +
   `generate_manifest.js`; export for Lightroom via `export_lightroom.js`.
6. **Change claim-page copy**: edit `public/claim_text.json`, rebuild, push.
