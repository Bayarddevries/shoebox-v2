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

// ── Height estimation (first-paint fallback only) ─────────────
// Real heights are measured after render (ResizeObserver) and the
// masonry recomputes from measured values, so estimates only matter
// for the very first frame.
function estimateContentHeight(photo: Photo): number {
  let h = 16 + 28 + 8
  if (photo.caption) h += 52
  if (photo.people) h += 30
  if (photo.keywords && photo.keywords.length > 0) h += 24
  h += 16 + 2
  return h
}

function estimateCardHeight(photo: Photo, colWidth: number): number {
  const aspectRatio = photo.width && photo.height ? photo.width / photo.height : 4 / 3
  const imageHeight = colWidth / aspectRatio
  return Math.round(imageHeight + estimateContentHeight(photo))
}

const GAP = 24
const PAD = 24

function getColCount(w: number): number {
  if (w >= 1024) return 4
  if (w >= 640) return 3
  return 2
}

function computeMasonry(
  photos: Photo[],
  containerWidth: number,
  measured: Map<number, number>,
) {
  const colCount = getColCount(containerWidth)
  const colWidth = Math.floor((containerWidth - PAD * 2 - GAP * (colCount - 1)) / colCount)

  const colHeights = new Array(colCount).fill(0)
  const positions = new Map<number, { top: number; left: number; width: number; height: number }>()

  for (const photo of photos) {
    const shortest = colHeights.indexOf(Math.min(...colHeights))
    const top = colHeights[shortest]
    const left = PAD + shortest * (colWidth + GAP)
    const height = measured.get(photo.id) ?? estimateCardHeight(photo, colWidth)

    positions.set(photo.id, { top, left, width: colWidth, height })
    colHeights[shortest] = top + height + GAP
  }

  return { positions, totalHeight: Math.max(...colHeights), colCount, colWidth }
}

export default function ArchiveGrid({ photos, onPhotoClick, baseUrl }: ArchiveGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [measuredHeights, setMeasuredHeights] = useState<Map<number, number>>(new Map())
  const roMap = useRef(new Map<number, ResizeObserver>())

  // Container width
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setContainerWidth(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Measure real card heights. Each card gets a ResizeObserver; when a
  // lazy image loads or fonts settle, the observer fires and the layout
  // recomputes from true heights (no gaps, no clipped images).
  const measureCards = useCallback(() => {
    const cards = containerRef.current?.querySelectorAll<HTMLDivElement>('[data-photo-id]') ?? []
    const next = new Map<number, number>()
    for (const card of cards) {
      const id = Number(card.dataset.photoId)
      if (!Number.isFinite(id)) continue
      const h = card.offsetHeight
      if (h > 0) next.set(id, h)
      // attach one RO per card, cheap idempotent guard
      if (!roMap.current.has(id)) {
        const ro = new ResizeObserver(() => {
          const cardEl = containerRef.current?.querySelector(`[data-photo-id="${id}"]`) as HTMLDivElement | null
          if (!cardEl) return
          const h2 = cardEl.offsetHeight
          setMeasuredHeights(prev => {
            if (prev.get(id) === h2) return prev
            const merged = new Map(prev)
            merged.set(id, h2)
            return merged
          })
        })
        ro.observe(card)
        roMap.current.set(id, ro)
      }
    }
    // prune observers for photos no longer present
    const liveIds = new Set<number>()
    for (const card of cards) {
      const id = Number(card.dataset.photoId)
      if (Number.isFinite(id)) liveIds.add(id)
    }
    for (const [id, ro] of roMap.current) {
      if (!liveIds.has(id)) {
        ro.disconnect()
        roMap.current.delete(id)
      }
    }
    setMeasuredHeights(prev => {
      if (prev.size === next.size && [...prev.keys()].every(k => prev.get(k) === next.get(k))) return prev
      return next
    })
  }, [])

  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(measureCards))
    return () => cancelAnimationFrame(raf)
  }, [photos, containerWidth, measureCards])

  const layout = useMemo(() => {
    if (containerWidth === 0 || photos.length === 0) return null
    return computeMasonry(photos, containerWidth, measuredHeights)
  }, [photos, containerWidth, measuredHeights])

  if (photos.length === 0) {
    return (
      <div className="empty-state">
        <div className="text-6xl mb-4">📷</div>
        <h3 className="text-xl font-serif mb-2" style={{ color: 'var(--color-charcoal)' }}>No photos found</h3>
        <p className="text-sm" style={{ color: 'var(--color-charcoal-light)' }}>
          Try adjusting your filters or search query
        </p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="archive-grid-container">
      {layout && (
        <div className="archive-grid-inner" style={{ height: layout.totalHeight }}>
          {photos.map((photo, index) => {
            const pos = layout.positions.get(photo.id)
            if (!pos) return null

            return (
              <div
                key={photo.id}
                className="archive-tile"
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
                  data-photo-id={photo.id}
                  className="archive-card cursor-pointer"
                  onClick={() => onPhotoClick(photo)}
                  style={{ display: 'flex', flexDirection: 'column' }}
                >
                  <div className="relative overflow-hidden">
                    <img
                      src={baseUrl ? `${baseUrl}${encodePath(photo.src)}` : encodePath(photo.src)}
                      alt={photo.alt || photo.title || 'Archive photo'}
                      className="photo-card-image"
                      loading="lazy"
                      width={photo.width || undefined}
                      height={photo.height || undefined}
                    />
                    {(photo.community || photo.location) && (
                      <div className="photo-card-badge">
                        <span className="photo-badge bg-white/90 px-2 py-1 rounded">
                          📍 {photo.community || photo.location?.split(',')[0]?.trim()}
                        </span>
                      </div>
                    )}
                    {photo.year && (
                      <div className="photo-card-year-badge">
                        <span className="photo-badge bg-white/90 px-2 py-1 rounded">
                          {photo.photoYearSource === 'keyword-era' ? `≈${photo.year}` : photo.year}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-4 flex-1">
                    <h3 className="font-serif text-lg mb-2 line-clamp-1" style={{ color: 'var(--color-charcoal)' }}>
                      {photo.title || photo.alt}
                    </h3>
                    {photo.caption && (
                      <p className="text-sm line-clamp-2 mb-3" style={{ color: 'var(--color-charcoal-light)' }}>
                        {photo.caption}
                      </p>
                    )}
                    {photo.people && (
                      <p className="text-xs mb-3" style={{ color: 'var(--color-charcoal-light)' }}>
                        <span className="font-medium">People:</span>{' '}
                        {photo.people.length > 60 ? photo.people.slice(0, 57) + '...' : photo.people}
                      </p>
                    )}
                    {photo.keywords && photo.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {photo.keywords.slice(0, 3).map((keyword, i) => (
                          <span key={i} className="keyword-tag">{keyword}</span>
                        ))}
                        {photo.keywords.length > 3 && <span className="keyword-tag">+{photo.keywords.length - 3}</span>}
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
