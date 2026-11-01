/**
 * ---------------------------------------------------------------------------
 * format.js — tiny presentation helpers shared across all pages
 * ---------------------------------------------------------------------------

 */

/** 1234567 → "1.23M", 1234 → "1.23K" (used for byte/packet rates). */
export function compact(n) {
  if (n == null || Number.isNaN(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`
  return `${Math.round(n)}`
}

/** Plain number with thousands separators. */
export function number(n) {
  if (n == null || Number.isNaN(n)) return '—'
  return n.toLocaleString('en-US')
}

/** 0.8731 → "87.3%" */
export function percent(v, digits = 1) {
  if (v == null || Number.isNaN(v)) return '—'
  return `${(v * 100).toFixed(digits)}%`
}

/** Milliseconds with adaptive precision. */
export function ms(v) {
  if (v == null || Number.isNaN(v)) return '—'
  if (v < 0.01) return '<0.01 ms'
  if (v < 1) return `${v.toFixed(2)} ms`
  if (v < 100) return `${v.toFixed(1)} ms`
  return `${v.toFixed(0)} ms`
}

/** Epoch ms → HH:MM:SS */
export function timeOfDay(t) {
  if (!t) return '—'
  return new Date(t).toLocaleTimeString('en-GB', { hour12: false })
}

/** Epoch ms → "31 Oct, 14:03:22" */
export function dateTime(t) {
  if (!t) return '—'
  return new Date(t).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

/** Title-case a raw feature key. */
export const FEATURE_LABELS = {
  pps: 'Packets per second',
  bps: 'Bytes per second',
  ports: 'Unique destination ports',
  icmp: 'ICMP ratio',
}
