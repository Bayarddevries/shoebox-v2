import { useEffect, useState } from 'react'
import type { Story, Photo } from '../types'

/** Encode each path segment to handle spaces, apostrophes, ampersands etc. */
function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

interface StoriesViewProps {
  stories: Story[]
  photos: Photo[]
  onPhotoClick: (photo: Photo) => void
}

export default function StoriesView({ stories, photos, onPhotoClick }: StoriesViewProps) {
  const [storyTexts, setStoryTexts] = useState<Record<string, string>>({})

  // Fetch story text files on mount
  useEffect(() => {
    stories.forEach(story => {
      if (story.textSrc && !storyTexts[story.id]) {
        fetch(story.textSrc)
          .then(res => res.ok ? res.text() : '')
          .then(text => {
            setStoryTexts(prev => ({ ...prev, [story.id]: text }))
          })
          .catch(() => {})
      }
    })
  }, [stories])

  if (stories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center p-8">
        <div className="text-6xl mb-4">📖</div>
        <h2 className="text-2xl font-serif mb-2">Stories Coming Soon</h2>
        <p className="text-sm" style={{ color: 'var(--color-charcoal-light)' }}>
          Oral histories and narratives will be available here
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto py-12 px-6">
      <h1 className="text-4xl font-serif text-center mb-4" style={{ color: 'var(--color-crimson)' }}>
        Oral Histories & Stories
      </h1>
      <p className="text-center mb-12 max-w-2xl mx-auto" style={{ color: 'var(--color-charcoal-light)' }}>
        Listen to stories from Red River Métis elders and community members, preserving our heritage through voice and memory.
      </p>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {stories.map((story) => {
          const storyPhotos = photos.filter(p => story.photoIds?.includes(p.id))
          const thumbnail = storyPhotos[0]
          const displayText = storyTexts[story.id] || story.text || ''

          return (
            <div
              key={story.id}
              className="archive-card p-6"
            >
              {/* Thumbnail or audio icon */}
              <div className="relative mb-4 h-48 bg-black rounded overflow-hidden flex items-center justify-center">
                {thumbnail ? (
                  <img 
                    src={encodePath(thumbnail.src)} 
                    alt={story.title}
                    className="w-full h-full object-cover opacity-80"
                  />
                ) : (
                  <div className="text-6xl opacity-50">🎙️</div>
                )}
                {/* Audio indicator */}
                {story.audioSrc && (
                  <div className="absolute bottom-3 right-3 bg-white/90 px-3 py-1 rounded-full text-xs flex items-center gap-1">
                    <span>🔊</span>
                    <span>Audio</span>
                  </div>
                )}
              </div>

              <h3 className="font-serif text-xl mb-3" style={{ color: 'var(--color-charcoal)' }}>
                {story.title}
              </h3>

              <p className="text-sm mb-4 line-clamp-3" style={{ color: 'var(--color-charcoal-light)' }}>
                {displayText || 'Listen to the audio recording for the full story.'}
              </p>

              {/* Audio player */}
              {story.audioSrc && (
                <audio controls className="w-full h-10 mb-4">
                  <source src={story.audioSrc} type="audio/mpeg" />
                  Your browser does not support audio.
                </audio>
              )}

              {/* Related photos */}
              {storyPhotos.length > 0 && (
                <div>
                  <p className="text-xs mb-2" style={{ color: 'var(--color-charcoal-light)' }}>
                    Related photos: {storyPhotos.length}
                  </p>
                  <div className="flex gap-2">
                    {storyPhotos.slice(0, 4).map((photo) => (
                      <button
                        key={photo.id}
                        onClick={() => onPhotoClick(photo)}
                        className="w-12 h-12 rounded overflow-hidden hover:ring-2 hover:ring-crimson transition-all"
                        style={{ '--tw-ring-color': 'var(--color-crimson)' } as React.CSSProperties}
                      >
                        <img 
                          src={encodePath(photo.src)} 
                          alt={photo.alt}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                    {storyPhotos.length > 4 && (
                      <div className="w-12 h-12 rounded bg-cream flex items-center justify-center text-xs" style={{ background: 'var(--color-cream)' }}>
                        +{storyPhotos.length - 4}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
