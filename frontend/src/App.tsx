import { lazy, Suspense } from 'react'
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { Loading } from './components/ui'

const StatePage = lazy(() => import('./pages/StatePage'))
const DistrictPage = lazy(() => import('./pages/DistrictPage'))
const DistrictIndex = lazy(() => import('./pages/DistrictIndex'))
const ExplorerPage = lazy(() => import('./pages/ExplorerPage'))

function Shell() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="site-header">
        <div className="wrap header-row">
          <div className="brand">
            <img src="/Seal_of_Maharashtra.svg" alt="Government of Maharashtra seal" height="44" />
            <img src="/MITRALogo.svg" alt="MITRA" height="44" />
            <div className="brand-text">
              <strong>Socio-Economic Dashboard</strong>
              <span>Maharashtra &middot; District Statistical Abstract</span>
            </div>
          </div>
          <nav aria-label="Primary">
            <NavLink to="/" end>State</NavLink>
            <NavLink to="/district">Districts</NavLink>
            <NavLink to="/explore">Data explorer</NavLink>
          </nav>
        </div>
      </header>
      <main id="main" className="wrap">
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<StatePage />} />
            <Route path="/district" element={<DistrictIndex />} />
            <Route path="/district/:id" element={<DistrictPage />} />
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
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}
