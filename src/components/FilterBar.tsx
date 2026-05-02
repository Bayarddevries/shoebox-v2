import { useState, useEffect, useCallback } from 'react'
import type { FilterState } from '../types'
import { toggleFilterValue, activeFilterCount, hasActiveFilters } from '../types'

interface FilterBarProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  communities: string[]
  families: string[]
  decades: string[]
  keywords: string[]
  resultsCount: number
  totalCount: number
}

export default function FilterBar({
  filters,
  onFiltersChange,
  communities,
  families,
  decades,
  keywords,
  resultsCount,
  totalCount,
}: FilterBarProps) {
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [searchFocused, setSearchFocused] = useState(false)
  const [sheetVisible, setSheetVisible] = useState(false)

  const filterCount = activeFilterCount(filters)
  const hasFilters = hasActiveFilters(filters)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.filter-dropdown-wrapper')) {
        setActiveDropdown(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Animated mobile sheet open/close
  const openSheet = useCallback(() => {
    setMobileSheetOpen(true)
    requestAnimationFrame(() => setSheetVisible(true))
  }, [])
  const closeSheet = useCallback(() => {
    setSheetVisible(false)
    setTimeout(() => setMobileSheetOpen(false), 280) // match transition duration
  }, [])

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeSheet()
        setActiveDropdown(null)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [closeSheet])

  const toggleValue = useCallback((key: keyof FilterState, value: string) => {
    if (key === 'search') return
    const currentArr = filters[key] as string[]
    onFiltersChange({ ...filters, [key]: toggleFilterValue(currentArr, value) })
  }, [filters, onFiltersChange])

  const clearAll = useCallback(() => {
    onFiltersChange({
      search: '',
      communities: [],
      families: [],
      decades: [],
      keywords: [],
    })
    setActiveDropdown(null)
  }, [onFiltersChange])

  const removeValue = useCallback((key: keyof FilterState, value: string) => {
    if (key === 'search') return
    const currentArr = filters[key] as string[]
    onFiltersChange({ ...filters, [key]: currentArr.filter(v => v !== value) })
  }, [filters, onFiltersChange])

  // Dropdown component
  const renderDropdown = (
    id: string,
    label: string,
    icon: string,
    items: string[],
    selectedItems: string[],
    filterKey: keyof FilterState,
  ) => (
    <div className="filter-dropdown-wrapper" key={id}>
      <button
        onClick={() => setActiveDropdown(activeDropdown === id ? null : id)}
        className={`filter-chip ${selectedItems.length > 0 ? 'filter-chip-active' : ''}`}
      >
        <span className="filter-chip-icon">{icon}</span>
        <span>{label}</span>
        {selectedItems.length > 0 && (
          <span className="filter-chip-count">{selectedItems.length}</span>
        )}
        <span className={`filter-chip-arrow ${activeDropdown === id ? 'filter-chip-arrow-open' : ''}`}>▾</span>
      </button>
      <div className={`filter-dropdown ${activeDropdown === id ? 'filter-dropdown-open' : ''}`}>
        <div className="filter-dropdown-scroll">
          {items.map(item => (
            <button
              key={item}
              onClick={() => toggleValue(filterKey, item)}
              className={`filter-dropdown-item ${selectedItems.includes(item) ? 'filter-dropdown-item-active' : ''}`}
            >
              <span className="filter-checkbox">
                {selectedItems.includes(item) && <span className="filter-checkbox-check">✓</span>}
              </span>
              <span>{item}</span>
            </button>
          ))}
        </div>
        {selectedItems.length > 0 && (
          <div className="filter-dropdown-footer">
            <button
              onClick={() => onFiltersChange({ ...filters, [filterKey]: [] })}
              className="filter-dropdown-clear"
            >
              Clear {label.toLowerCase()}
            </button>
          </div>
        )}
      </div>
    </div>
  )

  // Active filter chips
  const renderActiveChips = () => {
    const chips: { key: keyof FilterState; value: string; label: string }[] = []
    filters.communities.forEach(v => chips.push({ key: 'communities', value: v, label: v }))
    filters.families.forEach(v => chips.push({ key: 'families', value: v, label: v }))
    filters.decades.forEach(v => chips.push({ key: 'decades', value: v, label: v }))
    filters.keywords.forEach(v => chips.push({ key: 'keywords', value: v, label: v }))
    if (chips.length === 0 && !filters.search) return null
    return (
      <div className="active-chips">
        {filters.search && (
          <button
            onClick={() => onFiltersChange({ ...filters, search: '' })}
            className="active-chip active-chip-search"
          >
            🔍 "{filters.search}"
            <span className="active-chip-x">×</span>
          </button>
        )}
        {chips.map(chip => (
          <button
            key={`${chip.key}-${chip.value}`}
            onClick={() => removeValue(chip.key, chip.value)}
            className="active-chip"
          >
            {chip.label}
            <span className="active-chip-x">×</span>
          </button>
        ))}
        <button onClick={clearAll} className="clear-all-btn">
          Clear all
        </button>
      </div>
    )
  }

  // Mobile filter section
  const renderMobileSection = (
    title: string,
    icon: string,
    items: string[],
    selectedItems: string[],
    filterKey: keyof FilterState,
  ) => (
    <div className="mobile-filter-section">
      <h4 className="mobile-filter-title">{icon} {title}</h4>
      <div className="mobile-filter-chips">
        {items.map(item => (
          <button
            key={item}
            onClick={() => toggleValue(filterKey, item)}
            className={`mobile-filter-chip ${selectedItems.includes(item) ? 'mobile-filter-chip-active' : ''}`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <>
      {/* ═══ Desktop filter bar ═══ */}
      <div className="filter-bar">
        <div className={`filter-search ${searchFocused ? 'filter-search-focused' : ''}`}>
          <span className="filter-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search photos, people, places..."
            value={filters.search}
            onChange={e => onFiltersChange({ ...filters, search: e.target.value })}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="filter-search-input"
          />
          {filters.search && (
            <button
              onClick={() => onFiltersChange({ ...filters, search: '' })}
              className="filter-search-clear"
            >
              ✕
            </button>
          )}
        </div>

        <div className="filter-chips-row">
          {decades.length > 0 && renderDropdown('decade', 'Decade', '📅', decades, filters.decades, 'decades')}
          {communities.length > 0 && renderDropdown('community', 'Community', '📍', communities, filters.communities, 'communities')}
          {families.length > 0 && renderDropdown('family', 'Family', '👤', families, filters.families, 'families')}
          {keywords.length > 0 && renderDropdown('keyword', 'Keyword', '🏷️', keywords, filters.keywords, 'keywords')}
          {hasFilters && (
            <button onClick={clearAll} className="clear-all-inline">
              ✕ Clear
            </button>
          )}
        </div>

        <div className="filter-results-count hidden sm:block">
          {resultsCount === totalCount ? (
            <span>{totalCount} photos</span>
          ) : (
            <span><strong>{resultsCount}</strong> of {totalCount}</span>
          )}
        </div>

        <button
          onClick={openSheet}
          className="mobile-filter-btn sm:hidden"
        >
          <span>⚙️</span>
          Filter
          {filterCount > 0 && <span className="mobile-filter-badge">{filterCount}</span>}
        </button>
      </div>

      {/* Active chips bar */}
      {renderActiveChips()}

      {/* Mobile results bar */}
      <div className="mobile-results-bar sm:hidden">
        {resultsCount === totalCount ? (
          <span>{totalCount} photos</span>
        ) : (
          <span><strong>{resultsCount}</strong> of {totalCount}</span>
        )}
      </div>

      {/* ═══ Mobile sheet ═══ */}
      {mobileSheetOpen && (
        <div
          className={`mobile-sheet-backdrop ${sheetVisible ? 'mobile-sheet-backdrop-visible' : ''}`}
          onClick={closeSheet}
        >
          <div
            className={`mobile-sheet ${sheetVisible ? 'mobile-sheet-visible' : ''}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="mobile-sheet-header">
              <h3 className="mobile-sheet-title">Filter Archive</h3>
              <button onClick={closeSheet} className="mobile-sheet-close">✕</button>
            </div>

            <div className="mobile-sheet-body">
              <div className="mobile-search">
                <input
                  type="text"
                  placeholder="Search photos, people, places..."
                  value={filters.search}
                  onChange={e => onFiltersChange({ ...filters, search: e.target.value })}
                  className="search-input"
                  autoFocus
                />
              </div>

              {decades.length > 0 && renderMobileSection('Decade', '📅', decades, filters.decades, 'decades')}
              {communities.length > 0 && renderMobileSection('Community', '📍', communities, filters.communities, 'communities')}
              {families.length > 0 && renderMobileSection('Family', '👤', families, filters.families, 'families')}
              {keywords.length > 0 && renderMobileSection('Keywords', '🏷️', keywords, filters.keywords, 'keywords')}
            </div>

            <div className="mobile-sheet-footer">
              {hasFilters && (
                <button onClick={clearAll} className="mobile-clear-btn">
                  Clear All
                </button>
              )}
              <button onClick={closeSheet} className="mobile-apply-btn">
                Show {resultsCount} Photo{resultsCount !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
