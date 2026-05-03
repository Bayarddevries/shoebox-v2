export interface Photo {
 id: number
 src: string
 alt: string
 title?: string
 caption?: string
 people?: string
 location?: string
 community?: string
 province?: string
 sublocation?: string
 keywords?: string[]
 storyIds?: string[]
 lat?: number
 lng?: number
 position?: { x: number; y: number }
 rotation?: number
 scale?: number
 zIndex?: number
 lastModified?: number
 year?: number // historical photo date (derived from keywords/title/era)
 scanYear?: number // EXIF scan/digitization date
 photoYearSource?: 'keyword-specific' | 'title' | 'keyword-era' | 'scan-date' | 'unknown'
}

export interface Story {
  id: string
  title: string
  text: string
  audioSrc: string
  photoIds: number[]
  textFile?: string
  audioFile?: string
  _photoFiles?: string[]
}

/**
 * Multi-select filter state — all values are arrays.
 * Synced to URL query params for shareable/bookmarkable filtered views.
 */
export interface FilterState {
  search: string
  communities: string[]
  families: string[]
  decades: string[]
  keywords: string[]
}

export const EMPTY_FILTERS: FilterState = {
  search: '',
  communities: [],
  families: [],
  decades: [],
  keywords: [],
}

/** Check if any filter is active */
export function hasActiveFilters(filters: FilterState): boolean {
  return !!(
    filters.search ||
    filters.communities.length ||
    filters.families.length ||
    filters.decades.length ||
    filters.keywords.length
  )
}

/** Count total active filter selections (excluding search) */
export function activeFilterCount(filters: FilterState): number {
  return (
    filters.communities.length +
    filters.families.length +
    filters.decades.length +
    filters.keywords.length
  )
}

/** Serialize FilterState to URLSearchParams */
export function filtersToSearchParams(filters: FilterState): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.search) params.set('q', filters.search)
  filters.communities.forEach(v => params.append('community', v))
  filters.families.forEach(v => params.append('family', v))
  filters.decades.forEach(v => params.append('decade', v))
  filters.keywords.forEach(v => params.append('keyword', v))
  return params
}

/** Parse URLSearchParams into FilterState */
export function searchParamsToFilters(params: URLSearchParams): FilterState {
  return {
    search: params.get('q') || '',
    communities: params.getAll('community'),
    families: params.getAll('family'),
    decades: params.getAll('decade'),
    keywords: params.getAll('keyword'),
  }
}

/** Toggle a value in a string array (add if missing, remove if present) */
export function toggleFilterValue(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]
}

export type Page = 'home' | 'archive' | 'stories' | 'map' | 'contribute'
