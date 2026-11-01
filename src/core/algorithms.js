/**
 * ---------------------------------------------------------------------------
 * algorithms.js — The four anomaly detection algorithms
 * ---------------------------------------------------------------------------
 *  1. Fixed Threshold        — pps > threshold  ⇒ anomaly (user-defined)
 *  2. Moving Average         — deviation from a rolling mean/std of pps
 *  3. Statistical Threshold  — mean + 3σ baseline learned from normal traffic
 *  4. Proposed Adaptive Detector — rolling median/MAD over FOUR features
 *
 * Every detector has the same interface:
 *
 *   detect(records, params) → { preds, evidence, derived }
 *
 *     preds    — array of 0/1 predictions, one per record
 *     evidence — per record, the feature that triggered the flag (or null)
 *     derived  — internal values worth displaying (thresholds, μ, σ, …)
 *
 * IMPORTANT: no result is hard-coded. The "proposed" adaptive detector is
 * evaluated with exactly the same ground truth and the same timing procedure
 * as the baselines — if it ever loses, the dashboard will show it losing.
 * ---------------------------------------------------------------------------
 */

import { computeMetrics } from './metrics.js'

/** Features used by the multi-feature adaptive detector. */
export const ADAPTIVE_FEATURES = [
  { key: 'pps', label: 'Packets/s', floor: 1 },
  { key: 'bps', label: 'Bytes/s', floor: 100 },
  { key: 'ports', label: 'Unique ports', floor: 1 },
  { key: 'icmp', label: 'ICMP ratio', floor: 0.004 },
]

/** Default parameters for each algorithm (used when none are configured). */
export const DEFAULT_PARAMS = {
  // The fixed threshold is a genuinely fixed, user-configured constant
  // (default: 200 packets/s). It NEVER recalibrates itself from the dataset —
  // that rigidity is exactly what the research gap is about. It only changes
  // when the user moves the slider (or explicitly opts into the optional
  // auto-calibrate helper on the Algorithms page).
  fixed: { threshold: 200, autoCalibrate: false },
  moving: { window: 50, sensitivity: 3 },
  statistical: {},
  adaptive: { window: 50, sensitivity: 3.5 },
}

/* -------------------------------------------------------------------------
 * Small statistics helpers
 * ---------------------------------------------------------------------- */

function meanStd(values) {
  const n = values.length || 1
  const mean = values.reduce((a, b) => a + b, 0) / n
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n
  return { mean, sd: Math.sqrt(variance) }
}

function medianOfSorted(sorted) {
  const n = sorted.length
  if (n === 0) return 0
  const mid = n >> 1
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Robust location & scale: median and Median Absolute Deviation (MAD).
 *
 * `values` is sorted once. The deviations |v − median| then naturally form
 * two monotonic runs around the median — a descending run below it and an
 * ascending run above it — which are merged in O(n). That avoids sorting the
 * deviations a second time, and it matters because the adaptive detector
 * calls this for four features at every single observation.
 */
function robustStats(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  if (n === 0) return { med: 0, mad: 0 }
  const med = medianOfSorted(sorted)

  // Split point: first index whose value is >= median.
  let lo = 0
  let hi = n
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid] < med) lo = mid + 1
    else hi = mid
  }
  const k = lo

  // Merge the two ascending deviation runs (left run read right-to-left).
  const devs = new Array(n)
  let li = k - 1
  let ri = k
  let w = 0
  while (li >= 0 && ri < n) {
    const dl = med - sorted[li] // > 0: sorted[li] < med
    const dr = sorted[ri] - med // >= 0
    if (dl <= dr) devs[w++] = dl
    else devs[w++] = dr
    if (dl <= dr) li--
    else ri++
  }
  while (li >= 0) devs[w++] = med - sorted[li--]
  while (ri < n) devs[w++] = sorted[ri++] - med

  return { med, mad: medianOfSorted(devs) }
}

/**
 * Derive a sensible fixed threshold (μ + kσ) from normal traffic. Used for
 * the default/auto-calibrated threshold and shown to the user on the
 * Algorithms page.
 */
export function calibrateThreshold(calibration, multiplier = 3) {
  const source = calibration?.length ? calibration : []
  if (!source.length) return { mean: 0, sd: 0, threshold: DEFAULT_PARAMS.fixed.threshold }
  const { mean, sd } = meanStd(source.map((r) => r.pps))
  return { mean, sd, threshold: Math.round(mean + multiplier * sd) }
}

/* -------------------------------------------------------------------------
 * Algorithm 1 — Fixed Threshold Detection
 * The simplest baseline: one static threshold on packet rate.
 * ---------------------------------------------------------------------- */
function detectFixed(records, params) {
  const threshold = Number(params?.threshold) || DEFAULT_PARAMS.fixed.threshold
  const preds = new Array(records.length)
  const evidence = new Array(records.length).fill(null)
  for (let i = 0; i < records.length; i++) {
    if (records[i].pps > threshold) {
      preds[i] = 1
      evidence[i] = 'pps'
    } else {
      preds[i] = 0
    }
  }
  return { preds, evidence, derived: { threshold } }
}

/* -------------------------------------------------------------------------
 * Algorithm 2 — Moving Average Detection
 * Compares the current packet rate with the rolling mean/σ of the previous
 * `window` observations. Flags significant deviations (either direction).
 * ---------------------------------------------------------------------- */
function detectMovingAverage(records, params) {
  const w = Math.max(5, Math.round(Number(params?.window) || DEFAULT_PARAMS.moving.window))
  const k = Number(params?.sensitivity) || DEFAULT_PARAMS.moving.sensitivity
  const n = records.length
  const preds = new Array(n).fill(0)
  const evidence = new Array(n).fill(null)

  for (let i = 0; i < n; i++) {
    // Rolling history: only *past* observations (no look-ahead leakage).
    const from = Math.max(0, i - w)
    if (i - from < 5) continue // too little history to judge
    let sum = 0
    for (let j = from; j < i; j++) sum += records[j].pps
    const mean = sum / (i - from)
    let varSum = 0
    for (let j = from; j < i; j++) varSum += (records[j].pps - mean) ** 2
    const sd = Math.sqrt(varSum / (i - from))
    const z = (records[i].pps - mean) / (sd + 1e-9)
    if (Math.abs(z) > k) {
      preds[i] = 1
      evidence[i] = 'pps'
    }
  }
  return { preds, evidence, derived: { window: w, sensitivity: k } }
}

/* -------------------------------------------------------------------------
 * Algorithm 3 — Statistical Threshold Detection
 * μ and σ are estimated from a sample of known-normal traffic (the
 * calibration period produced by the simulator), then the decision rule is
 *
 *        pps > μ + 3σ  ⇒  anomaly
 * ---------------------------------------------------------------------- */
function detectStatistical(records, params) {
  const source = params?.calibration?.length >= 10 ? params.calibration : records
  const { mean, sd } = meanStd(source.map((r) => r.pps))
  const threshold = mean + 3 * sd
  const preds = new Array(records.length)
  const evidence = new Array(records.length).fill(null)
  for (let i = 0; i < records.length; i++) {
    if (records[i].pps > threshold) {
      preds[i] = 1
      evidence[i] = 'pps'
    } else {
      preds[i] = 0
    }
  }
  return { preds, evidence, derived: { mean, sd, threshold, multiplier: 3 } }
}

/* -------------------------------------------------------------------------
 * Algorithm 4 (PROPOSED) — Adaptive Multi-Feature Detection
 *
 * For every feature we keep a *rolling* window of the last `w` observations
 * and compute robust statistics (median + MAD instead of mean + σ, so that
 * earlier anomalies cannot poison the baseline). The robust score is
 *
 *        z = |x − median| / max(1.4826 · MAD, floor)
 *
 * (1.4826 makes MAD comparable to σ for Gaussian data). The observation is
 * flagged when ANY feature exceeds the sensitivity k — this is what lets the
 * detector catch port-scan and protocol-distribution anomalies that barely
 * move the packet rate. Because the window slides, thresholds automatically
 * adapt to changing traffic intensity (RQ3).
 * ---------------------------------------------------------------------- */
function robustBaseline(rows) {
  const base = {}
  for (const f of ADAPTIVE_FEATURES) {
    base[f.key] = robustStats(rows.map((r) => r[f.key]))
  }
  return base
}

/** Exposed for the dashboard's live monitor: score the newest point. */
export function scoreAgainstHistory(history, k = 3.5, windowSize = 50) {
  if (!history || history.length < 10) return { status: 'normal', worst: null }
  const rows = history.slice(-windowSize)
  const base = robustBaseline(rows)
  const last = rows[rows.length - 1]
  let worst = null
  for (const f of ADAPTIVE_FEATURES) {
    const denom = Math.max(1.4826 * base[f.key].mad, f.floor)
    const z = Math.abs(last[f.key] - base[f.key].med) / denom
    if (!worst || z > worst.z) worst = { z, key: f.key, label: f.label }
  }
  // Three severity levels drive the dashboard status indicator.
  const status = worst.z > k ? 'anomaly' : worst.z > k * 0.62 ? 'warning' : 'normal'
  return { status, worst, baseline: base }
}

function detectAdaptive(records, params) {
  const w = Math.max(10, Math.round(Number(params?.window) || DEFAULT_PARAMS.adaptive.window))
  const k = Number(params?.sensitivity) || DEFAULT_PARAMS.adaptive.sensitivity
  const n = records.length
  const preds = new Array(n).fill(0)
  const evidence = new Array(n).fill(null)

  // Seed the baseline with the known-normal calibration period, if present.
  let base = params?.calibration?.length >= 10 ? robustBaseline(params.calibration) : null

  for (let i = 0; i < n; i++) {
    const from = Math.max(0, i - w)
    const histLen = i - from
    if (histLen >= w) {
      // Full window → rebuild the rolling baseline from recent history, so
      // thresholds continuously adapt to the current traffic behaviour.
      base = robustBaseline(records.slice(from, i))
    } else if (!base && histLen >= 10) {
      // Warm-up without a calibration sample: bootstrap the baseline from the
      // partial history. (With a calibration sample we keep trusting it until
      // the window fills — a partial history of only a few points could be
      // dominated by an anomaly already in progress, which would inflate its
      // own baseline and hide the anomaly. This warm-up design is documented
      // on the Algorithms page.)
      base = robustBaseline(records.slice(from, i))
    }
    if (!base) continue // no baseline yet → cannot judge

    let worst = null
    for (const f of ADAPTIVE_FEATURES) {
      const denom = Math.max(1.4826 * base[f.key].mad, f.floor)
      const z = Math.abs(records[i][f.key] - base[f.key].med) / denom
      if (!worst || z > worst.z) worst = { z, key: f.key }
    }
    if (worst && worst.z > k) {
      preds[i] = 1
      evidence[i] = worst.key
    }
  }
  return { preds, evidence, derived: { window: w, sensitivity: k, features: ADAPTIVE_FEATURES.length } }
}

/* -------------------------------------------------------------------------
 * Algorithm registry (order defines how they appear everywhere in the UI)
 * ---------------------------------------------------------------------- */
export const ALGORITHMS = [
  {
    key: 'fixed',
    name: 'Fixed Threshold',
    tag: 'Baseline 1',
    badge: null,
    accent: '#64748b',
    description:
      'Flags an observation when packets per second exceed one static, user-defined threshold. Simple and fast, but the threshold cannot follow changing traffic conditions.',
    detect: detectFixed,
  },
  {
    key: 'moving',
    name: 'Moving Average',
    tag: 'Baseline 2',
    badge: null,
    accent: '#0ea5e9',
    description:
      'Compares each observation with the rolling mean and standard deviation of a recent window of packet rates. Detects sudden deviations, but tracks only a single feature.',
    detect: detectMovingAverage,
  },
  {
    key: 'statistical',
    name: 'Statistical Threshold',
    tag: 'Baseline 3',
    badge: null,
    accent: '#8b5cf6',
    description:
      'Learns a baseline (μ + 3σ of packet rate) from a period of known-normal traffic. Data-driven, yet still single-feature and static once learned.',
    detect: detectStatistical,
  },
  {
    key: 'adaptive',
    name: 'Proposed Adaptive Detector',
    tag: 'Proposed',
    badge: 'Proposed',
    accent: '#22c55e',
    description:
      'Lightweight adaptive detector: rolling median/MAD baselines over four features (packet rate, byte rate, unique ports, ICMP ratio). The baseline is seeded by a known-normal calibration period until the rolling window fills, then adapts continuously to recent behaviour. Flags any observation where one or more features show a significant robust deviation.',
    detect: detectAdaptive,
  },
]

export const ALGO_BY_KEY = Object.fromEntries(ALGORITHMS.map((a) => [a.key, a]))

/** Compact display names used in charts, tabs and chips. */
export const ALGO_SHORT = {
  fixed: 'Fixed',
  moving: 'Moving Avg',
  statistical: 'Statistical',
  adaptive: 'Adaptive',
}

/* -------------------------------------------------------------------------
 * Runner: executes one detector, times it fairly (median of 3 runs) and
 * evaluates it against the ground-truth labels.
 * ---------------------------------------------------------------------- */
export function runAlgorithm(key, records, params = {}) {
  const algo = ALGO_BY_KEY[key]
  if (!algo || !records || records.length === 0) return null

  // Time a few back-to-back runs and take the median to smooth out timer
  // jitter. Very large datasets only need one run — it is already long
  // enough to measure accurately, and re-running would freeze the UI.
  const runCount = records.length > 1500 ? 1 : 3
  const runs = []
  let result = null
  for (let r = 0; r < runCount; r++) {
    const t0 = performance.now()
    result = algo.detect(records, params)
    runs.push(performance.now() - t0)
  }
  runs.sort((a, b) => a - b)
  const durationMs = runs[Math.floor(runs.length / 2)] // median

  const metrics = computeMetrics(
    records.map((r) => r.label),
    result.preds,
  )

  return {
    key,
    preds: result.preds,
    evidence: result.evidence,
    derived: result.derived || {},
    durationMs,
    metrics,
  }
}

/** Run all four detectors with the same data → the basis of every comparison. */
export function runAllAlgorithms(dataset, params) {
  if (!dataset || !dataset.records?.length) return null
  const out = {}
  for (const algo of ALGORITHMS) {
    out[algo.key] = runAlgorithm(algo.key, dataset.records, {
      ...DEFAULT_PARAMS[algo.key],
      ...(params?.[algo.key] || {}),
      calibration: dataset.calibration,
    })
  }
  return out
}
