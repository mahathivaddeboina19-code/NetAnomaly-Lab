/**
 * ---------------------------------------------------------------------------
 * scripts/verify.mjs — full behavioural verification (no browser required)
 * ---------------------------------------------------------------------------
 * Run with:  node scripts/verify.mjs
 *
 * Verifies, against the real engine and the real React pages:
 *   1. All traffic scenarios simulate and detect correctly (incl. normal-only)
 *   2. Traffic intensity changes generated data AND experiment results
 *   3. Anomaly intensity changes the difficulty of detection
 *   4. Changing the Fixed Threshold affects ONLY the Fixed Threshold detector
 *   5. Rolling windows affect only the detectors that use them
 *   6. Regenerating data changes dashboard metrics (re-render comparison)
 *   7. Charts/tables render the calculated values (HTML content checks)
 *   8. CSV export contains every section with real numbers
 *   9. Research-quality language: simulated-data disclaimers present
 * ---------------------------------------------------------------------------
 */

import React from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'

globalThis.window = {
  location: { hash: '' },
  addEventListener() {},
  removeEventListener() {},
  scrollTo() {},
}

let failures = 0
const ok = (label, detail = '') => console.log(`  \u2713 ${label}${detail ? ` \u2014 ${detail}` : ''}`)
const bad = (msg) => {
  console.log(`  \u2717 ${msg}`)
  failures++
}
const check = (cond, label, detail) => (cond ? ok(label, detail) : bad(label + (detail ? ` \u2014 ${detail}` : '')))

const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])
const pct = (v, digits = 1) => `${(v * 100).toFixed(digits)}%`
const meanOf = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)

const server = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

try {
  const { App } = { App: (await server.ssrLoadModule('/src/App.jsx')).default }
  const { AppContext } = await server.ssrLoadModule('/src/state/AppContext.jsx')
  const sim = await server.ssrLoadModule('/src/core/simulator.js')
  const algo = await server.ssrLoadModule('/src/core/algorithms.js')
  const experiments = await server.ssrLoadModule('/src/core/experiments.js')
  const { buildResultsCsv } = await server.ssrLoadModule('/src/utils/exportCsv.js')
  const { runAllAlgorithms, runAlgorithm, DEFAULT_PARAMS, ALGORITHMS, calibrateThreshold } = algo
  const { generateTraffic, ANOMALY_TYPES } = sim

  const ALL = ANOMALY_TYPES.map((t) => t.id)
  const base = { observations: 600, trafficIntensity: 'medium', anomalyIntensity: 'medium', anomalyTypes: ALL, seed: 42 }

  /* ================= 1. scenario coverage ================================ */
  console.log('\n[1] Traffic scenarios: normal-only + each anomaly type in isolation')
  {
    const normalOnly = generateTraffic({ ...base, anomalyTypes: [] })
    check(
      normalOnly.records.every((r) => r.label === 0 && r.scenario === 'Normal'),
      'normal-only dataset has zero anomaly labels',
      `${normalOnly.records.length} records`,
    )

    for (const type of ANOMALY_TYPES) {
      const ds = generateTraffic({ ...base, anomalyTypes: [type.id] })
      const ofType = ds.records.filter((r) => r.label === 1)
      const wrongScenario = ofType.some((r) => r.scenario !== type.label)
      const wrongLabel = ds.records.some((r) => (r.label === 1) !== (r.scenario !== 'Normal'))
      check(
        ofType.length > 0 && !wrongScenario && !wrongLabel,
        `${type.label}: labels & scenarios consistent`,
        `${ofType.length} anomalous records injected`,
      )
      const res = runAllAlgorithms(ds, DEFAULT_PARAMS)
      const allValid = ALGORITHMS.every((a) => {
        const m = res[a.key].metrics
        return m.tp + m.fn === ofType.length && m.f1 >= 0 && m.f1 <= 1
      })
      check(
        allValid,
        `${type.label}: all four detectors produce valid metrics`,
        ALGORITHMS.map((a) => `${a.key}=${pct(res[a.key].metrics.recall)}`).join(' '),
      )
    }
  }

  /* ================= 2. traffic intensity ================================ */
  console.log('\n[2] Traffic intensity changes data AND experimental results')
  {
    const low = generateTraffic({ ...base, trafficIntensity: 'low', seed: 11 })
    const high = generateTraffic({ ...base, trafficIntensity: 'high', seed: 11 })
    const lowMean = meanOf(low.records.map((r) => r.pps))
    const highMean = meanOf(high.records.map((r) => r.pps))
    check(
      highMean > lowMean * 3,
      'generated packet rates scale with intensity',
      `low μ=${Math.round(lowMean)} pps vs high μ=${Math.round(highMean)} pps`,
    )

    const names = Object.fromEntries(ALGORITHMS.map((a) => [a.key, a.name]))
    const exp1 = experiments.runIntensityExperiment(DEFAULT_PARAMS, names)
    const fixedLow = exp1.rows.find((r) => r.algoKey === 'fixed' && r.group === 'low')
    const fixedHigh = exp1.rows.find((r) => r.algoKey === 'fixed' && r.group === 'high')
    const differs =
      fixedLow.metrics.recall !== fixedHigh.metrics.recall ||
      fixedLow.metrics.fpr !== fixedHigh.metrics.fpr
    check(
      differs,
      'Experiment 1 results differ across intensity levels (fixed detector)',
      `low recall ${pct(fixedLow.metrics.recall)}/FPR ${pct(fixedLow.metrics.fpr)} vs high ${pct(fixedHigh.metrics.recall)}/${pct(fixedHigh.metrics.fpr)}`,
    )
  }

  /* ================= 3. anomaly intensity ================================ */
  console.log('\n[3] Anomaly intensity changes detection difficulty')
  {
    const names = Object.fromEntries(ALGORITHMS.map((a) => [a.key, a.name]))
    const exp2 = experiments.runAnomalyIntensityExperiment(DEFAULT_PARAMS, names)
    const magOf = (level) => {
      const ds = generateTraffic({ ...base, anomalyIntensity: level, seed: 21 })
      const anoms = ds.records.filter((r) => r.label === 1)
      return {
        pps: meanOf(anoms.map((r) => r.pps)),
        recall: Object.fromEntries(
          ALGORITHMS.map((a) => [a.key, runAlgorithm(a.key, ds.records, { ...DEFAULT_PARAMS[a.key], calibration: ds.calibration }).metrics.recall]),
        ),
      }
    }
    const lo = magOf('low')
    const hi = magOf('high')
    check(hi.pps > lo.pps * 1.4, 'anomaly magnitude scales with anomaly intensity', `low μ=${Math.round(lo.pps)} pps vs high μ=${Math.round(hi.pps)} pps`)

    const rowsLo = exp2.rows.filter((r) => r.group === 'low')
    const rowsHi = exp2.rows.filter((r) => r.group === 'high')
    const easyHardDiffer = rowsLo.some(
      (r) => r.metrics.recall !== rowsHi.find((x) => x.algoKey === r.algoKey).metrics.recall,
    )
    check(easyHardDiffer, 'Experiment 2 detection rates change with anomaly intensity',
      `adaptive recall low ${pct(lo.recall.adaptive)} → high ${pct(hi.recall.adaptive)}`)
  }

  /* ================= 4. fixed threshold isolation ======================== */
  console.log('\n[4] Changing the Fixed Threshold affects ONLY the Fixed Threshold detector')
  {
    const ds = generateTraffic(base)
    const at = (threshold) => {
      const params = { ...DEFAULT_PARAMS, fixed: { threshold, autoCalibrate: false } }
      return runAllAlgorithms(ds, params)
    }
    const a = at(200)
    const b = at(800)
    check(
      !same(a.fixed.preds, b.fixed.preds),
      'fixed detector predictions change with the threshold',
      `alarms ${a.fixed.preds.reduce((s, v) => s + v, 0)} → ${b.fixed.preds.reduce((s, v) => s + v, 0)}`,
    )
    for (const key of ['moving', 'statistical', 'adaptive']) {
      check(same(a[key].preds, b[key].preds), `${key} detector is unaffected by the fixed threshold`)
    }
    // and the statistical threshold really is μ + 3σ of the baseline traffic
    const cal = ds.calibration.map((r) => r.pps)
    const mu = meanOf(cal)
    const sd = Math.sqrt(meanOf(cal.map((v) => (v - mu) ** 2)))
    check(
      Math.abs(a.statistical.derived.threshold - (mu + 3 * sd)) < 1e-6,
      'statistical detector uses exactly μ + 3σ of baseline traffic',
      `μ=${Math.round(mu)} σ=${Math.round(sd)} → ${Math.round(a.statistical.derived.threshold)} pps`,
    )
    check(
      a.fixed.derived.threshold === 200 && b.fixed.derived.threshold === 800,
      'fixed detector uses exactly the configured constant (default 200 pps)',
    )
  }

  /* ================= 5. rolling window isolation ========================= */
  console.log('\n[5] Rolling windows affect the detectors that use them (and only those)')
  {
    const ds = generateTraffic(base)
    const run = (key, window) =>
      runAlgorithm(key, ds.records, { ...DEFAULT_PARAMS[key], window, calibration: ds.calibration }).preds

    check(!same(run('moving', 10), run('moving', 100)), 'moving-average predictions change with window size (10 vs 100)')
    check(!same(run('adaptive', 20), run('adaptive', 100)), 'adaptive predictions change with window size (20 vs 100)')

    const p200 = runAlgorithm('fixed', ds.records, { threshold: 200, calibration: ds.calibration }).preds
    const p400 = runAlgorithm('fixed', ds.records, { threshold: 400, calibration: ds.calibration }).preds
    check(!same(p200, p400), 'fixed detector still depends only on its threshold')

    // Experiment 4 (window study) must produce three distinct rows
    const exp4 = experiments.runWindowExperiment(ds, DEFAULT_PARAMS)
    check(
      exp4.rows.length === 3 && exp4.rows.every((r, _, arr) => arr.filter((x) => x.window === r.window).length === 1),
      'Experiment 4 evaluates windows 20/50/100 separately',
      exp4.rows.map((r) => `w${r.window}: time ${r.durationMs.toFixed(2)}ms, F1 ${pct(r.metrics.f1)}`).join(' | '),
    )
    check(
      new Set(exp4.rows.map((r) => r.durationMs)).size === 3,
      'window size changes the adaptive detector processing time',
    )
  }

  /* ================= 6. dashboard metrics on regeneration ================ */
  console.log('\n[6] Dashboard metrics update when new traffic data is generated')
  {
    const valueFor = (ds) => ({
      config: { ...base },
      setConfig() {},
      dataset: ds,
      generate() {},
      lastGeneratedAt: new Date(),
      params: DEFAULT_PARAMS,
      setAlgoParam() {},
      results: runAllAlgorithms(ds, DEFAULT_PARAMS),
      comparison: ALGORITHMS.map((a) => {
        const r = runAllAlgorithms(ds, DEFAULT_PARAMS)[a.key]
        return { key: a.key, name: a.name, tag: a.tag, accent: a.accent, metrics: r.metrics, durationMs: r.durationMs, derived: r.derived, preds: r.preds, evidence: r.evidence }
      }),
      activeAlgorithm: 'adaptive',
      setActiveAlgorithm() {},
      experiments: { exp1: null, exp2: null, exp3: null, exp4: null },
      runExperiment() {},
      runAllExperiments() {},
    })
    const { Dashboard } = await server.ssrLoadModule('/src/pages/Dashboard.jsx')

    const dsA = generateTraffic({ ...base, seed: 1 })
    const dsB = generateTraffic({ observations: 900, trafficIntensity: 'high', anomalyIntensity: 'high', anomalyTypes: ALL, seed: 2 })
    const htmlA = renderToString(React.createElement(AppContext.Provider, { value: valueFor(dsA) }, React.createElement(Dashboard, { navigate() {} })))
    const htmlB = renderToString(React.createElement(AppContext.Provider, { value: valueFor(dsB) }, React.createElement(Dashboard, { navigate() {} })))

    check(htmlA.includes(dsA.meta.observations.toLocaleString()) && htmlB.includes(dsB.meta.observations.toLocaleString()), 'dashboard shows the current dataset size', `A=${dsA.meta.observations}, B=${dsB.meta.observations} observations`)
    check(htmlA !== htmlB, 'dashboard markup changes when the dataset changes')

    const mB = runAllAlgorithms(dsB, DEFAULT_PARAMS).adaptive.metrics
    check(htmlB.includes(pct(mB.recall, 1)), 'dashboard renders the calculated detection rate', `adaptive recall ${pct(mB.recall, 1)}`)
  }

  /* ================= 7. charts & tables show calculated values ============ */
  console.log('\n[7] Charts/tables display calculated values')
  {
    const ds = generateTraffic(base)
    const results = runAllAlgorithms(ds, DEFAULT_PARAMS)
    const comparison = ALGORITHMS.map((a) => ({
      key: a.key, name: a.name, tag: a.tag, accent: a.accent,
      metrics: results[a.key].metrics, durationMs: results[a.key].durationMs,
      derived: results[a.key].derived, preds: results[a.key].preds, evidence: results[a.key].evidence,
    }))
    const names = Object.fromEntries(ALGORITHMS.map((a) => [a.key, a.name]))
    const exps = {
      exp1: experiments.runIntensityExperiment(DEFAULT_PARAMS, names),
      exp2: experiments.runAnomalyIntensityExperiment(DEFAULT_PARAMS, names),
      exp3: experiments.runAnomalyTypeExperiment(DEFAULT_PARAMS, names),
      exp4: experiments.runWindowExperiment(ds, DEFAULT_PARAMS),
    }
    const ctx = {
      config: { ...base }, setConfig() {}, dataset: ds, generate() {}, lastGeneratedAt: new Date(),
      params: DEFAULT_PARAMS, setAlgoParam() {}, results, comparison,
      activeAlgorithm: 'adaptive', setActiveAlgorithm() {},
      experiments: exps, runExperiment() {}, runAllExperiments() {},
    }

    const pages = {
      Results: await server.ssrLoadModule('/src/pages/Results.jsx'),
      Analysis: await server.ssrLoadModule('/src/pages/Analysis.jsx'),
      AlgorithmsPage: await server.ssrLoadModule('/src/pages/AlgorithmsPage.jsx'),
      Experiments: await server.ssrLoadModule('/src/pages/Experiments.jsx'),
      Simulator: await server.ssrLoadModule('/src/pages/Simulator.jsx'),
    }

    const resultsHtml = renderToString(
      React.createElement(AppContext.Provider, { value: ctx }, React.createElement(pages.Results.Results, { navigate() {} })),
    )
    check(
      comparison.every((r) => resultsHtml.includes(r.name)),
      'comparison table lists all four algorithms',
    )
    check(
      comparison.every((r) => resultsHtml.includes(pct(r.metrics.f1, 2))),
      'comparison table shows the calculated F1 scores',
      comparison.map((r) => `${r.name}=${pct(r.metrics.f1, 2)}`).join(' | '),
    )
    check(resultsHtml.includes('Detection Rate') && resultsHtml.includes('False Positive Rate') && resultsHtml.includes('Processing Time'), 'comparison charts for detection rate / FPR / processing time are present')
    check(resultsHtml.includes('Proposed Adaptive Detector'), 'proposed detector is labelled as proposed in results')

    const analysisHtml = renderToString(
      React.createElement(AppContext.Provider, { value: ctx }, React.createElement(pages.Analysis.Analysis, { navigate() {} })),
    )
    const lower = analysisHtml.toLowerCase()
    check(
      lower.includes('packets per second') && lower.includes('bytes per second') &&
        lower.includes('unique destination ports') && lower.includes('icmp ratio'),
      'analysis page renders all four feature timelines',
    )
    check(analysisHtml.includes('Actual anomaly') && analysisHtml.includes('Detected'), 'timeline distinguishes actual labels from detections')

    const expHtml = renderToString(
      React.createElement(AppContext.Provider, { value: ctx }, React.createElement(pages.Experiments.Experiments, { navigate() {} })),
    )
    check(expHtml.includes('20 obs') && expHtml.includes('100 obs'), 'experiment 4 table renders the three window rows')

    const simHtml = renderToString(
      React.createElement(AppContext.Provider, { value: ctx }, React.createElement(pages.Simulator.Simulator, { navigate() {} })),
    )
    check(simHtml.includes('Actual label') && simHtml.includes('Scenario'), 'simulator table shows scenario + ground-truth label columns')
  }

  /* ================= 8. CSV export ======================================== */
  console.log('\n[8] Export: CSV report content')
  {
    const ds = generateTraffic(base)
    const results = runAllAlgorithms(ds, DEFAULT_PARAMS)
    const comparison = ALGORITHMS.map((a) => ({
      key: a.key, name: a.name, tag: a.tag, accent: a.accent,
      metrics: results[a.key].metrics, durationMs: results[a.key].durationMs,
      derived: results[a.key].derived, preds: results[a.key].preds, evidence: results[a.key].evidence,
    }))
    const names = Object.fromEntries(ALGORITHMS.map((a) => [a.key, a.name]))
    const csv = buildResultsCsv({
      meta: ds.meta,
      comparison,
      experiments: {
        exp1: experiments.runIntensityExperiment(DEFAULT_PARAMS, names),
        exp2: experiments.runAnomalyIntensityExperiment(DEFAULT_PARAMS, names),
        exp3: experiments.runAnomalyTypeExperiment(DEFAULT_PARAMS, names),
        exp4: experiments.runWindowExperiment(ds, DEFAULT_PARAMS),
      },
    })
    const required = [
      '=== Dataset ===', '=== Algorithm Comparison (current dataset) ===',
      'Experiment 1: Traffic Intensity', 'Experiment 2: Anomaly Intensity',
      'Experiment 3: Anomaly Type', '=== Experiment 4: Adaptive Detector Window Size ===',
      '=== Limitations ===', 'SIMULATED',
      'Accuracy,Precision,Detection Rate (Recall),False Positive Rate,False Negative Rate,F1 Score,Processing Time (ms)',
    ]
    check(required.every((needle) => csv.includes(needle)), 'CSV contains every report section', `${csv.split('\n').length} lines`)
    check(ALGORITHMS.every((a) => csv.includes(a.name)), 'CSV lists all four algorithms with metric columns')

    // with no experiments run, the export must still be produced and labelled
    const csvEmpty = buildResultsCsv({ meta: ds.meta, comparison, experiments: { exp1: null, exp2: null, exp3: null, exp4: null } })
    check(csvEmpty.includes('Experiment not run'), 'CSV degrades gracefully when experiments were not run')
  }

  /* ================= 9. research-quality language ========================= */
  console.log('\n[9] Research quality: simulated-data framing')
  {
    const ds = generateTraffic(base)
    const results = runAllAlgorithms(ds, DEFAULT_PARAMS)
    const comparison = ALGORITHMS.map((a) => ({
      key: a.key, name: a.name, tag: a.tag, accent: a.accent,
      metrics: results[a.key].metrics, durationMs: results[a.key].durationMs,
      derived: results[a.key].derived, preds: results[a.key].preds, evidence: results[a.key].evidence,
    }))
    const ctx = {
      config: { ...base }, setConfig() {}, dataset: ds, generate() {}, lastGeneratedAt: new Date(),
      params: DEFAULT_PARAMS, setAlgoParam() {}, results, comparison,
      activeAlgorithm: 'adaptive', setActiveAlgorithm() {},
      experiments: { exp1: null, exp2: null, exp3: null, exp4: null }, runExperiment() {}, runAllExperiments() {},
    }
    const appHtml = renderToString(React.createElement(App))
    check(appHtml.includes('SIMULATED DATA'), 'header carries the simulated-data badge')
    const { Results } = await server.ssrLoadModule('/src/pages/Results.jsx')
    const { Methodology } = await server.ssrLoadModule('/src/pages/Methodology.jsx')
    const resHtml = renderToString(React.createElement(AppContext.Provider, { value: ctx }, React.createElement(Results, { navigate() {} })))
    const methHtml = renderToString(React.createElement(Methodology, { navigate() {} }))
    check(resHtml.includes('Limitations') && resHtml.includes('Simulated traffic data'), 'results page includes the limitations section')
    check(methHtml.includes('RQ1') && methHtml.includes('RQ2') && methHtml.includes('RQ3') && methHtml.includes('RQ4'), 'methodology page lists all four research questions')
    check(methHtml.includes('TP / (TP + FN)') && methHtml.includes('FP / (FP + TN)'), 'methodology page defines the evaluation metrics')
    check(methHtml.includes('does not claim real-world'), 'methodology disclaims real-world IDS capability')
  }

  console.log(failures === 0 ? '\nALL VERIFICATION CHECKS PASSED\n' : `\n${failures} VERIFICATION CHECK(S) FAILED\n`)
  if (failures) process.exitCode = 1
} finally {
  await server.close()
}
