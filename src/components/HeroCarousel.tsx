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
 * Two-layer carousel with seamless crossfade.
 *
 * Layer model:
 *   ┌─────────────────┐
 *   │  TOP (z:2)      │ ← outgoing image, fades out via CSS
 *   ├─────────────────┤
 *   │  BOTTOM (z:1)   │ ← incoming image, always at opacity 1
 *   └─────────────────┘
 *
 * On each transition:
 *   1. Paint the next photo onto the BOTTOM layer
 *   2. Move the current photo to the TOP layer and start fading it out
 *   3. After fade completes, the top layer is invisible — ready to
 *      become the bottom layer on the NEXT transition
 *
 * We track which slot (A or B) is "current" and which is "next".
 * They alternate each transition.
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

  // Each slot holds a photo index. -1 = empty.
  // slot[0] = currently active, slot[1] = standby (will become next)
  const [slots, setSlots] = useState<[number, number]>([0, -1])
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
  }, [slots, shuffled, baseUrl])

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

      // Transition: current photo moves to top (fades out), next photo goes to bottom
      setSlots(prev => [next, prev[0]]) // [bottom=new, top=old]
      setFading(true)

      // After fade ends, top layer is invisible. Swap: top becomes the new standby.
      // The bottom (which was "new") is now the "current" photo.
      setTimeout(() => {
        setSlots(prev => [prev[0], -1]) // top cleared — it's just standby now
        setFading(false)
      }, CROSSFADE)
    }, SLIDE_DURATION)

    return () => clearInterval(id)
  }, [shuffled.length])

  if (shuffled.length === 0) return null

  const kb = (i: number) => KEN_BURNS[i % KEN_BURNS.length]

  const renderSlot = (photoIdx: number, role: 'bottom' | 'top') => {
    const zIndex = role === 'top' ? 2 : 1
    const isOutgoing = role === 'top' && fading
    const isEmpty = photoIdx < 0

    if (isEmpty) {
      return <div className="hero-carousel-slide" style={{ zIndex }} />
    }

    const photo = shuffled[photoIdx]
    const variant = kb(photoIdx)

    return (
      <div
        className={`hero-carousel-slide${isOutgoing ? ' hero-carousel-fade-out' : ''}`}
        style={{ zIndex }}
      >
        <div
          key={`kb-${photoIdx}`}
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
      {renderSlot(slots[0], 'bottom')}
      {renderSlot(slots[1], 'top')}
    </div>
  )
}
