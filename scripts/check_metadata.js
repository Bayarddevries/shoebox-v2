#!/usr/bin/env node
/**
 * check_metadata.js — Shoebox archive metadata quality report
 *
 * Read-only audit of public/assets/shoebox/manifest.json. Flags issues that
 * degrade the archive before they become search/filter/exhibit problems:
 *   - duplicate or filename-derived titles
 *   - empty or too-short captions
 *   - people entries that are descriptors/places (leaked into people field)
 *   - place-name variants / typos (e.g. Cemetary, Fort Gary, Assinaboia)
 *   - separator drift (; vs ,) inside the people field
 *
 * Run after every manifest regeneration:
 *   node scripts/check_metadata.js
 * Exit code 0 always (report only); prints counts + flagged examples.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const MANIFEST = path.join(__dirname, '..', 'public', 'assets', 'shoebox', 'manifest.json')
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
const photos = manifest.photos || []
const N = photos.length

// ── Known place-name variants / typos (from the 2026-09-02 place audit) ──
const PLACE_VARIANTS = [
  { bad: /cemetary/i, good: 'Cemetery' },
  { bad: /\bfort gary\b/i, good: 'Fort Garry' },
  { bad: /\bassinaboia\b/i, good: 'Assiniboia' },
  { bad: /victory at frog[^p]/i, good: 'Monument to the Victory at Frog Plain' },
  { bad: /\bcanadaa\b|\bcanaada\b/i, good: 'Canada' },
  { bad: /\bnorth west territoties\b/i, good: 'Northwest Territories' },
  { bad: /\bfor rae\b/i, good: 'Fort Rae' },
  { bad: /hydroelectric stat$/i, good: 'Hydroelectric Station' },
  { bad: /behind duck ba$/i, good: 'behind Duck Bay' },
]

// Descriptor keywords that should NOT be in the people field (mirror of
// TOPICAL_KEYWORDS in generate_manifest.js — keep in sync)
const DESCRIPTOR_RE = /(^|\s|;)(metis woman|metis man|military uniform|uniformed man|beadwork|fur parka|traditional clothing|indigenous culture|vintage photograph|for king and country|roll of honour|world war|ww2|ww1|patriotism|collected at|family|portrait|outdoors|winter|black and white|historical|church|farm|buffalo|bison|fiddle|children|women|men|couple|friends|community|soldier|uniform|wedding|cart|craftsman|artist|woodworking|park)(;|$|\s)/i

const report = {
  total: N,
  duplicateTitles: [],
  filenameTitles: [],
  emptyCaptions: 0,
  shortCaptions: [],
  emptyPeople: 0,
  descriptorPeople: [],
  placeVariants: [],
  commaSeparatedPeople: 0,
}

// ── Titles ──
const titleCount = new Map()
for (const p of photos) {
  const t = (p.title || '').trim()
  titleCount.set(t, (titleCount.get(t) || 0) + 1)
}
for (const [t, c] of titleCount) {
  if (c > 1) report.duplicateTitles.push({ title: t, count: c })
}
for (const p of photos) {
  const t = (p.title || '').trim()
  if (/^(untitled|photo_|img_|old photo|scan|stemadeleine_|winnipeg regional meeting 2026 \d)/i.test(t)) {
    report.filenameTitles.push({ id: p.id, title: t })
  }
}

// ── Captions ──
for (const p of photos) {
  const c = (p.caption || '').trim()
  if (!c) report.emptyCaptions++
  else if (c.length < 20) report.shortCaptions.push({ id: p.id, title: p.title, caption: c })
}

// ── People ──
for (const p of photos) {
  const people = p.people || ''
  if (!people) { report.emptyPeople++; continue }
  if (people.includes(',')) report.commaSeparatedPeople++
  if (DESCRIPTOR_RE.test(people)) report.descriptorPeople.push({ id: p.id, title: p.title, people })
}

// ── Place variants ──
for (const p of photos) {
  for (const k of ['location', 'community', 'sublocation']) {
    const v = p[k] || ''
    if (!v) continue
    for (const { bad, good } of PLACE_VARIANTS) {
      if (bad.test(v)) {
        report.placeVariants.push({ id: p.id, field: k, value: v, shouldBe: good })
        break
      }
    }
  }
}

// ── Output ──
console.log(`\n=== Shoebox metadata quality report (${N} photos) ===\n`)

console.log(`Titles:`)
console.log(`  ${report.duplicateTitles.length} titles duplicated`)
for (const d of report.duplicateTitles.slice(0, 8)) console.log(`    x${d.count} ${JSON.stringify(d.title)}`)
console.log(`  ${report.filenameTitles.length} filename-derived titles`)
for (const d of report.filenameTitles.slice(0, 6)) console.log(`    ${d.id} ${JSON.stringify(d.title)}`)

console.log(`\nCaptions:`)
console.log(`  ${report.emptyCaptions} empty (${Math.round((report.emptyCaptions / N) * 100)}%)`)
console.log(`  ${report.shortCaptions.length} under 20 chars`)
for (const d of report.shortCaptions.slice(0, 5)) console.log(`    ${JSON.stringify(d.title)}: ${JSON.stringify(d.caption)}`)

console.log(`\nPeople:`)
console.log(`  ${report.emptyPeople} empty`)
console.log(`  ${report.commaSeparatedPeople} comma-separated (should be semicolons)`)
console.log(`  ${report.descriptorPeople.length} with descriptor/place leakage`)
for (const d of report.descriptorPeople.slice(0, 4)) console.log(`    ${JSON.stringify(d.title)}: ${JSON.stringify(d.people)}`)

console.log(`\nPlace-name variants:`)
console.log(`  ${report.placeVariants.length} values need canonical fix`)
const byGood = {}
for (const v of report.placeVariants) byGood[v.shouldBe] = (byGood[v.shouldBe] || 0) + 1
for (const [good, n] of Object.entries(byGood)) console.log(`    -> ${good}: ${n}`)

console.log(`\nDone. Fix at source (Lightroom IPTC) or via the review loop, then regen.`)
