# Shoebox Consent Coverage — Quick Stats

**As of:** 2026-09-09 (after Lightroom export + consent register sync)

## Headline
544 photos from 27 submitters. **437 photos (80.3%) backed by documented consent**, covering **26 of 27 submitters in full**.

## Breakdown
| Category | Photos |
|---|---|
| Total photos | 544 |
| Signed consent form (consent_on_file) | 347 |
| Verbal/retro consent (retro_consent_confirmed) | 90 |
| **Total with consent** | **437 (80.3%)** |
| Without consent | 107 |

## The 107 without consent
- 89 unattributed legacy photos (no submitter identified)
- 18 Pat Dejarlais photos (submitter known, consent not obtained)

## Submitter-level view
- 27 unique submitters with photos
- 26 fully consent-covered (100% of their photos)
- 1 with zero coverage: **Pat Dejarlais** (18 photos)

## Strongest one-liner
> 544 photos from 27 submitters; 437 photos (80%) have documented consent, covering 26 of 27 submitters in full.

## How to regenerate
```bash
cd ~/shoebox-v2
# Consent register lives at: scripts/consent-register-import.csv
# (also mirrored live in the Shoebox Google Sheet, Consent Register tab)
```
Numbers come from the consentStatus column: `consent_on_file` + `retro_consent_confirmed` = covered.
