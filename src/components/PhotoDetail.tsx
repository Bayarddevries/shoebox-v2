import type { Photo, Story } from '../types'

interface PhotoDetailProps {
  photo: Photo
  stories: Story[]
  onClose: () => void
}

export default function PhotoDetail({ photo, stories, onClose }: PhotoDetailProps) {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  return (
    <div 
      className="modal-overlay fade-in" 
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="modal-content">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center z-10"
          style={{ background: 'var(--color-cream)' }}
        >
          ✕
        </button>

        <div className="grid md:grid-cols-2">
          {/* Image */}
          <div className="relative bg-black flex items-center justify-center min-h-[300px]">
            <img
              src={photo.src}
              alt={photo.alt || photo.title || 'Archive photo'}
              className="max-w-full max-h-[70vh] object-contain"
            />
          </div>

          {/* Details */}
          <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar" style={{ maxHeight: '70vh' }}>
            <h2 className="font-serif text-2xl mb-4" style={{ color: 'var(--color-crimson)' }}>
              {photo.title || photo.alt}
            </h2>

            {photo.location && (
              <div className="mb-4">
                <span className="text-sm font-medium" style={{ color: 'var(--color-charcoal-light)' }}>📍 Location</span>
                <p className="text-base">{photo.location}</p>
              </div>
            )}

            {photo.people && (
              <div className="mb-4">
                <span className="text-sm font-medium" style={{ color: 'var(--color-charcoal-light)' }}>👥 People</span>
                <p className="text-base">{photo.people}</p>
              </div>
            )}

            {photo.caption && (
              <div className="mb-4">
                <span className="text-sm font-medium" style={{ color: 'var(--color-charcoal-light)' }}>📝 Caption</span>
                <p className="text-base">{photo.caption}</p>
              </div>
            )}

            {photo.keywords && photo.keywords.length > 0 && (
              <div className="mb-6">
                <span className="text-sm font-medium block mb-2" style={{ color: 'var(--color-charcoal-light)' }}>🏷️ Keywords</span>
                <div className="flex flex-wrap gap-2">
                  {photo.keywords.map((keyword, i) => (
                    <span key={i} className="keyword-tag">{keyword}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Stories linked to this photo */}
            {stories.length > 0 && (
              <div className="border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
                <h3 className="font-serif text-lg mb-3">Related Stories</h3>
                {stories.map(story => (
                  <div key={story.id} className="mb-3 p-3 rounded" style={{ background: 'var(--color-cream)' }}>
                    <h4 className="font-medium mb-1">{story.title}</h4>
                    {story.audioSrc && (
                      <audio controls className="w-full mt-2 h-8">
                        <source src={story.audioSrc} type="audio/mpeg" />
                        Your browser does not support audio.
                      </audio>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Coordinates if available */}
            {photo.lat && photo.lng && (
              <div className="mt-4 text-xs" style={{ color: 'var(--color-charcoal-light)' }}>
                📍 Coordinates: {photo.lat.toFixed(6)}, {photo.lng.toFixed(6)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}