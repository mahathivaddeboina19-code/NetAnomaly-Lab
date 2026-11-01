/**
 * ---------------------------------------------------------------------------
 * App.jsx — application shell + hash router
 * ---------------------------------------------------------------------------
 * Seven routes, one shared state provider (AppProvider). The router listens
 * to location.hash so the built app can be hosted as static files.
 * ---------------------------------------------------------------------------
 */

import { useCallback, useEffect, useState } from 'react'
import { AppProvider } from './state/AppContext.jsx'
import { Sidebar, ROUTES } from './components/Sidebar.jsx'
import { Header } from './components/Header.jsx'
import { Dashboard } from './pages/Dashboard.jsx'
import { Simulator } from './pages/Simulator.jsx'
import { AlgorithmsPage } from './pages/AlgorithmsPage.jsx'
import { Analysis } from './pages/Analysis.jsx'
import { Experiments } from './pages/Experiments.jsx'
import { Results } from './pages/Results.jsx'
import { Methodology } from './pages/Methodology.jsx'
import { useApp } from './state/AppContext.jsx'

const PAGE_META = {
  '/dashboard': {
    title: 'Dashboard',
    subtitle: 'Real-time overview of simulated network traffic and detections',
  },
  '/simulator': {
    title: 'Traffic Simulator',
    subtitle: 'Generate labelled synthetic traffic observations',
  },
  '/algorithms': {
    title: 'Detection Algorithms',
    subtitle: 'Configure and compare the four detection approaches',
  },
  '/analysis': {
    title: 'Traffic Analysis',
    subtitle: 'Feature-level timeline inspection of normal vs anomalous traffic',
  },
  '/experiments': {
    title: 'Experiments',
    subtitle: 'Controlled studies: intensity, anomaly mix and detector configuration',
  },
  '/results': {
    title: 'Results & Report',
    subtitle: 'Performance comparison, findings and exportable report',
  },
  '/methodology': {
    title: 'Research Methodology',
    subtitle: 'Problem statement, research questions and evaluation metrics',
  },
}

const PAGES = {
  '/dashboard': Dashboard,
  '/simulator': Simulator,
  '/algorithms': AlgorithmsPage,
  '/analysis': Analysis,
  '/experiments': Experiments,
  '/results': Results,
  '/methodology': Methodology,
}

function readHash() {
  const h = window.location.hash.replace(/^#/, '')
  return h && PAGES[h] ? h : '/dashboard'
}

function Shell() {
  const { dataset } = useApp()
  const [route, setRoute] = useState(readHash)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onHash = () => setRoute(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = useCallback((path) => {
    window.location.hash = path
    setRoute(path)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const Page = PAGES[route]
  const meta = PAGE_META[route] || PAGE_META['/dashboard']

  return (
    <div className="app">
      <Sidebar
        route={route}
        onNavigate={navigate}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
      <div className="main">
        <Header
          title={meta.title}
          subtitle={meta.subtitle}
          dataset={dataset}
          onMenuClick={() => setMenuOpen(true)}
        />
        <main className="page">
          <Page navigate={navigate} route={route} routes={ROUTES} />
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
