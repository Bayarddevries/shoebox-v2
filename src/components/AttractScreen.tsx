import { useEffect, useMemo, useRef, useState } from 'react'
import type { Photo } from '../types'
import './AttractScreen.css'

/**
 * The idle "attract" screen for the public archive site.
 *
 * Three scenes cycle every 12 seconds:
 *   1. FEATURED PHOTOGRAPH  one large print plus who shared it
 *   2. FAMILIES WHO SHARED  three prints, each credited to its submitter
 *   3. ADD YOUR PHOTOGRAPHS the contribution invitation and QR
 *
 * The wordmark, the collection stats and the tap cue stay fixed so the screen
 * always explains itself and always looks interactive.
 */

interface AttractScreenProps {
  photos: Photo[]
  baseUrl: string
}

const SCENE_MS = 12000
const PLATE_CHROME = 96 // mount padding (12) + plate block (54) + margins (20) + safety
const MINI_CHROME = 104 // mount padding (10) + tag block (~74) + margins
const TRIO_GAP = 24

function encodePath(path: string): string {
  // encodeURI (not encodeURIComponent) keeps commas and apostrophes literal.
  // Some static servers, including the local preview server, fail to resolve
  // %2C in a path and fall back to index.html, which paints a blank mount.
  return encodeURI(path).replace(/#/g, '%23').replace(/\?/g, '%3F')
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

function captionOf(p: Photo): string {
  const title = titleOf(p).trim().toLowerCase()
  const caption = (p.caption || '').trim()
  if (!caption) return ''
  const c = caption.toLowerCase()
  if (c === title || c.startsWith(title) || title.startsWith(c)) return ''
  return caption
}

function submitterOf(p: Photo): string {
  return (p.submitter || '').trim() || 'the community archive'
}

/** Three photographs by three different submitters, where the pool allows it. */
function pickTrio(pool: Photo[], start: number): Photo[] {
  const out: Photo[] = []
  const seen = new Set<string>()
  for (let i = 0; i < pool.length && out.length < 3; i++) {
    const p = pool[(start + i) % pool.length]
    const who = submitterOf(p).toLowerCase()
    if (seen.has(who)) continue
    seen.add(who)
    out.push(p)
  }
  for (let i = 0; out.length < 3 && i < pool.length; i++) {
    out.push(pool[(start + i) % pool.length])
  }
  return out
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

function useSize() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setSize({ w: r.width, h: r.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, size }
}

function fitPhoto(p: Photo, maxW: number, maxH: number) {
  const ratio = (p.width || 0) / (p.height || 0)
  if (!maxW || !maxH || !ratio || ratio <= 0) return null
  let w = Math.min(maxW, maxH * ratio)
  let h = w / ratio
  if (h > maxH) {
    h = maxH
    w = h * ratio
  }
  return { w: Math.round(w), h: Math.round(h) }
}

/** Page 1: the large mounted print, with its plate. */
function HeroMount({ photo, baseUrl, width, height }: { photo: Photo; baseUrl: string; width: number; height: number }) {
  const photoRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const full = `${baseUrl}${encodePath(photo.src)}`
  const thumb = `${baseUrl}${encodePath(thumbOf(photo.src))}`

  useEffect(() => {
    let cancelled = false
    const ready = () => {
      if (!cancelled) setLoaded(true)
    }
    const img = new Image()
    img.onload = ready
    img.onerror = ready
    img.src = thumb
    const fallback = window.setTimeout(ready, 3000)
    return () => {
      cancelled = true
      window.clearTimeout(fallback)
    }
  }, [thumb])

  useEffect(() => {
    let cancelled = false
    const probe = new Image()
    probe.onload = async () => {
      try {
        await probe.decode()
      } catch {
        // decode() can reject for an already-decoded image; the swap is still safe
      }
      if (!cancelled && photoRef.current) photoRef.current.style.backgroundImage = `url("${full}")`
    }
    probe.src = full
    return () => {
      cancelled = true
    }
  }, [full])

  return (
    <div className={`at-mount${loaded ? ' on' : ''}`} style={{ width: width + 24 }}>
      <div ref={photoRef} className="photo" style={{ height, backgroundImage: `url("${thumb}")` }} />
      <div className="plate">
        <div className="card">
          <div className="ttl">{titleOf(photo)}</div>
          <div className="yr">{dateLine(photo)}</div>
        </div>
      </div>
    </div>
  )
}

/** Page 2: a smaller print with the submitter named directly beneath it. */
function MiniPrint({
  photo,
  baseUrl,
  width,
  height,
}: {
  photo: Photo
  baseUrl: string
  width: number
  height: number
}) {
  const photoRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const full = `${baseUrl}${encodePath(photo.src)}`
  const thumb = `${baseUrl}${encodePath(thumbOf(photo.src))}`

  useEffect(() => {
    let cancelled = false
    const ready = () => {
      if (!cancelled) setLoaded(true)
    }
    const img = new Image()
    img.onload = ready
    img.onerror = ready
    img.src = thumb
    const probe = new Image()
    probe.onload = async () => {
      try {
        await probe.decode()
      } catch {
        // already-decoded images can reject decode(); the swap is still safe
      }
      if (!cancelled && photoRef.current) photoRef.current.style.backgroundImage = `url("${full}")`
    }
    probe.src = full
    const fallback = window.setTimeout(ready, 4000)
    return () => {
      cancelled = true
      window.clearTimeout(fallback)
    }
  }, [thumb, full])

  return (
    <div className={`at-print${loaded ? ' on' : ''}`} style={{ width: width + 20 }}>
      <div ref={photoRef} className="photo" style={{ height, backgroundImage: `url("${thumb}")` }} />
      <div className="at-tag">
        <div className="lab">Shared by</div>
        <div className="who">{submitterOf(photo)}</div>
        <div className="meta">
          {titleOf(photo)} · {dateLine(photo)}
        </div>
      </div>
    </div>
  )
}

export default function AttractScreen({ photos, baseUrl }: AttractScreenProps) {
  const counts = useMemo(() => computeCounts(photos), [photos])

  const [pool, setPool] = useState<Photo[]>([])
  const [cycle, setCycle] = useState(0)
  const { ref: p1FieldRef, size: p1Field } = useSize()
  const { ref: p2RowRef, size: p2Row } = useSize()

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

  // Alternate landscape and portrait so the scenes don't run in one rhythm.
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

  // ── Scene clock ──
  useEffect(() => {
    if (!orderedPool.length) return
    const id = window.setInterval(() => setCycle(c => c + 1), SCENE_MS)
    return () => window.clearInterval(id)
  }, [orderedPool.length])

  const scene = cycle % 3

  // Content is chosen one scene AHEAD so its images have 12–24 seconds to
  // decode while hidden. Without this, a scene can open on a blank cream mount.
  const [featured, setFeatured] = useState<Photo | null>(null)
  const [trio, setTrio] = useState<Photo[]>([])

  useEffect(() => {
    if (!orderedPool.length) return
    if (scene === 0) {
      if (!featured) setFeatured(orderedPool[0])
      return
    }
    const nextP1 = cycle + ((0 - scene + 3) % 3)
    setFeatured(orderedPool[(nextP1 * 7) % orderedPool.length])
  }, [cycle, scene, orderedPool, featured])

  useEffect(() => {
    if (!orderedPool.length) return
    if (scene === 1) return
    const nextP2 = cycle + ((1 - scene + 3) % 3)
    setTrio(pickTrio(orderedPool, (nextP2 * 3 + 1) % orderedPool.length))
  }, [cycle, scene, orderedPool])

  // ── Sizes ──
  const featuredSize = featured ? fitPhoto(featured, p1Field.w - 40, p1Field.h - PLATE_CHROME) : null

  const trioSizes = useMemo(() => {
    if (!p2Row.w || !p2Row.h || !trio.length) return [] as ({ w: number; h: number } | null)[]
    const colW = (p2Row.w - TRIO_GAP * 2) / 3
    const maxPhotoW = colW - 20
    const maxPhotoH = p2Row.h - MINI_CHROME
    return trio.map(p => fitPhoto(p, maxPhotoW, maxPhotoH))
  }, [p2Row, trio])

  const featuredCaption = featured ? captionOf(featured) : ''

  return (
    <div className="at-root" role="presentation">
      <div className="at-glow" />
      <div className="at-layout">
        <header className="at-header">
          <div className="wm">The Red River Métis Shoebox</div>
          <div className="rule" />
          <div className="sub">A community photograph archive · Manitoba</div>
        </header>

        <div className="at-main">
          {/* ── Scene 1: featured photograph and who shared it ── */}
          <section className={`at-scene p1${scene === 0 ? ' on' : ''}`} aria-hidden={scene !== 0}>
            <div className="p1-left">
              <div className="p1-field" ref={p1FieldRef}>
                {featured && featuredSize && featuredSize.w > 40 ? (
                  <HeroMount
                    key={featured.id}
                    photo={featured}
                    baseUrl={baseUrl}
                    width={featuredSize.w}
                    height={featuredSize.h}
                  />
                ) : null}
              </div>
              <div className="at-sweep" />
            </div>
            <div className="p1-story">
              <div className="at-eyebrow">Featured photograph</div>
              {featured ? (
                <>
                  <h2>{titleOf(featured)}</h2>
                  <div className="p1-date">{dateLine(featured)}</div>
                  <div className="p1-credit">
                    <div className="lab">Shared by</div>
                    <div className="name">{submitterOf(featured)}</div>
                    {featured.community ? <div className="from">{featured.community}</div> : null}
                  </div>
                  {featuredCaption ? <div className="p1-rule" /> : null}
                  {featuredCaption ? <p className="p1-caption">{featuredCaption}</p> : null}
                </>
              ) : null}
            </div>
          </section>

          {/* ── Scene 2: three families, three credits ── */}
          <section className={`at-scene p2${scene === 1 ? ' on' : ''}`} aria-hidden={scene !== 1}>
            <div className="p2-head">
              <div className="at-eyebrow">Shared by families across Manitoba</div>
            </div>
            <div className="p2-row" ref={p2RowRef}>
              {trio.map((p, i) => {
                const s = trioSizes[i]
                if (!s || s.w < 40) return null
                return (
                  <div className="p2-item" key={`${p.id}-${i}`}>
                    <MiniPrint photo={p} baseUrl={baseUrl} width={s.w} height={s.h} />
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── Scene 3: add your photographs ── */}
          <section className={`at-scene p3${scene === 2 ? ' on' : ''}`} aria-hidden={scene !== 2}>
            <div className="p3-copy">
              <div className="at-eyebrow">Add to the archive</div>
              <h2>
                BRING YOUR FAMILY
                <br />
                PHOTOGRAPHS
              </h2>
              <p>
                We scan photographs, letters and documents at the booth, and hand them
                straight back. Tell us the story behind them, and help keep this history
                in the family.
              </p>
              <div className="p3-free">Free · scanned on site</div>
            </div>
            <div className="p3-qr-wrap">
              <div className="p3-qr">
                <div className="p3-ring" />
                <img
                  src={`${baseUrl}assets/shoebox/booth/contribute-qr.svg`}
                  alt="QR code to contribute photographs"
                />
              </div>
              <div className="p3-cap">Scan to share</div>
            </div>
          </section>
        </div>

        <section className="at-stats">
          <Stat target={counts.photos} label="Photographs" sub="digitized" />
          <Stat target={counts.communities} label="Communities" sub="represented" />
          <Stat target={counts.names} label="Names" sub="recorded" />
          <Stat target={counts.years} label="Years spanned" sub={counts.range} />
          <Stat target={counts.contributors} label="Contributors" sub="and growing" />
        </section>

        <footer className="at-footer">
          <div className="at-cue">
            <span className="tap" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11.5V6a1.5 1.5 0 0 1 3 0v5" />
                <path d="M12 11V4.5a1.5 1.5 0 0 1 3 0V11" />
                <path d="M15 11V6.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.6a5 5 0 0 1-3.6-1.5l-3.1-3.2a1.6 1.6 0 0 1 2.3-2.2L9 15.6" />
              </svg>
            </span>
            TAP ANYWHERE TO EXPLORE THE ARCHIVE
          </div>
        </footer>
      </div>
    </div>
  )
}
