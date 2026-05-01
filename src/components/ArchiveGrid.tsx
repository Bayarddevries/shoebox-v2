import type { Photo } from '../types'

interface ArchiveGridProps {
  photos: Photo[]
  onPhotoClick: (photo: Photo) => void
}

export default function ArchiveGrid({ photos, onPhotoClick }: ArchiveGridProps) {
  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-6xl mb-4">📷</div>
        <h3 className="text-xl font-serif mb-2" style={{ color: 'var(--color-charcoal)' }}>No photos found</h3>
        <p className="text-sm" style={{ color: 'var(--color-charcoal-light)' }}>
          Try adjusting your filters or search query
        </p>
      </div>
    )
  }

  return (
    <div className="archive-grid">
      {photos.map((photo, index) => (
        <div
          key={photo.id}
          className="archive-tile"
          style={{ animationDelay: `${Math.min(index * 50, 1000)}ms` }}
        >
          <div 
            className="archive-card cursor-pointer"
            onClick={() => onPhotoClick(photo)}
          >
            <div className="relative overflow-hidden">
              <img
                src={photo.src}
                alt={photo.alt || photo.title || 'Archive photo'}
                className="photo-card-image"
                loading="lazy"
              />
              {photo.location && (
                <div className="absolute top-3 right-3">
                  <span className="photo-badge bg-white/90 px-2 py-1 rounded">
                    📍 {photo.location}
                  </span>
                </div>
              )}
            </div>
            
            <div className="p-4">
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
                  <span className="font-medium">People:</span> {photo.people}
                </p>
              )}
              
              {photo.keywords && photo.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {photo.keywords.slice(0, 3).map((keyword, i) => (
                    <span key={i} className="keyword-tag">{keyword}</span>
                  ))}
                  {photo.keywords.length > 3 && (
                    <span className="keyword-tag">+{photo.keywords.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}