import { useEffect, useCallback } from 'react'
import type { Photo, Story } from '../types'

interface PhotoDetailProps {
  photo: Photo
  stories: Story[]
  onClose: () => void
}

export default function PhotoDetail({ photo, stories, onClose }: PhotoDetailProps) {
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

  return (
    <div
      className="modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label={photo.title || photo.alt}
    >
      <div className="photo-detail-modal">
        {/* Close button */}
        <button
          onClick={onClose}
          className="photo-detail-close"
          aria-label="Close"
        >
          ✕
        </button>

        {/* ═══ Mobile layout: image full width, details below ═══ */}
        <div className="photo-detail-mobile md:hidden">
          {/* Image — full bleed */}
          <div className="photo-detail-image-mobile">
            <img
              src={photo.src}
              alt={photo.alt || photo.title || 'Archive photo'}
            />
          </div>

          {/* Details — scrollable below */}
          <div className="photo-detail-info-mobile">
            <h2 className="photo-detail-title">{photo.title || photo.alt}</h2>

            <div className="photo-detail-meta-mobile">
              {photo.year && (
                <span className="photo-detail-badge">📅 {photo.year}</span>
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

        {/* ═══ Desktop layout: side-by-side ═══ */}
        <div className="hidden md:grid photo-detail-desktop">
          {/* Image — takes up left column */}
          <div className="photo-detail-image-desktop">
            <img
              src={photo.src}
              alt={photo.alt || photo.title || 'Archive photo'}
            />
          </div>

          {/* Details — right column, scrollable */}
          <div className="photo-detail-info-desktop">
            <h2 className="photo-detail-title">{photo.title || photo.alt}</h2>

            <div className="photo-detail-meta-desktop">
              {photo.year && (
                <span className="photo-detail-badge">📅 {photo.year}</span>
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
