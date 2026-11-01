/**
 * ---------------------------------------------------------------------------
 * AlgorithmsPage — configure, run and compare the four detectors
 * ---------------------------------------------------------------------------
 * Every parameter change re-runs all detectors automatically (the context
 * recomputes results), so the cards always show the metrics for the *current*
 * configuration on the *current* dataset.
 * ---------------------------------------------------------------------------
 */

import { useMemo } from 'react'
import { Activity, Cpu, Gauge, Info, Scale, Sparkles } from 'lucide-react'
import { useApp } from '../state/AppContext.jsx'
import { ALGORITHMS, ALGO_SHORT, calibrateThreshold } from '../core/algorithms.js'
import { SectionCard, EmptyState, StatCard } from '../components/ui.jsx'
import { Checkbox, RangeField, SelectField, Segmented } from '../components/controls.jsx'
import { ms, number, percent } from '../utils/format.js'

const ICONS = { fixed: Gauge, moving: Activity, statistical: Scale, adaptive: Sparkles }

const BEST_RULE = {
  accuracy: 'max',
  precision: 'max',
  recall: 'max',
  fpr: 'min',
  fnr: 'min',
  f1: 'max',
  durationMs: 'min',
}

function bestKeys(comparison, field) {
  if (!comparison?.length) return new Set()
  const rule = BEST_RULE[field]
  const values = comparison.map((r) => (field === 'durationMs' ? r.durationMs : r.metrics[field]))
  const target = rule === 'max' ? Math.max(...values) : Math.min(...values)
  return new Set(
    comparison
      .filter(
        (r, i) =>
          values[i] === target && (rule === 'max' ? target > 0 : true),
      )
      .map((r) => r.key),
  )
}

export function AlgorithmsPage() {
  const { dataset, params, setAlgoParam, comparison, results, activeAlgorithm, setActiveAlgorithm } =
    useApp()

  const calibration = dataset?.calibration
  const fixedCal = useMemo(() => calibrateThreshold(calibration, 3), [calibration])

  const thresholdMax = useMemo(() => {
    const peak = calibration?.length
      ? Math.max(...calibration.map((r) => r.pps))
      : 1200
    return Math.max(500, Math.round((peak * 2.6) / 50) * 50)
  }, [calibration])

  if (!dataset || !comparison) {
    return (
      <div className="card">
        <EmptyState
          icon={Cpu}
          title="Generate data first"
          hint="The detectors need a traffic dataset before they can run."
        />
      </div>
    )
  }

  const best = {
    accuracy: bestKeys(comparison, 'accuracy'),
    precision: bestKeys(comparison, 'precision'),
    recall: bestKeys(comparison, 'recall'),
    fpr: bestKeys(comparison, 'fpr'),
    fnr: bestKeys(comparison, 'fnr'),
    f1: bestKeys(comparison, 'f1'),
    durationMs: bestKeys(comparison, 'durationMs'),
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h2>Anomaly Detection Algorithms</h2>
          <div className="sub">
            Four approaches are evaluated on the same traffic trace: three baseline methods and
            the <b>Proposed Adaptive Detector</b>. Adjust any parameter and every result below
            is recomputed immediately.
          </div>
        </div>
        <div className="row">
          <span className="small muted">Focus:</span>
          <Segmented
            options={ALGORITHMS.map((a) => ({ value: a.key, label: ALGO_SHORT[a.key] }))}
            value={activeAlgorithm}
            onChange={setActiveAlgorithm}
          />
        </div>
      </div>

      <div className="banner">
        <Info size={15} />
        <span>
          Fair-evaluation protocol: all four detectors consume identical records and identical
          ground truth. Timing is the median of three back-to-back runs. Nothing is tuned to make
          the proposed method win — the tables show whatever the simulation produces.
        </span>
      </div>

      {/* ------------------------- four algorithm cards -------------------- */}
      <div className="grid-2">
        {ALGORITHMS.map((algo) => {
          const Icon = ICONS[algo.key]
          const run = results[algo.key]
          const m = run.metrics
          const derived = run.derived || {}

          return (
            <section
              key={algo.key}
              className="algo-card"
              style={{
                '--algo-accent': algo.accent,
                '--algo-accent-soft': `${algo.accent}22`,
                outline:
                  activeAlgorithm === algo.key
                    ? '1px solid rgba(59,130,246,0.55)'
                    : 'none',
              }}
            >
              <div className="algo-head">
                <div className="algo-icon">
                  <Icon size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="algo-name">
                    {algo.name}
                    {algo.badge ? <span className="badge">{algo.badge}</span> : null}
                  </div>
                  <div className="algo-tag">{algo.tag} · evaluated on this dataset</div>
                </div>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => setActiveAlgorithm(algo.key)}
                  title="Use this detector across the dashboard and analysis pages"
                >
                  {activeAlgorithm === algo.key ? 'Selected' : 'Focus'}
                </button>
              </div>

              <p className="algo-desc">{algo.description}</p>

              {/* ------------- per-algorithm parameter controls ------------- */}
              <div className="param-box">
                {algo.key === 'fixed' ? (
                  <>
                    <RangeField
                      label="Packet-rate threshold (pps)"
                      value={params.fixed.threshold}
                      min={50}
                      max={thresholdMax}
                      step={10}
                      display={(v) => `${number(v)} pps`}
                      onChange={(v) => setAlgoParam('fixed', { threshold: v })}
                    />
                    <div className="derived-line">
                      Rule: <b>pps &gt; {number(params.fixed.threshold)}</b> → anomaly · this
                      value is fixed for every dataset until you change it
                    </div>
                    <div className="derived-line">
                      Normal baseline (reference only): μ = {number(Math.round(fixedCal.mean))}, σ ={' '}
                      {number(Math.round(fixedCal.sd))} → μ + 3σ ={' '}
                      <b>{number(fixedCal.threshold)} pps</b> — the Statistical detector applies
                      this rule automatically; the fixed threshold does not
                    </div>
                    <Checkbox
                      label="Auto-calibrate threshold when new data is generated"
                      checked={params.fixed.autoCalibrate}
                      onChange={(v) => setAlgoParam('fixed', { autoCalibrate: v })}
                    />
                  </>
                ) : null}

                {algo.key === 'moving' ? (
                  <>
                    <SelectField
                      label="Rolling window size"
                      value={String(params.moving.window)}
                      onChange={(v) => setAlgoParam('moving', { window: Number(v) })}
                      options={[
                        { value: '10', label: '10 observations' },
                        { value: '20', label: '20 observations' },
                        { value: '50', label: '50 observations' },
                        { value: '100', label: '100 observations' },
                      ]}
                    />
                    <SelectField
                      label="Sensitivity (standard deviations)"
                      value={String(params.moving.sensitivity)}
                      onChange={(v) => setAlgoParam('moving', { sensitivity: Number(v) })}
                      options={['2', '2.5', '3', '3.5'].map((v) => ({
                        value: v,
                        label: `${v} σ`,
                      }))}
                    />
                    <div className="derived-line">
                      Rule: <b>|pps − μ₍rolling₎| &gt; {params.moving.sensitivity} σ</b> → anomaly
                    </div>
                  </>
                ) : null}

                {algo.key === 'statistical' ? (
                  <>
                    <div className="derived-line">
                      Baseline from normal calibration sample (n ={' '}
                      {number(dataset.calibration.length)})
                    </div>
                    <div className="derived-line">
                      μ = <b>{number(Math.round(derived.mean ?? 0))}</b> · σ ={' '}
                      <b>{number(Math.round(derived.sd ?? 0))}</b>
                    </div>
                    <div className="derived-line">
                      Threshold μ + 3σ = <b>{number(Math.round(derived.threshold ?? 0))} pps</b>
                    </div>
                    <div className="field-hint">
                      Recalibrated automatically from every new dataset’s normal sample.
                    </div>
                  </>
                ) : null}

                {algo.key === 'adaptive' ? (
                  <>
                    <SelectField
                      label="Rolling window size"
                      value={String(params.adaptive.window)}
                      onChange={(v) => setAlgoParam('adaptive', { window: Number(v) })}
                      options={[
                        { value: '20', label: '20 observations' },
                        { value: '50', label: '50 observations' },
                        { value: '100', label: '100 observations' },
                      ]}
                    />
                    <SelectField
                      label="Robust sensitivity (k)"
                      value={String(params.adaptive.sensitivity)}
                      onChange={(v) => setAlgoParam('adaptive', { sensitivity: Number(v) })}
                      options={['2.5', '3', '3.5', '4'].map((v) => ({
                        value: v,
                        label: `k = ${v}`,
                      }))}
                    />
                    <div className="chips">
                      {['Packets/s', 'Bytes/s', 'Unique ports', 'ICMP ratio'].map((f) => (
                        <span key={f} className="chip on" style={{ cursor: 'default' }}>
                          <span className="tick">✓</span>
                          {f}
                        </span>
                      ))}
                    </div>
                    <div className="derived-line">
                      Flags when <b>any</b> feature has |x − median| / (1.4826·MAD) &gt;{' '}
                      {params.adaptive.sensitivity} over the last {params.adaptive.window} records
                    </div>
                    <div className="field-hint">
                      Baseline warm-up: the known-normal calibration sample is used until the
                      rolling window is full, then the baseline follows recent traffic.
                    </div>
                  </>
                ) : null}
              </div>

              {/* ------------------- live metrics for this card --------------- */}
              <div className="kpi-row">
                <div className="kpi">
                  <div className="k-label">Accuracy</div>
                  <div className="k-value">{percent(m.accuracy, 1)}</div>
                </div>
                <div className="kpi">
                  <div className="k-label">Precision</div>
                  <div className="k-value">{percent(m.precision, 1)}</div>
                </div>
                <div className="kpi">
                  <div className="k-label">Detection</div>
                  <div className="k-value text-blue">{percent(m.recall, 1)}</div>
                </div>
                <div className="kpi">
                  <div className="k-label">FPR</div>
                  <div className="k-value text-orange">{percent(m.fpr, 1)}</div>
                </div>
                <div className="kpi">
                  <div className="k-label">F1</div>
                  <div className="k-value text-green">{percent(m.f1, 2)}</div>
                </div>
                <div className="kpi">
                  <div className="k-label">Time</div>
                  <div className="k-value">{ms(run.durationMs)}</div>
                </div>
              </div>

              <div className="derived-line">
                TP <b className="text-green">{m.tp}</b> · FP{' '}
                <b className="text-orange">{m.fp}</b> · FN <b className="text-red">{m.fn}</b> · TN{' '}
                <b>{m.tn}</b> of {number(m.total)} observations
              </div>
            </section>
          )
        })}
      </div>

      {/* ------------------------ head-to-head table ------------------------ */}
      <SectionCard
        icon={Cpu}
        title="Head-to-head Comparison"
        subtitle="Green cells mark the best value in each column for the current dataset"
        bodyClass="tight"
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Algorithm</th>
                <th>Accuracy</th>
                <th>Precision</th>
                <th>Detection Rate</th>
                <th>False Pos. Rate</th>
                <th>False Neg. Rate</th>
                <th>F1 Score</th>
                <th>Processing Time</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((r) => (
                <tr key={r.key}>
                  <td className="primary">
                    <span
                      className="legend-swatch"
                      style={{
                        background: r.accent,
                        display: 'inline-block',
                        marginRight: 8,
                      }}
                    />
                    {r.name}
                  </td>
                  <td className={`num ${best.accuracy.has(r.key) ? 'best' : ''}`}>
                    {percent(r.metrics.accuracy, 1)}
                  </td>
                  <td className={`num ${best.precision.has(r.key) ? 'best' : ''}`}>
                    {percent(r.metrics.precision, 1)}
                  </td>
                  <td className={`num ${best.recall.has(r.key) ? 'best' : ''}`}>
                    {percent(r.metrics.recall, 1)}
                  </td>
                  <td className={`num ${best.fpr.has(r.key) ? 'best' : ''}`}>
                    {percent(r.metrics.fpr, 1)}
                  </td>
                  <td className={`num ${best.fnr.has(r.key) ? 'best' : ''}`}>
                    {percent(r.metrics.fnr, 1)}
                  </td>
                  <td className={`num ${best.f1.has(r.key) ? 'best' : ''}`}>
                    {percent(r.metrics.f1, 2)}
                  </td>
                  <td className={`num ${best.durationMs.has(r.key) ? 'best' : ''}`}>
                    {ms(r.durationMs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-note">
          Best-in-column highlighting is computed from the actual results — no ranking is
          hard-coded. See the Results page for charts, experiments and the exportable report.
        </div>
      </SectionCard>
    </div>
  )
}
