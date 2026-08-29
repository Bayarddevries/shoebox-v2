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

// Face-anchored zoom variants: pure scale around the face point (no translate,
// so the transform-origin fully controls where the zoom is anchored).
// Alternating push-in / pull-out for variety.
const FACE_ZOOM = [
  { from: 'scale(1)', to: 'scale(1.15)' },
  { from: 'scale(1.15)', to: 'scale(1)' },
]

function getFacePosition(photo: Photo) {
  if (photo.faceX != null && photo.faceY != null) {
    return { x: photo.faceX, y: photo.faceY }
  }
  return FALLBACK_CENTER
}

/**
 * Compute the transform-origin (as % of the layer) that sits exactly on the
 * detected face, given `background-size: cover` + `background-position: center`.
 *
 * With cover+center the image covers the oversized layer (inset -5%, so 110% of
 * the viewport) with no gaps, and the image center is at the layer center. A
 * face at normalized (fx, fy) therefore lands at:
 *
 *   face_x = Lw/2 + Iw*(fx - 0.5)      (Iw = cover-scaled image width)
 *   face_y = Lh/2 + Ih*(fy - 0.5)
 *
 * Setting transform-origin to this point makes the scale zoom radiate from the
 * face (the projector's old bug was using raw `faceX%` as the origin, which is
 * wrong on an oversized layer and sent the zoom swinging off the face).
 *
 * Returns null when there is no face data, or the face sits so far off-screen
 * that anchoring there would zoom empty space (those photos fall back to the
 * smooth centered drift).
 */
function getFaceOrigin(photo: Photo): { x: number; y: number } | null {
  const f = getFacePosition(photo)
  const w = photo.width, h = photo.height
  if (f.x === FALLBACK_CENTER.x && f.y === FALLBACK_CENTER.y) return null
  if (!w || !h || w <= 0 || h <= 0) return null
  const layerW = window.innerWidth * 1.1 // inset: -5% each side
  const layerH = window.innerHeight * 1.1
  const s = Math.max(layerW / w, layerH / h) // cover
  const Iw = w * s, Ih = h * s
  const ox = (layerW / 2 + Iw * (f.x - 0.5)) / layerW * 100
  const oy = (layerH / 2 + Ih * (f.y - 0.5)) / layerH * 100
  // Viewport is the central ~9%..91% of the layer; only anchor when the face
  // is on-screen, otherwise the zoom would point at empty space.
  const lo = 100 * (1 - 1 / 1.1) / 2 // 4.5%
  const hi = 100 - lo
  if (ox < lo || ox > hi || oy < lo || oy > hi) return null
  return { x: ox, y: oy }
}

/**
 * Set the background (cover+center: zero gaps) and the Ken Burns transform for
 * one layer. When a usable face origin exists the zoom is anchored on the face;
 * otherwise it uses the smooth centered drift (matching HeroCarousel).
 */
function applyBg(layer: HTMLElement, photo: Photo, baseUrl: string, idx: number) {
  layer.style.backgroundImage = `url(${baseUrl}${encodePath(photo.src)})`
  layer.style.backgroundSize = 'cover'
  layer.style.backgroundPosition = 'center'
  const origin = getFaceOrigin(photo)
  if (origin) {
    const kb = FACE_ZOOM[idx % FACE_ZOOM.length]
    layer.style.transformOrigin = `${origin.x}% ${origin.y}%`
    layer.style.setProperty('--kb-from', kb.from)
    layer.style.setProperty('--kb-to', kb.to)
  } else {
    const kb = KEN_BURNS[idx % KEN_BURNS.length]
    layer.style.transformOrigin = 'center'
    layer.style.setProperty('--kb-from', kb.from)
    layer.style.setProperty('--kb-to', kb.to)
  }
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

      // Init: A visible with image 0, B hidden
      layerA.style.opacity = '1'
      layerA.style.zIndex = '2'
      applyBg(layerA, shuffled[0], baseUrl, 0)
      layerA.style.animation = 'none'
      void layerA.offsetHeight
      layerA.style.animation = `kenBurns ${SLIDE_DURATION + CROSSFADE_MS}ms ease-in-out both`

      layerB.style.opacity = '0'
      layerB.style.zIndex = '1'
      if (shuffled.length > 1) {
        applyBg(layerB, shuffled[1], baseUrl, 1)
      }

      const advance = () => {
        const nextIdx = (slideIdxRef.current + 1) % shuffled.length
        const nextPhoto = shuffled[nextIdx]

        const incoming = activeRef.current === 'a' ? layerB : layerA
        const outgoing = activeRef.current === 'a' ? layerA : layerB

        applyBg(incoming, nextPhoto, baseUrl, nextIdx)
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
