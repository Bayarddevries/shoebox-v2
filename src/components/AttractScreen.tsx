import { useEffect, useMemo, useRef, useState } from 'react'
import type { Photo } from '../types'
import './AttractScreen.css'

/**
 * The idle "attract" screen for the public archive site.
 *
 * Replaces the old full-bleed Ken Burns screensaver. Purpose: while the tablet
 * or Surface sits unattended at an event, show the best photographs AND explain
 * what the archive is, how big it is, and how a visitor can add to it. The
 * screen must also make it obvious that the device is interactive.
 *
 * Layout is fluid: portrait stacks (header / hero / stats / invitation / cue),
 * landscape splits (hero left, invitation right, stats across the bottom).
 */

interface AttractScreenProps {
  photos: Photo[]
  baseUrl: string
}

const HERO_INTERVAL = 8000
const PLATE_CHROME = 96 // mount padding (12) + plate block (54) + margins (20) + safety

function encodePath(path: string): string {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/')
}

function thumbOf(src: string): string {
  return src.replace('/photos/', '/thumbs/')
}

function yearOf(p: Photo): number | null {
  const y = p.year
  return typeof y === 'number' && y > 1800 && y < 2030 ? y : null
}

function titleOf(p: Photo): string {
  return (p.title && String(p.title).trim()) || (p.caption && String(p.caption).trim()) || p.alt || 'Untitled'
}

function dateLine(p: Photo): string {
  const y = yearOf(p)
  if (!y) return 'Undated'
  return y < 1930 ? `c. ${y}` : String(y)
}

function splitPeople(people: Photo['people']): string[] {
  if (!people) return []
  return String(people)
    .split(/[;,]/)
    .map(n => n.trim())
    .filter(Boolean)
}

interface Counts {
  photos: number
  communities: number
  names: number
  years: number
  range: string
  contributors: number
}

function computeCounts(photos: Photo[]): Counts {
  const communities = new Set<string>()
  const names = new Set<string>()
  const contributors = new Set<string>()
  let minY = Infinity
  let maxY = -Infinity

  for (const p of photos) {
    const c = (p.community || '').trim()
    if (c) {
      const normalized = c.toLowerCase() === 'for rae' ? 'Fort Rae' : c
      communities.add(normalized.toLowerCase())
    }
    for (const n of splitPeople(p.people)) names.add(n.toLowerCase())
    const s = p.submitter || ''
    if (s.trim()) contributors.add(s.trim().toLowerCase())
    const y = yearOf(p)
    if (y && y <= 2019) {
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }

  return {
    photos: photos.length,
    communities: communities.size,
    names: names.size,
    years: minY < Infinity ? maxY - minY + 1 : 0,
    range: minY < Infinity ? `${minY} – ${maxY}` : '',
    contributors: contributors.size,
  }
}

function useCountUp(target: number, duration = 1300): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / duration)
      const eased = 1 - Math.pow(1 - k, 3)
      setValue(Math.round(target * eased))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

function Stat({ target, label, sub }: { target: number; label: string; sub?: string }) {
  const value = useCountUp(target)
  return (
    <div className="at-stat">
      <div className="n">{value.toLocaleString('en-CA')}</div>
      <div className="l">{label}</div>
      {sub ? <div className="s">{sub}</div> : null}
    </div>
  )
}

function HeroMount({
  photo,
  baseUrl,
  width,
  height,
  active,
  onReady,
}: {
  photo: Photo
  baseUrl: string
  width: number
  height: number
  active: boolean
  onReady: () => void
}) {
  const photoRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const full = `${baseUrl}${encodePath(photo.src)}`
  const thumb = `${baseUrl}${encodePath(thumbOf(photo.src))}`

  // Paint the ~16KB thumbnail first and upgrade to the full scan on load.
  // The mount stays invisible until the thumbnail is decoded, so a crossfade
  // can never reveal an empty cream frame on a slow connection.
  useEffect(() => {
    let cancelled = false
    const markReady = () => {
      if (cancelled) return
      setLoaded(true)
      onReady()
    }
    const img = new Image()
    img.onload = markReady
    img.onerror = markReady
    img.src = thumb
    // Never let a missing/slow thumbnail freeze the rotation.
    const fallback = window.setTimeout(markReady, 3000)
    return () => {
      cancelled = true
      window.clearTimeout(fallback)
    }
    // onReady is stable enough for this one-shot preload
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thumb])

  useEffect(() => {
    let cancelled = false
    const probe = new Image()
    probe.onload = () => {
      if (!cancelled && photoRef.current) {
        photoRef.current.style.backgroundImage = `url("${full}")`
      }
    }
    probe.src = full
    return () => {
      cancelled = true
    }
  }, [full])

  return (
    <div className={`at-mount${active && loaded ? ' on' : ''}`} style={{ width: width + 24 }}>
      <div
        ref={photoRef}
        className="photo"
        style={{ height, backgroundImage: `url("${thumb}")` }}
      />
      <div className="plate">
        <div className="card">
          <div className="ttl">{titleOf(photo)}</div>
          <div className="yr">{dateLine(photo)}</div>
        </div>
      </div>
    </div>
  )
}

export default function AttractScreen({ photos, baseUrl }: AttractScreenProps) {
  const counts = useMemo(() => computeCounts(photos), [photos])

  const fieldRef = useRef<HTMLDivElement>(null)
  const [field, setField] = useState({ w: 0, h: 0 })
  const [pool, setPool] = useState<Photo[]>([])
  const [pair, setPair] = useState<{ photo: Photo; key: number }[]>([])
  const [activeKey, setActiveKey] = useState<number | null>(null)
  const indexRef = useRef(0)

  // ── Hero pool: the curated 80, resolved against the manifest ──
  useEffect(() => {
    let cancelled = false

    const fallback = () =>
      photos
        .filter(p => p.faceX != null && yearOf(p) != null && (yearOf(p) as number) < 1950)
        .slice(0, 80)

    const byId = new Map(photos.map(p => [String(p.id), p]))

    fetch(`${baseUrl}hero-pool.json`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: any) => {
        if (cancelled) return
        const list: any[] = data?.photos || (Array.isArray(data) ? data : [])
        const resolved: Photo[] = list
          .map(h => byId.get(String(h.id)) || (h as Photo))
          .filter((p): p is Photo => !!p && !!p.src && !!(p.width && p.height))
        setPool(resolved.length ? resolved : fallback())
      })
      .catch(() => {
        if (!cancelled) setPool(fallback())
      })

    return () => {
      cancelled = true
    }
  }, [photos, baseUrl])

  // Alternate landscape and portrait so the hero doesn't run in one rhythm.
  const orderedPool = useMemo(() => {
    if (!pool.length) return []
    const land = pool.filter(p => (p.width || 1) / (p.height || 1) >= 1)
    const port = pool.filter(p => (p.width || 1) / (p.height || 1) < 1)
    const out: Photo[] = []
    for (let i = 0; i < Math.max(land.length, port.length); i++) {
      if (land[i]) out.push(land[i])
      if (port[i]) out.push(port[i])
    }
    return out.length ? out : pool
  }, [pool])

  // ── Measure the hero field; the mount is sized to the photograph's ratio ──
  useEffect(() => {
    const el = fieldRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setField({ w: r.width, h: r.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Hero rotation ──
  useEffect(() => {
    if (!orderedPool.length) return
    indexRef.current = 0
    setPair([{ photo: orderedPool[0], key: 0 }])
    setActiveKey(null)
    const firstFallback = window.setTimeout(() => setActiveKey(0), 2500)

    const id = window.setInterval(() => {
      indexRef.current += 1
      const key = indexRef.current
      const photo = orderedPool[key % orderedPool.length]
      setPair(prev => {
        // Keep the last three mounts: if the newest photograph is still
        // decoding, the previously visible one stays in the DOM so the screen
        // can never be empty during a rotation.
        const keep = prev.slice(-2)
        return [...keep, { photo, key }]
      })
      // Activate when the thumbnail decodes; this fallback means a failed
      // thumbnail can never freeze the rotation.
      window.setTimeout(() => setActiveKey(k => (k == null || key > k ? key : k)), 2500)

      // Warm the next photograph while this one is on screen.
      const next = orderedPool[(key + 1) % orderedPool.length]
      if (next) {
        const img = new Image()
        img.src = `${baseUrl}${encodePath(next.src)}`
      }
    }, HERO_INTERVAL)

    return () => {
      window.clearInterval(id)
      window.clearTimeout(firstFallback)
    }
  }, [orderedPool, baseUrl])

  // Fit a photograph inside the field without cropping.
  const sized = useMemo(() => {
    return pair.map(({ photo, key }) => {
      const ratio = (photo.width || 0) / (photo.height || 0)
      if (!field.w || !field.h || !ratio || ratio <= 0) return { photo, key, width: 0, height: 0 }
      const maxPhotoW = field.w - 40
      const maxPhotoH = field.h - PLATE_CHROME
      let w = Math.min(maxPhotoW, maxPhotoH * ratio)
      let h = w / ratio
      if (h > maxPhotoH) {
        h = maxPhotoH
        w = h * ratio
      }
      return { photo, key, width: Math.round(w), height: Math.round(h) }
    })
  }, [pair, field])

  const ready = field.w > 0 && field.h > 0

  return (
    <div className="at-root" role="presentation">
      <div className="at-layout">
        <header className="at-header">
          <div className="wm">The Red River Métis Shoebox</div>
          <div className="rule" />
          <div className="sub">A community photograph archive · Manitoba</div>
        </header>

        <section className="at-hero">
          <div className="eyebrow">Featured from the collection</div>
          <div className="at-field" ref={fieldRef}>
            {ready &&
              sized.map(({ photo, key, width, height }) =>
                width > 40 ? (
                  <HeroMount
                    key={key}
                    photo={photo}
                    baseUrl={baseUrl}
                    width={width}
                    height={height}
                    active={activeKey === key}
                    onReady={() => setActiveKey(k => (k == null || key > k ? key : k))}
                  />
                ) : null
              )}
          </div>
          <div className="at-sweep" />
        </section>

        <section className="at-stats">
          <Stat target={counts.photos} label="Photographs" sub="digitized" />
          <Stat target={counts.communities} label="Communities" sub="represented" />
          <Stat target={counts.names} label="Names" sub="recorded" />
          <Stat target={counts.years} label="Years spanned" sub={counts.range} />
          <Stat target={counts.contributors} label="Contributors" sub="and growing" />
        </section>

        <section className="at-invite">
          <div className="at-copy">
            <div className="at-eyebrow">Add to the archive</div>
            <h2>
              BRING YOUR FAMILY
              <br />
              PHOTOGRAPHS
            </h2>
            <p>
              We scan photographs, letters and documents at the booth — and hand them
              straight back. Tell us the story behind them, and help keep this history in
              the family.
            </p>
            <div className="at-free">Free · scanned on site</div>
          </div>
          <div className="at-qr">
            <div className="box">
              <img src={`${baseUrl}assets/shoebox/booth/contribute-qr.svg`} alt="QR code to contribute photographs" />
            </div>
            <div className="cap">Scan to share</div>
          </div>
        </section>

        <footer className="at-footer">
          <div className="at-cue">
            <span className="dot" />
            TOUCH THE SCREEN TO EXPLORE THE ARCHIVE
          </div>
        </footer>
      </div>
    </div>
  )
}
