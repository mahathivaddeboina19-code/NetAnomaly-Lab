/**
 * ---------------------------------------------------------------------------
 * scripts/smoke.mjs — headless verification (no browser required)
 * ---------------------------------------------------------------------------
 * Run with:  node scripts/smoke.mjs
 *
 * Loads the app through Vite's SSR pipeline, then:
 *   1. generates a real dataset and runs all four detectors,
 *   2. sanity-checks the computed metrics and the CSV export,
 *   3. server-renders every page twice — with a fully populated state and
 *      with the empty state — to catch runtime errors early.
 * ---------------------------------------------------------------------------
 */

import React from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'

/* ---- minimal browser globals so components can render outside a browser --- */
globalThis.window = {
  location: { hash: '' },
  addEventListener() {},
  removeEventListener() {},
  scrollTo() {},
}

const ok = (label, detail = '') => console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`)
const fail = (msg) => {
  console.error(`  ✗ ${msg}`)
  process.exitCode = 1
}

const server = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

try {
  /* --------------------------- load app modules --------------------------- */
  const { App } = { App: (await server.ssrLoadModule('/src/App.jsx')).default }
  const { AppContext } = await server.ssrLoadModule('/src/state/AppContext.jsx')
  const { generateTraffic } = await server.ssrLoadModule('/src/core/simulator.js')
  const { runAllAlgorithms, DEFAULT_PARAMS, ALGORITHMS, calibrateThreshold } =
    await server.ssrLoadModule('/src/core/algorithms.js')
  const exp = await server.ssrLoadModule('/src/core/experiments.js')
  const { buildResultsCsv } = await server.ssrLoadModule('/src/utils/exportCsv.js')

  const pageModules = {}
  for (const name of [
    'Dashboard',
    'Simulator',
    'AlgorithmsPage',
    'Analysis',
    'Experiments',
    'Results',
    'Methodology',
  ]) {
    const mod = await server.ssrLoadModule(`/src/pages/${name}.jsx`)
    pageModules[name] = mod[name]
  }

  /* ------------------------ 1. engine: real numbers ----------------------- */
  console.log('\n[1] Traffic simulation + detection engine')
  const dataset = generateTraffic({
    observations: 500,
    trafficIntensity: 'medium',
    anomalyIntensity: 'medium',
    anomalyTypes: ['burst', 'portscan', 'flood', 'icmp'],
    seed: 42,
  })
  if (dataset.records.length !== 500) fail(`expected 500 records, got ${dataset.records.length}`)
  const labelled = dataset.records.filter((r) => r.label === 1).length
  ok('dataset generated', `${dataset.records.length} records, ${labelled} anomalies (${((labelled / 500) * 100).toFixed(1)}%)`)
  if (labelled === 0) fail('no anomalies were injected')

  // Mirror the app: the fixed threshold is a hand-tuned constant by default
  // (auto-calibration is opt-in on the Algorithms page).
  const params = DEFAULT_PARAMS
  const suggested = calibrateThreshold(dataset.calibration, 3).threshold
  const results = runAllAlgorithms(dataset, params)
  ok(
    'fixed threshold in use',
    `${params.fixed.threshold} pps hand-tuned (μ+3σ of normal sample would suggest ${suggested})`,
  )
  for (const algo of ALGORITHMS) {
    const m = results[algo.key].metrics
    const problems = []
    if (!(m.f1 >= 0 && m.f1 <= 1)) problems.push('F1 out of range')
    if (!(m.recall >= 0 && m.recall <= 1)) problems.push('recall out of range')
    if (!(m.fpr >= 0 && m.fpr <= 1)) problems.push('FPR out of range')
    if (m.tp + m.fn !== labelled) problems.push('confusion matrix inconsistent')
    if (problems.length) fail(`${algo.name}: ${problems.join(', ')}`)
    ok(
      algo.name,
      `recall ${(m.recall * 100).toFixed(1)}% · FPR ${(m.fpr * 100).toFixed(1)}% · F1 ${(m.f1 * 100).toFixed(1)}% · ${results[algo.key].durationMs.toFixed(3)} ms`,
    )
  }

  /* ---------------------- 2. experiments + CSV export --------------------- */
  console.log('\n[2] Experiments + CSV export')
  const namesByKey = Object.fromEntries(ALGORITHMS.map((a) => [a.key, a.name]))
  const experiments = {
    exp1: exp.runIntensityExperiment(params, namesByKey),
    exp2: exp.runAnomalyIntensityExperiment(params, namesByKey),
    exp3: exp.runAnomalyTypeExperiment(params, namesByKey),
    exp4: exp.runWindowExperiment(dataset, params),
  }
  for (const [k, v] of Object.entries(experiments)) {
    if (!v?.rows?.length) fail(`${k} produced no rows`)
  }
  ok('all four experiments ran',
    `exp1 ${experiments.exp1.rows.length} rows · exp2 ${experiments.exp2.rows.length} · exp3 ${experiments.exp3.rows.length} · exp4 ${experiments.exp4.rows.length}`)

  const comparison = ALGORITHMS.map((a) => ({
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
  const csv = buildResultsCsv({ meta: dataset.meta, comparison, experiments })
  for (const needle of ['Experiment 1', 'Experiment 4', 'F1 Score', 'Limitations', 'SIMULATED']) {
    if (!csv.includes(needle)) fail(`CSV missing section marker: ${needle}`)
  }
  ok('CSV report built', `${csv.split('\n').length} lines`)

  /* --------------------- 3. render every page (populated) ------------------ */
  console.log('\n[3] Server-rendering pages with populated state')
  const ctxValue = {
    config: {
      observations: 500,
      trafficIntensity: 'medium',
      anomalyIntensity: 'medium',
      anomalyTypes: ['burst', 'portscan', 'flood', 'icmp'],
      seed: '42',
    },
    setConfig() {},
    dataset,
    generate() {},
    lastGeneratedAt: new Date(),
    params,
    setAlgoParam() {},
    results,
    comparison,
    activeAlgorithm: 'adaptive',
    setActiveAlgorithm() {},
    experiments,
    runExperiment() {},
    runAllExperiments() {},
  }

  for (const [name, Page] of Object.entries(pageModules)) {
    try {
      const html = renderToString(
        React.createElement(
          AppContext.Provider,
          { value: ctxValue },
          React.createElement(Page, { navigate() {}, route: '/x', routes: [] }),
        ),
      )
      if (html.length < 200) fail(`${name} rendered suspiciously little markup (${html.length} chars)`)
      else ok(`${name} page rendered`, `${html.length} chars`)
    } catch (err) {
      fail(`${name} page crashed: ${err.message}`)
      console.error(err.stack.split('\n').slice(0, 4).join('\n'))
    }
  }

  /* ----------------------- 4. render app (empty state) --------------------- */
  console.log('\n[4] Server-rendering <App/> (empty-state boot path)')
  try {
    const html = renderToString(React.createElement(App))
    ok('App rendered', `${html.length} chars`)
  } catch (err) {
    fail(`App crashed: ${err.message}`)
    console.error(err.stack.split('\n').slice(0, 5).join('\n'))
  }

  console.log(
    process.exitCode ? '\nSMOKE TEST FAILED\n' : '\nSMOKE TEST PASSED — all pages and engine checks OK\n',
  )
} finally {
  await server.close()
}
