import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
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
 * Ken Burns inner div.
 *
 * CSS custom properties (--kb-from, --kb-to, --freeze-transform) are set
 * via ref callback because React's style prop silently drops backgroundImage
 * when custom properties are mixed into the same style object.
 */
function KenBurnsDiv({ photoIdx, shuffled, baseUrl, isOutgoing }: {
  photoIdx: number
  shuffled: Photo[]
  baseUrl: string
  isOutgoing: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const photo = shuffled[photoIdx]
  const variant = KEN_BURNS[photoIdx % KEN_BURNS.length]

  // Set CSS custom properties via DOM (avoids React's style prop bug)
  const setCustomProps = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    el.style.setProperty('--kb-from', variant.from)
    el.style.setProperty('--kb-to', variant.to)
    if (isOutgoing) {
      el.style.setProperty('--freeze-transform', variant.to)
    }
  }, [variant.from, variant.to, isOutgoing])

  return (
    <div
      ref={(el) => { (ref as React.MutableRefObject<HTMLDivElement | null>).current = el; setCustomProps(el) }}
      className="hero-carousel-ken-burns"
      style={{
        backgroundImage: `url(${baseUrl}${photo.src})`,
        animationName: isOutgoing ? 'kenBurnsFreeze' : 'kenBurns',
        animationDuration: isOutgoing ? '1ms' : `${SLIDE_DURATION + CROSSFADE}ms`,
      }}
    />
  )
}

/**
 * Two-layer carousel with seamless crossfade.
 *
 * slots[0] = bottom (current/new), slots[1] = top (old/fading). -1 = empty.
 * On transition: new image goes to bottom, current image moves to top and fades out.
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
      setSlots(prev => [next, prev[0]])
      setFading(true)
      setTimeout(() => {
        setSlots(prev => [prev[0], -1])
        setFading(false)
      }, CROSSFADE)
    }, SLIDE_DURATION)
    return () => clearInterval(id)
  }, [shuffled.length])

  if (shuffled.length === 0) return null

  const renderSlot = (photoIdx: number, role: 'bottom' | 'top') => {
    const zIndex = role === 'top' ? 2 : 1
    const isOutgoing = role === 'top' && fading
    const isEmpty = photoIdx < 0

    if (isEmpty) {
      return <div className="hero-carousel-slide" style={{ zIndex }} />
    }

    return (
      <div
        className={`hero-carousel-slide${isOutgoing ? ' hero-carousel-fade-out' : ''}`}
        style={{ zIndex }}
      >
        <KenBurnsDiv
          key={`kb-${photoIdx}`}
          photoIdx={photoIdx}
          shuffled={shuffled}
          baseUrl={baseUrl}
          isOutgoing={isOutgoing}
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
