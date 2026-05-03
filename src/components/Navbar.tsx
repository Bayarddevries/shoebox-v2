import { useState, useEffect, useRef } from 'react'
import type { Page } from '../types'

interface NavbarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
  onContribute: () => void
}

export default function Navbar({ currentPage, onNavigate, onContribute }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

 const navItems: { page: Page; label: string; icon: string }[] = [
 { page: 'home', label: 'Home', icon: '🏠' },
 { page: 'archive', label: 'Archive', icon: '📷' },
 { page: 'stories', label: 'Stories', icon: '📖' },
 ]

 const externalLinks = [
 { href: 'https://bayarddevries.github.io/rrmnhc-website/', label: 'Heritage Centre', icon: '🏛️' },
 { href: 'https://bayarddevries.github.io/rrmnhc-website/artifacts-viewer.html', label: 'Artifacts', icon: '🏺' },
 { href: 'https://bayarddevries.github.io/rrmnhc-website/news.html', label: 'News', icon: '📰' },
 { href: 'https://bayarddevries.github.io/rrmnhc-website/contact.html', label: 'Contact', icon: '✉️' },
 { href: 'https://bayarddevries.github.io/metis-homeland-map/', label: 'Homeland Map', icon: '🗺️' },
 ]

 // Close menu on outside click
 useEffect(() => {
 const handler = (e: MouseEvent) => {
 const target = e.target as HTMLElement
 // Don't close if clicking the hamburger button (it handles its own toggle)
 if (target.closest('.hamburger-btn')) return
 if (menuRef.current && !menuRef.current.contains(target)) {
 setMenuOpen(false)
 }
 }
 document.addEventListener('mousedown', handler)
 return () => document.removeEventListener('mousedown', handler)
 }, [])

  // Close menu on navigation
  const handleNavigate = (page: Page) => {
    onNavigate(page)
    setMenuOpen(false)
  }

  return (
    <nav className="navbar sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <button
            onClick={() => handleNavigate('home')}
            className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded flex items-center justify-center" style={{ background: 'var(--color-crimson)' }}>
              <span className="text-white font-serif text-lg sm:text-xl font-bold">R</span>
            </div>
            <div className="hidden sm:block">
              <div className="text-sm cinzel tracking-wider" style={{ color: 'var(--color-crimson)' }}>RRMNHC</div>
              <div className="text-xs" style={{ color: 'var(--color-charcoal-light)' }}>Digital Archive</div>
            </div>
          </button>

 {/* Desktop nav links */}
 <div className="hidden md:flex items-center gap-8">
 {navItems.map(({ page, label }) => (
 <button
 key={page}
 onClick={() => handleNavigate(page)}
 className={`nav-link ${currentPage === page ? 'active' : ''}`}
 >
 {label}
 </button>
 ))}
 <span className="nav-divider" />
 {externalLinks.map(({ href, label }) => (
 <a
 key={href}
 href={href}
 className="nav-link nav-link-external"
 target="_blank"
 rel="noopener noreferrer"
 >
 {label}
 <svg className="nav-link-icon" viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5">
 <path d="M4 2h6v6M10 2L4 8" />
 </svg>
 </a>
 ))}
 </div>

          {/* Right side: Contribute + Hamburger */}
          <div className="flex items-center gap-3">
            <button
              onClick={onContribute}
              className="btn-secondary text-xs hidden sm:inline-block"
            >
              Contribute
            </button>

            {/* Hamburger — md and below */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden hamburger-btn"
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              <span className={`hamburger-line ${menuOpen ? 'hamburger-line-open-1' : ''}`} />
              <span className={`hamburger-line ${menuOpen ? 'hamburger-line-open-2' : ''}`} />
              <span className={`hamburger-line ${menuOpen ? 'hamburger-line-open-3' : ''}`} />
            </button>
          </div>
        </div>

 {/* Mobile menu dropdown */}
 <div
 ref={menuRef}
 className={`mobile-nav-menu ${menuOpen ? 'mobile-nav-menu-open' : ''}`}
 >
 {navItems.map(({ page, label, icon }) => (
 <button
 key={page}
 onClick={() => handleNavigate(page)}
 className={`mobile-nav-item ${currentPage === page ? 'mobile-nav-item-active' : ''}`}
 >
 <span className="mobile-nav-icon">{icon}</span>
 <span>{label}</span>
 </button>
 ))}
 <div className="mobile-nav-divider" />
 {externalLinks.map(({ href, label, icon }) => (
 <a
 key={href}
 href={href}
 className="mobile-nav-item mobile-nav-external"
 target="_blank"
 rel="noopener noreferrer"
 >
 <span className="mobile-nav-icon">{icon}</span>
 <span>{label}</span>
 </a>
 ))}
 <button
 onClick={() => { onContribute(); setMenuOpen(false) }}
 className="mobile-nav-item mobile-nav-contribute"
 >
 <span className="mobile-nav-icon">✉️</span>
 <span>Contribute</span>
 </button>
 </div>
      </div>
    </nav>
  )
}
