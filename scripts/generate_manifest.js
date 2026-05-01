/**
 * Shoebox Manifest Generator
 * 
 * Generates manifest.json from source photos with:
 * - EXIF/IPTC metadata extraction (description, title, keywords, GPS, date)
 * - Year extraction from filenames or EXIF dates
 * - Proper title formatting (prefers IPTC ObjectName over filename)
 * - Chronological sorting (oldest first)
 * - GPS coordinates for map view
 * - Rich keyword parsing
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const SOURCE_DIR = '/home/bayard_devries/Backup/Website/assets/shoebox/photos'
const OUTPUT_FILE = '/home/bayard_devries/projects/Shoebox V2/public/assets/shoebox/manifest.json'

// Year extraction patterns from filenames
const YEAR_PATTERNS = [
  /(\d{4})[\s_-].*/,
  /(\d{4})_/,
  /(\d{4})$/,
]

function extractYearFromFilename(filename) {
  for (const pattern of YEAR_PATTERNS) {
    const match = filename.match(pattern)
    if (match) {
      const year = parseInt(match[1])
      if (year >= 1800 && year <= 2000) {
        return year
      }
    }
  }
  return null
}

// Format a title from filename (fallback)
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

// Parse EXIF date string (YYYY:MM:DD HH:MM:SS) into components
function parseExifDate(dateStr) {
  if (!dateStr) return null
  const match = dateStr.match(/(\d{4})/)
  if (match) {
    return { year: parseInt(match[1]) }
  }
  return null
}

// Extract EXIF metadata using exiftool
function extractExifMetadata(filepath) {
  try {
    const json = execSync(
      `exiftool -j -ImageDescription -ObjectName -Caption-Abstract -Keywords -DateTimeOriginal -GPSLatitude -GPSLongitude -Province-State -Country-PrimaryLocationName "${filepath}"`,
      { encoding: 'utf8', timeout: 10000 }
    )
    const data = JSON.parse(json)
    if (data && data.length > 0) {
      return data[0]
    }
  } catch (e) {
    // exiftool might not be available or other error
  }
  return {}
}

// Get all photos
const files = fs.readdirSync(SOURCE_DIR)
const imageFiles = files.filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f))

console.log(`Found ${imageFiles.length} images to process...`)

const photos = imageFiles.map((filename, index) => {
  const filepath = path.join(SOURCE_DIR, filename)
  const stats = fs.statSync(filepath)
  
  // Extract EXIF/IPTC metadata from the actual image file
  const exif = extractExifMetadata(filepath)
  
  // Title: prefer IPTC ObjectName, then filename-derived title
  const exifTitle = (exif.ObjectName || '').trim()
  const filenameTitle = formatTitleFromFilename(filename)
  const title = exifTitle || filenameTitle
  
  // Description/caption: prefer ImageDescription, then Caption-Abstract
  const rawDesc = exif.ImageDescription || exif['Caption-Abstract'] || ''
  const description = (typeof rawDesc === 'string' ? rawDesc : String(rawDesc)).trim()
  
  // Keywords
  const rawKeywords = exif.Keywords || ''
  let keywords = []
  if (typeof rawKeywords === 'string') {
    keywords = rawKeywords.split(',').map(k => k.trim()).filter(Boolean)
  } else if (Array.isArray(rawKeywords)) {
    keywords = rawKeywords.map(k => String(k).trim()).filter(Boolean)
  }
  
  // Year: prefer EXIF date original, then filename extraction
  const exifDate = parseExifDate(exif.DateTimeOriginal)
  const yearFromFile = extractYearFromFilename(filename)
  const year = exifDate?.year || yearFromFile
  
  // Add year to keywords if not already present
  if (year && !keywords.some(k => k === String(year))) {
    keywords.unshift(String(year))
  }
  
  // Extract location from IPTC fields
  const province = (exif['Province-State'] || '').trim()
  const country = (exif['Country-PrimaryLocationName'] || '').trim()
  const location = [province, country].filter(Boolean).join(', ')
  
  // GPS coordinates
  let lat = null
  let lng = null
  if (exif.GPSLatitude !== undefined && exif.GPSLongitude !== undefined) {
    lat = typeof exif.GPSLatitude === 'number' ? exif.GPSLatitude : parseFloat(exif.GPSLatitude)
    lng = typeof exif.GPSLongitude === 'number' ? exif.GPSLongitude : parseFloat(exif.GPSLongitude)
  }
  
  return {
    id: `photo_${index + 1}`,
    src: `assets/shoebox/photos/${filename}`,
    alt: filename,
    title: title,
    caption: description,
    description: description,
    people: '',
    location: location,
    keywords: keywords,
    year: year,
    lat: lat,
    lng: lng,
    lastModified: stats.mtimeMs,
    rotation: 0,
    scale: 1,
    zIndex: 0
  }
})

// Sort by year (oldest first), then by title
photos.sort((a, b) => {
  if (a.year && b.year) return a.year - b.year
  if (a.year) return -1
  if (b.year) return 1
  return a.title.localeCompare(b.title)
})

// Reassign IDs after sorting
photos.forEach((photo, index) => {
  photo.id = `photo_${index + 1}`
})

// Stats for metadata block
const photosWithYear = photos.filter(p => p.year)
const photosWithLocation = photos.filter(p => p.location)
const photosWithCaption = photos.filter(p => p.caption)
const photosWithKeywords = photos.filter(p => p.keywords && p.keywords.length > 0)
const photosWithGps = photos.filter(p => p.lat !== null && p.lng !== null)
const photosWithPeople = photos.filter(p => p.people)

// Generate manifest
const manifest = {
  generatedAt: new Date().toISOString(),
  photoCount: photos.length,
  photos: photos,
  metadata: {
    yearRange: {
      min: photosWithYear.length > 0 ? Math.min(...photosWithYear.map(p => p.year)) : null,
      max: photosWithYear.length > 0 ? Math.max(...photosWithYear.map(p => p.year)) : null
    },
    totalPhotos: photos.length,
    photosWithYear: photosWithYear.length,
    photosWithLocation: photosWithLocation.length,
    photosWithCaption: photosWithCaption.length,
    photosWithKeywords: photosWithKeywords.length,
    photosWithGps: photosWithGps.length,
    photosWithPeople: photosWithPeople.length
  }
}

// Write output
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2))
console.log(`\n✓ Generated manifest with ${photos.length} photos`)
console.log(`  Year range: ${manifest.metadata.yearRange.min || 'N/A'} - ${manifest.metadata.yearRange.max || 'N/A'}`)
console.log(`  Photos with year: ${manifest.metadata.photosWithYear}`)
console.log(`  Photos with location: ${manifest.metadata.photosWithLocation}`)
console.log(`  Photos with caption: ${manifest.metadata.photosWithCaption}`)
console.log(`  Photos with keywords: ${manifest.metadata.photosWithKeywords}`)
console.log(`  Photos with GPS: ${manifest.metadata.photosWithGps}`)
console.log(`  Photos with people: ${manifest.metadata.photosWithPeople}`)
console.log(`  Output: ${OUTPUT_FILE}`)