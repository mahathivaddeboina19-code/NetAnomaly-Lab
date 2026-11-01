/**
 * ---------------------------------------------------------------------------
 * chart.js — Shared chart styling + data builders (no JSX here)
 * ---------------------------------------------------------------------------
 * One dark, professional colour system keeps every chart on the dashboard
 * consistent with the "blue = normal, red = anomaly, orange = detected,
 * green = healthy" convention required by the project brief.
 * ---------------------------------------------------------------------------
 */

import { timeOfDay } from './format.js'

export const C = {
  blue: '#3b82f6',
  blueSoft: '#60a5fa',
  green: '#22c55e',
  orange: '#f59e0b',
  red: '#ef4444',
  purple: '#8b5cf6',
  sky: '#0ea5e9',
  slate: '#94a3b8',
  grid: 'rgba(148,163,184,0.12)',
  axis: '#8197b8',
  axisLine: 'rgba(148,163,184,0.28)',
}

/** Consistent axis styling for all Recharts charts. */
export const axis = {
  tick: { fill: C.axis, fontSize: 11 },
  axisLine: { stroke: C.axisLine },
  tickLine: false,
}

/**
 * Build the series consumed by the timeline charts:
 *   value    — the plain feature curve (blue line)
 *   actual   — feature value at ground-truth anomalies (red dots)
 *   detected — feature value where the algorithm raised an alarm (orange ring)
 */
export function buildTimelineData(records, predictions, dataKey = 'pps') {
  return records.map((r, i) => ({
    i,
    time: timeOfDay(r.t),
    value: r[dataKey],
    actual: r.label === 1 ? r[dataKey] : null,
    detected: predictions && predictions[i] === 1 ? r[dataKey] : null,
  }))
}

/** Compact y-axis tick formatter (handles packets, bytes and ratios). */
export function tickCompact(v) {
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  if (Math.abs(v) < 1) return v.toFixed(2)
  return `${v}`
}

/** Algorithm accent colours (kept in sync with the algorithm registry). */
export const ALGO_COLORS = {
  fixed: '#64748b',
  moving: '#0ea5e9',
  statistical: '#8b5cf6',
  adaptive: '#22c55e',
}

/** Severity → colour mapping used by status pills and alert lists. */
export const STATUS_COLORS = {
  normal: C.green,
  warning: C.orange,
  anomaly: C.red,
}
