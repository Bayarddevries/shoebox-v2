interface FilterSidebarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  families: string[]
  selectedFamily: string | null
  onFamilySelect: (family: string | null) => void
  locations: string[]
  selectedLocation: string | null
  onLocationSelect: (location: string | null) => void
  yearSpans: string[]
  selectedYearSpan: string | null
  onYearSpanSelect: (span: string | null) => void
  onClearFilters: () => void
  hasActiveFilters: boolean
  resultsCount: number
}

export default function FilterSidebar({
  searchQuery,
  onSearchChange,
  families,
  selectedFamily,
  onFamilySelect,
  locations,
  selectedLocation,
  onLocationSelect,
  yearSpans,
  selectedYearSpan,
  onYearSpanSelect,
  onClearFilters,
  hasActiveFilters,
  resultsCount,
}: FilterSidebarProps) {
  return (
    <aside 
      className="w-72 border-r overflow-y-auto custom-scrollbar hidden md:block"
      style={{ 
        background: 'var(--color-parchment)',
        borderColor: 'var(--color-border)',
        maxHeight: 'calc(100vh - 73px)'
      }}
    >
      <div className="p-6">
        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search archives..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="search-input"
          />
        </div>

        {/* Results count */}
        <div className="mb-4 text-sm" style={{ color: 'var(--color-charcoal-light)' }}>
          Showing <strong>{resultsCount}</strong> photo{resultsCount !== 1 ? 's' : ''}
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="w-full btn-secondary text-xs mb-6"
          >
            Clear All Filters
          </button>
        )}

        {/* Year Span Filter */}
        {yearSpans.length > 0 && (
          <div className="filter-section">
            <h3 className="filter-title">Time Period</h3>
            <div className="space-y-1">
              {yearSpans.map((span) => (
                <button
                  key={span}
                  onClick={() => onYearSpanSelect(selectedYearSpan === span ? null : span)}
                  className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                    selectedYearSpan === span 
                      ? 'bg-crimson text-white' 
                      : 'hover:bg-cream'
                  }`}
                  style={selectedYearSpan === span ? { background: 'var(--color-crimson)', color: 'white' } : { background: 'transparent' }}
                >
                  {span}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Family Filter */}
        {families.length > 0 && (
          <div className="filter-section">
            <h3 className="filter-title">Families</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
              {families.map((family) => (
                <button
                  key={family}
                  onClick={() => onFamilySelect(selectedFamily === family ? null : family)}
                  className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                    selectedFamily === family 
                      ? 'bg-crimson text-white' 
                      : 'hover:bg-cream'
                  }`}
                  style={selectedFamily === family ? { background: 'var(--color-crimson)', color: 'white' } : { background: 'transparent' }}
                >
                  {family}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Location Filter */}
        {locations.length > 0 && (
          <div className="filter-section">
            <h3 className="filter-title">Locations</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
              {locations.map((location) => (
                <button
                  key={location}
                  onClick={() => onLocationSelect(selectedLocation === location ? null : location)}
                  className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                    selectedLocation === location 
                      ? 'bg-crimson text-white' 
                      : 'hover:bg-cream'
                  }`}
                  style={selectedLocation === location ? { background: 'var(--color-crimson)', color: 'white' } : { background: 'transparent' }}
                >
                  📍 {location}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}