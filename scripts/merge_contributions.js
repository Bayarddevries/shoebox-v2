/**
 * merge_contributions.js — shared, pure merge logic used by:
 *   - scripts/generate_manifest.js  (merge into manifest.json after the exiftool pass)
 *   - scripts/test_scripts.mjs      (fixture tests)
 *
 * Review gate (HARD requirement):
 *   Only contributions with status === 'approved' are ever merged into the
 *   manifest. Pending / declined / reviewed-but-not-approved contributions
 *   NEVER touch the manifest, no matter what fields they carry.
 *
 * An approved contribution is the ADMIN-REVIEWED version (review happened
 * before status became 'approved'), so its non-empty values are authoritative:
 * they fill manifest fields Lightroom left empty AND override fields the admin
 * decided to correct. This is what makes approved community metadata survive
 * every Lightroom re-export (contributions.json is never modified here).
 *
 * Field mapping (contribution -> manifest):
 *   caption      -> caption, description (manifest keeps description = caption)
 *   people       -> people
 *   location     -> location
 *   community    -> community
 *   province     -> province
 *   sublocation  -> sublocation
 *   keywords     -> keywords (array)
 *   dateYear     -> year (only when a plausible 4-digit year)
 */

export const MERGE_FIELDS = [
  'caption',
  'description',
  'people',
  'location',
  'community',
  'province',
  'sublocation',
  'keywords',
  'year',
]

function isBlank(value) {
  return (
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  )
}

function toKeywords(value) {
  if (Array.isArray(value)) {
    return value.map(String).map((k) => k.trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(/[,;]/)
      .map((k) => k.trim())
      .filter(Boolean)
  }
  return []
}

function normalizeYear(value) {
  if (isBlank(value)) return null
  const match = String(value).match(/(\d{4})/)
  if (!match) return null
  const year = parseInt(match[1], 10)
  return year >= 1800 && year <= 2100 ? year : null
}

/**
 * Merges approved contributions into an array of manifest photo objects.
 * Mutates and returns the same array (so callers can keep the reference).
 *
 * @param {Array<object>} manifestPhotos
 * @param {Array<object>} contributions
 * @returns {number} number of photos that received community metadata
 */
export function mergeContributions(manifestPhotos, contributions) {
  const approved = (contributions || []).filter((c) => c && c.status === 'approved')
  if (approved.length === 0) return 0

  const byId = new Map(manifestPhotos.map((p) => [p.id, p]))
  let mergedCount = 0

  for (const contribution of approved) {
    const photo = byId.get(contribution.photoId)
    if (!photo) continue // photo not in this manifest -> leave untouched

    let touched = false

    const caption = typeof contribution.caption === 'string' ? contribution.caption.trim() : ''
    if (caption) {
      photo.caption = caption
      photo.description = caption // manifest keeps description mirroring caption
      touched = true
    }

    for (const field of ['people', 'location', 'community', 'province', 'sublocation']) {
      const value = typeof contribution[field] === 'string' ? contribution[field].trim() : ''
      if (value) {
        photo[field] = value
        touched = true
      }
    }

    const keywords = toKeywords(contribution.keywords)
    if (keywords.length > 0) {
      photo.keywords = keywords
      touched = true
    }

    const year = normalizeYear(contribution.dateYear)
    if (year !== null) {
      photo.year = year
      touched = true
    }

    if (touched) mergedCount++
  }

  return mergedCount
}
