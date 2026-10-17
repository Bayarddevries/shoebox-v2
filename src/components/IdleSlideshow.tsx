import { useEffect, useRef, useState } from 'react'
import type { Photo } from '../types'
import AttractScreen from './AttractScreen'

/**
 * Idle timer that reveals the archive's attract screen.
 *
 * The attract screen replaced the old full-bleed Ken Burns slideshow: it shows
 * the best photographs together with the collection's scale and an invitation
 * to contribute, and it says plainly that the screen is interactive.
 *
 * Default idle time is 4 minutes. For events, override it with a URL parameter:
 *   ?idle=60        → show the attract screen after 60 seconds
 * (clamped to 10–3600 seconds).
 */

const DEFAULT_IDLE_TIMEOUT_MS = 4 * 60 * 1000
const CLICK_GUARD_MS = 700

function readIdleTimeoutMs(): number {
  try {
    const raw = new URLSearchParams(window.location.search).get('idle')
    if (!raw) return DEFAULT_IDLE_TIMEOUT_MS
    const seconds = Number(raw)
    if (!Number.isFinite(seconds)) return DEFAULT_IDLE_TIMEOUT_MS
    return Math.min(3600, Math.max(10, seconds)) * 1000
  } catch {
    return DEFAULT_IDLE_TIMEOUT_MS
  }
}

// Read once at module load, before any app effect rewrites the URL.
const IDLE_TIMEOUT_MS = readIdleTimeoutMs()

interface IdleSlideshowProps {
  photos: Photo[]
  baseUrl: string
}

export default function IdleSlideshow({ photos, baseUrl }: IdleSlideshowProps) {
  const [showing, setShowing] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timeoutRef = useRef(IDLE_TIMEOUT_MS)
  const showingRef = useRef(false)
  const suppressClickUntil = useRef(0)

  useEffect(() => {
    showingRef.current = showing
  }, [showing])

  useEffect(() => {
    if (photos.length === 0) return

    const startTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setShowing(true), timeoutRef.current)
    }

    // Any deliberate interaction dismisses the attract screen and restarts the
    // timer. `mousemove` is intentionally NOT a trigger: a hand passing over a
    // mouse, or a pen hovering above the Surface, would otherwise dismiss the
    // screen before anyone has actually touched it.
    const dismiss = () => {
      if (showingRef.current) {
        // The overlay disappears on pointerdown, so the browser's following
        // click would otherwise land on whatever was underneath it (often a
        // photograph) and open a detail view the visitor never asked for.
        suppressClickUntil.current = Date.now() + CLICK_GUARD_MS
      }
      setShowing(false)
      startTimer()
    }

    // Swallow the wake gesture's click so it cannot activate the page below.
    const blockClick = (e: MouseEvent) => {
      if (Date.now() < suppressClickUntil.current) {
        e.stopPropagation()
        e.preventDefault()
      }
    }

    const events = ['mousedown', 'touchstart', 'pointerdown', 'scroll', 'keydown', 'wheel']
    events.forEach(ev => window.addEventListener(ev, dismiss, { passive: true }))
    window.addEventListener('click', blockClick, true)

    startTimer()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      events.forEach(ev => window.removeEventListener(ev, dismiss))
      window.removeEventListener('click', blockClick, true)
    }
  }, [photos.length])

  // Lock body scroll while the overlay is showing so the page's scrollbar
  // doesn't float over the attract screen.
  useEffect(() => {
    if (!showing) return
    const prevBody = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevBody
      document.documentElement.style.overflow = prevHtml
    }
  }, [showing])

  if (!showing || photos.length === 0) return null

  return (
    <div onClick={() => setShowing(false)} onTouchStart={() => setShowing(false)}>
      <AttractScreen photos={photos} baseUrl={baseUrl} />
    </div>
  )
}
