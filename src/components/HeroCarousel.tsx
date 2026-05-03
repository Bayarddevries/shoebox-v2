import { useEffect, useRef, useMemo, useState } from 'react'
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

const SLIDE_DURATION = 7000
const CROSSFADE_MS = 1500
const PRELOAD_AHEAD = 3

interface HeroCarouselProps {
  photos: Photo[]
  baseUrl: string
}

/**
 * Seamless crossfade carousel — two persistent DOM layers, no React re-renders during transitions.
 *
 * The incoming layer fades IN on top of the outgoing layer.
 * The outgoing layer stays at opacity 1 underneath the entire time.
 * The viewer ALWAYS sees a fully opaque image — no gap, no dark dip.
 *
 * After the crossfade completes, the (now-hidden) outgoing layer
 * snaps to opacity 0 instantly. Since it's behind the incoming layer,
 * this snap is invisible.
 */
export default function HeroCarousel({ photos, baseUrl }: HeroCarouselProps) {
  const shuffled = useMemo(() => {
    const arr = [...photos]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }, [photos])

  const layerARef = useRef<HTMLDivElement>(null)
  const layerBRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)
  const slideIdxRef = useRef(0)
  const activeRef = useRef<'a' | 'b'>('a')
  const readyRef = useRef(false)
  const [ready, setReady] = useState(false)

  // Preload first image before showing anything
  useEffect(() => {
    if (shuffled.length === 0) return
    const img = new Image()
    img.onload = () => { readyRef.current = true; setReady(true) }
    img.onerror = () => { readyRef.current = true; setReady(true) }
    img.src = `${baseUrl}${shuffled[0].src}`
    // Also preload second image
    if (shuffled.length > 1) {
      const img2 = new Image()
      img2.src = `${baseUrl}${shuffled[1].src}`
    }
  }, [shuffled, baseUrl])

  // Intersection Observer — pause when hero is scrolled off-screen
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const observer = new IntersectionObserver(
      ([entry]) => { pausedRef.current = !entry.isIntersecting },
      { threshold: 0.1 }
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  // Main carousel engine — all DOM manipulation is direct (no React re-renders)
  useEffect(() => {
    if (shuffled.length <= 1 || !readyRef.current) return

    const layerA = layerARef.current
    const layerB = layerBRef.current
    if (!layerA || !layerB) return

    const getKenBurns = (idx: number) => KEN_BURNS[idx % KEN_BURNS.length]

    // ── Initialize: A visible with image 0, B hidden ──
    const kb0 = getKenBurns(0)
    layerA.style.opacity = '1'
    layerA.style.zIndex = '2'
    layerA.style.backgroundImage = `url(${baseUrl}${shuffled[0].src})`
    layerA.style.setProperty('--kb-from', kb0.from)
    layerA.style.setProperty('--kb-to', kb0.to)
    // Restart Ken Burns animation from scratch
    layerA.style.animation = 'none'
    void layerA.offsetHeight // force reflow
    layerA.style.animation = `kenBurns ${SLIDE_DURATION + CROSSFADE_MS}ms ease-in-out both`

    layerB.style.opacity = '0'
    layerB.style.zIndex = '1'
    // Pre-load B with next image while hidden
    if (shuffled.length > 1) {
      layerB.style.backgroundImage = `url(${baseUrl}${shuffled[1].src})`
    }

    // ── Advance function ──
    const advance = () => {
      if (pausedRef.current) return

      const nextIdx = (slideIdxRef.current + 1) % shuffled.length
      const nextPhoto = shuffled[nextIdx]
      const kb = getKenBurns(nextIdx)

      // Incoming = the currently-hidden layer; Outgoing = the currently-visible layer
      const incoming = activeRef.current === 'a' ? layerB : layerA
      const outgoing = activeRef.current === 'a' ? layerA : layerB

      // 1. Set incoming layer's image + Ken Burns (still at opacity 0 — invisible)
      incoming.style.backgroundImage = `url(${baseUrl}${nextPhoto.src})`
      incoming.style.setProperty('--kb-from', kb.from)
      incoming.style.setProperty('--kb-to', kb.to)
      incoming.style.animation = 'none'
      void incoming.offsetHeight
      incoming.style.animation = `kenBurns ${SLIDE_DURATION + CROSSFADE_MS}ms ease-in-out both`

      // 2. Bring incoming to top and fade in OVER outgoing
      incoming.style.zIndex = '2'
      outgoing.style.zIndex = '1'
      incoming.style.transition = `opacity ${CROSSFADE_MS}ms ease-in-out`
      incoming.style.opacity = '1'

      // 3. After crossfade: hide outgoing layer instantly (it's behind, so invisible)
      setTimeout(() => {
        outgoing.style.transition = 'none'
        outgoing.style.opacity = '0'
        // Preload upcoming images for future slides
        for (let i = 1; i <= PRELOAD_AHEAD; i++) {
          const idx = (nextIdx + i) % shuffled.length
          const p = shuffled[idx]
          if (p) {
            const img = new Image()
            img.src = `${baseUrl}${p.src}`
          }
        }
      }, CROSSFADE_MS + 50) // small buffer to ensure transition is complete

      // 4. Swap active layer for next cycle
      activeRef.current = activeRef.current === 'a' ? 'b' : 'a'
      slideIdxRef.current = nextIdx
    }

    const id = setInterval(advance, SLIDE_DURATION)
    return () => clearInterval(id)
  }, [shuffled, baseUrl])

  if (shuffled.length === 0) return null
  if (!ready) return <div ref={sectionRef} className="hero-carousel" />

  return (
    <div ref={sectionRef} className="hero-carousel">
      {/* Two persistent layers — never destroyed by React.
          The background-image, opacity, z-index, and Ken Burns animation
          are all controlled via direct DOM manipulation in the useEffect above. */}
      <div ref={layerARef} className="hero-carousel-ken-burns" />
      <div ref={layerBRef} className="hero-carousel-ken-burns" />
    </div>
  )
}
