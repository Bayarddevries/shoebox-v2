#!/usr/bin/env node
/**
 * test_scripts.mjs — fixture test for the admin-side scripts.
 *
 * Proves:
 *   (a) approved contributions are merged into the manifest
 *       (fill where Lightroom is empty AND override where approved)
 *   (b) pending contributions are NOT merged (raw submitter text never lands)
 *   (c) Lightroom export contains ONLY approved rows (review-gated)
 *   (d) drop-zone -> manifest photo linking works, keyed by submitter
 *       COLLECTION KEY (folder name = submission key, e.g. Dumas-M)
 *
 * Run: node scripts/test_scripts.mjs
 */

import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

import { matchSubmittersToManifest, normalizeSubmitterFilename } from './link_submissions.js'
import { mergeContributions } from './merge_contributions.js'
import { exportLightroom, LIGHTROOM_COLUMNS } from './export_lightroom.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Tiny test harness ──────────────────────────────────────────────────────
const results = []
function assert(name, cond) {
  results.push({ name, pass: !!cond })
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`)
}

// ─── Fixtures ───────────────────────────────────────────────────────────────
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shoebox-test-'))
const dropZone = path.join(tmp, '2026-08-29-rm')
const submitterDir = path.join(dropZone, 'Dumas-M')
fs.mkdirSync(submitterDir, { recursive: true })

// Submitter scan files, prefixed with the submitter's collection key
// (folder name IS the submission key; no bag naming).
fs.writeFileSync(path.join(submitterDir, 'Dumas-M_01.jpg'), 'x')
fs.writeFileSync(path.join(submitterDir, 'Dumas-M_02.jpg'), 'x')
fs.writeFileSync(path.join(submitterDir, 'Dumas-M_99.jpg'), 'x') // no manifest match

// Temp manifest fixture (photos mirroring the real manifest shape).
const manifestPhotos = [
  {
    id: 'photo_1',
    src: 'assets/shoebox/photos/Dumas-M_01.jpg',
    title: 'First Communion',
    caption: 'Original Lightroom caption for photo one',
    description: 'Original Lightroom caption for photo one',
    people: '',
    location: '',
    community: null,
    province: null,
    keywords: [],
    year: null,
  },
  {
    id: 'photo_2',
    src: 'assets/shoebox/photos/Dumas-M_02.jpg',
    title: 'River Lot 2',
    caption: 'Original Lightroom caption for photo two',
    description: 'Original Lightroom caption for photo two',
    people: 'Curator Name',
    location: 'Selkirk, Manitoba, Canada',
    community: 'Selkirk',
    province: 'Manitoba',
    keywords: ['river'],
    year: 1950,
  },
]

// Temp contributions fixture: one approved, one pending.
const contributions = [
  {
    id: 'c-1',
    photoId: 'photo_1',
    submitterName: 'Marie Dumas',
    people: 'Marie Laliberte',
    location: 'St. Boniface, Manitoba, Canada',
    community: 'St. Boniface',
    province: 'Manitoba',
    country: 'Canada',
    dateYear: 1925,
    dateEra: '1925-1950',
    occasion: 'Wedding',
    caption: 'Admin-reviewed caption for photo one',
    attribution: 'Courtesy of the Mercredi Family Collection',
    keywords: ['wedding', 'community'],
    status: 'approved',
    submittedAt: '2026-08-25T18:00:00.000Z',
    reviewedAt: '2026-08-26T14:30:00.000Z',
    reviewedBy: 'admin',
  },
  {
    id: 'c-2',
    photoId: 'photo_2',
    submitterName: 'John Doe',
    people: 'John Doe',
    location: 'Winnipeg, Manitoba, Canada',
    community: 'Winnipeg',
    caption: 'RAW SUBMITTER TEXT THAT MUST NEVER SHIP TO LIGHTROOM',
    keywords: ['family'],
    status: 'pending',
    submittedAt: '2026-08-26T09:00:00.000Z',
  },
]

const clone = (arr) => JSON.parse(JSON.stringify(arr))

// ─── 1. Link Photos: submitter key drop-zone -> manifest photoIds ───────────
console.log('\n[1] link_submissions.js — submitter-key -> manifest matching')
{
  const result = matchSubmittersToManifest(dropZone, manifestPhotos)
  const ids = result.mapping['Dumas-M']
  assert('Dumas-M maps to [photo_1, photo_2]', JSON.stringify(ids) === JSON.stringify(['photo_1', 'photo_2']))
  assert('submitter key prefix stripped (Dumas-M_01.jpg -> 01)', normalizeSubmitterFilename('Dumas-M_01.jpg', 'Dumas-M') === '01')
  assert('unmatched file reported (Dumas-M_99.jpg)', result.details['Dumas-M'].unmatchedFiles.includes('Dumas-M_99.jpg'))
  assert('summary matched=2 unmatched=1', result.summary.matched === 2 && result.summary.unmatched === 1)
}

// ─── 2. Merge: approved applied, pending NOT ────────────────────────────────
console.log('\n[2] merge_contributions.js — review-gated manifest merge')
{
  const photos = clone(manifestPhotos)
  mergeContributions(photos, contributions)

  const p1 = photos.find((p) => p.id === 'photo_1')
  const p2 = photos.find((p) => p.id === 'photo_2')

  // (a) approved merge applied — override existing Lightroom caption + fill empties
  assert(
    'approved: caption overridden to admin-reviewed value',
    p1.caption === 'Admin-reviewed caption for photo one' &&
      p1.description === 'Admin-reviewed caption for photo one',
  )
  assert(
    'approved: people/location/community/province filled where Lightroom empty',
    p1.people === 'Marie Laliberte' &&
      p1.community === 'St. Boniface' &&
      p1.province === 'Manitoba' &&
      p1.location === 'St. Boniface, Manitoba, Canada',
  )
  assert(
    'approved: keywords and year merged',
    JSON.stringify(p1.keywords) === JSON.stringify(['wedding', 'community']) && p1.year === 1925,
  )

  // (b) pending NOT applied — raw submitter text must not land
  assert(
    'pending: caption NOT applied (Lightroom value kept)',
    p2.caption === 'Original Lightroom caption for photo two' &&
      p2.caption !== 'RAW SUBMITTER TEXT THAT MUST NEVER SHIP TO LIGHTROOM',
  )
  assert(
    'pending: no field touched on photo_2',
    p2.people === 'Curator Name' && p2.community === 'Selkirk' && p2.year === 1950,
  )

  // no-op robustness
  const photos2 = clone(manifestPhotos)
  mergeContributions(photos2, [])
  assert('empty contributions list leaves manifest untouched', JSON.stringify(photos2) === JSON.stringify(manifestPhotos))
}

// ─── 3. Export: only approved rows, review-gated ────────────────────────────
console.log('\n[3] export_lightroom.js — review-gated Lightroom export')
{
  const outDir = path.join(tmp, 'output')
  const { csvPath, jsonPath, count } = await exportLightroom(contributions, outDir)

  const csv = fs.readFileSync(csvPath, 'utf8')
  const rows = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))

  assert('export has exactly 1 approved row (pending excluded)', count === 1 && rows.length === 1)
  assert('approved caption present in CSV', csv.includes('Admin-reviewed caption for photo one'))
  assert('raw submitter text absent from CSV', !csv.includes('RAW SUBMITTER TEXT THAT MUST NEVER SHIP TO LIGHTROOM'))
  assert('raw submitter text absent from JSON', !JSON.stringify(rows).includes('RAW SUBMITTER TEXT THAT MUST NEVER SHIP TO LIGHTROOM'))
  assert(
    'CSV header row matches Lightroom columns',
    csv.startsWith(LIGHTROOM_COLUMNS.join(',')),
  )
  assert('CSV row carries photoId for file matching', rows[0].photoId === 'photo_1')
  assert('CSV row carries admin-edited caption', rows[0].Caption === 'Admin-reviewed caption for photo one')
}

// ─── Summary ────────────────────────────────────────────────────────────────
console.log('\n──────────────────────────────────────────────')
const failed = results.filter((r) => !r.pass)
console.log(`Results: ${results.length - failed.length}/${results.length} passed`)
if (failed.length) {
  for (const f of failed) console.log(`  FAILED: ${f.name}`)
  console.log(`Temp fixtures kept at: ${tmp}`)
  process.exit(1)
}
console.log('ALL TESTS PASSED')
fs.rmSync(tmp, { recursive: true, force: true })
process.exit(0)
