import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { DataDisclaimer, Loading } from './components/ui'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ExplorerPage = lazy(() => import('./pages/ExplorerPage'))

/**
 * "Dashboard" with a "Data explorer" submenu. Opens on hover or keyboard focus (CSS), and on tap/click of the
 * caret for touch devices; Esc or a click elsewhere closes it.
 */
function DashboardMenu() {
  // Tied to the page it was opened on, so navigating closes it without an effect.
  const { pathname } = useLocation()
  const [openAt, setOpenAt] = useState<string | null>(null)
  const open = openAt === pathname
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => { if (!ref.current?.contains(e.target as Node)) setOpenAt(null) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenAt(null) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={ref} className={`nav-group ${open ? 'open' : ''}`}>
      <NavLink to="/" end className={({ isActive }) => (isActive || pathname.startsWith('/dashboard') ? 'active' : '')}>Dashboard</NavLink>
      <button
        type="button" className="nav-caret" aria-haspopup="true" aria-expanded={open} aria-controls="nav-submenu"
        aria-label="Dashboard menu" onClick={() => setOpenAt(open ? null : pathname)}
      >
        ▾
      </button>
      <div id="nav-submenu" className="nav-submenu">
        <div className="nav-submenu-inner">
          <NavLink to="/explore">Data explorer</NavLink>
        </div>
      </div>
    </div>
  )
}

function Shell() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="site-header">
        <div className="wrap header-row">
          <div className="brand">
            <img src={`${import.meta.env.BASE_URL}Seal_of_Maharashtra.svg`} alt="Government of Maharashtra seal" height="44" />
            <img src={`${import.meta.env.BASE_URL}MITRALogo.svg`} alt="MITRA" height="44" />
            <div className="brand-text">
              <strong>Socio-Economic Dashboard</strong>
              <span>Maharashtra &middot; District Statistical Abstract</span>
            </div>
          </div>
          <nav aria-label="Primary">
            <DashboardMenu />
          </nav>
        </div>
      </header>
      <main id="main" className="wrap">
        <DataDisclaimer />
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/dashboard/:id" element={<DashboardPage />} />
            <Route path="/explore" element={<ExplorerPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <footer className="site-footer">
        <div className="wrap">
          Source: District Statistical Abstract (DSA) and District Domestic Product estimates, Government of Maharashtra.
          GDDP figures are nominal.
        </div>
      </footer>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Shell />
    </BrowserRouter>
  )
}
