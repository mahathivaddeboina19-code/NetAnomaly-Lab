/**
 * ---------------------------------------------------------------------------
 * Experiments — the four controlled studies of the research project
 * ---------------------------------------------------------------------------
 * Exp 1: traffic intensity (low/medium/high)
 * Exp 2: anomaly intensity (low/medium/high)
 * Exp 3: anomaly type (burst / port scan / flood / protocol)
 * Exp 4: proposed detector window size (20/50/100 observations)
 *
 * Each panel: run button → seeded datasets → table + grouped bar chart with
 * a metric switcher (Detection Rate / FPR / F1 / Processing Time).
 * ---------------------------------------------------------------------------
 */

import { useState } from 'react'
import {
  Activity,
  BarChart3,
  FlaskConical,
  Info,
  Layers,
  Play,
  Scale,
  Sliders,
  Target,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useApp } from '../state/AppContext.jsx'
import { ALGORITHMS, ALGO_SHORT } from '../core/algorithms.js'
import { SectionCard, EmptyState } from '../components/ui.jsx'
import { Segmented } from '../components/controls.jsx'
import { ChartTooltip } from '../components/ChartTooltip.jsx'
import { ALGO_COLORS, C, axis as axisStyle } from '../utils/chart.js'
import { ms, percent } from '../utils/format.js'

const METRICS = [
  { key: 'recall', label: 'Detection Rate', fmt: percent, axisFmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'fpr', label: 'False Positive Rate', fmt: percent, axisFmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'f1', label: 'F1 Score', fmt: percent, axisFmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'durationMs', label: 'Processing Time', fmt: ms, axisFmt: (v) => `${v.toFixed(1)}` },
]

const valueOf = (row, metricKey) =>
  metricKey === 'durationMs' ? row.durationMs : row.metrics[metricKey]

function ExperimentPanel({
  icon: Icon,
  index,
  title,
  purpose,
  rq,
  groupHeader,
  result,
  onRun,
  isWindowExperiment = false,
  disabled = false,
  disabledHint,
}) {
  const [metricKey, setMetricKey] = useState('recall')
  const metric = METRICS.find((m) => m.key === metricKey)

  /* Build grouped-bar data: one entry per condition, one value per algorithm. */
  const chartData =
    result?.groups?.map((g) => {
      const entry = { name: isWindowExperiment ? `Window ${g}` : g }
      if (isWindowExperiment) {
        const row = result.rows.find((r) => r.window === g)
        entry.value = row ? valueOf(row, metricKey) : 0
      } else {
        for (const algo of ALGORITHMS) {
          const row = result.rows.find((r) => r.group === g && r.algoKey === algo.key)
          entry[algo.key] = row ? valueOf(row, metricKey) : 0
        }
      }
      return entry
    }) || []

  return (
    <SectionCard
      icon={Icon}
      title={title}
      subtitle={purpose}
      actions={
        <>
          <span className="pill info">
            {rq} · {index}
          </span>
          <button className="btn btn-sm btn-primary" onClick={onRun} disabled={disabled}>
            <Play size={13} />
            {result ? 'Re-run' : 'Run experiment'}
          </button>
        </>
      }
    >
      {disabled ? (
        <EmptyState icon={FlaskConical} title="Experiment unavailable" hint={disabledHint} />
      ) : !result ? (
        <EmptyState
          icon={FlaskConical}
          title="Experiment not run yet"
          hint="Press “Run experiment”. Seeded datasets are generated in-browser — no data leaves this page."
        />
      ) : (
        <div className="stack">
          <div className="row-between">
            <span className="small muted">
              Metric shown in chart (table always shows everything):
            </span>
            <Segmented
              options={METRICS.map((m) => ({ value: m.key, label: m.label }))}
              value={metricKey}
              onChange={setMetricKey}
            />
          </div>

          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" {...axisStyle} interval={0} angle={chartData.length > 4 ? -12 : 0} dy={6} />
                <YAxis {...axisStyle} width={46} tickFormatter={metric.axisFmt} />
                <Tooltip
                  cursor={{ fill: 'rgba(148,163,184,0.07)' }}
                  content={
                    <ChartTooltip
                      format={(v) => metric.fmt(v, 1)}
                      title={(label) => label}
                    />
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#9db0d0' }} />
                {isWindowExperiment ? (
                  <Bar dataKey="value" name="Adaptive detector" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={i === 1 ? C.green : 'rgba(34,197,94,0.45)'} />
                    ))}
                  </Bar>
                ) : (
                  ALGORITHMS.map((a) => (
                    <Bar
                      key={a.key}
                      dataKey={a.key}
                      name={a.name}
                      fill={ALGO_COLORS[a.key]}
                      radius={[5, 5, 0, 0]}
                      isAnimationActive={false}
                    />
                  ))
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Algorithm</th>
                  {!isWindowExperiment ? <th>{groupHeader}</th> : <th>Window</th>}
                  <th>Accuracy</th>
                  <th>Precision</th>
                  <th>Detection Rate</th>
                  <th>FPR</th>
                  <th>FNR</th>
                  <th>F1</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r, i) => (
                  <tr key={i}>
                    <td className="primary">
                      {isWindowExperiment ? 'Proposed Adaptive Detector' : r.algoName}
                    </td>
                    <td>{isWindowExperiment ? `${r.window} obs` : r.group}</td>
                    <td className="num">{percent(r.metrics.accuracy, 1)}</td>
                    <td className="num">{percent(r.metrics.precision, 1)}</td>
                    <td className="num">{percent(r.metrics.recall, 1)}</td>
                    <td className="num">{percent(r.metrics.fpr, 1)}</td>
                    <td className="num">{percent(r.metrics.fnr, 1)}</td>
                    <td className="num">{percent(r.metrics.f1, 1)}</td>
                    <td className="num">{ms(r.durationMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

export function Experiments() {
  const { experiments, runExperiment, runAllExperiments, dataset } = useApp()

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h2>Experimental Scenarios</h2>
          <div className="sub">
            Four controlled studies that isolate one variable at a time. Datasets are generated
            with fixed seeds so every run of the study is reproducible.
          </div>
        </div>
        <button className="btn btn-primary" onClick={runAllExperiments}>
          <FlaskConical size={15} />
          Run All Experiments
        </button>
      </div>

      <div className="banner">
        <Info size={15} />
        <span>
          <b>Fairness protocol:</b> the Fixed Threshold keeps your configured threshold (it does
          not recalibrate — that is its defining limitation), the Statistical detector learns
          μ+3σ from each run’s normal sample, and both rolling-window detectors adapt inside the
          run. All four see identical records and identical ground truth.
        </span>
      </div>

      <ExperimentPanel
        icon={Activity}
        index="Experiment 1"
        title="Experiment 1 — Traffic Intensity"
        purpose="Low / medium / high background load with identical medium-strength anomalies (600 observations each)."
        rq="RQ1 · RQ3"
        groupHeader="Traffic Intensity"
        result={experiments.exp1}
        onRun={() => runExperiment('exp1')}
      />

      <ExperimentPanel
        icon={Target}
        index="Experiment 2"
        title="Experiment 2 — Anomaly Intensity"
        purpose="How detection quality degrades as anomalies become subtler (low → high intensity) at medium load."
        rq="RQ1"
        groupHeader="Anomaly Intensity"
        result={experiments.exp2}
        onRun={() => runExperiment('exp2')}
      />

      <ExperimentPanel
        icon={Layers}
        index="Experiment 3"
        title="Experiment 3 — Anomaly Type"
        purpose="One scenario per run: traffic burst, port-scan-like activity, packet flood and protocol distribution anomaly."
        rq="RQ2"
        groupHeader="Anomaly Type"
        result={experiments.exp3}
        onRun={() => runExperiment('exp3')}
      />

      <ExperimentPanel
        icon={Sliders}
        index="Experiment 4"
        title="Experiment 4 — Adaptive Detector Configuration"
        purpose={`Rolling window sizes 20 / 50 / 100 observations for the proposed detector, evaluated on the current dataset${
          dataset ? ` (seed ${dataset.meta.seed})` : ''
        }.`}
        rq="RQ4"
        groupHeader="Window"
        result={experiments.exp4}
        onRun={() => runExperiment('exp4')}
        isWindowExperiment
        disabled={!dataset}
        disabledHint="Generate a traffic dataset first — this experiment evaluates the current trace."
      />

      <SectionCard icon={Scale} title="How to read these results" subtitle="Interpretation guide">
        <div className="grid-3">
          <div className="metric-def">
            <div className="m-name">Detection Rate ↑</div>
            <div className="m-desc">
              Share of real anomalies that were flagged. Higher is better; a detector that misses
              attacks shows a low value here.
            </div>
          </div>
          <div className="metric-def">
            <div className="m-name">False Positive Rate ↓</div>
            <div className="m-desc">
              Share of normal records wrongly flagged. Lower is better — every false alarm costs
              operator attention.
            </div>
          </div>
          <div className="metric-def">
            <div className="m-name">F1 Score ↑</div>
            <div className="m-desc">
              Harmonic mean of precision and recall: the single balanced number to compare
              detectors overall.
            </div>
          </div>
        </div>
        <div className="table-note" style={{ marginTop: 12 }}>
          <BarChart3 size={12} style={{ verticalAlign: '-2px' }} /> Use the metric switcher above
          each chart to switch the plotted measure; the tables always show all metrics.
        </div>
      </SectionCard>
    </div>
  )
}
