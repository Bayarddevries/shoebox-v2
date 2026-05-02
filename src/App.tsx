import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { Photo, Story, Page, FilterState } from './types'
import { EMPTY_FILTERS, filtersToSearchParams, searchParamsToFilters, hasActiveFilters } from './types'
import Navbar from './components/Navbar'
import ArchiveGrid from './components/ArchiveGrid'
import PhotoDetail from './components/PhotoDetail'
import FilterBar from './components/FilterBar'
import MapView from './components/MapView'
import StoriesView from './components/StoriesView'
import ContributeForm from './components/ContributeForm'

// Debounce hook
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [showContribute, setShowContribute] = useState(false)
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const initialUrlRead = useRef(false)

  // ── URL sync ──────────────────────────────────────────
  // Read filters from URL on mount
  useEffect(() => {
    if (initialUrlRead.current) return
    initialUrlRead.current = true
    const params = new URLSearchParams(window.location.search)
    const urlFilters = searchParamsToFilters(params)
    if (hasActiveFilters(urlFilters)) {
      setFilters(urlFilters)
      setCurrentPage('archive')
    }
    // Also check for #archive, #map, #stories hash
    const hash = window.location.hash.replace('#', '')
    if (['archive', 'map', 'stories'].includes(hash)) {
      setCurrentPage(hash as Page)
    }
  }, [])

  // Write filters to URL when they change
  useEffect(() => {
    if (!initialUrlRead.current) return
    const params = filtersToSearchParams(filters)
    const qs = params.toString()
    const newUrl = qs
      ? `${window.location.pathname}?${qs}${window.location.hash}`
      : `${window.location.pathname}${window.location.hash}`
    window.history.replaceState(null, '', newUrl)
  }, [filters])

  // ── Data loading ──────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      try {
        const base = import.meta.env.BASE_URL
        const manifestRes = await fetch(`${base}assets/shoebox/manifest.json`)
        const manifestData = await manifestRes.json()
        const manifestPhotos = Array.isArray(manifestData) ? manifestData : (manifestData.photos || [])

        const storiesRes = await fetch(`${base}assets/shoebox/stories.json`)
        const storiesData = await storiesRes.json()

        const storiesWithIds: Story[] = storiesData.map((s: any) => ({
          id: s.id,
          title: s.title,
          text: s.text_file ? '' : '',
          audioSrc: s.audio_file ? `${base}assets/shoebox/audio/${s.audio_file}` : '',
          photoIds: [] as number[],
          textFile: s.text_file,
          audioFile: s.audio_file,
          _photoFiles: s.photo_files || [],
        }))

        const photosWithStoryLinks = manifestPhotos.map((p: any, idx: number) => {
          const storyLinks = storiesWithIds.filter(s => s._photoFiles?.includes(p.alt || p.title))
          return {
            ...p,
            id: typeof p.id === 'string' ? parseInt(p.id.replace('photo_', ''), 10) || idx : p.id,
            storyIds: storyLinks.map(s => s.id),
          }
        })

        storiesWithIds.forEach(story => {
          story.photoIds = photosWithStoryLinks
            .filter((p: any) => story._photoFiles?.includes(p.alt || p.title))
            .map((p: any) => p.id)
        })

        setPhotos(photosWithStoryLinks)
        setStories(storiesWithIds)
      } catch (err) {
        console.error('Failed to load manifest:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // ── Extract filter options from data ──────────────────
  const { communities, families, decades, keywords } = useMemo(() => {
    const communitySet = new Set<string>()
    const familySet = new Set<string>()
    const decadeSet = new Set<string>()
    const keywordCount = new Map<string, number>()

    photos.forEach(p => {
      // Community from structured field, fallback to location
      if (p.community) {
        communitySet.add(p.community)
      } else if (p.location) {
        // Only use location as community fallback if it looks like a place name
        const loc = p.location.split(',')[0].trim()
        if (loc.length > 1 && loc.length < 40) communitySet.add(loc)
      }

      // Family names from people field
      if (p.people) {
        p.people.split(',').forEach(name => {
          const trimmed = name.trim()
          const parts = trimmed.split(' ')
          if (parts.length > 1) {
            // Take last word as surname (common convention)
            const surname = parts[parts.length - 1]
            // Filter out obvious non-surnames
            if (surname.length > 1 && !/^\d+$/.test(surname)) {
              familySet.add(surname)
            }
          } else if (trimmed.length > 1) {
            // Single-word name — include as-is
            familySet.add(trimmed)
          }
        })
      }

      // Decades from year field
      if (p.year) {
        const decade = Math.floor(p.year / 10) * 10
        decadeSet.add(`${decade}s`)
      }

      // Keywords — count occurrences, only show top ones
      if (p.keywords) {
        p.keywords.forEach(kw => {
          // Skip year-span patterns and people names (they have their own filters)
          if (/^\d{4}-\d{4}$/.test(kw)) return
          keywordCount.set(kw, (keywordCount.get(kw) || 0) + 1)
        })
      }
    })

    // Only include keywords used by 2+ photos, sorted by frequency
    const topKeywords = Array.from(keywordCount.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([kw]) => kw)
      .slice(0, 25)

    return {
      communities: Array.from(communitySet).sort(),
      families: Array.from(familySet).sort(),
      decades: Array.from(decadeSet).sort(),
      keywords: topKeywords,
    }
  }, [photos])

  // ── Debounced search ──────────────────────────────────
  const debouncedSearch = useDebouncedValue(filters.search, 250)

  // ── Filter photos ─────────────────────────────────────
  const filteredPhotos = useMemo(() => {
    return photos.filter(photo => {
      // Search
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase()
        const searchFields = [
          photo.title,
          photo.caption,
          photo.location,
          photo.community,
          photo.people,
          ...(photo.keywords || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!searchFields.includes(q)) return false
      }

      // Community filter (match against community field or location)
      if (filters.communities.length > 0) {
        const photoCommunity = photo.community || (photo.location ? photo.location.split(',')[0].trim() : '')
        if (!filters.communities.some(c => photoCommunity === c || photo.location?.includes(c))) return false
      }

      // Family filter
      if (filters.families.length > 0) {
        const photoPeople = (photo.people || '').toLowerCase()
        if (!filters.families.some(f => photoPeople.includes(f.toLowerCase()))) return false
      }

      // Decade filter
      if (filters.decades.length > 0) {
        if (!photo.year) return false
        const photoDecade = `${Math.floor(photo.year / 10) * 10}s`
        if (!filters.decades.includes(photoDecade)) return false
      }

      // Keyword filter
      if (filters.keywords.length > 0) {
        const photoKws = photo.keywords || []
        if (!filters.keywords.some(k => photoKws.includes(k))) return false
      }

      return true
    })
  }, [photos, debouncedSearch, filters])

  // ── Sort ──────────────────────────────────────────────
  const sortedPhotos = useMemo(() => {
    return [...filteredPhotos].sort((a, b) => {
      const yearA = a.year || 9999
      const yearB = b.year || 9999
      return yearA - yearB
    })
  }, [filteredPhotos])

  // ── Navigation with hash ──────────────────────────────
  const navigate = useCallback((page: Page) => {
    setCurrentPage(page)
    window.location.hash = page === 'home' ? '' : page
  }, [])

  // ── Loading state ─────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-parchment)' }}>
        <div className="text-center">
          <div className="cinzel text-2xl mb-4" style={{ color: 'var(--color-crimson)' }}>Loading Archive...</div>
          <div className="w-48 h-2 mx-auto rounded overflow-hidden" style={{ background: 'var(--color-cream)' }}>
            <div className="h-full rounded shimmer" style={{ background: 'var(--color-crimson)', width: '60%' }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-parchment)' }}>
      <Navbar currentPage={currentPage} onNavigate={navigate} onContribute={() => setShowContribute(true)} />

      <main>
        {/* ═══ HOME PAGE ═══ */}
        {currentPage === 'home' && (
          <div className="relative">
            <div className="hero-section">
              <div
                className="hero-bg"
                style={{
                  backgroundImage: photos[0]?.src ? `url(${photos[0].src})` : undefined,
                }}
              />
              <div className="hero-overlay" />
              <div className="hero-content">
                <h1 className="hero-title">Red River Métis</h1>
                <p className="hero-subtitle">Digital Archive & Heritage Collection</p>
                <button
                  onClick={() => navigate('archive')}
                  className="btn-primary text-lg"
                >
                  Explore the Archive
                </button>
              </div>
            </div>

            <div className="max-w-6xl mx-auto py-16 px-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                <div>
                  <div className="stat-number">{photos.length}</div>
                  <div className="stat-label">Photographs</div>
                </div>
                <div>
                  <div className="stat-number">{stories.length}</div>
                  <div className="stat-label">Stories</div>
                </div>
                <div>
                  <div className="stat-number">{families.length}</div>
                  <div className="stat-label">Families</div>
                </div>
                <div>
                  <div className="stat-number">{communities.length}</div>
                  <div className="stat-label">Communities</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ ARCHIVE PAGE ═══ */}
        {currentPage === 'archive' && (
          <div>
            <FilterBar
              filters={filters}
              onFiltersChange={setFilters}
              communities={communities}
              families={families}
              decades={decades}
              keywords={keywords}
              resultsCount={filteredPhotos.length}
              totalCount={photos.length}
            />
            <div className="archive-page-content">
              <ArchiveGrid photos={sortedPhotos} onPhotoClick={setSelectedPhoto} />
            </div>
          </div>
        )}

        {/* ═══ MAP PAGE ═══ */}
        {currentPage === 'map' && (
          <MapView photos={photos} onPhotoClick={setSelectedPhoto} />
        )}

        {/* ═══ STORIES PAGE ═══ */}
        {currentPage === 'stories' && (
          <StoriesView stories={stories} photos={photos} onPhotoClick={setSelectedPhoto} />
        )}
      </main>

      {/* Photo Detail Modal */}
      {selectedPhoto && (
        <PhotoDetail
          photo={selectedPhoto}
          stories={stories.filter(s => s.photoIds?.includes(selectedPhoto.id))}
          onClose={() => setSelectedPhoto(null)}
        />
      )}

      {/* Contribute Modal */}
      {showContribute && (
        <ContributeForm onClose={() => setShowContribute(false)} />
      )}
    </div>
  )
}
