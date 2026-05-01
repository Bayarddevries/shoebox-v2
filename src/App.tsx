import { useState, useEffect, useMemo } from 'react'
import type { Photo, Story } from './types'
import Navbar from './components/Navbar'
import ArchiveGrid from './components/ArchiveGrid'
import PhotoDetail from './components/PhotoDetail'
import FilterSidebar from './components/FilterSidebar'
import MapView from './components/MapView'
import StoriesView from './components/StoriesView'
import ContributeForm from './components/ContributeForm'

type Page = 'home' | 'archive' | 'stories' | 'map' | 'contribute'

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedYearSpan, setSelectedYearSpan] = useState<string | null>(null)
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [showContribute, setShowContribute] = useState(false)

  // Load manifest on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load manifest
        const manifestRes = await fetch('/assets/shoebox/manifest.json')
        const manifestPhotos = await manifestRes.json()
        
        // Load stories
        const storiesRes = await fetch('/assets/shoebox/stories.json')
        const storiesData = await storiesRes.json()
        
        // Convert stories to have photoIds
        const storiesWithIds: Story[] = storiesData.map((s: any) => ({
          id: s.id,
          title: s.title,
          text: s.text_file ? '' : '', // Text loaded separately if needed
          audioSrc: s.audio_file ? `/assets/shoebox/audio/${s.audio_file}` : '',
          photoIds: [] as number[],
          textFile: s.text_file,
          audioFile: s.audio_file,
          _photoFiles: s.photo_files || []
        }))
        
        // Match photos to stories
        const photosWithStoryLinks = manifestPhotos.map((p: any, idx: number) => {
          const storyLinks = storiesWithIds.filter(s => s._photoFiles?.includes(p.alt || p.title))
          return {
            ...p,
            id: typeof p.id === 'string' ? parseInt(p.id.replace('photo_', ''), 10) || idx : p.id,
            storyIds: storyLinks.map(s => s.id)
          }
        })
        
        // Update story photoIds
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

  // Extract unique values for filters
  const { families, locations, yearSpans } = useMemo(() => {
    const families = new Set<string>()
    const locations = new Set<string>()
    const yearSpans = new Set<string>()
    
    photos.forEach(p => {
      // Extract family names from people
      if (p.people) {
        p.people.split(',').forEach(name => {
          const parts = name.trim().split(' ')
          if (parts.length > 1) families.add(parts[parts.length - 1])
        })
      }
      
      // Extract location
      if (p.location) locations.add(p.location)
      
      // Extract keywords with year spans
      if (p.keywords) {
        p.keywords.forEach(kw => {
          if (/\d{4}-\d{4}/.test(kw)) yearSpans.add(kw)
        })
      }
    })
    
    return {
      families: Array.from(families).sort(),
      locations: Array.from(locations).sort(),
      yearSpans: Array.from(yearSpans).sort(),
    }
  }, [photos])

  // Filter photos based on active filters
  const filteredPhotos = useMemo(() => {
    return photos.filter(photo => {
      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const searchText = [photo.title, photo.caption, photo.location, photo.people, ...(photo.keywords || [])].join(' ').toLowerCase()
        if (!searchText.includes(q)) return false
      }
      
      // Year span filter
      if (selectedYearSpan) {
        if (!photo.keywords?.includes(selectedYearSpan)) return false
      }
      
      // Family filter
      if (selectedFamily) {
        if (!photo.people?.toLowerCase().includes(selectedFamily.toLowerCase())) return false
      }
      
      // Location filter
      if (selectedLocation) {
        if (!photo.location?.toLowerCase().includes(selectedLocation.toLowerCase())) return false
      }
      
      return true
    })
  }, [photos, searchQuery, selectedYearSpan, selectedFamily, selectedLocation])

  // Sort by oldest first
  const sortedPhotos = useMemo(() => {
    return [...filteredPhotos].sort((a, b) => {
      // Use year field if available, otherwise use lastModified
      const yearA = a.year || Math.floor((a.lastModified || 0) / 100000000000)
      const yearB = b.year || Math.floor((b.lastModified || 0) / 100000000000)
      return yearA - yearB
    })
  }, [filteredPhotos])

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedYearSpan(null)
    setSelectedFamily(null)
    setSelectedLocation(null)
  }

  const hasActiveFilters = !!(searchQuery || selectedYearSpan || selectedFamily || selectedLocation)

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
      <Navbar currentPage={currentPage} onNavigate={setCurrentPage} onContribute={() => setShowContribute(true)} />
      
      <main>
        {/* HOME PAGE */}
        {currentPage === 'home' && (
          <div className="relative">
            {/* Hero Section */}
            <div className="relative h-[60vh] min-h-[400px] flex items-center justify-center overflow-hidden">
              <div 
                className="absolute inset-0 bg-cover bg-center"
                style={{ 
                  backgroundImage: photos[0]?.src ? `url(${photos[0].src})` : undefined,
                  filter: 'brightness(0.4)'
                }}
              />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(139,0,0,0.3), rgba(0,0,0,0.7))' }} />
              <div className="relative z-10 text-center text-white px-6">
                <h1 className="text-5xl md:text-7xl font-serif mb-6">Red River Métis</h1>
                <p className="text-xl md:text-2xl mb-8 opacity-90">Digital Archive & Heritage Collection</p>
                <button 
                  onClick={() => setCurrentPage('archive')}
                  className="btn-primary text-lg"
                >
                  Explore the Archive
                </button>
              </div>
            </div>
            
            {/* Stats */}
            <div className="max-w-6xl mx-auto py-16 px-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                <div>
                  <div className="text-4xl font-serif mb-2" style={{ color: 'var(--color-crimson)' }}>{photos.length}</div>
                  <div className="text-sm uppercase tracking-wider" style={{ color: 'var(--color-charcoal-light)' }}>Photographs</div>
                </div>
                <div>
                  <div className="text-4xl font-serif mb-2" style={{ color: 'var(--color-crimson)' }}>{stories.length}</div>
                  <div className="text-sm uppercase tracking-wider" style={{ color: 'var(--color-charcoal-light)' }}>Stories</div>
                </div>
                <div>
                  <div className="text-4xl font-serif mb-2" style={{ color: 'var(--color-crimson)' }}>{families.length}</div>
                  <div className="text-sm uppercase tracking-wider" style={{ color: 'var(--color-charcoal-light)' }}>Families</div>
                </div>
                <div>
                  <div className="text-4xl font-serif mb-2" style={{ color: 'var(--color-crimson)' }}>{locations.length}</div>
                  <div className="text-sm uppercase tracking-wider" style={{ color: 'var(--color-charcoal-light)' }}>Locations</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ARCHIVE PAGE */}
        {currentPage === 'archive' && (
          <div className="flex min-h-[calc(100vh-73px)]">
            {/* Sidebar */}
            <FilterSidebar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              families={families}
              selectedFamily={selectedFamily}
              onFamilySelect={setSelectedFamily}
              locations={locations}
              selectedLocation={selectedLocation}
              onLocationSelect={setSelectedLocation}
              yearSpans={yearSpans}
              selectedYearSpan={selectedYearSpan}
              onYearSpanSelect={setSelectedYearSpan}
              onClearFilters={clearFilters}
              hasActiveFilters={hasActiveFilters}
              resultsCount={filteredPhotos.length}
            />
            
            {/* Main Content */}
            <div className="flex-1 overflow-auto custom-scrollbar">
              <ArchiveGrid photos={sortedPhotos} onPhotoClick={setSelectedPhoto} />
            </div>
          </div>
        )}

        {/* MAP PAGE */}
        {currentPage === 'map' && (
          <MapView photos={photos} onPhotoClick={setSelectedPhoto} />
        )}

        {/* STORIES PAGE */}
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