# Shoebox v2 — Feature Reference (situational)

> This is a **situational reference** for the Shoebox v2 project. Load it only when a session touches one of these features: the projector slideshow, typography/hero/branding, or the archive grid masonry layout. The root `AGENTS.md` stays lean per the progressive-disclosure discipline (Anthropic's CLAUDE.md guidance: universal rules in root, situational depth in imported files).

## Projector Slideshow

A standalone HTML page (`public/projector.html`) for kiosk/event full-screen slideshow. Deployed at:
> https://bayarddevries.github.io/shoebox-v2/projector.html

### Architecture

One self-contained HTML file — no build step, no dependencies. Loads `manifest.json` at runtime via `fetch()`. Deployed by copying to `shoebox/projector.html` (the build output directory).

### Control bar sections (labeled)

| Section | Buttons |
|---------|---------|
| **Playback** | ⏸ pause/play, ◀ prev, ▶ next |
| **Speed** | 3s, 5s, 7s, 10s, 15s — sets auto-advance interval |
| **Transition** | Ken (Ken Burns), Fade, Slide, Cut, Wipe |
| **Display** | Captions (toggle: Off/Title/Full), Shuffle, Face (face-aware centering), Fullscreen |
| **Filter** | Tags (opens filter panel), photo counter |

### Immersive mode

After 3s of mouse/touch inactivity, `body` gets class `.immersed` which hides controls + progress bar via CSS (`opacity: 0; pointer-events: none`). Captions stay visible during immersive mode. Any mouse move or touch restores the UI and resets the 3s timer.

### Smart background sizing

In `applyImageToLayer()`, each photo gets a `background-size` based on its aspect ratio vs the viewport using manifest `width`/`height`:
- **Portrait** (imgAspect < screenAspect) → `auto 100%` (full height, sides cropped)
- **Landscape** → `100% auto` (full width, top/bottom cropped)
- **No dimensions** → falls back to `cover`

### Face-aware features

- **Face Track toggle** — when ON, `background-position` uses `photo.faceX`/`photo.faceY` (0-1 normalized). Default OFF (center-crop).
- **Face-aware Ken Burns** — `getKenBurns(idx, faceX, faceY)` computes translate direction toward the face. Half zoom-in, half zoom-out for variety. Falls back to gentle random pan when no face data.

### Filter panel

- Slide-out from left (`#filterPanel` with `.open` class)
- Content scrolls in `div.filter-scroll`, action buttons pinned in `div.filter-actions-sticky` at bottom
- Categories: Communities, Families/People, Decades, Keywords
- AND logic between categories, OR within
- Keywords searchable via text input (`filterKeywordChecks`)
- Presets saved to localStorage (`shoebox_presets` key)

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| Space | Toggle play/pause |
| ← / → | Prev / Next slide |
| C | Cycle captions (Off → Title → Full) |
| F | Toggle fullscreen |
| G | Toggle face tracking |
| S | Toggle shuffle |
| T | Cycle transitions |
| 1-5 | Set speed (3/5/7/10/15s) |
| F2 | Toggle filter panel |
| Esc | Close filter panel |

### Touch

Tap left 25% → prev, right 25% → next, center → toggle play. Passive listener (doesn't block scroll).

### Common pitfalls

- **`let` redeclarations**: All state variables are declared at the top of the `<script>` block. Do NOT re-declare `captionMode`, `shuffle`, or `transition` with `let` elsewhere in the file — it throws a SyntaxError.
- **Arrow function bodies**: Multi-statement arrow functions must use `{ }` (e.g., `setTimeout(() => { nextSlide(); updateTimerIdx(); }, speedMs)`).
- **Deployment**: `projector.html` is NOT part of the Vite build. After editing, must be manually copied: `cp public/projector.html shoebox/projector.html`. Then commit both files.
- **CDN cache**: GitHub Pages CDN takes 1-3 minutes to propagate. Use `?_cb=<timestamp>` for cache-busting during testing.

## Typography System

The hero and page headers use an editorial typographic hierarchy:

- **Kicker** — `Cinzel`, all-caps, small, above headline (e.g. "DIGITAL PHOTO ARCHIVE")
- **Hed (Headline)** — `EB Garamond`, 700 weight, serif (e.g. "Red River Métis Shoebox")
- **Deck** — `Inter`, sans-serif, summary paragraph below headline

This matches professional editorial design (newspaper/magazine) where kicker → hed → deck form a visual stack.

## Hero Section & MMF Branding (2026-05-19/20)

### Split Hero Layout
The hero section uses a two-column split layout on desktop:
- **Left column (35%):** MMF RRM logo (`assets/mmf_logo_rrm.png`), right-aligned, `max-height: 320px`
- **Right column (65%):** Kicker → Hed → Deck → CTA button, left-aligned
- **Gap:** 4rem between columns
- **Max-width:** 1200px, centered

### Mobile Behavior
- Hero section is `100vh` (full screen) on mobile (`< 768px`)
- Logo scales dynamically at `max-height: 25vh`
- Content stacks vertically: logo on top, text below
- Text is center-aligned on mobile
- Text-side uses symmetric horizontal padding (`padding: 0 1.5rem`)

### CSS Classes
- `.hero-section` — `width: 100%`, `height: 60vh` (desktop) / `100vh` (mobile), `overflow: hidden`
- `.hero-content-split` — flex container for the two-column layout
- `.hero-logo-side` — `flex: 0 0 35%`, `justify-content: flex-end`, no background (transparent)
- `.hero-text-side` — `flex: 1 1 65%`, flex column, `padding: 0 2.5rem 0 1.5rem` (desktop), no gradient background
- `.hero-mmf-logo` — `max-height: 320px` (desktop) / `25vh` (mobile), `filter: drop-shadow(...)` for readability against carousel

### Text Readability
- Title text uses text-shadows exclusively (no dark gradient bar behind text):
  ```
  text-shadow:
    0 1px 4px rgba(0, 0, 0, 0.9),
    0 4px 16px rgba(0, 0, 0, 0.6),
    0 12px 40px rgba(0, 0, 0, 0.4);
  ```
- Global dark overlay on carousel image provides baseline contrast
- MMF logo uses `drop-shadow` filter for pop against carousel photos

### Color Palette
- Primary: `--color-crimson: #8b0000` (dark crimson, NOT MMF bright red `#cf152d`)
- MMF logo is layered in as an image asset; the color palette remains the original crimson
- Background: `--color-parchment: #fdfcf9`

### Key Implementation Notes
- The hero section uses a React fragment (`<>...</>`) to wrap both the `hero-section` div and the stats section as siblings
- The `HeroCarousel` component renders absolutely positioned Ken Burns layers with `inset: -5%`
- The `hero-overlay` is a self-closing div (sibling of carousel and content, NOT a parent)
- The stats section lives OUTSIDE `hero-section` (was previously nested inside, causing layout bugs)
- A stray `<div className="relative">` wrapper was removed from App.tsx — it was constraining the carousel width
- **No dark gradient bar behind text:** The `.hero-text-side` previously had a `background: linear-gradient(to right, ...)` that created a semi-transparent black panel behind the title. Removed 2026-05-20 — text-shadows + global overlay provide sufficient contrast.

## Archive Grid — JS Masonry Layout (2026-05-20)

**Replaced CSS `columns` with JS shortest-column masonry** to fix the "column 4 shows newer photos" problem.

### The Problem

CSS `columns` uses column-major fill (top-to-bottom, left-to-right). With chronological sort, this puts the newest 25% of photos at the top of column 4. No amount of array reordering can fix this — it's hardcoded in the CSS spec.

### The Solution

**ArchiveGrid.tsx** now uses a custom JS masonry algorithm:

1. **Measure container width** via `ResizeObserver` → derive column count (2/3/4 based on breakpoints matching old CSS)
2. **Shortest-column placement** — for each chronologically sorted photo, find the column with the least total height and place it there. This naturally distributes oldest photos across all columns
3. **Height estimation from metadata** — photos have `width`/`height` in the manifest, so card height is estimated as `colWidth / aspectRatio + contentEstimate` before render
4. **Absolute positioning** — each tile is `position: absolute` with computed `top`/`left`/`width`/`height`

### Why this fixes it

With 450 photos and 4 columns, the first 4 photos (oldest) go to columns 1-4 since they all start at height 0. Every column starts with an old photo. As items fill in, the algorithm keeps columns balanced — all columns progress through time at roughly the same rate.

### Key files

| File | Purpose |
|------|---------|
| `src/components/ArchiveGrid.tsx` | JS masonry component — `computeMasonry()`, `estimateCardHeight()`, shortest-column algorithm |
| `src/index.css` | `.archive-grid-container`, `.archive-grid-inner` (no more `columns` or `break-inside`) |

### What didn't work (history)

- ❌ **CSS columns + chronological sort** — column-major fill puts newest photos in col 4
- ❌ **CSS columns + chunk reorder** — clever array reordering still can't overcome column-major fill with masonry heights
- ❌ **CSS Grid** — gives row-major but no masonry (wasted space)
- ✅ **JS masonry with shortest-column** — correct era distribution + masonry packing
