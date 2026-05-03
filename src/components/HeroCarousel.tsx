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
const CROSSFADE = 1500
const PRELOAD = 3

interface Props {
  photos: Photo[]
  baseUrl: string
}

/**
 * Two-layer carousel.
 * 
 * Both layers always exist in the DOM — no React keys that cause
 * teardown/recreate gaps. On each transition:
 *   1. The next image is painted onto the BOTTOM layer (opacity 1, Ken Burns starts)
 *   2. The TOP layer (old image) fades out via CSS animation
 *   3. When fade completes, the now-hidden top layer becomes the new bottom
 *   4. Layers swap roles for the next transition
 * 
 * Result: the new image is always fully rendered before the old one
 * starts fading, so there's never a gap or dark flash.
 */
export default function HeroCarousel({ photos, baseUrl }: Props) {
  const shuffled = useMemo(() => {
    const arr = [...photos]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }, [photos])

  // Two persistent layers. Each stores a photo index.
  // layer[0] = bottom, layer[1] = top
  const [layers, setLayers] = useState<[number, number]>([0, -1])
  const [fading, setFading] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)
  const idxRef = useRef(0)

  // Preload upcoming images
  useEffect(() => {
    const cur = idxRef.current
    for (let i = 1; i <= PRELOAD; i++) {
      const photo = shuffled[(cur + i) % shuffled.length]
      if (photo) { const img = new Image(); img.src = `${baseUrl}${photo.src}` }
    }
  }, [layers, shuffled, baseUrl])

  // Intersection Observer
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { pausedRef.current = !e.isIntersecting },
      { threshold: 0.1 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Advance timer
  useEffect(() => {
    if (shuffled.length <= 1) return
    const id = setInterval(() => {
      if (pausedRef.current) return

      const next = (idxRef.current + 1) % shuffled.length
      idxRef.current = next

      // Paint next image onto bottom, current image stays on top to fade out
      setLayers(prev => [next, prev[0]]) // bottom=new, top=old(current)
      setFading(true)

      setTimeout(() => {
        // After fade: top layer is now hidden. Swap so bottom (new image) is the
        // "current" layer for the next cycle. New top = -1 (empty/hidden).
        setLayers(prev => [prev[0], -1])
        setFading(false)
      }, CROSSFADE)
    }, SLIDE_DURATION)
    return () => clearInterval(id)
  }, [shuffled.length])

  if (shuffled.length === 0) return null

  const kb = (i: number) => KEN_BURNS[i % KEN_BURNS.length]

  const renderLayer = (photoIdx: number, isTop: boolean) => {
    if (photoIdx < 0 || photoIdx >= shuffled.length) return null
    const photo = shuffled[photoIdx]
    const variant = kb(photoIdx)
    const isOutgoing = isTop && fading

    return (
      <div
        className={`hero-carousel-slide${isOutgoing ? ' hero-carousel-fade-out' : ''}`}
        style={{ zIndex: isTop ? 2 : 1 }}
      >
        <div
          className="hero-carousel-ken-burns"
          style={{
            backgroundImage: `url(${baseUrl}${photo.src})`,
            animationName: isOutgoing ? 'kenBurnsFreeze' : 'kenBurns',
            animationDuration: isOutgoing ? '1ms' : `${SLIDE_DURATION + CROSSFADE}ms`,
            '--kb-from': variant.from,
            '--kb-to': variant.to,
            ...(isOutgoing ? { '--freeze-transform': variant.to } as React.CSSProperties : {}),
          } as React.CSSProperties}
        />
      </div>
    )
  }

  return (
    <div ref={sectionRef} className="hero-carousel">
      {renderLayer(layers[0], false)} {/* bottom: incoming */}
      {renderLayer(layers[1], true)}  {/* top: outgoing (fading) or -1 (hidden) */}
    </div>
  )
}
