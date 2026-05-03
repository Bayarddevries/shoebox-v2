import { useEffect, useCallback, useRef, useState } from 'react'
import type { Photo, Story } from '../types'

/** Encode each path segment to handle spaces, apostrophes, ampersands etc. */
function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

interface PhotoDetailProps {
 photo: Photo
 stories: Story[]
 onClose: () => void
}

/** Format the year badge with source context */
function formatYearBadge(photo: Photo): string | null {
 if (!photo.year) return null
 const source = photo.photoYearSource
 if (source === 'keyword-specific' || source === 'title') {
 return `📅 ${photo.year}` // exact year from metadata
 }
 if (source === 'keyword-era') {
 return `📅 ≈${photo.year}` // approximate (era midpoint)
 }
 if (source === 'scan-date') {
 return `📅 ${photo.year} (scanned)` // scan date, not photo date
 }
 return `📅 ${photo.year}`
}

export default function PhotoDetail({ photo, stories, onClose }: PhotoDetailProps) {
  const [swipeY, setSwipeY] = useState(0)
  const touchStartY = useRef(0)
  const touchCurrentY = useRef(0)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [handleKeyDown])

  // Swipe down to dismiss (mobile)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const deltaY = e.touches[0].clientY - touchStartY.current
    touchCurrentY.current = deltaY
    if (deltaY > 0) {
      setSwipeY(deltaY)
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (swipeY > 100) {
      onClose()
    }
    setSwipeY(0)
    touchStartY.current = 0
    touchCurrentY.current = 0
  }, [swipeY, onClose])

  return (
    <div
      className="modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label={photo.title || photo.alt}
    >
      {/* ═══ Close button — OUTSIDE the modal entirely so transform/overflow never clips it ═══ */}
      <button
        onClick={onClose}
        className="photo-detail-close"
        aria-label="Close"
      >
        ✕
      </button>

      <div
        className="photo-detail-modal"
        style={{
          transform: swipeY > 0 ? `translateY(${swipeY}px)` : undefined,
          transition: swipeY > 0 ? 'none' : undefined,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >

        {/* ═══ Mobile layout: image full width, details below ═══ */}
        <div className="photo-detail-mobile md:hidden">
          {/* Swipe-down handle */}
          <div className="mobile-detail-handle" />

          {/* Image — full bleed */}
          <div className="photo-detail-image-mobile">
            <img
              src={encodePath(photo.src)}
              alt={photo.alt || photo.title || 'Archive photo'}
            />
          </div>

          {/* Details — scrollable below */}
          <div className="photo-detail-info-mobile">
            <h2 className="photo-detail-title">{photo.title || photo.alt}</h2>

            <div className="photo-detail-meta-mobile">
 {formatYearBadge(photo) && (
 <span className="photo-detail-badge">{formatYearBadge(photo)}</span>
 )}
              {photo.community && (
                <span className="photo-detail-badge">📍 {photo.community}{photo.province ? `, ${photo.province}` : ''}</span>
              )}
              {!photo.community && photo.location && (
                <span className="photo-detail-badge">📍 {photo.location}</span>
              )}
            </div>

            {photo.people && (
              <div className="photo-detail-section">
                <h4 className="photo-detail-label">👥 People</h4>
                <p>{photo.people}</p>
              </div>
            )}

            {photo.caption && (
              <div className="photo-detail-section">
                <h4 className="photo-detail-label">📝 Caption</h4>
                <p>{photo.caption}</p>
              </div>
            )}

            {photo.keywords && photo.keywords.length > 0 && (
              <div className="photo-detail-section">
                <h4 className="photo-detail-label">🏷️ Keywords</h4>
                <div className="flex flex-wrap gap-2">
                  {photo.keywords.map((keyword, i) => (
                    <span key={i} className="keyword-tag">{keyword}</span>
                  ))}
                </div>
              </div>
            )}

            {stories.length > 0 && (
              <div className="photo-detail-section photo-detail-stories">
                <h4 className="photo-detail-label">📖 Related Stories</h4>
                {stories.map(story => (
                  <div key={story.id} className="photo-detail-story-card">
                    <h5>{story.title}</h5>
                    {story.audioSrc && (
                      <audio controls className="w-full mt-2 h-8">
                        <source src={story.audioSrc} type="audio/mpeg" />
                      </audio>
                    )}
                  </div>
                ))}
              </div>
            )}

            {photo.lat && photo.lng && (
              <div className="photo-detail-coords">
                📍 {photo.lat.toFixed(4)}, {photo.lng.toFixed(4)}
              </div>
            )}

            {/* Bottom padding so content isn't cut off on notched phones */}
            <div className="h-8" />
          </div>
        </div>

        {/* ═══ Desktop layout: side-by-side ═══ */}
        <div className="hidden md:grid photo-detail-desktop">
          {/* Image — takes up left column */}
          <div className="photo-detail-image-desktop">
            <img
              src={encodePath(photo.src)}
              alt={photo.alt || photo.title || 'Archive photo'}
            />
          </div>

          {/* Details — right column, scrollable */}
          <div className="photo-detail-info-desktop">
            <h2 className="photo-detail-title">{photo.title || photo.alt}</h2>

            <div className="photo-detail-meta-desktop">
 {formatYearBadge(photo) && (
 <span className="photo-detail-badge">{formatYearBadge(photo)}</span>
 )}
              {photo.community && (
                <span className="photo-detail-badge">📍 {photo.community}{photo.province ? `, ${photo.province}` : ''}</span>
              )}
              {!photo.community && photo.location && (
                <span className="photo-detail-badge">📍 {photo.location}</span>
              )}
            </div>

            {photo.people && (
              <div className="photo-detail-section">
                <h4 className="photo-detail-label">👥 People</h4>
                <p>{photo.people}</p>
              </div>
            )}

            {photo.caption && (
              <div className="photo-detail-section">
                <h4 className="photo-detail-label">📝 Caption</h4>
                <p>{photo.caption}</p>
              </div>
            )}

            {photo.keywords && photo.keywords.length > 0 && (
              <div className="photo-detail-section">
                <h4 className="photo-detail-label">🏷️ Keywords</h4>
                <div className="flex flex-wrap gap-2">
                  {photo.keywords.map((keyword, i) => (
                    <span key={i} className="keyword-tag">{keyword}</span>
                  ))}
                </div>
              </div>
            )}

            {stories.length > 0 && (
              <div className="photo-detail-section photo-detail-stories">
                <h4 className="photo-detail-label">📖 Related Stories</h4>
                {stories.map(story => (
                  <div key={story.id} className="photo-detail-story-card">
                    <h5>{story.title}</h5>
                    {story.audioSrc && (
                      <audio controls className="w-full mt-2 h-8">
                        <source src={story.audioSrc} type="audio/mpeg" />
                      </audio>
                    )}
                  </div>
                ))}
              </div>
            )}

            {photo.lat && photo.lng && (
              <div className="photo-detail-coords">
                📍 {photo.lat.toFixed(4)}, {photo.lng.toFixed(4)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
