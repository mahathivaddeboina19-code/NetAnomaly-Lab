/**
 * ---------------------------------------------------------------------------
 * AppContext.jsx — Global application state
 * ---------------------------------------------------------------------------
 * Holds everything the pages share:
 *   • the generated traffic dataset (records + normal calibration sample),
 *   • the per-algorithm parameters,
 *   • the evaluation results of the four detectors,
 *   • the four experiment result sets.
 *
 * Regenerating data or tweaking a parameter re-runs all detectors
 * automatically, so every page always reflects the current configuration.
 * ---------------------------------------------------------------------------
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { generateTraffic, ANOMALY_TYPES } from '../core/simulator.js'
import {
  ALGORITHMS,
  DEFAULT_PARAMS,
  calibrateThreshold,
  runAllAlgorithms,
} from '../core/algorithms.js'
import {
  runIntensityExperiment,
  runAnomalyIntensityExperiment,
  runAnomalyTypeExperiment,
  runWindowExperiment,
} from '../core/experiments.js'
import { randomSeed } from '../core/prng.js'

const AppContext = createContext(null)

// Exported for tooling/tests (e.g. the SSR smoke test in scripts/smoke.mjs).
export { AppContext }

export const DEFAULT_CONFIG = {
  observations: 600,
  trafficIntensity: 'medium',
  anomalyIntensity: 'medium',
  anomalyTypes: ANOMALY_TYPES.map((t) => t.id),
  seed: '', // empty → random seed each run
}

export function AppProvider({ children }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [dataset, setDataset] = useState(null)
  const [params, setParams] = useState(DEFAULT_PARAMS)
  const [results, setResults] = useState(null)
  const [activeAlgorithm, setActiveAlgorithm] = useState('adaptive')
  const [experiments, setExperiments] = useState({
    exp1: null,
    exp2: null,
    exp3: null,
    exp4: null,
  })
  const [lastGeneratedAt, setLastGeneratedAt] = useState(null)

  /** Generate a new dataset (optionally overriding the current config). */
  const generate = useCallback(
    (overrides) => {
      const cfg = { ...config, ...(overrides || {}) }
      const ds = generateTraffic({
        observations: Number(cfg.observations) || 600,
        trafficIntensity: cfg.trafficIntensity,
        anomalyIntensity: cfg.anomalyIntensity,
        anomalyTypes: cfg.anomalyTypes,
        seed: cfg.seed === '' || cfg.seed == null ? randomSeed() : Number(cfg.seed) >>> 0,
      })
      setDataset(ds)
      setLastGeneratedAt(new Date())
      setConfig(cfg)

      // Auto-calibrate the fixed threshold from the new normal baseline
      // (can be switched off by the user on the Algorithms page).
      if (params.fixed?.autoCalibrate) {
        const { threshold } = calibrateThreshold(ds.calibration, 3)
        setParams((p) => ({ ...p, fixed: { ...p.fixed, threshold } }))
      }
      return ds
    },
    [config, params.fixed?.autoCalibrate],
  )

  /** First load: produce a default dataset so the dashboard is populated. */
  useEffect(() => {
    generate(DEFAULT_CONFIG)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** (Re)run all four detectors whenever the data or a parameter changes. */
  useEffect(() => {
    if (!dataset) {
      setResults(null)
      return
    }
    setResults(runAllAlgorithms(dataset, params))
  }, [dataset, params])

  const setAlgoParam = useCallback((algoKey, partial) => {
    setParams((p) => ({ ...p, [algoKey]: { ...p[algoKey], ...partial } }))
  }, [])

  /** Flat comparison rows used by dashboards, tables and the CSV export. */
  const comparison = useMemo(() => {
    if (!results) return null
    return ALGORITHMS.map((a) => ({
      key: a.key,
      name: a.name,
      tag: a.tag,
      accent: a.accent,
      metrics: results[a.key].metrics,
      durationMs: results[a.key].durationMs,
      derived: results[a.key].derived,
      preds: results[a.key].preds,
      evidence: results[a.key].evidence,
    }))
  }, [results])

  const namesByKey = useMemo(
    () => Object.fromEntries(ALGORITHMS.map((a) => [a.key, a.name])),
    [],
  )

  /** Run one experiment (or all four). */
  const runExperiment = useCallback(
    (id) => {
      setExperiments((prev) => {
        const next = { ...prev }
        if (id === 'exp1') next.exp1 = runIntensityExperiment(params, namesByKey)
        if (id === 'exp2') next.exp2 = runAnomalyIntensityExperiment(params, namesByKey)
        if (id === 'exp3') next.exp3 = runAnomalyTypeExperiment(params, namesByKey)
        if (id === 'exp4') next.exp4 = runWindowExperiment(dataset, params)
        return next
      })
    },
    [params, dataset, namesByKey],
  )

  const runAllExperiments = useCallback(() => {
    setExperiments((prev) => ({
      exp1: runIntensityExperiment(params, namesByKey),
      exp2: runAnomalyIntensityExperiment(params, namesByKey),
      exp3: runAnomalyTypeExperiment(params, namesByKey),
      exp4: runWindowExperiment(dataset, params) ?? prev.exp4,
    }))
  }, [params, dataset, namesByKey])

  const value = {
    config,
    setConfig,
    dataset,
    generate,
    lastGeneratedAt,
    params,
    setAlgoParam,
    results,
    comparison,
    activeAlgorithm,
    setActiveAlgorithm,
    experiments,
    runExperiment,
    runAllExperiments,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
