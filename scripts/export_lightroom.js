#!/usr/bin/env node
/**
 * export_lightroom.js — review-gated Lightroom export.
 *
 * Reads public/assets/shoebox/contributions.json and exports ONLY rows whose
 * status === 'approved' as both a CSV and a JSON file with Lightroom
 * import-compatible columns:
 *
 *   Title, Caption, Date Created, Location, City, Province, Country,
 *   Copyright, Keywords, Person names, photoId
 *
 * REVIEW GATE (HARD requirement): pending / declined / reviewed-but-not-
 * approved rows are excluded entirely. The caption that ships here is the
 * single reviewed field from the contribution row — the admin edited it before
 * the row was approved, so raw submitter-only text never reaches Lightroom.
 * The photoId column lets Lightroom rows be matched back to the photo files.
 *
 * Date Created is emitted as YYYY-01-01 when only a year is known, so the
 * value parses as an importable ISO date in Lightroom.
 *
 * Usage:
 *   node scripts/export_lightroom.js [CONTRIBUTIONS_FILE] [OUTPUT_DIR]
 *   CONTRIBUTIONS_FILE = path to contributions.json
 *                       (default: public/assets/shoebox/contributions.json)
 *   OUTPUT_DIR         = output directory (default: scripts/output)
 *
 * Exports:
 *   buildLightroomRows(contributions) -> array of row objects (approved only)
 *   toCsv(rows)                       -> CSV string with header row
 *   exportLightroom(contributions, outDir) -> { csvPath, jsonPath, count }
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')

export const LIGHTROOM_COLUMNS = [
  'Title',
  'Caption',
  'Date Created',
  'Location',
  'City',
  'Province',
  'Country',
  'Copyright',
  'Keywords',
  'Person names',
  'photoId',
]

/**
 * Build Lightroom rows from approved contributions only.
 * @param {Array<object>} contributions contribution rows
 * @returns {Array<object>} rows keyed by LIGHTROOM_COLUMNS
 */
export function buildLightroomRows(contributions) {
  const approved = (contributions || []).filter((c) => c && c.status === 'approved')
  return approved.map((c) => {
    const keywords = Array.isArray(c.keywords)
      ? c.keywords
      : typeof c.keywords === 'string'
        ? c.keywords.split(/[,;]/).map((k) => k.trim()).filter(Boolean)
        : []
    const caption = typeof c.caption === 'string' ? c.caption.trim() : ''
    const location =
      (typeof c.location === 'string' && c.location.trim()) ||
      [c.community, c.province, c.country].filter(Boolean).join(', ')
    const dateYear = /^\d{4}$/.test(String(c.dateYear ?? '')) ? String(c.dateYear) : ''
    return {
      Title: caption,
      Caption: caption,
      'Date Created': dateYear ? `${dateYear}-01-01` : '',
      Location: location,
      City: (c.community || '').trim(),
      Province: (c.province || '').trim(),
      Country: (c.country || '').trim(),
      Copyright: (c.attribution || '').trim(),
      Keywords: keywords.join(', '),
      'Person names': (c.people || '').trim(),
      photoId: (c.photoId || '').trim(),
    }
  })
}

/** Escape a single CSV field (quote when it contains comma, quote, or newline). */
function csvField(value) {
  const s = String(value ?? '')
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * Serialize rows to a CSV string with a header row.
 * @param {Array<object>} rows row objects keyed by LIGHTROOM_COLUMNS
 * @returns {string}
 */
export function toCsv(rows) {
  const header = LIGHTROOM_COLUMNS.join(',')
  const lines = rows.map((row) => LIGHTROOM_COLUMNS.map((col) => csvField(row[col])).join(','))
  return [header, ...lines].join('\n') + '\n'
}

/**
 * Write approved contributions to scripts/output/lightroom_export_<ts>.csv/.json.
 * @param {Array<object>} contributions contribution rows
 * @param {string} outDir output directory (default scripts/output)
 * @returns {Promise<{csvPath, jsonPath, count}>}
 */
export async function exportLightroom(contributions, outDir) {
  const dir = outDir || path.join(PROJECT_ROOT, 'scripts/output')
  fs.mkdirSync(dir, { recursive: true })

  const rows = buildLightroomRows(contributions)
  const ts = new Date().toISOString().replace(/[:.]/g, '-') // filesystem-safe timestamp
  const base = `lightroom_export_${ts}`

  const csvPath = path.join(dir, `${base}.csv`)
  const jsonPath = path.join(dir, `${base}.json`)

  fs.writeFileSync(csvPath, toCsv(rows))
  fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2) + '\n')

  return { csvPath, jsonPath, count: rows.length }
}

// ─── CLI ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const contributionsFile =
    args[0] || path.join(PROJECT_ROOT, 'public/assets/shoebox/contributions.json')
  const outDir = args[1]

  if (!fs.existsSync(contributionsFile)) {
    console.error(`Contributions file not found: ${contributionsFile}`)
    process.exit(2)
  }

  const data = JSON.parse(fs.readFileSync(contributionsFile, 'utf8'))
  const contributions = Array.isArray(data.contributions) ? data.contributions : []
  const { csvPath, jsonPath, count } = await exportLightroom(contributions, outDir)

  console.log(`Lightroom export — ${count} approved contribution(s)`)
  console.log(`  CSV:  ${csvPath}`)
  console.log(`  JSON: ${jsonPath}`)
  console.log(`  (pending/declined rows excluded — review-gated)`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
