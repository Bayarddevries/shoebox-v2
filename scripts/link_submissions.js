#!/usr/bin/env node
/**
 * link_submissions.js — 'Link Photos' backing logic.
 *
 * Given an event drop-zone folder (one subfolder per submitter, keyed by the
 * submitter's COLLECTION KEY derived from their consent record, e.g.
 *   archive/scans/2026-08-29-rm/Dumas-M/  with files like Dumas-M_01.jpg
 * or files prefixed Dumas-M_01.jpg directly), and the photo manifest, this
 * matches each submitter folder's scan files to manifest entries by filename
 * and reports submitterKey -> [manifest photoIds] plus a match summary.
 *
 * The join key is the COLLECTION KEY: one submitter = one folder = one
 * submission. The folder name IS the submission key — this script is fully
 * generic and assumes NO bag / "SM-" / "RM-" naming.
 *
 * Matching rule: a submitter's filename is normalized by stripping the
 * submitter-key prefix (e.g. "Dumas-M_" -> ""), then compared
 * case-insensitively against the manifest src basenames. Files with no
 * prefix are compared as-is. Works for both Lightroom-kept scan names
 * ("Dumas-M_01.jpg") and descriptive final names ("First Communion.jpg").
 *
 * This script is READ-ONLY: it reports matches. Persisting photoIds onto a
 * submission row is done by the admin API (server/admin-api.ts).
 *
 * Usage:
 *   node scripts/link_submissions.js [DROP_ZONE] [MANIFEST] [--json] [--dry-run]
 *   DROP_ZONE = event drop-zone folder containing submitter subfolders (required)
 *   MANIFEST  = path to manifest.json (default: public/assets/shoebox/manifest.json)
 *   --dry-run = do not write anything (default, and the only mode; kept for clarity)
 *   --json    = machine-readable JSON output instead of the human summary
 *
 * Exports:
 *   matchSubmittersToManifest(dropZoneDir, manifestPhotos) -> result object
 *   normalizeSubmitterFilename(filename, submitterKey)     -> normalized stem
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|tiff?)$/i

// Generic leading submission-key token, e.g. "Dumas-M_" (LastName-Initial),
// "C-0123_" (consent number), "SM-001_" (legacy). Deliberately not tied to
// any project's bag naming: letters/digits, dash, letters/digits, separator.
const LEADING_KEY_TOKEN = /^[a-z0-9]+-[a-z0-9]+[_-\s]*/i

/**
 * Normalize a submitter scan filename for comparison against manifest src
 * basenames. Strips the submitter-key prefix ("Dumas-M_01.jpg" -> "01.jpg"),
 * then the extension, then lowercases for a case-insensitive compare.
 * @returns {string} normalized stem (lowercase, no extension)
 */
export function normalizeSubmitterFilename(filename, submitterKey) {
  let base = path.basename(filename)
  base = base.replace(IMAGE_EXT, '')
  // Strip the submitter's own key prefix: "Dumas-M_" / "Dumas-M-" / "Dumas-M "
  if (submitterKey) {
    const escaped = submitterKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    base = base.replace(new RegExp(`^${escaped}[_\\-\\s]*`, 'i'), '')
  }
  // Fall back to a generic leading key token if none matched cleanly.
  base = base.replace(LEADING_KEY_TOKEN, '')
  return base.trim().toLowerCase()
}

/**
 * Match every submitter subfolder in a drop-zone folder against the manifest.
 * The folder name is the submitter's collection key.
 * @param {string} dropZoneDir path containing one subfolder per submitter
 * @param {Array<object>} manifestPhotos manifest.photos array
 * @returns {object} { event, mapping, details, summary }
 */
export function matchSubmittersToManifest(dropZoneDir, manifestPhotos) {
  // Index manifest src basenames so submitter files can be matched after their
  // key prefix is stripped. Keys added per photo (all lowercase):
  //   1. full basename            "Dumas-M_01.jpg"
  //   2. stem (no extension)      "dumas-m_01"
  //   3. key-stripped stem        "01"
  const byStem = new Map()
  for (const photo of manifestPhotos) {
    const srcBase = path.basename(photo.src || '')
    const stem = srcBase.toLowerCase().replace(IMAGE_EXT, '')
    const tokenless = stem.replace(LEADING_KEY_TOKEN, '')
    byStem.set(srcBase.toLowerCase(), photo)
    byStem.set(stem, photo)
    byStem.set(tokenless, photo)
  }

  const submitterDirs = fs
    .readdirSync(dropZoneDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()

  const mapping = {}
  const details = {}
  let totalFiles = 0
  let totalMatched = 0
  let totalUnmatched = 0

  for (const submitterKey of submitterDirs) {
    const folderPath = path.join(dropZoneDir, submitterKey)
    const files = fs.readdirSync(folderPath).filter((f) => IMAGE_EXT.test(f)).sort()

    const matched = []
    const matchedFiles = []
    const unmatchedFiles = []

    for (const file of files) {
      const stem = normalizeSubmitterFilename(file, submitterKey)
      const photo = byStem.get(stem) || byStem.get(file.toLowerCase())
      if (photo) {
        matched.push(photo.id)
        matchedFiles.push(file)
      } else {
        unmatchedFiles.push(file)
      }
    }

    // Deterministic, deduped photoIds (a stem could match multiple index keys once).
    const photoIds = [...new Set(matched)]
    mapping[submitterKey] = photoIds
    details[submitterKey] = {
      folder: folderPath,
      fileCount: files.length,
      imageFiles: files,
      matchedFiles,
      photoIds,
      unmatchedFiles,
      matchedCount: photoIds.length,
      unmatchedCount: unmatchedFiles.length,
    }
    totalFiles += files.length
    totalMatched += photoIds.length
    totalUnmatched += unmatchedFiles.length
  }

  return {
    event: path.basename(dropZoneDir),
    manifest: 'provided',
    mapping,
    details,
    summary: {
      submitters: submitterDirs.length,
      files: totalFiles,
      matched: totalMatched,
      unmatched: totalUnmatched,
    },
  }
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2)
  const flags = { json: false, dryRun: true }
  const positionals = args.filter((a) => {
    if (a === '--json') { flags.json = true; return false }
    if (a === '--dry-run' || a === '--commit') { flags.dryRun = true; return false }
    return true
  })

  const dropZoneDir = positionals[0]
  const manifestPath = positionals[1] || path.join(PROJECT_ROOT, 'public/assets/shoebox/manifest.json')

  if (!dropZoneDir || !fs.existsSync(dropZoneDir)) {
    console.error('Usage: node scripts/link_submissions.js [DROP_ZONE] [MANIFEST] [--json] [--dry-run]')
    console.error('  DROP_ZONE = event drop-zone folder containing submitter subfolders (e.g. archive/scans/2026-08-29-rm)')
    console.error('  MANIFEST  = path to manifest.json (default: public/assets/shoebox/manifest.json)')
    process.exit(2)
  }
  if (!fs.existsSync(manifestPath)) {
    console.error(`Manifest not found: ${manifestPath}`)
    process.exit(2)
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const result = matchSubmittersToManifest(dropZoneDir, manifest.photos || [])

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  console.log(`Link Photos — drop zone: ${dropZoneDir}`)
  console.log(`  Submitters: ${result.summary.submitters}  Files: ${result.summary.files}  Matched: ${result.summary.matched}  Unmatched: ${result.summary.unmatched}`)
  for (const [submitterKey, det] of Object.entries(result.details)) {
    console.log(`  ${submitterKey} — ${det.matchedCount}/${det.fileCount} photos matched`)
    if (det.photoIds.length) console.log(`      -> ${det.photoIds.join(', ')}`)
    if (det.unmatchedFiles.length) console.log(`      ! unmatched: ${det.unmatchedFiles.join(', ')}`)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
