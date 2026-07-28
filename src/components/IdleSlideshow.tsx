import { useEffect, useRef, useState, useMemo } from 'react'
import type { Photo } from '../types'

const IDLE_TIMEOUT_MS = 4 * 60 * 1000 // 4 minutes
const SLIDE_DURATION = 7000
const CROSSFADE_MS = 1500
const PRELOAD_AHEAD = 3

// Ken Burns variants matching HeroCarousel
// Each variant defines the scale/translate range for the pan & zoom effect
const KEN_BURNS = [
  { from: 'scale(1) translate(0, 0)', to: 'scale(1.15) translate(-2%, -1%)' },
  { from: 'scale(1.1) translate(-2%, 0)', to: 'scale(1) translate(1%, -1%)' },
  { from: 'scale(1) translate(1%, 0)', to: 'scale(1.12) translate(-1%, 1%)' },
  { from: 'scale(1.08) translate(0, -1%)', to: 'scale(1) translate(1%, 1%)' },
  { from: 'scale(1.05) translate(-1%, 1%)', to: 'scale(1.15) translate(1%, -1%)' },
  { from: 'scale(1.1) translate(1%, -1%)', to: 'scale(1) translate(-1%, 1%)' },
]

// Fallback center when face coordinates are missing
const FALLBACK_CENTER = { x: 0.5, y: 0.5 }

function getFacePosition(photo: Photo) {
  if (photo.faceX != null && photo.faceY != null) {
    return { x: photo.faceX, y: photo.faceY }
  }
  return FALLBACK_CENTER
}

function encodePath(path: string): string {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/')
}

interface IdleSlideshowProps {
  photos: Photo[]
  baseUrl: string
}

/**
 * Idle timeout slideshow — full-screen Ken Burns overlay after 4 minutes of
 * inactivity. Any interaction (click, touch, scroll, keypress, mousemove)
 * dismisses it and resets the timer.
 */
export default function IdleSlideshow({ photos, baseUrl }: IdleSlideshowProps) {
  const [showing, setShowing] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Shuffle photos once for the slideshow order
  const shuffled = useMemo(() => {
    const arr = [...photos]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }, [photos])

  // Reset the idle timer
  const resetTimer = useRef(() => {})

  // ── Slideshow engine (inside overlay) ──
  function SlideshowEngine() {
    const layerARef = useRef<HTMLDivElement>(null)
    const layerBRef = useRef<HTMLDivElement>(null)
    const slideIdxRef = useRef(0)
    const activeRef = useRef<'a' | 'b'>('a')

    useEffect(() => {
      if (shuffled.length === 0) return

      const layerA = layerARef.current
      const layerB = layerBRef.current
      if (!layerA || !layerB) return

      const getKenBurns = (idx: number) => KEN_BURNS[idx % KEN_BURNS.length]

      // Init: A visible with image 0, B hidden
      const kb0 = getKenBurns(0)
      const pos0 = getFacePosition(shuffled[0])
      layerA.style.opacity = '1'
      layerA.style.zIndex = '2'
      layerA.style.backgroundImage = `url(${baseUrl}${encodePath(shuffled[0].src)})`
      layerA.style.backgroundPosition = `${pos0.x * 100}% ${pos0.y * 100}%`
      layerA.style.setProperty('--kb-from', kb0.from)
      layerA.style.setProperty('--kb-to', kb0.to)
      layerA.style.animation = 'none'
      void layerA.offsetHeight
      layerA.style.animation = `kenBurns ${SLIDE_DURATION + CROSSFADE_MS}ms ease-in-out both`

      layerB.style.opacity = '0'
      layerB.style.zIndex = '1'
      if (shuffled.length > 1) {
        const pos1 = getFacePosition(shuffled[1])
        layerB.style.backgroundImage = `url(${baseUrl}${encodePath(shuffled[1].src)})`
        layerB.style.backgroundPosition = `${pos1.x * 100}% ${pos1.y * 100}%`
      }

      const advance = () => {
        const nextIdx = (slideIdxRef.current + 1) % shuffled.length
        const nextPhoto = shuffled[nextIdx]
        const kb = getKenBurns(nextIdx)
        const pos = getFacePosition(nextPhoto)

        const incoming = activeRef.current === 'a' ? layerB : layerA
        const outgoing = activeRef.current === 'a' ? layerA : layerB

        incoming.style.backgroundImage = `url(${baseUrl}${encodePath(nextPhoto.src)})`
        incoming.style.backgroundPosition = `${pos.x * 100}% ${pos.y * 100}%`
        incoming.style.setProperty('--kb-from', kb.from)
        incoming.style.setProperty('--kb-to', kb.to)
        incoming.style.animation = 'none'
        void incoming.offsetHeight
        incoming.style.animation = `kenBurns ${SLIDE_DURATION + CROSSFADE_MS}ms ease-in-out both`

        incoming.style.zIndex = '2'
        outgoing.style.zIndex = '1'
        incoming.style.transition = `opacity ${CROSSFADE_MS}ms ease-in-out`
        void incoming.offsetHeight
        incoming.style.opacity = '1'

        setTimeout(() => {
          outgoing.style.transition = 'none'
          outgoing.style.opacity = '0'
          for (let i = 1; i <= PRELOAD_AHEAD; i++) {
            const idx = (nextIdx + i) % shuffled.length
            const p = shuffled[idx]
            if (p) {
              const img = new Image()
              img.src = `${baseUrl}${encodePath(p.src)}`
            }
          }
        }, CROSSFADE_MS + 50)

        activeRef.current = activeRef.current === 'a' ? 'b' : 'a'
        slideIdxRef.current = nextIdx
      }

      const id = setInterval(advance, SLIDE_DURATION)
      return () => clearInterval(id)
    }, [shuffled, baseUrl])

    return (
      <>
        <div ref={layerARef} className="hero-carousel-ken-burns idle-ken-burns" />
        <div ref={layerBRef} className="hero-carousel-ken-burns idle-ken-burns" />
      </>
    )
  }

  // ── Setup idle timer and global listeners ──
  useEffect(() => {
    if (photos.length === 0) return

    const startTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setShowing(true), IDLE_TIMEOUT_MS)
    }

    const dismiss = () => {
      if (showing) {
        setShowing(false)
      }
      startTimer() // always reset the timer
    }

    resetTimer.current = startTimer

    const events = ['mousedown', 'mousemove', 'touchstart', 'scroll', 'keydown', 'wheel']
    events.forEach(ev => window.addEventListener(ev, dismiss, { passive: true }))

    startTimer()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      events.forEach(ev => window.removeEventListener(ev, dismiss))
    }
  }, [photos.length, showing])

  // If no photos, render nothing
  if (shuffled.length === 0) return null

  return (
    <>
      {showing && (
        <div
          ref={overlayRef}
          className="idle-slideshow-overlay"
          onClick={() => { setShowing(false); resetTimer.current() }}
          onTouchStart={() => { setShowing(false); resetTimer.current() }}
        >
          <SlideshowEngine />
          <div className="idle-slideshow-tip">
            Tap anywhere to return
          </div>
        </div>
      )}
      <style>{`
        .idle-slideshow-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: black;
          cursor: pointer;
          animation: idleFadeIn 0.8s ease-out;
        }
        @keyframes idleFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .idle-ken-burns {
          position: absolute;
          inset: -5%;
          background-size: cover;
          background-position: center;
          filter: brightness(0.7) saturate(1.1);
          will-change: transform, opacity;
        }
        .idle-slideshow-tip {
          position: absolute;
          bottom: 2rem;
          left: 50%;
          transform: translateX(-50%);
          color: rgba(255, 255, 255, 0.5);
          font-family: 'Inter', sans-serif;
          font-size: 0.8rem;
          letter-spacing: 0.05em;
          z-index: 10;
          animation: idleTipPulse 3s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes idleTipPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </>
  )
}
