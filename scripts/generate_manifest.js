/**
 * Shoebox Manifest Generator v2
 * 
 * Standard pipeline for generating manifest.json from source photos.
 * Reads structured IPTC/XMP metadata written by Adobe Lightroom:
 *   - IPTC City, Sub-location, Province-State, Country
 *   - IPTC ObjectName (title), Caption-Abstract (description)
 *   - GPS coordinates (with proper sign handling for Western Canada)
 *   - Keywords (tags + people names)
 *
 * Enrichment steps:
 *   1. Extract all IPTC location fields → build full "Community, Province, Canada" location
 *   2. Normalize province spellings to full name
 *   3. Geocode: GPS from EXIF if present, otherwise lookup table for known Métis communities
 *   4. Separate people names from topical keywords
 *   5. Clean up year ranges and date metadata
 *
 * Usage:
 *   node scripts/generate_manifest.js [SOURCE_DIR] [OUTPUT_FILE]
 * 
 * Defaults:
 *   SOURCE_DIR  = ./public/assets/shoebox/photos
 *   OUTPUT_FILE = ./public/assets/shoebox/manifest.json
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')

// ─── Configuration ──────────────────────────────────────────────────────────

const SOURCE_DIR = process.argv[2] || path.join(PROJECT_ROOT, 'public/assets/shoebox/photos')
const OUTPUT_FILE = process.argv[3] || path.join(PROJECT_ROOT, 'public/assets/shoebox/manifest.json')

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
  'Louis Riel Gravesite', 'St. Mary\'s Academy', 'Fort Garry Hotel', 'Fort Gary Hotel',
  'Selkirk Park', 'Prairie Bison Local', 'Local Meeting',
  'MMF', 'Manitoba Métis Federation', 'RRMNHC',
  'Minister', 'Prime Minister', 'President Chartrand',
  'Touched up', 'Foxhorn', 'rural',
  // Place names (these go to location, not people)
  'Duck Bay', 'Selkirk', 'St. Boniface', 'Winnipeg', 'Winnipeg Region',
  'Red River', 'St. Eustache', 'Fort Smith', 'Fond Du Lac', 'The Pas',
  'Beaulieu', 'Prince Albert', 'Black Lake', 'Grand Rapids',
  'Stony Rapids', 'Saskatoon', 'St. Andrews', 'Fort Chipewyan',
  'Saskatchewan', 'Manitoba', 'Alberta',
  // Street addresses (not people)
  '200 Main St.', '200 Main st.', '335 Main St.', '42 Thorncliff Bay', '787 Main St',
  '1963 Roblin Blvd. Shelmerdene Dr',
])

// Patterns that indicate a topical (non-person) keyword
const TOPICAL_PATTERNS = [
  /^\d{4}$/,                    // Pure year: 1964
  /^\d{4}-\d{4}$/,              // Year range: 1950-1975
  /^\d+\s/,                     // Starts with number: "200 Main st."
  /^\d{4}s$/,                   // Decade: "1950s"
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

// ─── EXIF Metadata Extraction ───────────────────────────────────────────────

function extractExifMetadata(filepath) {
  try {
    // -n flag: numeric output for GPS (signed decimals instead of DMS strings)
    const json = execSync(
      `exiftool -j -n ` +
      `-ImageDescription -ObjectName -Caption-Abstract -Keywords ` +
      `-DateTimeOriginal -DateCreated ` +
      `-GPSLatitude -GPSLongitude -GPSLatitudeRef -GPSLongitudeRef ` +
      `-City -Sub-location -Province-State -Country-PrimaryLocationName ` +
      `"${filepath}"`,
      { encoding: 'utf8', timeout: 10000 }
    )
    const data = JSON.parse(json)
    if (data && data.length > 0) {
      return data[0]
    }
  } catch (e) {
    // exiftool might not be available or other error
    console.warn(`  Warning: could not extract EXIF from ${path.basename(filepath)}: ${e.message}`)
  }
  return {}
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

function geocode(city, province, exifLat, exifLng) {
  // 1. Use GPS from EXIF if available (already signed decimals from -n flag)
  if (exifLat !== undefined && exifLng !== undefined &&
      !isNaN(exifLat) && !isNaN(exifLng) &&
      exifLat !== 0 && exifLng !== 0) {
    // Sanity check: ensure it's in Western Canada range
    if (exifLat >= 45 && exifLat <= 70 && exifLng >= -140 && exifLng <= -80) {
      return { lat: exifLat, lng: exifLng }
    }
  }

  // 2. Lookup by city name
  if (city && GEOCODE_TABLE[city]) {
    return GEOCODE_TABLE[city]
  }

  // 3. No coordinates available
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
console.log('║   Shoebox Manifest Generator v2                 ║')
console.log('╚══════════════════════════════════════════════════╝')
console.log(`Source: ${SOURCE_DIR}`)
console.log(`Output: ${OUTPUT_FILE}`)
console.log()

const files = fs.readdirSync(SOURCE_DIR)
const imageFiles = files.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))

console.log(`Found ${imageFiles.length} images to process...\n`)

let statsCount = { city: 0, province: 0, country: 0, gps: 0, geocoded: 0, people: 0, title: 0, caption: 0, year: 0 }

const photos = imageFiles.map((filename, index) => {
  const filepath = path.join(SOURCE_DIR, filename)
  const stats = fs.statSync(filepath)

  // ── Step 1: Extract all metadata ──
  const exif = extractExifMetadata(filepath)

  // ── Step 2: Title ──
  const exifTitle = (exif.ObjectName || '').trim()
  const title = exifTitle || formatTitleFromFilename(filename)

  // ── Step 3: Caption / Description ──
  const rawCaption = exif['Caption-Abstract'] || exif.ImageDescription || ''
  const caption = (typeof rawCaption === 'string' ? rawCaption : String(rawCaption)).trim()

  // ── Step 4: Location from IPTC structured fields ──
  const rawCity = normalizeCity(exif.City || '')
  const rawSublocation = (exif['Sub-location'] || '').trim()
  const rawProvince = normalizeProvince(exif['Province-State'] || '')
  const rawCountry = (exif['Country-PrimaryLocationName'] || '').trim()

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
  const rawKeywords = exif.Keywords || []
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
 const exifYear = extractYear(exif.DateCreated) || extractYear(exif.DateTimeOriginal)
 const scanYear = exifYear // EXIF timestamp = when the file was created/scanned
 const { photoYear, photoYearSource } = derivePhotoYear(topicalKeywords, title, exifYear)

  // ── Step 8: Geocoding ──
  const coords = geocode(rawCity, rawProvince, exif.GPSLatitude, exif.GPSLongitude)

  // ── Stats ──
  if (rawCity) statsCount.city++
  if (rawProvince) statsCount.province++
  if (rawCountry) statsCount.country++
  if (coords.lat !== null) statsCount.geocoded++
  if (exif.GPSLatitude !== undefined) statsCount.gps++
  if (people.length > 0) statsCount.people++
  if (title) statsCount.title++
  if (caption) statsCount.caption++
 if (photoYear) statsCount.year++

 return {
 id: `photo_${index + 1}`,
 src: `assets/shoebox/photos/${filename}`,
 alt: filename,
 title: title,
 caption: caption,
 description: caption, // kept for backward compat
 people: people.join('; '),
 location: location,
 community: rawCity || null,
 province: rawProvince || null,
 sublocation: rawSublocation || null,
 keywords: topicalKeywords,
 year: photoYear, // historical photo date (derived from keywords/title/era)
 scanYear: scanYear, // EXIF scan/digitization date
 photoYearSource: photoYearSource,
 lat: coords.lat,
 lng: coords.lng,
 lastModified: stats.mtimeMs,
 rotation: 0,
 scale: 1,
 zIndex: 0,
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
  }
}

// ── Write output ──
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
console.log()
console.log(`  ✓ Output: ${OUTPUT_FILE}`)
