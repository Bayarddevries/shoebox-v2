/**
 * Shoebox Manifest Generator v3
 *
 * Standard pipeline for generating manifest.json from source photos.
 * Reads structured IPTC/XMP metadata written by Adobe Lightroom and
 * captures EVERY field Lightroom writes, preserving provenance:
 *   - IPTC City, Sub-location, Province-State, Country (+ CountryCode)
 *   - IPTC ObjectName (title), Caption-Abstract (description)
 *   - GPS coordinates (with proper sign handling for Western Canada)
 *   - Keywords (tags + people names)
 *   - Copyright / Rights (used to derive submitter)
 *   - Creator / By-line / Artist (photographer), Credit, Source, Headline
 *   - Rating, Label (Lightroom star / color labels)
 *   - Scanner provenance: Make, Model, SerialNumber, Software
 *   - Dates: DateCreated, TimeCreated, DateTimeOriginal, CreateDate
 *
 * Enrichment steps:
 *   1. ONE bulk exiftool pass over the whole directory (not one spawn per
 *      file) with group-qualified tag names, cached by filename.
 *   2. Extract all IPTC/XMP location fields → build full "Community, Province, Canada"
 *   3. Normalize province spellings to full name
 *   4. Geocode: GPS from EXIF if present, otherwise lookup table for known Métis communities
 *   5. Separate people names from topical keywords
 *   6. Clean up year ranges and date metadata
 *   7. Face detection: run detect_faces.py to get faceX/faceY for each photo
 *
 * Every photo carries a `metadata` object with the full raw field set so no
 * Lightroom data is ever silently dropped. Derived fields (year, location,
 * people, submitter) sit at the top level for the frontend.
 *
 * Usage:
 *   node scripts/generate_manifest.js [SOURCE_DIR] [OUTPUT_FILE]
 *
 * Defaults:
 *   SOURCE_DIR  = ./public/assets/shoebox/photos
 *   OUTPUT_FILE = ./public/assets/shoebox/manifest.json
 *
 * Exiftool resolution: $EXIFTOOL env var first, then `exiftool-bin`, then
 * `exiftool`. On this machine ~/bin/exiftool is a directory containing the
 * real binary at ~/bin/exiftool-bin (see papercuts log 2026-09-01).
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { mergeContributions } from './merge_contributions.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')

// ─── Configuration ──────────────────────────────────────────────────────────

const SOURCE_DIR = process.argv[2] || path.join(PROJECT_ROOT, 'public/assets/shoebox/photos')
const OUTPUT_FILE = process.argv[3] || path.join(PROJECT_ROOT, 'public/assets/shoebox/manifest.json')

// ─── Exiftool resolution ────────────────────────────────────────────────────
// Try, in order: $EXIFTOOL env (explicit), exiftool-bin (this machine's real
// binary), exiftool (standard). Verify each actually runs before using it.
function resolveExiftool() {
  const candidates = [
    process.env.EXIFTOOL,
    'exiftool-bin',
    'exiftool',
  ].filter(Boolean)
  for (const c of candidates) {
    try {
      execSync(`${c} -ver`, { encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] })
      return c
    } catch {
      // try next candidate
    }
  }
  return null
}

const EXIFTOOL = resolveExiftool()

// ─── Province Normalization ─────────────────────────────────────────────────

const PROVINCE_MAP = {
  'mb': 'Manitoba',
  'manitoba': 'Manitoba',
  'sk': 'Saskatchewan',
  'sask': 'Saskatchewan',
  'saskatchewan': 'Saskatchewan',
  'saskachewan': 'Saskatchewan',
  'saskachechewan': 'Saskatchewan',
  'ab': 'Alberta',
  'alberta': 'Alberta',
  'nwt': 'Northwest Territories',
  'north west territories': 'Northwest Territories',
  'northwest territories': 'Northwest Territories',
  'north west territories': 'Northwest Territories',
  'nt': 'Northwest Territories',
  'qc': 'Quebec',
  'quebec': 'Quebec',
  'on': 'Ontario',
  'ontario': 'Ontario',
  'nu': 'Nunavut',
  'nunavut': 'Nunavut',
  'bc': 'British Columbia',
  'british columbia': 'British Columbia',
  'yt': 'Yukon',
  'yukon': 'Yukon',
}

// ─── City Name Normalization ────────────────────────────────────────────────

const CITY_ALIASES = {
  'winniepg': 'Winnipeg',
  'portage la prarie': 'Portage la Prairie',
  'st, andrews': 'St. Andrews',
  'ste. madeleine': 'Ste. Madeleine',
  'st. lazar': 'St. Lazar',
  'willow bunch': 'Willow Bunch',
  'fond du lac': 'Fond Du Lac',  // lowercase variant → canonical
}

// ─── Geocoding Lookup Table ─────────────────────────────────────────────────
// Coordinates for known Métis and regional communities (Western Canada)
// All longitudes are negative (west of Prime Meridian)

const GEOCODE_TABLE = {
  // Manitoba
  'Winnipeg':            { lat: 49.8956, lng: -97.1386 },
  'Duck Bay':            { lat: 52.7717, lng: -100.9014 },
  'St. Eustache':        { lat: 50.2500, lng: -97.4167 },
  'St. Andrews':         { lat: 50.0500, lng: -96.9833 },
  'Lockport':            { lat: 50.0917, lng: -96.9500 },
  'Selkirk':             { lat: 50.0333, lng: -96.8667 },
  'St. Boniface':        { lat: 49.8917, lng: -97.1139 },
  'The Pas':             { lat: 53.8333, lng: -101.2500 },
  'Grand Rapids':        { lat: 53.1833, lng: -99.3333 },
  'Portage la Prairie':  { lat: 49.9733, lng: -98.2914 },
  'Churchill':           { lat: 58.7689, lng: -94.1674 },
  'Winnipeg Beach':      { lat: 50.5000, lng: -96.9667 },
  'Pine Falls':          { lat: 50.5500, lng: -96.2167 },
  'Foxwarren':           { lat: 50.4000, lng: -100.5167 },
  'Ste. Madeleine':      { lat: 50.5167, lng: -99.6000 },
  'Rooster Town':        { lat: 49.8333, lng: -97.1667 },
  'St. Lazar':           { lat: 49.8333, lng: -97.0833 },
  'Marchand':            { lat: 49.4167, lng: -96.6667 },
  'Bacon Ridge':         { lat: 52.7833, lng: -100.7833 },
  // Saskatchewan
  'Saskatoon':           { lat: 52.1322, lng: -106.6706 },
  'Prince Albert':       { lat: 53.2034, lng: -105.7587 },
  'Stony Rapids':        { lat: 59.2500, lng: -105.3333 },
  'Black Lake':          { lat: 59.3000, lng: -105.4000 },
  'Fond Du Lac':         { lat: 59.3500, lng: -107.6000 },
  'Willow Bunch':        { lat: 49.1667, lng: -105.5833 },
  'Fort Chipewyan':      { lat: 58.9833, lng: -111.1833 },  // AB but close to SK border
  // Alberta
  'Fort Smith':          { lat: 60.0031, lng: -111.8841 },
  'Fort Resolution':     { lat: 61.1833, lng: -113.6833 },
  'Lac St. Anne':        { lat: 53.6833, lng: -114.4833 },
  'Fatima':              { lat: 53.7000, lng: -114.4333 },
  'Vogar':               { lat: 53.7500, lng: -114.5500 },
  'Stony Lake':          { lat: 53.6667, lng: -114.5167 },
  'Fort Rae':            { lat: 62.8167, lng: -116.0167 },
  // Northwest Territories
  'Stall Lake':          { lat: 62.7500, lng: -115.9500 },
  'Fort Resolution':     { lat: 61.1833, lng: -113.6833 },
}

// ─── Keyword Classification ─────────────────────────────────────────────────
// These keywords are topical tags, NOT people names

const TOPICAL_KEYWORDS = new Set([
  // Date ranges
  '1900-1925', '1925-1950', '1950-1975', '1975-2000', '2000-2025',
  '1990-1925', '1940-1945', '1945-1950', '1935-1940', '1925-1930',
  '1950s', '1960s', 'early 20th century',
  // Event tags
  'Aga 2025', 'AGA 2024', 'RRMNBDC Gala 2025',
  // Subject / descriptive tags
  'Outdoors', 'Outdoor', 'outdoors', 'outdoor',
  'Winter', 'winter', 'Summer', 'summer',
  'School', 'Day School', 'school', 'students',
  'Portrait', 'portrait', 'Family portrait', 'family portrait', 'Winter portrait',
  'Professional portrait', 'professional portrait', 'studio portrait', 'group portrait',
  'Historical', 'Historic photo', 'historical', 'Vintage', 'vintage', 'black and white',
  'Métis', 'Red River Métis', 'Métis Shoebox', 'Shoebox interview',
  'House', 'house', 'home', 'Trees', 'trees', 'forest', 'woodland', 'nature',
  'Dog', 'dog', 'pet', 'animal', 'calf', 'livestock', 'Dogsled',
  'Church', 'Boat', 'Farm', 'farm', 'garden', 'agriculture', 'harvest',
  'Fishing', 'resource gathering',
  'Agriculture', 'Gardening', 'Forestry', 'Bush work', 'Logging', 'bow saw',
  'Buffalo', 'Bison', 'bison', 'Sheep', 'Fiddle',
  'Children', 'children', 'youth', 'Women', 'women', 'woman', 'Men', 'men', 'man',
  'Family', 'family', 'couple', 'friends', 'community', 'Chartrand family', 'Dejarlais family',
  'Grandmothers', 'Snow', 'snow', 'Trapper Cabin',
  'candid', 'smiling', 'serene',
  'indoor', 'livingroom', 'landscape', 'field', 'grass', 'lake', 'water',
  'car', 'storefront', 'uniform', 'uniforms', 'military', 'military service', 'soldier',
  'wedding', 'food', 'scanning', 'scanned in house',
  'fur hood', 'evergreen', 'Evergreen',
  // HR/LR = Lightroom edit flags (not people!)
  'HR', 'LR',
  // Event/org tags
  'Louis Riel Day', 'National Indigenous Peoples Day', 'NIPD',
  'Ste. Madeleine Métis Days 2026', 'Victory at Frog Plain 2026',
  'Louis Riel Gravesite', 'St. Mary\'s Academy', 'Fort Garry Hotel', 'Fort Gary Hotel',
  'Selkirk Park', 'Prairie Bison Local', 'Local Meeting',
  'MMF', 'Manitoba Métis Federation', 'RRMNHC',
  'Minister', 'Prime Minister', 'President Chartrand',
 'Touched up', 'Foxhorn', 'rural',
// Roles / titles (not people names)
 'Grey Nun', 'Grey Nuns', 'Nun', 'Nuns', 'nun', 'nuns',
 'Priest', 'priest', 'Bishop', 'bishop',
 'Chief', 'chief', 'Guide', 'guide',
 'Voyageur', 'Councillor', 'Interpreter',
// Place names (these go to location, not people)
 'Duck Bay', 'Selkirk', 'St. Boniface', 'Winnipeg', 'Winnipeg Region',
 'Red River', 'St. Eustache', 'Fort Smith', 'Fond Du Lac', 'The Pas',
 'Beaulieu', 'Prince Albert', 'Black Lake', 'Grand Rapids',
 'Stony Rapids', 'Saskatoon', 'St. Andrews', 'Fort Chipewyan',
 'Fort Rae', 'Fort Resolution', 'Fort Qu\'Appelle', 'Fort Garry',
 'Saskatchewan', 'Manitoba', 'Alberta',
  // Street addresses (not people)
  '200 Main St.', '200 Main st.', '335 Main St.', '42 Thorncliff Bay', '787 Main St',
  '1963 Roblin Blvd. Shelmerdene Dr',
])

// Patterns that indicate a topical (non-person) keyword
const TOPICAL_PATTERNS = [
 /^\d{4}$/, // Pure year: 1964
 /^\d{4}-\d{4}$/, // Year range: 1950-1975
 /^\d+\s/, // Starts with number: "200 Main st."
 /^\d{4}s$/, // Decade: "1950s"
 /^(Fort|St\.|Saint|Mount|Lake|Port)\s/i, // Place name prefixes
]

function isTopicalKeyword(kw) {
  const strKw = String(kw)
  if (TOPICAL_KEYWORDS.has(strKw)) return true
  for (const pattern of TOPICAL_PATTERNS) {
    if (pattern.test(strKw)) return true
  }
  // Single-word all-lowercase keywords are almost never person names
  // Exceptions: common single-word surnames like "Lafferty" are capitalized
  if (/^[a-z]+$/.test(strKw) && strKw.length > 1) return true
  return false
}

// ─── EXIF Metadata Extraction (bulk pass) ───────────────────────────────────
// One exiftool invocation over the whole directory (not one spawn per file).
// Output is group-qualified (-G1) so we can tell IPTC vs XMP vs EXIF apart.
// Returns a Map<filename, tags>.

const EXIF_TAGS = [
  '-ImageDescription', '-ObjectName', '-Caption-Abstract', '-Keywords',
  '-DateTimeOriginal', '-CreateDate', '-DateCreated', '-TimeCreated',
  '-GPSLatitude', '-GPSLongitude', '-GPSLatitudeRef', '-GPSLongitudeRef',
  '-City', '-Sub-location', '-Province-State', '-Country-PrimaryLocationName', '-CountryCode',
  '-ImageWidth', '-ImageHeight', '-Software', '-Make', '-Model', '-SerialNumber',
  '-Copyright', '-Rights', '-Credit', '-Source', '-Headline', '-Instructions',
  '-By-line', '-By-lineTitle', '-Creator', '-Rating', '-Label', '-Artist', '-CreatorWorkEmail',
]

function extractAllExif(dir) {
  if (!EXIFTOOL) {
    console.warn('  ⚠ exiftool not found — manifest will have NO metadata. Fix: set $EXIFTOOL or install exiftool.')
    return new Map()
  }
  try {
    const json = execSync(
      `${EXIFTOOL} -j -n -G1 -q ${EXIF_TAGS.join(' ')} "${dir}"`,
      { encoding: 'utf8', timeout: 60000, maxBuffer: 256 * 1024 * 1024 }
    )
    const data = JSON.parse(json)
    const map = new Map()
    for (const rec of data) {
      const fname = path.basename(rec.SourceFile)
      map.set(fname, rec)
    }
    return map
  } catch (e) {
    console.warn(`  ⚠ exiftool bulk pass failed: ${e.message}`)
    return new Map()
  }
}

// Group-aware field picker: tries candidate keys in order, returns first present.
function exifPick(exif, keys) {
  for (const k of keys) {
    const v = exif && exif[k]
    if (v !== undefined && v !== null && v !== '') return v
  }
  return undefined
}

// String coercion: numbers from exiftool JSON (serial, width, rating...) become strings safely.
function exifStr(exif, keys) {
  const v = exifPick(exif, keys)
  if (v === undefined || v === null) return ''
  return String(v).trim()
}

// ─── Province Normalization ─────────────────────────────────────────────────

function normalizeProvince(raw) {
  if (!raw) return ''
  const key = raw.trim().toLowerCase()
  return PROVINCE_MAP[key] || raw.trim()
}

// ─── City Normalization ─────────────────────────────────────────────────────

function normalizeCity(raw) {
  if (!raw) return ''
  const key = raw.trim()
  // Check aliases first (handles typos)
  const lowerKey = key.toLowerCase()
  for (const [alias, canonical] of Object.entries(CITY_ALIASES)) {
    if (lowerKey === alias.toLowerCase()) return canonical
  }
  return key
}

// ─── Build Location String ──────────────────────────────────────────────────

function buildLocationString(city, province, country) {
  const parts = [city, province, country].filter(Boolean)
  return parts.join(', ')
}

// ─── Geocode a Photo ────────────────────────────────────────────────────────

function geocode(city, province, exifLat, exifLng, keywords) {
  // 1. Use GPS from EXIF if available (already signed decimals from -n flag)
  if (exifLat !== undefined && exifLng !== undefined &&
      !isNaN(exifLat) && !isNaN(exifLng) &&
      exifLat !== 0 && exifLng !== 0) {
    // Sanity check: ensure it's in Western Canada range
    if (exifLat >= 45 && exifLat <= 70 && exifLng >= -140 && exifLng <= -80) {
      return { lat: exifLat, lng: exifLng }
    }
  }

  // 2. Lookup by city name (case-insensitive: EXIF may say "portage la prairie")
  if (city) {
    const cityLower = city.toLowerCase()
    for (const [place, coords] of Object.entries(GEOCODE_TABLE)) {
      if (place.toLowerCase() === cityLower) return coords
    }
  }

  // 3. Lookup by keyword (e.g. event keywords like "Ste. Madeleine Métis Days 2026")
  //    that name a known community. Checks each keyword (and substring) against
  //    the geocode table so event/place-tagged scans still map.
  const keywordList = Array.isArray(keywords) ? keywords : keywords ? [String(keywords)] : []
  for (const kw of keywordList) {
    const kwLower = String(kw).toLowerCase()
    for (const [place, coords] of Object.entries(GEOCODE_TABLE)) {
      if (kwLower === place.toLowerCase() || kwLower.includes(place.toLowerCase())) {
        return coords
      }
    }
  }

  // 4. No coordinates available
  return { lat: null, lng: null }
}

// ─── Year Extraction ────────────────────────────────────────────────────────

function extractYear(dateStr) {
 if (!dateStr) return null
 const match = String(dateStr).match(/(\d{4})/)
 if (match) {
 const year = parseInt(match[1])
 if (year >= 1800 && year <= 2100) return year
 }
 return null
}

// ─── Photo Year Derivation ──────────────────────────────────────────────────
// Derives the approximate date a photo was TAKEN (not scanned).
// Priority: specific year in keywords > title > era range midpoint > scan date
// Returns { photoYear: number|null, photoYearSource: string }

function derivePhotoYear(keywords, title, exifYear) {
 // 1. Specific 4-digit year in keywords (e.g. "1960", "1925")
 //    Exclude years >= 2020 — those are scan/upload dates leaking into keywords
 const specificYears = keywords
 .filter(kw => /^\d{4}$/.test(String(kw)))
 .map(kw => parseInt(kw, 10))
 .filter(y => y >= 1800 && y < 2020)

 if (specificYears.length > 0) {
 // Use the earliest specific year — if multiple exist, the earliest
 // is most likely the actual photo date (later ones could be reprints)
 return { photoYear: Math.min(...specificYears), photoYearSource: 'keyword-specific' }
 }

 // 2. Year embedded in the title (e.g. "4 Generations 1974")
 if (title) {
 const titleYearMatch = title.match(/\b(18|19|20)\d{2}\b/)
 if (titleYearMatch) {
 const y = parseInt(titleYearMatch[0], 10)
 if (y >= 1800 && y < 2020) {
 return { photoYear: y, photoYearSource: 'title' }
 }
 }
 }

 // 3. Era range in keywords (e.g. "1950-1975") → use midpoint
 //    Some ranges are backwards (e.g. "1990-1925") so normalize
 const eraRanges = keywords
 .filter(kw => /^\d{4}-\d{4}$/.test(String(kw)))
 .map(kw => {
 const [a, b] = kw.split('-').map(Number)
 const lo = Math.min(a, b)
 const hi = Math.max(a, b)
 return { lo, hi, mid: Math.round((lo + hi) / 2) }
 })
 .filter(r => r.lo >= 1800 && r.hi < 2025)

 if (eraRanges.length > 0) {
 // Use the range with the earliest midpoint (most likely the photo's era)
 const earliest = eraRanges.reduce((a, b) => a.mid < b.mid ? a : b)
 return { photoYear: earliest.mid, photoYearSource: 'keyword-era' }
 }

 // 4. Fallback: EXIF date (likely scan date, but better than nothing)
 if (exifYear) {
 return { photoYear: exifYear, photoYearSource: 'scan-date' }
 }

 return { photoYear: null, photoYearSource: 'unknown' }
}

// ─── Title from Filename (fallback) ─────────────────────────────────────────

function formatTitleFromFilename(filename) {
  let title = filename.replace(/\.[^.]+$/, '')
  title = title.replace(/^[\d\s_-]+/, '')
  title = title.replace(/_/g, ' ')
  title = title.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
  title = title.replace(/[\s]+/g, ' ').trim()
  return title || filename
}

// ─── Main Pipeline ──────────────────────────────────────────────────────────

console.log('╔══════════════════════════════════════════════════╗')
console.log('║   Shoebox Manifest Generator v3                 ║')
console.log('╚══════════════════════════════════════════════════╝')
console.log(`Source: ${SOURCE_DIR}`)
console.log(`Output: ${OUTPUT_FILE}`)
console.log(`Exiftool: ${EXIFTOOL || 'NOT FOUND'}`)
console.log()

const files = fs.readdirSync(SOURCE_DIR)
const imageFiles = files.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))

console.log(`Found ${imageFiles.length} images to process...\n`)

// Bulk metadata pass (ONE exiftool call for the whole directory)
const exifCache = extractAllExif(SOURCE_DIR)

let statsCount = {
  city: 0, province: 0, country: 0, gps: 0, geocoded: 0, people: 0, title: 0, caption: 0, year: 0,
  rating: 0, label: 0, creator: 0, credit: 0, source: 0, headline: 0,
  scanner: 0, serial: 0, submitter: 0,
}

const photos = imageFiles.map((filename, index) => {
  const filepath = path.join(SOURCE_DIR, filename)
  const stats = fs.statSync(filepath)

  // ── Step 1: Metadata (from bulk cache) ──
  const exif = exifCache.get(filename) || {}

  // ── Step 2: Title ──
  const exifTitle = (exifPick(exif, ['IPTC:ObjectName', 'XMP-dc:Title', 'ObjectName']) || '').trim()
  const title = exifTitle || formatTitleFromFilename(filename)

  // ── Step 3: Caption / Description ──
  const rawCaption = exifPick(exif, ['IPTC:Caption-Abstract', 'XMP-dc:Description', 'EXIF:ImageDescription', 'IFD0:ImageDescription', 'ImageDescription']) || ''
  const caption = (typeof rawCaption === 'string' ? rawCaption : String(rawCaption)).trim()

  // ── Step 3b: Submitter from IPTC Copyright/Rights ──
  const rawCopyright = String(exifPick(exif, ['IFD0:Copyright', 'EXIF:Copyright', 'XMP-dc:Rights', 'IPTC:CopyrightNotice', 'Copyright']) || '').trim()
  const submitterMatch = rawCopyright.match(/Submitted by\s+(.+)/i)
  const submitter = submitterMatch ? submitterMatch[1].trim() : null

  // ── Step 4: Location from IPTC structured fields ──
  const rawCity = normalizeCity(exifPick(exif, ['IPTC:City', 'XMP-photoshop:City', 'City']) || '')
  const rawSublocation = (exifPick(exif, ['IPTC:Sub-location', 'XMP-iptc:Location', 'Sub-location']) || '').trim()
  const rawProvince = normalizeProvince(exifPick(exif, ['IPTC:Province-State', 'XMP-photoshop:State', 'Province-State']) || '')
  const rawCountry = (exifPick(exif, ['IPTC:Country-PrimaryLocationName', 'XMP-photoshop:Country', 'Country-PrimaryLocationName']) || '').trim()
  const countryCode = (exifPick(exif, ['IPTC:CountryCode', 'XMP-iptc:CountryCode', 'CountryCode']) || '').trim() || null

  // Build display location: "Community, Province, Canada"
  // If sub-location is more specific than city and NOT a street address, use it
  let community = rawCity
  if (rawSublocation && rawCity && rawSublocation !== rawCity) {
    // Skip sub-locations that are street addresses or numeric prefixes
    if (!/^\d/.test(rawSublocation)) {
      community = `${rawSublocation}, ${rawCity}`
    }
  }
  const location = buildLocationString(community, rawProvince, rawCountry)

  // ── Step 5: Keywords ──
  const rawKeywords = exifPick(exif, ['IPTC:Keywords', 'XMP-dc:Subject', 'Keywords']) || []
  let keywords = []
  if (typeof rawKeywords === 'string') {
    keywords = rawKeywords.split(',').map(k => k.trim()).filter(Boolean)
  } else if (Array.isArray(rawKeywords)) {
    keywords = rawKeywords.map(k => String(k).trim()).filter(Boolean)
  }

  // ── Step 6: Separate people from topical keywords ──
  const people = keywords.filter(kw => !isTopicalKeyword(kw))
  const topicalKeywords = keywords.filter(kw => isTopicalKeyword(kw))

 // ── Step 7: Year ──
 const exifYear = extractYear(exifPick(exif, ['IPTC:DateCreated', 'XMP-photoshop:DateCreated', 'DateCreated'])) ||
                  extractYear(exifPick(exif, ['ExifIFD:DateTimeOriginal', 'EXIF:DateTimeOriginal', 'DateTimeOriginal']))
 const scanYear = exifYear // EXIF timestamp = when the file was created/scanned
 const { photoYear, photoYearSource } = derivePhotoYear(topicalKeywords, title, exifYear)

  // ── Step 8: Geocoding ──
  const gpsLat = exifPick(exif, ['Composite:GPSLatitude', 'GPS:GPSLatitude', 'GPSLatitude'])
  const gpsLng = exifPick(exif, ['Composite:GPSLongitude', 'GPS:GPSLongitude', 'GPSLongitude'])
  const coords = geocode(rawCity, rawProvince, gpsLat, gpsLng, keywords)

  // ── Step 9: Photographer / credit fields ──
  const creator = exifPick(exif, ['XMP-dc:Creator', 'IPTC:By-line', 'IFD0:Artist', 'EXIF:Artist', 'By-line'])
  const creatorStr = Array.isArray(creator) ? creator.join('; ') : exifStr(exif, ['XMP-dc:Creator', 'IPTC:By-line', 'IFD0:Artist', 'EXIF:Artist', 'By-line']) || null
  const credit = exifStr(exif, ['XMP-photoshop:Credit', 'IPTC:Credit', 'Credit']) || null
  const source = exifStr(exif, ['XMP-photoshop:Source', 'IPTC:Source', 'Source']) || null
  const headline = exifStr(exif, ['XMP-photoshop:Headline', 'IPTC:Headline', 'Headline']) || null
  const instructions = exifStr(exif, ['XMP-photoshop:Instructions', 'IPTC:Instructions', 'Instructions']) || null

  // ── Step 10: Scanner provenance ──
  const scannerMake = exifStr(exif, ['IFD0:Make', 'EXIF:Make', 'Make']) || null
  const scannerModel = exifStr(exif, ['IFD0:Model', 'EXIF:Model', 'Model']) || null
  const scannerSerial = exifStr(exif, ['ExifIFD:SerialNumber', 'XMP-aux:SerialNumber', 'SerialNumber']) || null
  const software = exifStr(exif, ['IFD0:Software', 'XMP-tiff:Software', 'EXIF:Software', 'Software']) || null

  // ── Step 11: Dates (preserve the full set) ──
  const dateCreated = exifStr(exif, ['IPTC:DateCreated', 'XMP-photoshop:DateCreated', 'DateCreated']) || null
  const timeCreated = exifStr(exif, ['IPTC:TimeCreated', 'TimeCreated']) || null
  const dateTimeOriginal = exifStr(exif, ['ExifIFD:DateTimeOriginal', 'EXIF:DateTimeOriginal', 'DateTimeOriginal']) || null
  const createDate = exifStr(exif, ['XMP-xmp:CreateDate', 'ExifIFD:CreateDate', 'CreateDate']) || null

  // ── Step 12: Rating / Label ──
  const ratingRaw = exifPick(exif, ['XMP-xmp:Rating', 'Rating'])
  const rating = (ratingRaw !== undefined && ratingRaw !== null && ratingRaw !== '') ? Number(ratingRaw) : null
  const label = exifStr(exif, ['XMP-xmp:Label', 'Label']) || null

  // ── Stats ──
  if (rawCity) statsCount.city++
  if (rawProvince) statsCount.province++
  if (rawCountry) statsCount.country++
  if (coords.lat !== null) statsCount.geocoded++
  if (gpsLat !== undefined) statsCount.gps++
  if (people.length > 0) statsCount.people++
  if (title) statsCount.title++
  if (caption) statsCount.caption++
 if (photoYear) statsCount.year++
  if (rating !== null) statsCount.rating++
  if (label) statsCount.label++
  if (creatorStr) statsCount.creator++
  if (credit) statsCount.credit++
  if (source) statsCount.source++
  if (headline) statsCount.headline++
  if (scannerMake || scannerModel) statsCount.scanner++
  if (scannerSerial) statsCount.serial++
  if (submitter) statsCount.submitter++

  return {
 id: `photo_${index + 1}`,
 src: `assets/shoebox/photos/${filename}`,
 alt: filename,
 title: title,
 caption: caption,
 description: caption, // kept for backward compat
 submitter: submitter, // from IPTC Copyright "© Submitted by <Name>" (or null)
 people: people.join('; '),
 location: location,
 community: rawCity || null,
 province: rawProvince || null,
 sublocation: rawSublocation || null,
 countryCode: countryCode,
 keywords: topicalKeywords,
 year: photoYear, // historical photo date (derived from keywords/title/era)
 scanYear: scanYear, // EXIF scan/digitization date
 photoYearSource: photoYearSource,
 width: exifPick(exif, ['File:ImageWidth', 'ImageWidth']) || null,
 height: exifPick(exif, ['File:ImageHeight', 'ImageHeight']) || null,
 lat: coords.lat,
 lng: coords.lng,
 lastModified: stats.mtimeMs,
 rotation: 0,
 scale: 1,
 zIndex: 0,
 faceX: null, // populated by detect_faces.py (normalized 0-1, or null if no face detected)
 faceY: null, // populated by detect_faces.py
 // Lightroom / provenance fields (full preservation)
 rating: rating,
 label: label,
 creator: creatorStr,
 credit: credit,
 source: source,
 headline: headline,
 instructions: instructions,
 scannerMake: scannerMake,
 scannerModel: scannerModel,
 scannerSerial: scannerSerial,
 software: software,
 metadata: {
   dateCreated: dateCreated,
   timeCreated: timeCreated,
   dateTimeOriginal: dateTimeOriginal,
   createDate: createDate,
   copyright: rawCopyright || null,
   rights: (exifPick(exif, ['XMP-dc:Rights', 'Rights']) || '').trim() || null,
   gpsLatitude: gpsLat !== undefined ? gpsLat : null,
   gpsLongitude: gpsLng !== undefined ? gpsLng : null,
 },
  }
})

// ── Sort chronologically ──
photos.sort((a, b) => {
  if (a.year && b.year) return a.year - b.year
  if (a.year) return -1
  if (b.year) return 1
  return a.title.localeCompare(b.title)
})

// ── Reassign IDs after sort ──
photos.forEach((photo, index) => {
  photo.id = `photo_${index + 1}`
})

// ── Build manifest ──
const yearValues = photos.filter(p => p.year).map(p => p.year)
const manifest = {
  generatedAt: new Date().toISOString(),
  photoCount: photos.length,
  photos: photos,
  metadata: {
    yearRange: {
      min: yearValues.length > 0 ? Math.min(...yearValues) : null,
      max: yearValues.length > 0 ? Math.max(...yearValues) : null,
    },
    totalPhotos: photos.length,
    photosWithTitle: statsCount.title,
    photosWithCaption: statsCount.caption,
    photosWithYear: statsCount.year,
    photosWithCity: statsCount.city,
    photosWithProvince: statsCount.province,
    photosWithCountry: statsCount.country,
    photosWithLocation: photos.filter(p => p.location).length,
    photosWithGps: statsCount.gps,
    photosGeocoded: statsCount.geocoded,
    photosWithPeople: statsCount.people,
    photosWithRating: statsCount.rating,
    photosWithLabel: statsCount.label,
    photosWithCreator: statsCount.creator,
    photosWithCredit: statsCount.credit,
    photosWithSource: statsCount.source,
    photosWithHeadline: statsCount.headline,
    photosWithScanner: statsCount.scanner,
    photosWithScannerSerial: statsCount.serial,
    photosWithSubmitter: statsCount.submitter,
  }
}

// ── Merge approved community contributions (review-gated) ──────────────────
// Runs AFTER the exiftool pass and BEFORE writing output. Approved rows in
// contributions.json fill/override community fields on matching photos; the
// file itself is never modified, so approved work survives every regen.
// A missing or malformed contributions.json is skipped silently.
const CONTRIBUTIONS_FILE = path.join(PROJECT_ROOT, 'public/assets/shoebox/contributions.json')
let mergedPhotoCount = 0
if (fs.existsSync(CONTRIBUTIONS_FILE)) {
  try {
    const contributionsData = JSON.parse(fs.readFileSync(CONTRIBUTIONS_FILE, 'utf8'))
    const contributionRows = Array.isArray(contributionsData.contributions)
      ? contributionsData.contributions
      : []
    mergedPhotoCount = mergeContributions(manifest.photos, contributionRows)
  } catch (e) {
    console.warn(`  Skipping contributions merge (${e.message})`)
  }
}

// ── Write output ──

// ── Auto-run face detection (optional, if OpenCV available) ──
try {
  const cv2 = require('child_process')
  const pythonExe = process.platform === 'win32' ? 'python' : 'python3'
  const detectScript = path.join(PROJECT_ROOT, 'scripts', 'detect_faces.py')

  if (fs.existsSync(detectScript)) {
    console.log('\n  📸 Running face detection...')
    execSync(`${pythonExe} "${detectScript}" "${SOURCE_DIR}" "${path.join(path.dirname(OUTPUT_FILE), 'face_coords.json')}"`, {
      encoding: 'utf8',
      timeout: 120000, // 2 min timeout
      stdio: 'ignore', // suppress output unless there's an error
    })
    console.log('  ✓ Face detection complete')
  }
} catch (e) {
  // OpenCV not available — skip silently, face fields will remain null
  console.log('  ⚠ Face detection skipped (OpenCV not available)')
}

// Merge face coordinates into photos if face_coords.json exists
const FACE_COORDS_FILE = path.join(
  path.dirname(OUTPUT_FILE),
  'face_coords.json'
)
if (fs.existsSync(FACE_COORDS_FILE)) {
  const faceCoords = JSON.parse(fs.readFileSync(FACE_COORDS_FILE, 'utf8'))
  let merged = 0
  photos.forEach(photo => {
    const filename = photo.alt
    if (faceCoords[filename]) {
      photo.faceX = faceCoords[filename].faceX
      photo.faceY = faceCoords[filename].faceY
      merged++
    }
  })
  console.log(`  Merged face coords: ${merged}/${manifest.photoCount}`)
}

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true })
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2))

console.log('╔══════════════════════════════════════════════════╗')
console.log('║   Manifest Generated                            ║')
console.log('╚══════════════════════════════════════════════════╝')
console.log(`  Total photos:        ${manifest.photoCount}`)
console.log(`  Year range:          ${manifest.metadata.yearRange.min || 'N/A'} – ${manifest.metadata.yearRange.max || 'N/A'}`)
console.log(`  With title:          ${statsCount.title}/${manifest.photoCount}`)
console.log(`  With caption:        ${statsCount.caption}/${manifest.photoCount}`)
console.log(`  With year:           ${statsCount.year}/${manifest.photoCount}`)
console.log(`  With city (IPTC):    ${statsCount.city}/${manifest.photoCount}`)
console.log(`  With province:       ${statsCount.province}/${manifest.photoCount}`)
console.log(`  With country:        ${statsCount.country}/${manifest.photoCount}`)
console.log(`  With GPS (EXIF):     ${statsCount.gps}/${manifest.photoCount}`)
console.log(`  Geocoded (total):    ${statsCount.geocoded}/${manifest.photoCount}`)
console.log(`  With people:         ${statsCount.people}/${manifest.photoCount}`)
console.log(`  With submitter:      ${statsCount.submitter}/${manifest.photoCount}`)
console.log(`  With rating:         ${statsCount.rating}/${manifest.photoCount}`)
console.log(`  With label:          ${statsCount.label}/${manifest.photoCount}`)
console.log(`  With creator:        ${statsCount.creator}/${manifest.photoCount}`)
console.log(`  With credit:         ${statsCount.credit}/${manifest.photoCount}`)
console.log(`  With source:         ${statsCount.source}/${manifest.photoCount}`)
console.log(`  With headline:       ${statsCount.headline}/${manifest.photoCount}`)
console.log(`  With scanner:        ${statsCount.scanner}/${manifest.photoCount}`)
console.log(`  With scanner serial: ${statsCount.serial}/${manifest.photoCount}`)
if (mergedPhotoCount > 0) {
  console.log(`  Community merged:    ${mergedPhotoCount}/${manifest.photoCount} (approved contributions)`)
}
console.log()
console.log(`  ✓ Output: ${OUTPUT_FILE}`)
