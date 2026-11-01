/**
 * Sidebar — left navigation for the seven sections of the application.
 * Navigation is hash-based (#/dashboard, #/simulator, …) so the app works
 * as a fully static build with no server-side routing.
 */

import {
  Activity,
  BarChart3,
  BookOpen,
  Cpu,
  FlaskConical,
  LayoutDashboard,
  LineChart,
  ShieldCheck,
} from 'lucide-react'

export const ROUTES = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Monitor' },
  { path: '/simulator', label: 'Traffic Simulator', icon: Activity, group: 'Monitor' },
  { path: '/algorithms', label: 'Detection Algorithms', icon: Cpu, group: 'Research' },
  { path: '/analysis', label: 'Traffic Analysis', icon: LineChart, group: 'Research' },
  { path: '/experiments', label: 'Experiments', icon: FlaskConical, group: 'Research' },
  { path: '/results', label: 'Results', icon: BarChart3, group: 'Research' },
  { path: '/methodology', label: 'Research Methodology', icon: BookOpen, group: 'About' },
]

export function Sidebar({ route, onNavigate, open, onClose }) {
  let lastGroup = null
  return (
    <>
      <div className={`sidebar-backdrop ${open ? 'show' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-logo">
            <ShieldCheck size={21} />
          </div>
          <div>
            <div className="brand-title">NetAnomaly Lab</div>
            <div className="brand-sub">Adaptive Traffic Detection</div>
          </div>
        </div>

        <nav className="nav">
          {ROUTES.map((r) => {
            const showGroup = r.group !== lastGroup
            lastGroup = r.group
            const Icon = r.icon
            return (
              <div key={r.path}>
                {showGroup ? <div className="nav-label">{r.group}</div> : null}
                <button
                  type="button"
                  className={`nav-item ${route === r.path ? 'active' : ''}`}
                  onClick={() => {
                    onNavigate(r.path)
                    onClose?.()
                  }}
                >
                  <Icon size={16} />
                  {r.label}
                </button>
              </div>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="dot-row">
            <span className="live-dot" style={{ background: 'var(--green)' }} />
            Simulation engine online
          </div>
          Computer Networks Mini-Project · v1.0
          <br />
          All traffic shown is synthetic.
        </div>
      </aside>
    </>
  )
}
