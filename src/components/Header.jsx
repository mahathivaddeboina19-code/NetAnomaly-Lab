/**
 * Header — sticky top bar with the current page title, dataset summary and
 * the "simulated data" disclosure badge.
 */

import { Info, Menu } from 'lucide-react'
import { percent } from '../utils/format.js'

export function Header({ title, subtitle, dataset, onMenuClick }) {
  return (
    <header className="topbar">
      <button type="button" className="menu-btn" onClick={onMenuClick} aria-label="Open menu">
        <Menu size={17} />
      </button>
      <div>
        <div className="topbar-title">{title}</div>
        <div className="topbar-sub">{subtitle}</div>
      </div>

      <div className="topbar-right">
        {dataset ? (
          <span className="pill neutral">
            {dataset.meta.observations.toLocaleString()} obs ·{' '}
            {dataset.meta.trafficIntensity} load · {percent(dataset.meta.anomalyRate, 1)} anomalies
          </span>
        ) : null}
        <span className="pill info" title="This application analyses synthetic traffic generated in-browser.">
          <Info size={12} />
          SIMULATED DATA
        </span>
      </div>
    </header>
  )
}
