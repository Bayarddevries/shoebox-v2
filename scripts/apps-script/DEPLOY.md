# Shoebox Submitter Metadata - Apps Script Deployment Guide

## One-time setup in Apps Script editor

1. Open https://script.google.com
2. Click **+ New Project** (blank project)
3. Delete any placeholder code in the editor
4. Paste the contents of `scripts/apps-script/Code.gs` into the editor
5. (Optional) In the Apps Script editor: **Resources → Advanced Google services** → enable **Google Sheets API** (needed only if you call Sheets API directly from the script)
6. Save the project (Ctrl+S). A project name is optional.

## Deploy as a web app

1. Click **Deploy → New deployment**
2. At the top click the **gear icon** to select "Web app" (or choose Add deployment → Web app)
3. Fill in:
   - **Execute as:** Me (the owner of this Google account)
   - **Who has access:** Anyone
4. Click **Deploy**
5. Copy the **Web app URL** (ends in `/exec`). This is the endpoint the claim view and admin tool will call.
6. Save this URL — it never changes after deployment unless you publish a new version.

## After deployment: set the spreadsheet ID

The `SPREADSHEET_ID` constant at the top of `Code.gs` must point to the same Google Sheet you created (the one with "Submissions" and "Contributions" tabs). It is already set to the correct ID in this file. If you recreate the sheet, update the constant and re-deploy.

## Live deployment (2026-08-27)

- **Web app URL (v2, current):** `https://script.google.com/macros/s/AKfycbwx0l2LijEV5MkodZcKMWPGNj5ADiZvS0Yfj9zUsITaEhhoFn_1mzd3jLi-w42qduNe/exec`
- **Script project:** `https://script.google.com/macros/edit?lib=1Jy2Hd1PjoEr1UikN1QI1eXmogPB4If8AJ-7Li7klBgqmXzhXIAi8-5Lq`
- **Admin token:** stored in `Code.gs` (line 13) — keep it out of public repos
- **Claim link format:** `https://bayarddevries.github.io/shoebox-v2/?claim=<TOKEN>`
- **Verified end-to-end:** admin create submission → GET submission by token → POST contribution → row lands in sheet with status `pending`. All tested live 2026-08-27.

### Note on admin actions
Admin create/update/delete actions are routed through **GET** (query params) in `doGet` — e.g. `?action=admin_create_submission&submissionId=X&...&admin_token=Y`. `doPost` is reserved for the submitter-facing contribution POST. This matches the frontend (ClaimView only POSTs contributions).

## Test every endpoint with curl

Replace `BASE_URL` with the web app `/exec` URL from step 5 above.

### Test 1 — GET a submission with a valid token (should return submission data)

```bash
curl -s "https://script.google.com/macros/s/BASE_URL/exec?action=submission&token=REPLACE_WITH_REAL_TOKEN"
```

Expected: JSON with `submitterName`, `photos` (array), `contributions` (array). If the token does not exist yet it returns `{ "submitterName": "", "photos": [], "contributions": [] }`. To test with a real token, first seed one in the Submissions tab (see seed row below).

### Test 2 — GET a submission with an invalid token

```bash
curl -s "https://script.google.com/macros/s/BASE_URL/exec?action=submission&token=invalid_token_xyz"
```

Expected: `{ "error": "invalid_token" }` (HTTP 403).

### Test 3 — POST a contribution (form-encoded, required format)

```bash
curl -s -X POST \
  -d "token=REPLACE_WITH_REAL_TOKEN" \
  -d "photoId=PHOTO_ID" \
  -d "people=John Doe" \
  -d "location=Winnipeg" \
  -d "community=St. Vital" \
  -d "province=Manitoba" \
  -d "country=Canada" \
  -d "dateYear=1925" \
  -d "dateEra=1920-1930" \
  -d "occasion=Family gathering" \
  -d "story=The family came to Manitoba in 1900" \
  -d "caption=My grandmother" \
  -d "attribution=Courtesy of the Doe Family Collection" \
  -d "keywords=family,grandmother" \
  "https://script.google.com/macros/s/BASE_URL/exec"
```

Important: send form-encoded (`-d`) NOT JSON (`-H "Content-Type: application/json"`). Apps Script web apps do not answer `OPTIONS` preflight, so JSON from the browser will fail.

Expected: `{ "status": "ok", "contributionId": "..." }`. Check the Contributions tab — a new row with `status: pending` should appear.

### Test 4 — POST with missing fields (error case)

```bash
curl -s -X POST \
  -d "photoId=PHOTO_ID" \
  "https://script.google.com/macros/s/BASE_URL/exec"
```

Expected: `{ "error": "missing_required_fields", "field": "token" }` (HTTP 400).

### Test 5 — Admin: list submissions

```bash
curl -s "https://script.google.com/macros/s/BASE_URL/exec?action=admin_list_submissions&admin_token=CHANGE_THIS_TO_YOUR_RANDOM_ADMIN_TOKEN_BEFORE_DEPLOYMENT"
```

Expected: JSON with `submissions` array.

### Test 6 — Admin: get a submission by id

```bash
curl -s "https://script.google.com/macros/s/BASE_URL/exec?action=admin_get_submission&id=SM-001&admin_token=CHANGE_THIS_TO_YOUR_RANDOM_ADMIN_TOKEN_BEFORE_DEPLOYMENT"
```

Expected: JSON with the submission fields, or `{ "error": "not_found" }`.

### Test 7 — Admin: create a submission (assigns a random token)

```bash
curl -s -X POST \
  -d "action=admin_create_submission" \
  -d "submissionId=TEST-001" \
  -d "event=Test Event" \
  -d "submitterName=Test User" \
  -d "email=test@example.com" \
  -d "admin_token=CHANGE_THIS_TO_YOUR_RANDOM_ADMIN_TOKEN_BEFORE_DEPLOYMENT" \
  "https://script.google.com/macros/s/BASE_URL/exec"
```

Expected: `{ "status": "created", "submissionId": "TEST-001", "token": "..." }`. Copy the returned `token` for the claim link.

### Test 8 — Admin: update a submission

```bash
curl -s -X POST \
  -d "action=admin_update_submission" \
  -d "id=TEST-001" \
  -d "photoIds=photo1,photo2" \
  -d "status=linked" \
  -d "admin_token=CHANGE_THIS_TO_YOUR_RANDOM_ADMIN_TOKEN_BEFORE_DEPLOYMENT" \
  "https://script.google.com/macros/s/BASE_URL/exec"
```

Expected: `{ "status": "updated", "id": "TEST-001" }`.

### Test 9 — Admin: list contributions

```bash
curl -s "https://script.google.com/macros/s/BASE_URL/exec?action=admin_list_contributions&admin_token=CHANGE_THIS_TO_YOUR_RANDOM_ADMIN_TOKEN_BEFORE_DEPLOYMENT"
```

Expected: JSON with `contributions` array.

### Test 10 — Admin: update a contribution status

```bash
curl -s -X POST \
  -d "action=admin_update_contribution" \
  -d "id=CONTRIBUTION_ID" \
  -d "status=approved" \
  -d "admin_token=CHANGE_THIS_TO_YOUR_RANDOM_ADMIN_TOKEN_BEFORE_DEPLOYMENT" \
  "https://script.google.com/macros/s/BASE_URL/exec"
```

Expected: `{ "status": "updated", "id": "CONTRIBUTION_ID" }`.

### Test 11 — Admin: delete a contribution

```bash
curl -s -X POST \
  -d "action=admin_delete_contribution" \
  -d "id=CONTRIBUTION_ID" \
  -d "admin_token=CHANGE_THIS_TO_YOUR_RANDOM_ADMIN_TOKEN_BEFORE_DEPLOYMENT" \
  "https://script.google.com/macros/s/BASE_URL/exec"
```

Expected: `{ "status": "deleted", "id": "CONTRIBUTION_ID" }`.

## Seed row — create one test submission to validate the full flow

Run the admin create call above (Test 7) with a fresh id like `TEST-001`. That returns a `token`. Then use that token in the claim link and in Test 3 to verify end-to-end.

## Important notes

- The `/exec` URL works once deployed. Every code change requires a **New deployment** (version) and you must use that new URL, or re-deploy to the same deployment ID.
- `ADMIN_TOKEN` is hardcoded and is a plain capability key. Change it to a long random string before deployment. Do not log it or expose it in public-facing code.
- The claim link format is: `https://bayarddevries.github.io/shoebox-v2/?claim=<TOKEN>`.
- POST must be form-encoded (`application/x-www-form-urlencoded`). Do NOT send JSON from the browser — Apps Script web apps do not respond to CORS preflight (`OPTIONS`). The frontend fetch must use `fetch(url, { method: 'POST', body: new URLSearchParams({...}) })` (which sends `application/x-www-form-urlencoded` automatically) rather than `body: JSON.stringify({...})` with `Content-Type: application/json`.
- Tokens are stored in the Submissions tab in the `token` column. They are >=16 char random strings generated by `Utilities.getUuid()`. They are not PII and are the only thing exposed in a claim link.
