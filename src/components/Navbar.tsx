type Page = 'home' | 'archive' | 'stories' | 'map' | 'contribute'

interface NavbarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
  onContribute: () => void
}

export default function Navbar({ currentPage, onNavigate, onContribute }: NavbarProps) {
  const navItems: { page: Page; label: string }[] = [
    { page: 'home', label: 'Home' },
    { page: 'archive', label: 'Archive' },
    { page: 'stories', label: 'Stories' },
    { page: 'map', label: 'Map' },
  ]

  return (
    <nav className="navbar sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <button 
            onClick={() => onNavigate('home')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 rounded flex items-center justify-center" style={{ background: 'var(--color-crimson)' }}>
              <span className="text-white font-serif text-xl font-bold">R</span>
            </div>
            <div className="hidden sm:block">
              <div className="text-sm cinzel tracking-wider" style={{ color: 'var(--color-crimson)' }}>RRMNHC</div>
              <div className="text-xs" style={{ color: 'var(--color-charcoal-light)' }}>Digital Archive</div>
            </div>
          </button>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map(({ page, label }) => (
              <button
                key={page}
                onClick={() => onNavigate(page)}
                className={`nav-link ${currentPage === page ? 'active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Contribute Button */}
          <button
            onClick={onContribute}
            className="btn-secondary text-xs"
          >
            Contribute
          </button>
        </div>

        {/* Mobile Nav */}
        <div className="md:hidden flex items-center justify-center gap-4 mt-4 pb-2 border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
          {navItems.map(({ page, label }) => (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              className={`nav-link text-xs ${currentPage === page ? 'active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}