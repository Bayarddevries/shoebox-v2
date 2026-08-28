#!/usr/bin/env node
/**
 * Shoebox photo intake orchestrator.
 *
 * One command that walks the whole intake pipeline safely:
 *   1. Preflight checks (exiftool on PATH, Python + PIL, unzip if needed)
 *   2. Copy image files from a source folder or .zip into
 *      public/assets/shoebox/photos/ with collision reporting
 *   3. Regenerate manifest.json (node scripts/generate_manifest.js)
 *   4. Generate thumbnails (python3 scripts/generate_thumbs.py)
 *   5. Rebuild (npm run build) so the committed build output matches
 *   6. Print a verification summary (photo / thumb / face counts)
 *
 * It NEVER commits or pushes. It prints the exact git commands to run
 * afterwards so the archive admin decides when to publish.
 *
 * Usage:
 *   node scripts/ingest_photos.js <source>                    # DRY RUN (default, writes nothing)
 *   node scripts/ingest_photos.js <source> --do-it            # actually ingest
 *   node scripts/ingest_photos.js <source> --do-it --overwrite  # allow overwriting colliding files
 *   node scripts/ingest_photos.js <source> --do-it --bun     # use bun for the build step
 *
 * <source> is a folder of images or a .zip file. Collision rules:
 *   - filename already in the archive with identical content  -> skipped (duplicate)
 *   - filename already in the archive with different content -> REPORTED as a collision;
 *     ingestion ABORTS before any write unless --overwrite is given
 *   - filename not in the archive                            -> added as new
 *
 * Test hooks (env vars, for fixtures only, not normal use):
 *   SHOEBOX_PHOTOS_DIR     override photos source dir (default public/assets/shoebox/photos)
 *   SHOEBOX_MANIFEST_OUT   override manifest output   (default public/assets/shoebox/manifest.json)
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'
import { createHash } from 'crypto'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')

// Defaults (same as generate_manifest.js so the pipeline stays consistent)
const PHOTOS_DIR = process.env.SHOEBOX_PHOTOS_DIR
  ? path.resolve(process.env.SHOEBOX_PHOTOS_DIR)
  : path.join(PROJECT_ROOT, 'public/assets/shoebox/photos')
const MANIFEST_OUT = process.env.SHOEBOX_MANIFEST_OUT
  ? path.resolve(process.env.SHOEBOX_MANIFEST_OUT)
  : path.join(PROJECT_ROOT, 'public/assets/shoebox/manifest.json')
const THUMBS_DIR = path.join(path.dirname(PHOTOS_DIR), 'thumbs')

const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i

const args = process.argv.slice(2)
const SOURCE = args.find((a) => !a.startsWith('--'))
const DO_IT = args.includes('--do-it')
const OVERWRITE = args.includes('--overwrite')
const USE_BUN = args.includes('--bun')
const ALLOW_NO_EXIFTOOL = args.includes('--allow-no-exiftool')

const isOverride = !!process.env.SHOEBOX_PHOTOS_DIR || !!process.env.SHOEBOX_MANIFEST_OUT

function fail(msg) {
  console.error(`ERROR: ${msg}`)
  process.exit(1)
}

function sha256(file) {
  const h = createHash('sha256')
  h.update(fs.readFileSync(file))
  return h.digest('hex')
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(p, out)
    else if (IMAGE_EXT.test(entry.name)) out.push(p)
  }
  return out
}

function collectSource(source) {
  const stat = fs.statSync(source)
  if (stat.isDirectory()) {
    return { files: walk(source), tempDir: null }
  }
  if (stat.isFile() && /\.zip$/i.test(source)) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shoebox-intake-'))
    execSync(`unzip -q "${source}" -d "${tempDir}"`, { stdio: 'ignore' })
    console.log(`Extracted zip to ${tempDir}`)
    return { files: walk(tempDir), tempDir }
  }
  if (stat.isFile()) {
    fail(`Unsupported source type: ${source} (use a folder or a .zip)`)
  }
  fail(`Source not found: ${source}`)
}

function resolveIntraBatchCollisions(files) {
  const byName = new Map()
  for (const f of files) {
    const name = path.basename(f)
    if (!byName.has(name)) byName.set(name, [])
    byName.get(name).push(f)
  }
  return [...byName.entries()].filter(([, v]) => v.length > 1)
}

function classify(files) {
  const existing = new Set(fs.readdirSync(PHOTOS_DIR))
  const result = { new: [], duplicate: [], collision: [] }
  for (const f of files) {
    const name = path.basename(f)
    const dest = path.join(PHOTOS_DIR, name)
    if (!existing.has(name)) {
      result.new.push({ name, src: f, dest })
      continue
    }
    const srcSize = fs.statSync(f).size
    const destSize = fs.statSync(dest).size
    if (srcSize !== destSize) {
      result.collision.push({ name, src: f, dest, srcSize, destSize })
      continue
    }
    // Same size: confirm with a hash so we do not needlessly overwrite identical files
    if (sha256(f) === sha256(dest)) {
      result.duplicate.push({ name, src: f, dest })
    } else {
      result.collision.push({ name, src: f, dest, srcSize, destSize, sameSize: true })
    }
  }
  return result
}

function preflight(zipSource) {
  const checks = []
  // exiftool is the data backbone; without it the manifest silently loses IPTC
  let exiftoolOk = false
  try {
    const ver = execSync('exiftool -ver', { encoding: 'utf8', timeout: 15000 }).trim()
    checks.push(`exiftool ${ver} on PATH (OK)`)
    exiftoolOk = true
  } catch {
    checks.push(
      'exiftool MISSING. The manifest generator would silently drop all IPTC metadata. ' +
      'Fix: add /home/bayarddevries/bin/exiftool to PATH or install exiftool.'
    )
  }
  try {
    execSync("python3 -c \"import PIL\"", { stdio: 'ignore', timeout: 20000 })
    checks.push('python3 + PIL available (thumbs OK)')
  } catch {
    checks.push('python3 + PIL MISSING. Thumbnails cannot be generated. Fix: pip install pillow')
  }
  try {
    execSync('node --version', { stdio: 'ignore', timeout: 15000 })
    checks.push('node available (manifest + build OK)')
  } catch {
    checks.push('node MISSING')
  }
  if (zipSource) {
    try {
      execSync('unzip -v >/dev/null 2>&1', { stdio: 'ignore' })
      checks.push('unzip available (OK)')
    } catch {
      checks.push('unzip MISSING. Install unzip or extract the zip by hand first.')
    }
  }
  return { checks, exiftoolOk }
}

function countImages(dir) {
  if (!fs.existsSync(dir)) return 0
  return fs.readdirSync(dir).filter((f) => IMAGE_EXT.test(f)).length
}

function printPlan(result, { checks }) {
  console.log('--- Preflight ---')
  for (const c of checks) console.log(`  ${c}`)
  console.log('')
  console.log('--- Intake plan ---')
  console.log(`  Photos dir : ${PHOTOS_DIR}`)
  console.log(`  Existing   : ${countImages(PHOTOS_DIR)} images`)
  console.log(`  Source     : ${result.new.length} new + ${result.duplicate.length} duplicate (skip) + ${result.collision.length} collision(s)`)
  if (result.new.length) {
    console.log('  New files:')
    for (const n of result.new.slice(0, 15)) console.log(`    + ${n.name}`)
    if (result.new.length > 15) console.log(`    ... and ${result.new.length - 15} more`)
  }
  if (result.duplicate.length) {
    console.log('  Identical (will skip, already in archive):')
    for (const d of result.duplicate) console.log(`    = ${d.name}`)
  }
  if (result.collision.length) {
    console.log('  COLLISIONS (same name, different content):')
    for (const c of result.collision)
      console.log(`    ! ${c.name}  (source ${c.srcSize} B vs archive ${c.destSize} B)`)
    console.log('    Action needed: re-run with --overwrite to REPLACE the archive copy,')
    console.log('    or leave the source file out if the archive copy is the good one.')
  }
}

function copyFiles(result) {
  for (const d of result.duplicate) console.log(`  = skip (identical): ${d.name}`)
  let copied = 0
  for (const n of result.new) {
    fs.copyFileSync(n.src, n.dest)
    copied++
  }
  for (const c of result.collision) {
    fs.copyFileSync(c.src, c.dest)
    console.log(`  ! overwritten: ${c.name}`)
  }
  console.log(`  Copied ${copied} new file(s).`)
}

function run(label, cmd, timeout) {
  console.log(`\n--- ${label} ---`)
  console.log(`  $ ${cmd}`)
  const out = execSync(cmd, { encoding: 'utf8', cwd: PROJECT_ROOT, timeout, maxBuffer: 64 * 1024 * 1024 })
  console.log(out.trim().split('\n').slice(-25).join('\n'))
  return out
}

function verify() {
  console.log('\n--- Verification ---')
  const photoCount = countImages(PHOTOS_DIR)
  const thumbCount = countImages(THUMBS_DIR)
  const manifestPhotoCount = fs.existsSync(MANIFEST_OUT)
    ? JSON.parse(fs.readFileSync(MANIFEST_OUT, 'utf8')).photoCount
    : null

  console.log(`  Photos on disk : ${photoCount}`)
  console.log(`  Thumbs on disk : ${thumbCount}`)
  console.log(`  Manifest count : ${manifestPhotoCount ?? 'n/a'}`)

  if (manifestPhotoCount !== null && manifestPhotoCount !== photoCount) {
    console.log('  WARNING: manifest count does not match photos dir. Re-run generate_manifest.js.')
  } else if (manifestPhotoCount !== null) {
    console.log('  OK: manifest matches photos dir.')
  }
  if (thumbCount < photoCount) {
    console.log(`  WARNING: missing ${photoCount - thumbCount} thumbnail(s). Re-run generate_thumbs.py.`)
  } else {
    console.log('  OK: thumbnails cover all photos.')
  }

  // If not overridden, check the committed build output actually carries the thumbs
  const buildThumbs = path.join(PROJECT_ROOT, 'shoebox/assets/shoebox/thumbs')
  if (!isOverride) {
    const buildThumbCount = countImages(buildThumbs)
    console.log(`  Build copy thumbs : ${buildThumbCount}`)
    if (buildThumbCount < photoCount) {
      console.log(`  WARNING: build output is missing ${photoCount - buildThumbCount} thumbnail(s). ` +
        'The build step likely failed or was skipped. The live site will show no thumbnails.')
    } else {
      console.log('  OK: build output carries all thumbnails.')
    }
  }

  if (manifestPhotoCount !== null) {
    const m = JSON.parse(fs.readFileSync(MANIFEST_OUT, 'utf8'))
    const faces = m.photos.filter((p) => p.faceX != null).length
    console.log(`  Faces in manifest: ${faces}/${manifestPhotoCount}`)
    if (faces === 0) {
      console.log('  Note: no face data. OpenCV is not installed here; face detection was skipped.')
    }
    const noCaption = m.photos.filter((p) => !p.caption).length
    if (noCaption) console.log(`  Note: ${noCaption} photo(s) have no caption (expected for new raw exports).`)
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

if (!SOURCE) {
  console.log('Usage: node scripts/ingest_photos.js <source> [--do-it] [--overwrite] [--bun] [--allow-no-exiftool]')
  console.log('  <source>    folder of images or a .zip')
  console.log('  --do-it     actually ingest (default is a dry run, writes nothing)')
  console.log('  --overwrite replace archive files that collide by name with the source')
  console.log('  --bun       use bun for the build step instead of npm')
  console.log('  --allow-no-exiftool  force the run even when exiftool is missing (not recommended)')
  process.exit(1)
}

if (!fs.existsSync(SOURCE)) fail(`Source not found: ${SOURCE}`)
if (path.resolve(SOURCE) === PHOTOS_DIR) fail('Source cannot be the photos dir itself.')

const zipSource = fs.statSync(SOURCE).isFile() && /\.zip$/i.test(SOURCE)
if (!fs.statSync(SOURCE).isDirectory() && !zipSource) {
  fail('Source must be a folder or a .zip file.')
}

const checks = preflight(zipSource)
const { files, tempDir } = collectSource(SOURCE)
if (files.length === 0) {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true })
  fail('No image files (.jpg/.jpeg/.png/.gif/.webp) found in the source.')
}

const intraDupes = resolveIntraBatchCollisions(files)
if (intraDupes.length) {
  console.log('Intra-batch duplicate filenames (two source files with the same name):')
  for (const [name, paths] of intraDupes) console.log(`  ! ${name} -> ${paths.join(', ')}`)
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true })
  fail('Resolve these first (rename or pick one). Refusing to guess.')
}

const plan = classify(files)
printPlan(plan, checks)

if (!DO_IT) {
  console.log('\nDRY RUN only. Nothing was written.')
  console.log('To ingest:  node scripts/ingest_photos.js <source> --do-it')
  if (plan.collision.length) console.log('Collisions present: add --overwrite to replace archive copies.')
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true })
  process.exit(0)
}

// Real run. Gate on collisions BEFORE writing anything so a bad batch never
// half-copies. --overwrite is required to replace any colliding file.
if (plan.collision.length > 0 && !OVERWRITE) {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true })
  fail(
    `${plan.collision.length} collision(s) need --overwrite. ` +
    'Nothing was copied. Re-run with --overwrite to replace the archive copies.'
  )
}

// exiftool is the data backbone. Refuse to run the metadata pipeline without
// it (this was the #1 real incident: silent IPTC loss). --allow-no-exiftool
// opts out for the rare case where metadata truly is not wanted.
if (!checks.exiftoolOk && !ALLOW_NO_EXIFTOOL) {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true })
  fail(
    'exiftool is not on PATH. The manifest would be generated without any IPTC ' +
    'metadata. Fix the PATH (add /home/bayarddevries/bin/exiftool), or re-run with ' +
    '--allow-no-exiftool to force it (not recommended).'
  )
}

console.log('\n--- Copying into photos dir ---')
copyFiles(plan)

// manifest (pass the same dir/out so the generator stays in sync with overrides)
run('Regenerating manifest.json', `node scripts/generate_manifest.js "${PHOTOS_DIR}" "${MANIFEST_OUT}"`, 600000)

// thumbs (generate_thumbs.py is hardcoded to public/, so only run it on the real dir)
if (!isOverride) {
  run('Generating thumbnails', 'python3 scripts/generate_thumbs.py', 300000)
} else {
  console.log('\n--- Generating thumbnails ---')
  console.log('  Skipped: SHOEBOX_PHOTOS_DIR is set but generate_thumbs.py targets public/ by design.')
}

// build (skip when testing with overrides so the real build output is untouched)
if (!isOverride) {
  run('Rebuilding', USE_BUN ? 'bun run build' : 'npm run build', 600000)
} else {
  console.log('\n--- Rebuilding ---')
  console.log('  Skipped: override env vars are set (fixture/test mode).')
}

if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true })
verify()

console.log('\n--- Next steps (you decide, no auto-commit) ---')
console.log('  Review the diff, then:')
console.log('    git add public/assets/shoebox/photos public/assets/shoebox/manifest.json public/assets/shoebox/face_coords.json')
console.log('    git add public/assets/shoebox/thumbs')
console.log('    git add shoebox')
console.log('    git commit -m "Add N new archival photos"')
console.log('    git push origin main')
console.log('  After the push, CI rebuilds and deploys to GitHub Pages.')
console.log('  Wait 1-3 minutes for the CDN, then hard-refresh the live page.')
