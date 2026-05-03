/**
 * RRMNHC Shared Site Navigation
 * 
 * A portable sandwich menu that works across all three RRMNHC sites:
 * - Main Heritage Centre site
 * - Métis Homeland Map
 * - Shoebox Digital Archive
 * 
 * Usage: Add to any page:
 *   <div class="site-nav" data-active="centre|map|archive"></div>
 *   <script src="https://bayarddevries.github.io/shared-assets/site-nav.js"></script>
 * 
 * The data-active attribute dims the current site's link so users know where they are.
 */

function initNav() {
  // ── 1. Inject CSS ──────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #sidebar-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      backdrop-filter: blur(2px);
      z-index: 1900;
    }
    #sidebar {
      position: fixed;
      top: 0;
      left: -300px;
      width: 300px;
      height: 100%;
      background: #fdfcf9;
      border-right: 1px solid rgba(139,0,0,0.1);
      z-index: 1950;
      transition: transform 0.3s ease;
      padding: 3rem 2rem;
      display: flex;
      flex-direction: column;
      box-shadow: 10px 0 30px rgba(0,0,0,0.05);
    }
    #sidebar.open {
      transform: translateX(300px);
    }
    .sidebar-link {
      font-family: 'Cinzel', serif;
      font-size: 0.9rem;
      letter-spacing: 0.15em;
      color: #2c2c2c;
      text-decoration: none;
      padding: 1.2rem 0;
      border-bottom: 1px solid rgba(0,0,0,0.05);
      text-transform: uppercase;
      transition: color 0.2s ease;
      display: block;
    }
    .sidebar-link:hover {
      color: #8b0000;
    }
    .sidebar-link.active {
      color: #8b0000;
      opacity: 0.4;
      cursor: default;
      pointer-events: none;
    }
    .menu-toggle {
      position: fixed;
      top: 1.5rem;
      right: 1.5rem;
      z-index: 2000;
      background: #8b0000;
      color: white;
      padding: 0.6rem 1.2rem;
      font-family: 'Cinzel', serif;
      font-size: 0.75rem;
      letter-spacing: 0.1em;
      cursor: pointer;
      border: none;
      box-shadow: 0 4px 12px rgba(139,0,0,0.2);
      transition: background 0.2s;
    }
    .menu-toggle:hover {
      background: #a00000;
    }
    /* Map pages: avoid Leaflet zoom control overlap */
    .site-nav[data-active="map"] ~ .menu-toggle,
    .site-nav[data-active="map"] .menu-toggle {
      right: auto;
      left: 1.5rem;
    }
  `;
  document.head.appendChild(style);

  // ── 2. Toggle function ─────────────────────────────
  window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar || !overlay) return;
    const isOpen = sidebar.classList.contains('open');
    if (isOpen) {
      sidebar.classList.remove('open');
      overlay.style.display = 'none';
    } else {
      sidebar.classList.add('open');
      overlay.style.display = 'block';
    }
  };

  // ── 3. Close on Escape ─────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const sidebar = document.getElementById('sidebar');
      if (sidebar && sidebar.classList.contains('open')) {
        window.toggleSidebar();
      }
    }
  });

  // ── 4. Inject nav into each .site-nav ──────────────
  const BASE = 'https://bayarddevries.github.io';
  
  const links = [
    { id: 'centre',  href: `${BASE}/rrmnhc-website/`,   label: 'Heritage Centre' },
    { id: 'map',     href: `${BASE}/metis-homeland-map/`, label: 'Homeland Map' },
    { id: 'archive', href: `${BASE}/shoebox-v2/`,        label: 'Digital Archive' },
  ];

  document.querySelectorAll('.site-nav').forEach(nav => {
    const activeId = nav.dataset.active || '';

    nav.innerHTML = `
      <button class="menu-toggle" onclick="toggleSidebar()">☰ MENU</button>
      <div id="sidebar-overlay" onclick="toggleSidebar()"></div>
      <nav id="sidebar">
        <h2 style="font-family: 'Cinzel', serif; color: #8b0000; font-size: 0.875rem; margin-bottom: 2rem; text-transform: uppercase; letter-spacing: 0.1em;">Navigation</h2>
        ${links.map(l => 
          `<a href="${l.href}" class="sidebar-link${l.id === activeId ? ' active' : ''}">${l.label}</a>`
        ).join('\n')}
      </nav>
    `;
  });
}

// Auto-init when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNav);
} else {
  initNav();
}
