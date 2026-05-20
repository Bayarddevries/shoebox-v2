import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import type { Photo } from '../types'

/** Encode each path segment to handle spaces, apostrophes, ampersands etc. */
function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

interface ArchiveGridProps {
  photos: Photo[]
  onPhotoClick: (photo: Photo) => void
  baseUrl: string
}

type ComputedPos = {
  top: number
  left: number
  width: number
  height: number
}

// ── Height estimation ───────────────────────────────────────────
// This gives us the initial layout; actual heights are measured
// after images load via a post-mount pass.

function estimateContentHeight(photo: Photo): number {
  // p-4 top + title (font-serif text-lg ~28px + mb-2 8px)
  let h = 16 + 28 + 8
  // caption: text-sm line-clamp-2 mb-3 (~40px + 12px)
  if (photo.caption) h += 52
  // people: text-xs mb-3 (~18px + 12px)
  if (photo.people) h += 30
  // keywords: flex-wrap gap-1 (~24px)
  if (photo.keywords && photo.keywords.length > 0) h += 24
  // p-4 bottom + border top+bottom
  h += 16 + 2
  return h
}

function estimateCardHeight(photo: Photo, colWidth: number): number {
  const aspectRatio =
    photo.width && photo.height ? photo.width / photo.height : 4 / 3
  const imageHeight = colWidth / aspectRatio
  return Math.round(imageHeight + estimateContentHeight(photo))
}

// ── Responsive count ────────────────────────────────────────────
function columnCountFromWidth(w: number): number {
  // Match the old CSS breakpoints for consistency
  if (w >= 1024) return 4
  if (w >= 640) return 3
  return 2
}

const COLUMN_GAP = 24
const CONTAINER_PAD = 24 // outer padding on each side

// ── Masonry layout computation ──────────────────────────────────
function computeMasonry(
  photos: Photo[],
  containerWidth: number,
): { positions: Map<number, ComputedPos>; totalHeight: number; colCount: number } | null {
  if (containerWidth === 0 || photos.length === 0) return null

  const colCount = columnCountFromWidth(containerWidth)
  const colWidth = Math.floor(
    (containerWidth - CONTAINER_PAD * 2 - COLUMN_GAP * (colCount - 1)) /
      colCount,
  )

  const colHeights = new Array(colCount).fill(0)
  const positions = new Map<number, ComputedPos>()

  for (const photo of photos) {
    const shortest = colHeights.indexOf(Math.min(...colHeights))
    const top = colHeights[shortest]
    const left = CONTAINER_PAD + shortest * (colWidth + COLUMN_GAP)
    const height = estimateCardHeight(photo, colWidth)

    positions.set(photo.id, { top, left, width: colWidth, height })
    colHeights[shortest] = top + height + COLUMN_GAP
  }

  return {
    positions,
    totalHeight: Math.max(...colHeights),
    colCount,
  }
}

export default function ArchiveGrid({
  photos,
  onPhotoClick,
  baseUrl,
}: ArchiveGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  // After mount, measure actual card heights and re-layout for accuracy
  const [measuredHeights, setMeasuredHeights] = useState<Map<number, number> | null>(null)
  const [layoutVersion, setLayoutVersion] = useState(0)

  // Measure container on mount + resize
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setContainerWidth(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Compute layout (uses estimated heights initially)
  const layout = useMemo(() => {
    return computeMasonry(photos, containerWidth)
  }, [photos, containerWidth])

  // After images load, measure actual card heights and re-layout
  const measuredLayout = useMemo(() => {
    if (!layout) return null
    if (!measuredHeights || measuredHeights.size === 0) return layout

    // Re-run masonry with actual measured heights
    const colCount = layout.colCount
    const colWidth = Math.floor(
      (containerWidth - CONTAINER_PAD * 2 - COLUMN_GAP * (colCount - 1)) /
        colCount,
    )
    const colHeights = new Array(colCount).fill(0)
    const positions = new Map<number, ComputedPos>()

    for (const photo of photos) {
      const id = photo.id
      const actualHeight = measuredHeights.get(id)
      const estimated = estimateCardHeight(photo, colWidth)
      const height = actualHeight ?? estimated

      const shortest = colHeights.indexOf(Math.min(...colHeights))
      const top = colHeights[shortest]
      const left = CONTAINER_PAD + shortest * (colWidth + COLUMN_GAP)

      positions.set(id, { top, left, width: colWidth, height })
      colHeights[shortest] = top + height + COLUMN_GAP
    }

    return {
      positions,
      totalHeight: Math.max(...colHeights),
      colCount,
    }
  }, [layout, measuredHeights, photos, containerWidth])

  // After first render, measure actual heights
  const onCardMount = useCallback(
    (id: number, el: HTMLDivElement | null) => {
      if (!el || measuredHeights) return // only do one pass
      const actualHeight = el.offsetHeight
      if (actualHeight > 0) {
        setMeasuredHeights((prev) => {
          const next = new Map(prev ?? [])
          next.set(id, actualHeight)
          if (next.size >= photos.length) {
            // All measured — trigger re-layout
            setTimeout(() => setLayoutVersion((v) => v + 1), 50)
          }
          return next
        })
      }
    },
    [measuredHeights, photos],
  )

  // Wait for all measurements before showing final layout version
  const finalLayout = measuredLayout ?? layout

  // ── Empty state ──────────────────────────────────────────
  if (photos.length === 0) {
    return (
      <div className="empty-state">
        <div className="text-6xl mb-4">📷</div>
        <h3 className="text-xl font-serif mb-2" style={{ color: 'var(--color-charcoal)' }}>
          No photos found
        </h3>
        <p className="text-sm" style={{ color: 'var(--color-charcoal-light)' }}>
          Try adjusting your filters or search query
        </p>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div ref={containerRef} className="archive-grid-container" key={layoutVersion}>
      {finalLayout && (
        <div
          className="archive-grid-inner"
          style={{ height: finalLayout.totalHeight }}
        >
          {photos.map((photo, index) => {
            const pos = finalLayout.positions.get(photo.id)
            if (!pos) return null

            return (
              <div
                key={photo.id}
                className="archive-tile"
                ref={(el) => onCardMount(photo.id, el)}
                style={{
                  position: 'absolute',
                  top: pos.top,
                  left: pos.left,
                  width: pos.width,
                  height: pos.height,
                  animationDelay: `${Math.min(index * 40, 800)}ms`,
                }}
              >
                <div
                  className="archive-card cursor-pointer"
                  onClick={() => onPhotoClick(photo)}
                  style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                >
                  <div
                    className="relative overflow-hidden"
                    style={
                      photo.width && photo.height
                        ? { aspectRatio: `${photo.width}/${photo.height}` }
                        : undefined
                    }
                  >
                    <img
                      src={
                        baseUrl
                          ? `${baseUrl}${encodePath(photo.src)}`
                          : encodePath(photo.src)
                      }
                      alt={photo.alt || photo.title || 'Archive photo'}
                      className="photo-card-image"
                      loading="lazy"
                      width={photo.width || undefined}
                      height={photo.height || undefined}
                    />
                    {/* Community badge */}
                    {(photo.community || photo.location) && (
                      <div className="photo-card-badge">
                        <span className="photo-badge bg-white/90 px-2 py-1 rounded">
                          📍{' '}
                          {photo.community ||
                            photo.location?.split(',')[0]?.trim()}
                        </span>
                      </div>
                    )}
                    {/* Year badge */}
                    {photo.year && (
                      <div className="photo-card-year-badge">
                        <span className="photo-badge bg-white/90 px-2 py-1 rounded">
                          {photo.photoYearSource === 'keyword-era'
                            ? `≈${photo.year}`
                            : photo.year}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-4 flex-1" style={{ minHeight: estimateContentHeight(photo) }}>
                    <h3
                      className="font-serif text-lg mb-2 line-clamp-1"
                      style={{ color: 'var(--color-charcoal)' }}
                    >
                      {photo.title || photo.alt}
                    </h3>

                    {photo.caption && (
                      <p
                        className="text-sm line-clamp-2 mb-3"
                        style={{ color: 'var(--color-charcoal-light)' }}
                      >
                        {photo.caption}
                      </p>
                    )}

                    {photo.people && (
                      <p
                        className="text-xs mb-3"
                        style={{ color: 'var(--color-charcoal-light)' }}
                      >
                        <span className="font-medium">People:</span>{' '}
                        {photo.people.length > 60
                          ? photo.people.slice(0, 57) + '...'
                          : photo.people}
                      </p>
                    )}

                    {photo.keywords && photo.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {photo.keywords.slice(0, 3).map((keyword, i) => (
                          <span key={i} className="keyword-tag">
                            {keyword}
                          </span>
                        ))}
                        {photo.keywords.length > 3 && (
                          <span className="keyword-tag">
                            +{photo.keywords.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
