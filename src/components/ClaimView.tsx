import { useState, useEffect, useCallback } from 'react'
import MetadataForm from './MetadataForm'

interface Submission {
  submitterName: string
  photos: { photoId: number; src: string; title: string }[]
  contributions: any[]
}

interface ClaimViewProps {
  token: string
  onDone?: () => void
}

export default function ClaimView({ token, onDone }: ClaimViewProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [completedPhotos, setCompletedPhotos] = useState<Set<number>>(new Set())

  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwx0l2LijEV5MkodZcKMWPGNj5ADiZvS0Yfj9zUsITaEhhoFn_1mzd3jLi-w42qduNe/exec'

  const fetchSubmission = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = `${APPS_SCRIPT_URL}?action=submission&token=${token}`
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      if (!data.submitterName) {
        throw new Error('Invalid or expired claim token')
      }
      setSubmission(data)
    } catch (err) {
      console.error('Failed to fetch submission:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch submission')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchSubmission()
  }, [fetchSubmission])

  const currentPhoto = submission?.photos[currentPhotoIndex]
  const totalPhotos = submission?.photos.length || 0
  const completedCount = completedPhotos.size

  const handleFormSubmit = async (data: any, photoId: number) => {
    try {
      const formData = new URLSearchParams()
      formData.append('token', token)
      formData.append('photoId', String(photoId))
      formData.append('people', data.people)
      formData.append('location', data.location)
      formData.append('community', data.community || '')
      formData.append('province', data.province || '')
      formData.append('country', data.country || '')
      formData.append('dateYear', data.dateYear)
      formData.append('dateEra', data.dateEra)
      formData.append('occasion', data.occasion)
      formData.append('story', data.story)
      formData.append('caption', data.caption || '')
      formData.append('attribution', data.attribution)
      formData.append('keywords', data.keywords)
      formData.append('consent', String(data.consent))

      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`POST failed: ${res.status} ${text}`)
      }
      setCompletedPhotos(prev => new Set(prev).add(photoId))
    } catch (err) {
      console.error('Failed to submit metadata:', err)
      alert('Failed to submit metadata. Please try again or contact us.')
    }
  }

  const handleNext = () => {
    if (currentPhotoIndex < totalPhotos - 1) {
      setCurrentPhotoIndex(currentPhotoIndex + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handlePrevious = () => {
    if (currentPhotoIndex > 0) {
      setCurrentPhotoIndex(currentPhotoIndex - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-parchment)' }}>
        <div className="text-center">
          <div className="cinzel text-xl mb-4" style={{ color: 'var(--color-crimson)' }}>Loading your photos...</div>
          <div className="w-48 h-2 mx-auto rounded overflow-hidden" style={{ background: 'var(--color-cream)' }}>
            <div className="h-full rounded shimmer" style={{ background: 'var(--color-crimson)', width: '60%' }} />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-parchment)' }}>
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-md text-center">
          <div className="text-2xl mb-4">❌</div>
          <h2 className="font-serif text-xl mb-2" style={{ color: 'var(--color-crimson)' }}>Error</h2>
          <p className="mb-6" style={{ color: 'var(--color-charcoal)' }}>{error}</p>
          <p className="text-sm" style={{ color: 'var(--color-charcoal-light)' }}>
            Please check your link or contact us if the problem persists.
          </p>
        </div>
      </div>
    )
  }

  if (!submission) {
    return null
  }

  // All done state
  if (completedCount === totalPhotos) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-parchment)' }}>
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-md text-center">
          <div className="text-3xl mb-4">✨</div>
          <h2 className="font-serif text-2xl mb-4" style={{ color: 'var(--color-crimson)' }}>Thank You!</h2>
          <p className="mb-4" style={{ color: 'var(--color-charcoal)' }}>
            You’ve successfully added metadata to all {totalPhotos} of your photos.
          </p>
          <p className="text-sm mb-6" style={{ color: 'var(--color-charcoal-light)' }}>
            Your contributions are now in the queue for review. We appreciate you helping preserve Métis history!
          </p>
          <p className="text-xs mb-2" style={{ color: 'var(--color-charcoal-light)' }}>
            Want to add a story by phone? Call us at <strong>204-XXX-XXXX</strong>
          </p>
          {onDone && (
            <button
              onClick={onDone}
              className="mt-4 btn-secondary"
            >
              Return to Archive
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!currentPhoto) {
    return null
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-parchment)' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md" style={{ background: 'rgba(255,255,255,0.9)', borderBottom: '1px solid var(--color-border)' }}>
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h1 className="font-serif text-xl md:text-2xl" style={{ color: 'var(--color-crimson)' }}>
              These are YOUR photos
            </h1>
            <div className="text-sm" style={{ color: 'var(--color-charcoal-light)' }}>
              {completedCount} of {totalPhotos} completed
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-red-700 h-2 rounded-full transition-all"
              style={{ width: `${(completedCount / totalPhotos) * 100}%` }}
            />
          </div>
          <p className="text-sm mt-2" style={{ color: 'var(--color-charcoal-light)' }}>
            Submitter: <span className="font-medium">{submission.submitterName}</span>
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        {/* Photo display */}
        <section className="mb-8">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="relative">
              <img
                src={`${import.meta.env.BASE_URL}${encodePath(currentPhoto.src)}`}
                alt={currentPhoto.title || `Photo ${currentPhoto.photoId}`}
                className="w-full h-auto object-contain"
                style={{ maxHeight: '70vh' }}
              />
              <div className="absolute top-2 right-2 px-3 py-1 rounded text-sm font-medium"
                   style={{ background: 'var(--color-cream)', color: 'var(--color-crimson)' }}>
                Photo {currentPhotoIndex + 1}
              </div>
            </div>
            <div className="p-4" style={{ borderTop: '1px solid var(--color-border)' }}>
              <h2 className="font-serif text-lg md:text-xl" style={{ color: 'var(--color-charcoal)' }}>
                {currentPhoto.title || `Photo ${currentPhoto.photoId}`}
              </h2>
            </div>
          </div>
        </section>

        {/* Metadata Form */}
        <section>
          <MetadataForm
            photoId={currentPhoto.photoId}
            submitterToken={token}
            onSubmit={(data: any) => handleFormSubmit(data, currentPhoto.photoId)}
            isCompleted={completedPhotos.has(currentPhoto.photoId)}
          />
        </section>

        {/* Navigation */}
        <section className="mt-8 flex justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentPhotoIndex === 0}
            className="px-6 py-2 rounded font-medium transition-colors"
            style={{
              background: currentPhotoIndex === 0
                ? 'var(--color-cream)'
                : 'var(--color-crimson)',
              color: currentPhotoIndex === 0
                ? 'var(--color-charcoal-light)'
                : 'white'
            }}
          >
            ← Previous
          </button>

          <button
            onClick={handleNext}
            disabled={currentPhotoIndex === totalPhotos - 1 || !completedPhotos.has(currentPhoto.photoId)}
            className="px-6 py-2 rounded font-medium transition-colors"
            style={{
              background: currentPhotoIndex === totalPhotos - 1 || !completedPhotos.has(currentPhoto.photoId)
                ? 'var(--color-cream)'
                : 'var(--color-crimson)',
              color: currentPhotoIndex === totalPhotos - 1 || !completedPhotos.has(currentPhoto.photoId)
                ? 'var(--color-charcoal-light)'
                : 'white'
            }}
          >
            {currentPhotoIndex === totalPhotos - 1 ? 'Done' : 'Next →'}
          </button>
        </section>
      </main>

      <footer className="mt-12 py-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-xs" style={{ color: 'var(--color-charcoal-light)' }}>
            Red River Métis Digital Archive | Shoebox v2 | Secure submitter experience
          </p>
        </div>
      </footer>
    </div>
  )
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}