/**
 * ---------------------------------------------------------------------------
 * experiments.js — The four experimental scenarios of the research study
 * ---------------------------------------------------------------------------
 * Each experiment generates fresh, seeded datasets (reproducible runs) and
 * evaluates the four algorithms on them, returning plain rows that the
 * Experiments and Results pages turn into tables and charts.
 *
 * Fairness protocol (shown in the UI as well):
 *   • Fixed Threshold  always uses the user-configured threshold — this is
 *     the defining property of the method (it does NOT recalibrate).
 *   • Statistical Threshold recalibrates μ+3σ from each run's normal
 *     calibration sample.
 *   • Moving Average and the Proposed Adaptive Detector use rolling windows,
 *     so they adapt inside a run.
 *   • All detectors see exactly the same records and the same ground truth.
 * ---------------------------------------------------------------------------
 */

import { generateTraffic, ANOMALY_TYPES } from './simulator.js'
import { runAlgorithm, DEFAULT_PARAMS } from './algorithms.js'

/** Observation count used for generated experiment datasets. */
const EXP_OBSERVATIONS = 600
const BASE_SEED = 20261101

const ALL_TYPES = ANOMALY_TYPES.map((t) => t.id)

/** Run all four algorithms on one dataset and flatten to comparable rows. */
function evaluate(dataset, params) {
  return [
    ['fixed', DEFAULT_PARAMS.fixed],
    ['moving', DEFAULT_PARAMS.moving],
    ['statistical', DEFAULT_PARAMS.statistical],
    ['adaptive', DEFAULT_PARAMS.adaptive],
  ].map(([key, defaults]) => {
    const run = runAlgorithm(key, dataset.records, {
      ...defaults,
      ...(params?.[key] || {}),
      calibration: dataset.calibration,
    })
    return { key, metrics: run.metrics, durationMs: run.durationMs, derived: run.derived }
  })
}

function buildRows(evaluations, namesByKey, groupAccessor) {
  const rows = []
  evaluations.forEach((entry) => {
    entry.results.forEach((res) => {
      rows.push({
        algoKey: res.key,
        algoName: namesByKey[res.key],
        group: groupAccessor(entry),
        metrics: res.metrics,
        durationMs: res.durationMs,
      })
    })
  })
  return rows
}

/* -------------------------------------------------------------------------
 * Experiment 1 — Traffic Intensity (supports RQ1 / RQ3)
 * Does the choice of *normal* load level change algorithm performance?
 * ---------------------------------------------------------------------- */
export function runIntensityExperiment(params, namesByKey) {
  const levels = ['low', 'medium', 'high']
  const entries = levels.map((level, idx) => {
    const dataset = generateTraffic({
      observations: EXP_OBSERVATIONS,
      trafficIntensity: level,
      anomalyIntensity: 'medium',
      anomalyTypes: ALL_TYPES,
      seed: BASE_SEED + idx,
    })
    return { level, dataset, results: evaluate(dataset, params) }
  })
  return {
    groups: levels,
    rows: buildRows(entries, namesByKey, (e) => e.level),
  }
}

/* -------------------------------------------------------------------------
 * Experiment 2 — Anomaly Intensity (supports RQ1)
 * Are low-and-slow anomalies harder to catch than obvious ones?
 * ---------------------------------------------------------------------- */
export function runAnomalyIntensityExperiment(params, namesByKey) {
  const levels = ['low', 'medium', 'high']
  const entries = levels.map((level, idx) => {
    const dataset = generateTraffic({
      observations: EXP_OBSERVATIONS,
      trafficIntensity: 'medium',
      anomalyIntensity: level,
      anomalyTypes: ALL_TYPES,
      seed: BASE_SEED + 10 + idx,
    })
    return { level, dataset, results: evaluate(dataset, params) }
  })
  return {
    groups: levels,
    rows: buildRows(entries, namesByKey, (e) => e.level),
  }
}

/* -------------------------------------------------------------------------
 * Experiment 3 — Anomaly Type (supports RQ2)
 * Port-scan and protocol-distribution anomalies barely move the packet rate;
 * this experiment shows which detectors notice them at all.
 * ---------------------------------------------------------------------- */
export function runAnomalyTypeExperiment(params, namesByKey) {
  const entries = ANOMALY_TYPES.map((type, idx) => {
    const dataset = generateTraffic({
      observations: 500,
      trafficIntensity: 'medium',
      anomalyIntensity: 'medium',
      anomalyTypes: [type.id],
      seed: BASE_SEED + 20 + idx,
    })
    return { level: type.label, dataset, results: evaluate(dataset, params) }
  })
  return {
    groups: ANOMALY_TYPES.map((t) => t.label),
    rows: buildRows(entries, namesByKey, (e) => e.level),
  }
}

/* -------------------------------------------------------------------------
 * Experiment 4 — Adaptive Detector Configuration (supports RQ1/RQ4)
 * How does the rolling window size of the PROPOSED detector affect accuracy
 * and processing overhead? Runs on the dataset currently loaded in the app.
 * ---------------------------------------------------------------------- */
export function runWindowExperiment(dataset, params) {
  if (!dataset?.records?.length) return null
  const windows = [20, 50, 100]
  const rows = windows.map((w) => {
    const run = runAlgorithm('adaptive', dataset.records, {
      ...DEFAULT_PARAMS.adaptive,
      ...(params?.adaptive || {}),
      window: w,
      calibration: dataset.calibration,
    })
    return { window: w, metrics: run.metrics, durationMs: run.durationMs }
  })
  return { groups: windows, rows }
}
