#!/usr/bin/env python3
"""Create the 'Consent Register' tab in the Shoebox Submitter Metadata sheet
and load all 544 rows from consent-register-import.csv."""

import json
import csv
import os
import sys

SPREADSHEET_ID = "1DSu7arfh8xnQmYm7JIphImPjBhmeCrADAD8AOhpCy9g"
SHEET_NAME = "Consent Register"
CSV_PATH = "/home/bayarddevries/shoebox-v2/scripts/consent-register-import.csv"

TOKEN_PATHS = [
    "/home/bayarddevries/Hermes Agent State/google_token.json",
    "/home/bayarddevries/.hermes/google_token.json",
]

def get_valid_token():
    """Load a token file, refresh if needed, return Credentials."""
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request

    for tp in TOKEN_PATHS:
        if not os.path.exists(tp):
            continue
        try:
            with open(tp) as f:
                tok_data = json.load(f)
            # These tokens use 'token' (not 'access_token') as the key
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
                print(f"Refreshing expired token from {tp}...")
                creds.refresh(Request())
                # Save the refreshed token back with same key names
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

token, token_path_used = get_valid_token()

if not token:
    print("ERROR: No valid Google OAuth token found.")
    print(f"Checked: {TOKEN_PATHS}")
    sys.exit(1)

print(f"Using token from: {token_path_used}")
print(f"Token scopes: {token.scopes}")

try:
    from googleapiclient.discovery import build
except ImportError:
    print("ERROR: google-api-python-client not installed. Run: pip install google-api-python-client")
    sys.exit(1)

sheets = build("sheets", "v4", credentials=token)
spreadsheet = sheets.spreadsheets()
print(f"Connected to Sheets API. Spreadsheet: {SPREADSHEET_ID}")

# ── Step 1: Check existing sheets ──
print("\n=== Existing sheets ===")
result = spreadsheet.get(spreadsheetId=SPREADSHEET_ID, includeGridData=False).execute()
existing_sheets = result.get("sheets", [])
for s in existing_sheets:
    props = s.get("properties", {})
    print(f"  - {props.get('title')} (gid={props.get('sheetId')})")

# ── Step 2: Create Consent Register tab if it doesn't exist ──
existing_titles = [s["properties"]["title"] for s in existing_sheets]

if SHEET_NAME in existing_titles:
    print(f"\nSheet '{SHEET_NAME}' already exists — will clear and reload it.")
    # Find the sheetId
    target_sheet = next(s for s in existing_sheets if s["properties"]["title"] == SHEET_NAME)
    sheet_id = target_sheet["properties"]["sheetId"]
    requests = [
        {
            "updateCells": {
                "start": {
                    "sheetId": sheet_id,
                    "rowIndex": 0,
                    "columnIndex": 0,
                },
                "rows": [
                    {
                        "values": [
                            {"userEnteredValue": {"stringValue": ""}}
                            for _ in range(20)  # clear at least 20 columns
                        ]
                    }
                    for _ in range(600)  # clear at least 600 rows
                ],
                "fields": "userEnteredValue",
            }
        }
    ]
else:
    print(f"\nCreating sheet '{SHEET_NAME}'...")
    requests = [
        {
            "addSheet": {
                "properties": {
                    "title": SHEET_NAME,
                }
            }
        }
    ]

batch_update = spreadsheet.batchUpdate(
    spreadsheetId=SPREADSHEET_ID,
    body={"requests": requests}
).execute()

if SHEET_NAME not in existing_titles:
    # Re-read to get the new sheetId
    result = spreadsheet.get(spreadsheetId=SPREADSHEET_ID, includeGridData=False).execute()
    target_sheet = next(s for s in result["sheets"] if s["properties"]["title"] == SHEET_NAME)
    sheet_id = target_sheet["properties"]["sheetId"]
    print(f"Created sheet '{SHEET_NAME}' (sheetId={sheet_id})")
else:
    sheet_id = target_sheet["properties"]["sheetId"]
    print(f"Using existing sheet '{SHEET_NAME}' (sheetId={sheet_id})")

# ── Step 3: Read CSV ──
print(f"\nReading CSV: {CSV_PATH}")
with open(CSV_PATH, newline="", encoding="utf-8") as f:
    reader = csv.reader(f)
    rows = list(reader)

# Filter out comment lines (start with #) and blank lines
data_rows = [r for r in rows if r and not r[0].startswith("#")]

print(f"CSV rows: {len(rows)} total, {len(data_rows)} data rows")

if not data_rows:
    print("ERROR: No data rows found in CSV")
    sys.exit(1)

# First row should be the header
header = data_rows[0]
data = data_rows[1:]

print(f"Header ({len(header)} cols): {header}")
print(f"Data rows: {len(data)}")

# ── Step 4: Write to sheet ──
# Format: first row = header, then all data rows
values = [header] + data

print(f"\nWriting {len(values)} rows to sheet '{SHEET_NAME}'...")
try:
    spreadsheet.values().update(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{SHEET_NAME}'!A1",
        valueInputOption="RAW",
        body={"values": values},
    ).execute()
    print(f"Done. Wrote {len(values)} rows ({len(values)-1} data rows + header).")
except Exception as e:
    print(f"Error writing values: {e}")
    sys.exit(1)

# ── Step 5: Set column widths ──
print("\nSetting column widths...")
col_widths = {
    "A": 12,   # photoId
    "B": 50,   # src (filename)
    "C": 22,   # submitter
    "D": 12,   # submissionId
    "E": 28,   # consentRef
    "F": 14,   # consentVersion
    "G": 22,   # consentStatus
    "H": 14,   # signedDate
    "I": 14,   # mmfVNumber
    "J": 8,    # tier
    "K": 50,   # evidence
    "L": 40,   # notes
    "M": 14,   # lastUpdated
    "N": 16,   # updatedBy
}

# Build A1 notation for column range
col_range = ",".join(f"'{SHEET_NAME}'!{col}1:{col}" for col in col_widths)
# We need to update dimensions via batchUpdate
dimension_requests = []
for col_letter, width in col_widths.items():
    dimension_requests.append({
        "updateDimensionProperties": {
            "range": {
                "sheetId": sheet_id,
                "dimension": "COLUMNS",
                "startIndex": ord(col_letter) - ord("A"),
                "endIndex": ord(col_letter) - ord("A") + 1,
            },
            "properties": {
                "pixelSize": width,
            },
            "fields": "pixelSize",
        }
    })

if dimension_requests:
    spreadsheet.batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={"requests": dimension_requests}
    ).execute()
    print("Column widths set.")

# ── Step 6: Freeze header row ──
print("Freezing header row...")
spreadsheet.batchUpdate(
    spreadsheetId=SPREADSHEET_ID,
    body={
        "requests": [
            {
                "updateSheetProperties": {
                    "properties": {
                        "sheetId": sheet_id,
                        "gridProperties": {
                            "frozenRowCount": 1,
                        },
                    },
                    "fields": "gridProperties.frozenRowCount",
                }
            }
        ]
    }
).execute()
print("Header row frozen.")

# ── Step 7: Add data validation dropdown for consentStatus (column G) ──
print("Adding consentStatus dropdown (column G)...")
statuses = [
    "consent_on_file",
    "consent_unknown",
    "retro_consent_pending",
    "retro_consent_confirmed",
    "no_consent_do_not_display",
]

dropdown_request = {
    "addConditionalFormatRule": {
        "rule": {
            "ranges": [
                {
                    "sheetId": sheet_id,
                    "startRowIndex": 1,  # skip header
                    "startColumnIndex": 6,  # column G (0-indexed)
                    "endColumnIndex": 7,
                }
            ],
            "booleanRule": {
                "condition": {
                    "type": "ONE_OF_LIST",
                    "values": [{"userEnteredValue": s} for s in statuses]
                },
                "format": {
                    "backgroundColor": {"red": 0.95, "green": 0.95, "blue": 0.95},
                },
            },
        },
        "index": 0,
    }
}

# Simpler: data validation
data_validation_request = {
    "addDataValidation": {
        "rule": {
            "condition": {
                "type": "ONE_OF_LIST",
                "values": [{"userEnteredValue": s} for s in statuses]
            },
            "inputMessage": "Select a consent status",
            "strict": True,
        },
        "range": {
            "sheetId": sheet_id,
            "startRowIndex": 1,
            "startColumnIndex": 6,
            "endColumnIndex": 7,
        },
    }
}

try:
    spreadsheet.batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={"requests": [data_validation_request]}
    ).execute()
    print("ConsentStatus dropdown added to column G.")
except Exception as e:
    print(f"Note: Could not add dropdown (may already exist): {e}")

# ── Final summary ──
print("\n" + "="*60)
print(f"CONSENT REGISTER TAB CREATED")
print(f"Spreadsheet: {SPREADSHEET_ID}")
print(f"Tab: {SHEET_NAME}")
print(f"Rows: {len(values)} ({len(data)} photos + header)")
print(f"Columns: {len(header)}")
print(f"Status dropdown: column G")
print("="*60)
