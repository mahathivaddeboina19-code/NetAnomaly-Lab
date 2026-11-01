/**
 * ---------------------------------------------------------------------------
 * exportCsv.js — "Export Experimental Results" (Results page)
 * ---------------------------------------------------------------------------
 * Produces one CSV file containing:
 *   • dataset description,  • main four-algorithm comparison,
 *   • experiment 1–4 results, • limitations footer.
 * ---------------------------------------------------------------------------
 */

import { percent, ms } from './format.js'

const esc = (v) => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const row = (...cells) => cells.map(esc).join(',')

const METRIC_HEADERS = [
  'Accuracy',
  'Precision',
  'Detection Rate (Recall)',
  'False Positive Rate',
  'False Negative Rate',
  'F1 Score',
  'Processing Time (ms)',
]

function metricCells(r) {
  return [
    percent(r.metrics.accuracy, 2),
    percent(r.metrics.precision, 2),
    percent(r.metrics.recall, 2),
    percent(r.metrics.fpr, 2),
    percent(r.metrics.fnr, 2),
    percent(r.metrics.f1, 2),
    (r.durationMs ?? 0).toFixed(3),
  ]
}

export function buildResultsCsv({ meta, comparison, experiments }) {
  const lines = []
  const stamp = new Date().toISOString()

  lines.push('Adaptive Network Traffic Anomaly Detection - Experimental Results')
  lines.push(`Exported,${stamp}`)
  lines.push('Note,All traffic in this report is SIMULATED (synthetic). Academic demonstration only.')
  lines.push('')

  // ---- Dataset -----------------------------------------------------------
  lines.push('=== Dataset ===')
  if (meta) {
    lines.push(row('Observations', meta.observations))
    lines.push(row('Normal records', meta.normalCount))
    lines.push(row('Anomalous records', meta.anomalyCount))
    lines.push(row('Traffic intensity', meta.trafficIntensity))
    lines.push(row('Anomaly intensity', meta.anomalyIntensity))
    lines.push(row('Anomaly types', meta.anomalyTypes.join(' | ') || 'none'))
    lines.push(row('PRNG seed', meta.seed))
  } else {
    lines.push('No dataset generated')
  }
  lines.push('')

  // ---- Main comparison ---------------------------------------------------
  lines.push('=== Algorithm Comparison (current dataset) ===')
  lines.push(row('Algorithm', ...METRIC_HEADERS))
  if (comparison) {
    for (const r of comparison) lines.push(row(r.name, ...metricCells(r)))
  } else {
    lines.push('No results available')
  }
  lines.push('')

  // ---- Experiments -------------------------------------------------------
  const expDefs = [
    ['Experiment 1: Traffic Intensity', 'Condition', experiments?.exp1],
    ['Experiment 2: Anomaly Intensity', 'Condition', experiments?.exp2],
    ['Experiment 3: Anomaly Type', 'Condition', experiments?.exp3],
  ]
  for (const [title, groupHeader, data] of expDefs) {
    lines.push(`=== ${title} ===`)
    lines.push(row('Algorithm', groupHeader, ...METRIC_HEADERS))
    if (data?.rows?.length) {
      for (const r of data.rows) lines.push(row(r.algoName, r.group, ...metricCells(r)))
    } else {
      lines.push('Experiment not run')
    }
    lines.push('')
  }

  lines.push('=== Experiment 4: Adaptive Detector Window Size ===')
  lines.push(row('Rolling Window', ...METRIC_HEADERS))
  if (experiments?.exp4?.rows?.length) {
    for (const r of experiments.exp4.rows) lines.push(row(r.window, ...metricCells(r)))
  } else {
    lines.push('Experiment not run')
  }
  lines.push('')

  // ---- Limitations -------------------------------------------------------
  lines.push('=== Limitations ===')
  lines.push('Traffic data is simulated; no real network traces are used.')
  lines.push('Results depend on the chosen simulation parameters (intensity, anomaly mix, seed).')
  lines.push('Synthetic traffic cannot fully represent real-world network behaviour.')
  lines.push('This system is an academic demonstration and research prototype, not a production IDS.')

  return lines.join('\n')
}

/** Trigger a browser download of the CSV text. */
export function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 500)
}
