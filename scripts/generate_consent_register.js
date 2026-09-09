#!/usr/bin/env node
/**
 * generate_consent_register.js — Generate consent-register-import.csv from manifest.
 * Outputs a CSV with one row per photo, consentStatus left blank for manual review.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const MANIFEST_PATH = path.join(__dirname, '..', 'public', 'assets', 'shoebox', 'manifest.json');
const OUTPUT_PATH   = path.join(__dirname, 'consent-register-import.csv');

const headers = [
  'photoId', 'src', 'submitter', 'submissionId', 'consentRef',
  'consentVersion', 'consentStatus', 'signedDate', 'mmfVNumber',
  'tier', 'evidence', 'notes', 'lastUpdated', 'updatedBy'
];

function quoteCSV(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const photos = manifest.photos || [];

const lines = [headers.join(',')];

for (const photo of photos) {
  const row = [
    photo.id || '',
    photo.src || '',
    photo.submitter || '',
    '', // submissionId
    '', // consentRef
    'V3', // consentVersion
    '', // consentStatus
    '', // signedDate
    '', // mmfVNumber
    '', // tier
    '', // evidence
    '', // notes
    '', // lastUpdated
    '', // updatedBy
  ];
  lines.push(row.map(quoteCSV).join(','));
}

// Write with comment header
const commentHeader = [
  '# Consent Register Import CSV',
  '#',
  '# Purpose: Import into Google Sheet \'Shoebox Submitter Metadata\' → \'Consent Register\' tab.',
  '#',
  '# Import process:',
  '# 1. Open the Google Sheet \'Shoebox Submitter Metadata\'.',
  '# 2. Go to the \'Consent Register\' tab.',
  '# 3. Select row 1 (the header row) and delete all existing data rows below it (keep the header).',
  '# 4. From the menu: File → Import → Upload → select this CSV file.',
  '# 5. Choose "Insert new sheet(s)" or "Replace spreadsheet" depending on your needs.',
  '#    - For a fresh import: "Replace spreadsheet" (careful — this wipes the sheet).',
  '#    - For appending: import into a new tab, then copy/paste rows into \'Consent Register\'.',
  '# 6. After import, verify row count = ' + photos.length + ' data rows + 1 header = ' + (photos.length + 1) + ' total.',
  '# 7. Do NOT overwrite the header row — the first line of this CSV is the column header.',
  '#',
  '# Notes:',
  '# - consentStatus is left blank for all rows. Bayard fills these by reviewing paper forms.',
  '# - consentVersion defaults to V3 (MMF V# field, blank year).',
  '# - submissionId is a proposed ID (first-initial + sequence); confirm with each submitter.',
  '# - Scanned PDFs live in RRMNHC OneDrive; hardcopies in Bayard\'s desk.',
  '# - Last updated: 2026-09-04',
  '# - Generated from: shoebox-v2/public/assets/shoebox/manifest.json',
  '#',
  ''
];

fs.writeFileSync(OUTPUT_PATH, commentHeader.join('\n') + lines.join('\n') + '\n', 'utf-8');
console.log(`Generated ${OUTPUT_PATH}: ${lines.length - 1} data rows`);
