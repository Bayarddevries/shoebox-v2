import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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
  const [prevIdx, setPrevIdx] = useState(-1)
  const [transitioning, setTransitioning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)

  // Preload upcoming images
  useEffect(() => {
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

  // Advance slides
  const advance = useCallback(() => {
    if (pausedRef.current) return
    setPrevIdx(currentIdx)
    setCurrentIdx((prev) => (prev + 1) % shuffled.length)
    setTransitioning(true)
  }, [currentIdx, shuffled.length])

  useEffect(() => {
    intervalRef.current = setTimeout(advance, SLIDE_DURATION)
    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current)
    }
  }, [advance])

  // End transition after crossfade completes
  useEffect(() => {
    if (!transitioning) return
    const timer = setTimeout(() => setTransitioning(false), CROSSFADE_DURATION)
    return () => clearTimeout(timer)
  }, [transitioning])

  if (shuffled.length === 0) return null

  const current = shuffled[currentIdx]
  const prev = prevIdx >= 0 ? shuffled[prevIdx] : null

  const getKenBurns = (idx: number) => KEN_BURNS[idx % KEN_BURNS.length]

  return (
    <div ref={sectionRef} className="hero-carousel">
      {/* Previous slide (fading out) */}
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

      {/* Current slide (fading in or static) */}
      <div
        className={`hero-carousel-slide ${prevIdx >= 0 ? 'hero-carousel-fade-in' : ''}`}
        key={`curr-${currentIdx}`}
      >
        <div
          className="hero-carousel-ken-burns"
          style={{
            backgroundImage: `url(${baseUrl}${current.src})`,
            animationName: 'kenBurns',
            animationDuration: `${SLIDE_DURATION + CROSSFADE_DURATION}ms`,
            // Use the Ken Burns variant for this slide
            '--kb-from': getKenBurns(currentIdx).from,
            '--kb-to': getKenBurns(currentIdx).to,
          } as React.CSSProperties}
        />
      </div>
    </div>
  )
}
