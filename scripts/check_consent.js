#!/usr/bin/env node
'use strict';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MANIFEST_PATH = path.join(__dirname, '..', 'public', 'assets', 'shoebox', 'manifest.json');
const CSV_PATH = path.join(__dirname, 'consent-register-import.csv');
const OUTPUT_PATH = path.join(__dirname, 'consent-coverage.csv');

const COVERED_STATUSES = new Set(['consent_on_file', 'retro_consent_confirmed']);

function parseCSV(text) {
  const lines = [];
  let current = '';
  let inQuotes = false;
  for (const ch of text) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (ch === '\n' && !inQuotes) {
      lines.push(current);
      current = '';
    } else if (ch === '\r') {
      // skip
    } else {
      current += ch;
    }
  }
  if (current.length > 0) lines.push(current);

  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    const fields = parseCSVLine(lines[i]);
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (j < fields.length ? fields[j] : '');
    }
    rows.push(row);
  }
  return { headers, rows };
}

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function main() {
  // Load manifest
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch (err) {
    console.error('Failed to read manifest:', err.message);
    process.exit(1);
  }

  // Load consent register CSV
  let csvText;
  try {
    csvText = fs.readFileSync(CSV_PATH, 'utf8');
  } catch (err) {
    console.error('Failed to read consent register CSV:', err.message);
    process.exit(1);
  }

  const { rows: registerRows } = parseCSV(csvText);

  // Build lookup: photoId -> register row
  const registerByPhotoId = new Map();
  for (const row of registerRows) {
    const photoId = row.photoId && row.photoId.trim();
    if (photoId) {
      registerByPhotoId.set(photoId, row);
    }
  }

  const results = [];
  const covered = [];
  const uncoveredButAttributed = [];
  const uncoveredNoSubmitter = [];

  for (const photo of manifest.photos) {
    const photoId = photo.id;
    const src = photo.src || '';
    const submitter = photo.submitter || null;

    const registerRow = registerByPhotoId.get(photoId);
    let consentStatus = '';

    if (registerRow) {
      consentStatus = (registerRow.consentStatus || '').trim();
    }

    let category;
    let coveredFlag;

    if (!submitter) {
      category = 'uncovered-no-submitter';
      coveredFlag = false;
    } else if (consentStatus === '') {
      // Row exists in register but consentStatus is blank — attributed but not yet reviewed
      category = 'uncovered-but-attributed';
      coveredFlag = false;
    } else if (COVERED_STATUSES.has(consentStatus)) {
      category = 'covered';
      coveredFlag = true;
    } else {
      category = 'uncovered-but-attributed';
      coveredFlag = false;
    }

    results.push({
      photoId,
      src,
      submitter: submitter || '',
      consentStatus,
      covered: coveredFlag,
      category
    });

    if (category === 'covered') {
      covered.push(results[results.length - 1]);
    } else if (category === 'uncovered-but-attributed') {
      uncoveredButAttributed.push(results[results.length - 1]);
    } else {
      uncoveredNoSubmitter.push(results[results.length - 1]);
    }
  }

  // Print counts
  console.log('=== Consent Coverage Report ===');
  console.log(`Total photos in manifest: ${manifest.photos.length}`);
  console.log(`Covered (consent_on_file / retro_consent_confirmed): ${covered.length}`);
  console.log(`Uncovered but attributed (has submitter, consent not confirmed): ${uncoveredButAttributed.length}`);
  console.log(`Uncovered no submitter (no submitter in manifest): ${uncoveredNoSubmitter.length}`);
  console.log('');

  // Print first 10 uncovered-but-attributed
  if (uncoveredButAttributed.length > 0) {
    console.log('--- First 10 Uncovered but Attributed ---');
    for (let i = 0; i < Math.min(10, uncoveredButAttributed.length); i++) {
      const r = uncoveredButAttributed[i];
      console.log(`  ${r.photoId} | ${r.src} | ${r.submitter} | ${r.consentStatus || '(blank)'}`);
    }
    console.log('');
  }

  // Print first 10 uncovered-no-submitter
  if (uncoveredNoSubmitter.length > 0) {
    console.log('--- First 10 Uncovered No Submitter ---');
    for (let i = 0; i < Math.min(10, uncoveredNoSubmitter.length); i++) {
      const r = uncoveredNoSubmitter[i];
      console.log(`  ${r.photoId} | ${r.src} | ${r.submitter || '(none)'} | ${r.consentStatus || '(blank)'}`);
    }
    console.log('');
  }

  // Write CSV
  const csvLines = ['photoId,src,submitter,consentStatus,covered'];
  for (const r of results) {
    const srcEscaped = '"' + r.src.replace(/"/g, '""') + '"';
    const submitterEscaped = '"' + r.submitter.replace(/"/g, '""') + '"';
    csvLines.push([r.photoId, srcEscaped, submitterEscaped, r.consentStatus, r.covered ? 'true' : 'false'].join(','));
  }

  try {
    fs.writeFileSync(OUTPUT_PATH, csvLines.join('\n') + '\n', 'utf8');
    console.log(`Written: ${OUTPUT_PATH} (${results.length} rows)`);
  } catch (err) {
    console.error('Failed to write output CSV:', err.message);
    process.exit(1);
  }
}

main();
