/**
 * ---------------------------------------------------------------------------
 * ui.jsx — small shared building blocks
 *   StatCard, SectionCard, StatusPill, EmptyState
 * ---------------------------------------------------------------------------
 */

/* --------------------------------- StatCard ------------------------------- */
const ACCENTS = {
  blue: ['#3b82f6', 'rgba(59,130,246,.14)'],
  green: ['#22c55e', 'rgba(34,197,94,.14)'],
  orange: ['#f59e0b', 'rgba(245,158,11,.14)'],
  red: ['#ef4444', 'rgba(239,68,68,.14)'],
  purple: ['#8b5cf6', 'rgba(139,92,246,.14)'],
  cyan: ['#38bdf8', 'rgba(56,189,248,.14)'],
  slate: ['#94a3b8', 'rgba(148,163,184,.14)'],
}

export function StatCard({ label, value, foot, icon: Icon, accent = 'blue' }) {
  const [color, soft] = ACCENTS[accent] || ACCENTS.blue
  return (
    <div className="stat-card" style={{ '--accent': color, '--accent-soft': soft }}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className="stat-icon">
          {Icon ? <Icon size={15} /> : null}
        </span>
      </div>
      <div className="stat-value">{value}</div>
      {foot ? <div className="stat-foot">{foot}</div> : null}
    </div>
  )
}

/* ------------------------------- SectionCard ------------------------------ */
export function SectionCard({
  icon: Icon,
  title,
  subtitle,
  actions,
  children,
  className = '',
  bodyClass = '',
}) {
  return (
    <section className={`card ${className}`}>
      <div className="card-head">
        <div>
          <div className="card-title">
            {Icon ? <Icon size={16} /> : null}
            <span>{title}</span>
          </div>
          {subtitle ? <div className="card-sub">{subtitle}</div> : null}
        </div>
        {actions ? <div className="row">{actions}</div> : null}
      </div>
      <div className={`card-body ${bodyClass}`}>{children}</div>
    </section>
  )
}

/* -------------------------------- StatusPill ------------------------------ */
export function StatusPill({ status = 'normal', label, pulse = false }) {
  const text =
    label || (status === 'anomaly' ? 'Anomaly' : status === 'warning' ? 'Warning' : 'Normal')
  return (
    <span className={`pill ${status}`}>
      <span className="dot" style={pulse ? { animation: 'pulse 1.6s ease-in-out infinite' } : undefined} />
      {text}
    </span>
  )
}

/* -------------------------------- EmptyState ------------------------------ */
export function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="empty">
      {Icon ? <Icon size={30} /> : null}
      <div className="title">{title}</div>
      {hint ? <div className="hint">{hint}</div> : null}
      {action}
    </div>
  )
}
