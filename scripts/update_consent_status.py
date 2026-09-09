#!/usr/bin/env python3
"""Update consentStatus to 'consent_on_file' for submitters with confirmed forms on hand.
Also set evidence column (K) to indicate paper/digital form location.
Kim Venne Smith gets flagged for investigation (consentStatus stays blank, notes flagged)."""

import json
import csv
import sys

SPREADSHEET_ID = "1DSu7arfh8xnQmYm7JIphImPjBhmeCrADAD8AOhpCy9g"
SHEET_NAME = "Consent Register"

# Token loading with refresh (same pattern as before)
TOKEN_PATHS = [
    "/home/bayarddevries/Hermes Agent State/google_token.json",
    "/home/bayarddevries/.hermes/google_token.json",
]

def get_valid_token():
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    for tp in TOKEN_PATHS:
        if not os.path.exists(tp):
            continue
        try:
            with open(tp) as f:
                tok_data = json.load(f)
            creds = Credentials(
                token=tok_data.get("token"),
                refresh_token=tok_data.get("refresh_token"),
                token_uri=tok_data.get("token_uri", "https://oauth2.googleapis.com/token"),
                client_id=tok_data.get("client_id"),
                client_secret=tok_data.get("client_secret"),
                scopes=tok_data.get("scopes", []),
            )
            if creds and creds.valid:
                return creds, tp
            if creds and creds.expired and creds.refresh_token:
                print(f"Refreshing token from {tp}...")
                creds.refresh(Request())
                updated = {
                    "token": creds.token,
                    "refresh_token": creds.refresh_token,
                    "token_uri": tok_data.get("token_uri"),
                    "client_id": tok_data.get("client_id"),
                    "client_secret": tok_data.get("client_secret"),
                    "scopes": creds.scopes,
                    "expiry": creds.expiry.isoformat() if creds.expiry else None,
                    "type": "authorized_user",
                    "universe_domain": tok_data.get("universe_domain", "googleapis.com"),
                    "account": tok_data.get("account"),
                }
                with open(tp, "w") as f:
                    json.dump(updated, f, indent=2)
                return creds, tp
        except Exception as e:
            print(f"Error with {tp}: {e}")
    return None, None

import os
token, token_path = get_valid_token()
if not token:
    print("ERROR: No valid token. Exiting.")
    sys.exit(1)
print(f"Using token from: {token_path}")

from googleapiclient.discovery import build
sheets = build("sheets", "v4", credentials=token)
spreadsheet = sheets.spreadsheets()

# ── Confirmed consent submitters ──
# From your list: all names you sent earlier where you confirmed you have a form.
# Includes both digital scans and paper forms from your desk.
CONFIRMED_FORMS = {
    # Digital scans / OneDrive
    "Gail Hargreaves": {"form_type": "digital_scan", "evidence": "OneDrive scan on file - pending review"},
    "Wendy Sikora": {"form_type": "digital_scan", "evidence": "Two digital forms (consent_1 + consent_2) on file - pending review"},
    "Joen Hadfield": {"form_type": "digital_scan", "evidence": "Digital forms (2 PDF files, front/back) on file - pending review"},
    "Carole Zastre": {"form_type": "digital_scan", "evidence": "Adobe Scan Sep 23 2025 on file - pending review"},
    # Paper forms from desk (hardcopy)
    "Louise McQuade": {"form_type": "paper", "evidence": "Hardcopy on desk - pending review"},
    "Lynda Monkman": {"form_type": "paper", "evidence": "Hardcopy on desk - pending review"},
    "Paul Laporte": {"form_type": "paper", "evidence": "Hardcopy on desk - pending review"},
    "Richard Charpentier": {"form_type": "paper", "evidence": "Hardcopy on desk - pending review"},
    "Sheila Kim Chipman": {"form_type": "paper", "evidence": "Hardcopy on desk - pending review"},
    "Shelley Belhumeur": {"form_type": "paper", "evidence": "Hardcopy on desk - pending review"},
    "Catherine Fiedierchuk": {"form_type": "paper", "evidence": "Hardcopy on desk - pending review"},  # 0 photos matched
    "Cheryl Haas": {"form_type": "paper", "evidence": "Hardcopy on desk - pending review"},
    "Heather Keens": {"form_type": "paper", "evidence": "Hardcopy on desk - pending review"},
    "Jim Griffiths": {"form_type": "paper", "evidence": "Hardcopy on desk - pending review"},
    "James Boucher": {"form_type": "paper", "evidence": "Hardcopy on desk - pending review"},  # 0 photos matched
    "Justin Cure": {"form_type": "paper", "evidence": "Hardcopy on desk - pending review"},
    "Larry Flett": {"form_type": "paper", "evidence": "Hardcopy on desk - pending review"},
    "Lesley Keleman": {"form_type": "paper", "evidence": "Hardcopy on desk - pending review"},
    "May Hupe": {"form_type": "paper", "evidence": "Hardcopy on desk - pending review"},
    "Chandra Brown-Erlendson": {"form_type": "paper", "evidence": "Hardcopy on desk - pending review"},
    # Needs investigation - Kim Venne Smith has photos but submitter not confirmed
    "Kim Venne Smith": {"form_type": "UNKNOWN", "evidence": "Form on hand - NEEDS INVESTIGATION: photos not yet matched to submitter"},
}

# Names with NO form confirmed (leave blank)
# Alfred Anderson, Pat Dejarlais, Erynne Gilpin, Marie-Claire Granger,
# Vicki Lynne Johnstone, Bayard deVries - not on your forms list

# Names with 0 photos matched - skip updating rows for them
NO_PHOTOS = {"Zoe Steven", "Catherine Fiedierchuk", "James Boucher"}

# ── Read current sheet data ──
print(f"Reading current sheet data...")
result = spreadsheet.values().get(
    spreadsheetId=SPREADSHEET_ID,
    range=f"'{SHEET_NAME}'!A1:N1000"
).execute()
all_rows = result.get("values", [])
if not all_rows:
    print("ERROR: Sheet is empty or unreadable")
    sys.exit(1)

header = all_rows[0]
data_rows = all_rows[1:]

# Find column indices
col_map = {h: i for i, h in enumerate(header)}
print(f"Header columns: {header}")
print(f"Column map: {col_map}")

# Required columns
photoId_col = col_map["photoId"]
src_col = col_map["src"]
submitter_col = col_map["submitter"]
submissionId_col = col_map["submissionId"]
consentRef_col = col_map["consentRef"]
consentStatus_col = col_map["consentStatus"]
evidence_col = col_map["evidence"]
notes_col = col_map["notes"]

# ── Build update map ──
# For each data row, determine what to update
updated_count = 0
skipped_no_photos = 0
kim_venne_rows = 0
unchanged = 0

rows_to_update = {}  # row_index (0-based from data_rows) -> new row values

for i, row in enumerate(data_rows):
    # Pad row to 14 cols if needed
    padded = list(row) + [""] * (len(header) - len(row))
    padded = padded[:len(header)]

    photo_id = padded[photoId_col] if photoId_col < len(padded) else ""
    submitter = padded[submitter_col] if submitter_col < len(padded) else ""

    if not submitter or not submitter.strip():
        # No submitter - skip (leave blank)
        unchanged += 1
        continue

    submitter = submitter.strip()

    if submitter == "Kim Venne Smith":
        # Flag for investigation - leave consentStatus blank, set notes
        padded[notes_col] = "NEEDS INVESTIGATION: form on hand but photos not yet matched to submitter"
        kim_venne_rows += 1
        rows_to_update[i] = padded
        continue

    if submitter in NO_PHOTOS:
        # Form exists but no photos matched - still set evidence to flag it
        padded[evidence_col] = CONFIRMED_FORMS[submitter]["evidence"]
        padded[notes_col] = "Form on hand but NO photos matched in archive - needs review"
        rows_to_update[i] = padded
        skipped_no_photos += 1
        continue

    if submitter in CONFIRMED_FORMS:
        # Mark as consent_on_file
        form_info = CONFIRMED_FORMS[submitter]
        padded[consentStatus_col] = "consent_on_file"
        padded[consentRef_col] = f"{submitter}-form-on-file"
        padded[evidence_col] = form_info["evidence"]
        updated_count += 1
        rows_to_update[i] = padded
    else:
        # Not on confirmed forms list - leave blank
        unchanged += 1

print(f"\nAnalysis complete:")
print(f"  Rows to mark as consent_on_file: {updated_count}")
print(f"  Rows flagged for Kim Venne investigation: {kim_venne_rows}")
print(f"  Rows with form but no photos matched: {skipped_no_photos}")
print(f"  Rows unchanged (no submitter or no form): {unchanged}")

# ── Apply updates ──
if not rows_to_update:
    print("\nNo rows to update. Exiting.")
    sys.exit(0)

print(f"\nApplying {len(rows_to_update)} row updates (rate-limit safe)...")

# Collect which rows need updating, with their new values
# Sort by row index so we update in order
updates_sorted = sorted(rows_to_update.items())

# Write in batches of 10 rows with small delays to avoid 429
BATCH_SIZE = 10
TOTAL_UPDATED = 0

for batch_start in range(0, len(updates_sorted), BATCH_SIZE):
    batch = updates_sorted[batch_start:batch_start + BATCH_SIZE]
    
    # For this batch, we write the full row values directly (no read-first)
    # Use batchUpdate with updateCells for each row
    requests = []
    for row_idx, new_row in batch:
        sheet_row = row_idx + 2  # 1-based row in sheet (header is row 1)
        range_str = f"'{SHEET_NAME}'!A{sheet_row}:N{sheet_row}"
        
        requests.append({
            "updateCells": {
                "start": {"sheetId": 217266980, "rowIndex": sheet_row - 1, "columnIndex": 0},
                "rows": [{"values": [{"userEnteredValue": {"stringValue": str(v) if v is not None else ""}} for v in new_row]}],
                "fields": "userEnteredValue",
            }
        })
    
    try:
        result = spreadsheet.batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body={"requests": requests}
        ).execute()
        TOTAL_UPDATED += len(batch)
        print(f"  Batch {batch_start//BATCH_SIZE + 1}: updated rows {batch[0][0]+2}-{batch[-1][0]+2} ({len(batch)} rows)")
    except Exception as e:
        print(f"  Batch {batch_start//BATCH_SIZE + 1} FAILED: {e}")
        # Retry individual rows
        for row_idx, new_row in batch:
            try:
                sheet_row = row_idx + 2
                range_str = f"'{SHEET_NAME}'!A{sheet_row}:N{sheet_row}"
                result = spreadsheet.batchUpdate(
                    spreadsheetId=SPREADSHEET_ID,
                    body={"requests": [{
                        "updateCells": {
                            "start": {"sheetId": 217266980, "rowIndex": sheet_row - 1, "columnIndex": 0},
                            "rows": [{"values": [{"userEnteredValue": {"stringValue": str(v) if v is not None else ""}} for v in new_row]}],
                            "fields": "userEnteredValue",
                        }
                    }]}
                ).execute()
                TOTAL_UPDATED += 1
            except Exception as e2:
                print(f"    Row {sheet_row} FAILED: {e2}")

    # Small delay between batches (but not too small to avoid hammering)
    if batch_start + BATCH_SIZE < len(updates_sorted):
        import time
        time.sleep(0.5)

print(f"\nTotal rows updated: {TOTAL_UPDATED}")

# ── Final summary ──
print(f"\n{'='*60}")
print(f"CONSENT STATUS UPDATE COMPLETE")
print(f"{'='*60}")
print(f"Submitters marked consent_on_file: {updated_count} rows")
print(f"Kim Venne Smith flagged: {kim_venne_rows} rows (needs investigation)")
print(f"Forms with no photos matched: {skipped_no_photos} rows")

# List which submitters got marked
marked_submitters = set()
for i, new_row in rows_to_update.items():
    submitter = new_row[submitter_col] if submitter_col < len(new_row) else ""
    if submitter and submitter.strip() and submitter.strip() != "Kim Venne Smith":
        marked_submitters.add(submitter.strip())

print(f"\nSubmitters marked as consent_on_file:")
for s in sorted(marked_submitters):
    print(f"  - {s}")

print(f"\nSubmitters NOT marked (no form on your list):")
all_sheet_submitters = set()
for row in data_rows:
    s = row[submitter_col] if submitter_col < len(row) else ""
    if s and s.strip():
        all_sheet_submitters.add(s.strip())
not_marked = all_sheet_submitters - marked_submitters - {"Kim Venne Smith"} - NO_PHOTOS
for s in sorted(not_marked):
    print(f"  - {s}")
print(f"\nNOTE: These submitters have photos but no form confirmed on your list.")
print(f"Their consentStatus remains blank - you'll need to find their forms or confirm no form exists.")

print(f"\nSHEET: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit#gid=217266980")
