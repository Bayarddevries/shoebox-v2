import { useState, useEffect, useRef, useMemo } from 'react'
import type { Photo } from '../types'

// Ken Burns variants for visual variety
const KEN_BURNS = [
  { from: 'scale(1) translate(0, 0)', to: 'scale(1.15) translate(-2%, -1%)' },
  { from: 'scale(1.1) translate(-2%, 0)', to: 'scale(1) translate(1%, -1%)' },
  { from: 'scale(1) translate(1%, 0)', to: 'scale(1.12) translate(-1%, 1%)' },
  { from: 'scale(1.08) translate(0, -1%)', to: 'scale(1) translate(1%, 1%)' },
  { from: 'scale(1.05) translate(-1%, 1%)', to: 'scale(1.15) translate(1%, -1%)' },
  { from: 'scale(1.1) translate(1%, -1%)', to: 'scale(1) translate(-1%, 1%)' },
]

const SLIDE_DURATION = 7000 // ms per slide
const CROSSFADE_DURATION = 1500 // ms for crossfade transition
const PRELOAD_AHEAD = 3 // preload this many upcoming images

interface HeroCarouselProps {
  photos: Photo[]
  baseUrl: string
}

export default function HeroCarousel({ photos, baseUrl }: HeroCarouselProps) {
  // Shuffle photos once on mount (Fisher-Yates)
  const shuffled = useMemo(() => {
    const arr = [...photos]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }, [photos])

  const [currentIdx, setCurrentIdx] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)

  // Preload upcoming images whenever the index changes
  useEffect(() => {
    if (shuffled.length === 0) return
    for (let i = 1; i <= PRELOAD_AHEAD; i++) {
      const idx = (currentIdx + i) % shuffled.length
      const photo = shuffled[idx]
      if (photo) {
        const img = new Image()
        img.src = `${baseUrl}${photo.src}`
      }
    }
  }, [currentIdx, shuffled, baseUrl])

  // Intersection Observer — pause when off-screen
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        pausedRef.current = !entry.isIntersecting
      },
      { threshold: 0.1 }
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  // Slide advancement — always-running interval, skips when paused
  useEffect(() => {
    if (shuffled.length <= 1) return

    const id = setInterval(() => {
      if (pausedRef.current) return

      // Start transition: move to next slide
      setTransitioning(true)
      setCurrentIdx((prev) => (prev + 1) % shuffled.length)

      // End crossfade after duration
      setTimeout(() => setTransitioning(false), CROSSFADE_DURATION)
    }, SLIDE_DURATION)

    return () => clearInterval(id)
  }, [shuffled.length])

  if (shuffled.length === 0) return null

  const current = shuffled[currentIdx]
  const prevIdx = transitioning
    ? (currentIdx - 1 + shuffled.length) % shuffled.length
    : -1
  const prev = prevIdx >= 0 ? shuffled[prevIdx] : null

  const getKenBurns = (idx: number) => KEN_BURNS[idx % KEN_BURNS.length]

  return (
    <div ref={sectionRef} className="hero-carousel">
      {/* Current slide — always at full opacity (the base layer) */}
      <div
        className="hero-carousel-slide"
        key={`curr-${currentIdx}`}
      >
        <div
          className="hero-carousel-ken-burns"
          style={{
            backgroundImage: `url(${baseUrl}${current.src})`,
            animationName: 'kenBurns',
            animationDuration: `${SLIDE_DURATION + CROSSFADE_DURATION}ms`,
            '--kb-from': getKenBurns(currentIdx).from,
            '--kb-to': getKenBurns(currentIdx).to,
          } as React.CSSProperties}
        />
      </div>

      {/* Previous slide on top — fading out to reveal current underneath */}
      {prev && transitioning && (
        <div
          className="hero-carousel-slide hero-carousel-fade-out"
          key={`prev-${prevIdx}`}
        >
          <div
            className="hero-carousel-ken-burns"
            style={{
              backgroundImage: `url(${baseUrl}${prev.src})`,
              animationName: 'kenBurnsHold',
              animationDuration: `${SLIDE_DURATION}ms`,
            }}
          />
        </div>
      )}
    </div>
  )
}
