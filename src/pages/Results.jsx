/**
 * ---------------------------------------------------------------------------
 * Results & Report — the "algorithm comparison page" of the project
 * ---------------------------------------------------------------------------
 *  • full performance-comparison table (best value highlighted),
 *  • four comparison charts: detection rate, FPR, F1, processing time,
 *  • a dynamically written summary of the actual findings,
 *  • CSV export of the comparison + all four experiments,
 *  • limitations section.
 * ---------------------------------------------------------------------------
 */

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Download,
  FileText,
  Info,
  Scale,
  Target,
  Timer,
  Trophy,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useApp } from '../state/AppContext.jsx'
import { ALGORITHMS, ALGO_SHORT } from '../core/algorithms.js'
import { SectionCard, EmptyState } from '../components/ui.jsx'
import { ChartTooltip } from '../components/ChartTooltip.jsx'
import { ALGO_COLORS, C, axis as axisStyle } from '../utils/chart.js'
import { ms, number, percent } from '../utils/format.js'
import { buildResultsCsv, downloadCsv } from '../utils/exportCsv.js'

/* ------------------------- small bar-chart helper -------------------------- */
function MetricBarChart({ comparison, metricKey, title, subtitle, format, axisFormat, height = 250 }) {
  const data = comparison.map((r) => ({
    name: ALGO_SHORT[r.key],
    key: r.key,
    value: metricKey === 'durationMs' ? r.durationMs : r.metrics[metricKey],
  }))

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" {...axisStyle} interval={0} dy={6} />
          <YAxis {...axisStyle} width={46} tickFormatter={axisFormat} />
          <Tooltip
            cursor={{ fill: 'rgba(148,163,184,0.07)' }}
            content={<ChartTooltip format={(v) => format(v, 1)} title={() => title} />}
          />
          <Bar dataKey="value" name={title} radius={[6, 6, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.key} fill={ALGO_COLORS[d.key]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="tiny faint" style={{ textAlign: 'center', marginTop: -4 }}>
        {subtitle}
      </div>
    </div>
  )
}

/* --------------------------- best-value helpers ---------------------------- */
function bestOf(comparison, pick, rule = 'max') {
  let best = null
  for (const r of comparison) {
    const v = pick(r)
    if (best === null || (rule === 'max' ? v > best.value : v < best.value)) {
      best = { key: r.key, name: r.name, value: v }
    }
  }
  return best
}

export function Results() {
  const { dataset, comparison, experiments, runExperiment } = useApp()
  const [exportedAt, setExportedAt] = useState(null)

  const ranks = useMemo(() => {
    if (!comparison) return null
    const byF1 = [...comparison].sort((a, b) => b.metrics.f1 - a.metrics.f1)
    const byRecall = bestOf(comparison, (r) => r.metrics.recall, 'max')
    const byFpr = bestOf(comparison, (r) => r.metrics.fpr, 'min')
    const byAcc = bestOf(comparison, (r) => r.metrics.accuracy, 'max')
    const fastest = bestOf(comparison, (r) => r.durationMs, 'min')
    const slowest = bestOf(comparison, (r) => r.durationMs, 'max')
    const adaptive = comparison.find((r) => r.key === 'adaptive')
    const overhead = fastest.value > 0 ? adaptive.durationMs / fastest.value : 0
    return { byF1, byRecall, byFpr, byAcc, fastest, slowest, adaptive, overhead }
  }, [comparison])

  if (!comparison || !ranks) {
    return (
      <div className="card">
        <EmptyState
          icon={FileText}
          title="No results yet"
          hint="Generate traffic data — the four detectors run automatically and populate this report."
        />
      </div>
    )
  }

  const handleExport = () => {
    const csv = buildResultsCsv({
      meta: dataset?.meta,
      comparison,
      experiments,
    })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    downloadCsv(`netanomaly_results_${stamp}.csv`, csv)
    setExportedAt(new Date())
  }

  const adaptiveRank = ranks.byF1.findIndex((r) => r.key === 'adaptive') + 1
  const expCount = ['exp1', 'exp2', 'exp3', 'exp4'].filter((k) => experiments[k]).length

  const LIMITATIONS = [
    {
      icon: Info,
      title: 'Simulated traffic data',
      text: 'The initial traffic data is generated synthetically inside the browser. No real network capture (PCAP) is analysed by this prototype.',
    },
    {
      icon: SlidersIcon,
      title: 'Parameter-dependent results',
      text: 'Results depend on the selected simulation parameters — observation count, traffic intensity, anomaly intensity, anomaly mix and the random seed.',
    },
    {
      icon: AlertTriangle,
      title: 'Synthetic ≠ real world',
      text: 'Synthetic traffic cannot fully represent all real-world network behaviour: background diversity, encrypted application mixes and novel attack strategies are simplified.',
    },
    {
      icon: BookOpen,
      title: 'Academic demonstration',
      text: 'The system is designed as an academic demonstration and research prototype, not as a production intrusion-prevention system.',
    },
  ]

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h2>Results &amp; Report</h2>
          <div className="sub">
            Complete performance comparison of the four detectors on the current dataset, plus
            whatever experiments you have run. Every number below is computed live from the
            simulation — nothing is pre-recorded.
          </div>
        </div>
        <div className="row">
          <span className="pill neutral">
            {expCount}/4 experiments run
          </span>
          <button className="btn btn-success" onClick={handleExport}>
            <Download size={15} />
            Export Experimental Results
          </button>
        </div>
      </div>

      {exportedAt ? (
        <div className="banner">
          <CheckCircle2 size={15} />
          <span>
            CSV downloaded at {exportedAt.toLocaleTimeString()} — it contains the dataset
            description, this comparison table and all {expCount}/4 experiment result sets
            (unrun experiments are marked “Experiment not run”).
          </span>
        </div>
      ) : null}

      {/* ---------------------- comparison table ---------------------- */}
      <SectionCard
        icon={TableIcon}
        title="Performance Comparison Table"
        subtitle={`Four algorithms · ${number(dataset.meta.observations)} observations · seed ${dataset.meta.seed} · best value in each column marked green`}
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
                <th>False Positive Rate</th>
                <th>False Negative Rate</th>
                <th>F1 Score</th>
                <th>Processing Time</th>
                <th>TP / FP / FN / TN</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((r) => {
                const bestF1 = ranks.byF1[0]?.key === r.key
                return (
                  <tr key={r.key}>
                    <td className="primary">
                      <span
                        className="legend-swatch"
                        style={{ background: r.accent, display: 'inline-block', marginRight: 8 }}
                      />
                      {r.name}
                      {bestF1 ? (
                        <span className="badge" style={{ marginLeft: 8 }}>
                          best F1
                        </span>
                      ) : null}
                    </td>
                    <td className={`num ${r.key === ranks.byAcc.key ? 'best' : ''}`}>
                      {percent(r.metrics.accuracy, 1)}
                    </td>
                    <td className="num">{percent(r.metrics.precision, 1)}</td>
                    <td className={`num ${r.key === ranks.byRecall.key ? 'best' : ''}`}>
                      {percent(r.metrics.recall, 1)}
                    </td>
                    <td className={`num ${r.key === ranks.byFpr.key ? 'best' : ''}`}>
                      {percent(r.metrics.fpr, 1)}
                    </td>
                    <td className="num">{percent(r.metrics.fnr, 1)}</td>
                    <td className={`num ${bestF1 ? 'best' : ''}`}>
                      {percent(r.metrics.f1, 2)}
                    </td>
                    <td className={`num ${r.key === ranks.fastest.key ? 'best' : ''}`}>
                      {ms(r.durationMs)}
                    </td>
                    <td className="num faint">
                      {r.metrics.tp} / {r.metrics.fp} / {r.metrics.fn} / {r.metrics.tn}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="table-note">
          Green = best in column (computed from these results). Processing time is the median of
          repeated in-memory passes over the dataset.
        </div>
      </SectionCard>

      {/* ---------------------- four comparison charts ---------------------- */}
      <div className="grid-2">
        <SectionCard icon={Target} title="Detection Rate" subtitle="Higher is better — real anomalies caught">
          <MetricBarChart
            comparison={comparison}
            metricKey="recall"
            title="Detection Rate"
            subtitle="TP / (TP + FN)"
            format={percent}
            axisFormat={(v) => `${Math.round(v * 100)}%`}
          />
        </SectionCard>

        <SectionCard icon={AlertTriangle} title="False Positive Rate" subtitle="Lower is better — false alarms on normal traffic">
          <MetricBarChart
            comparison={comparison}
            metricKey="fpr"
            title="False Positive Rate"
            subtitle="FP / (FP + TN)"
            format={percent}
            axisFormat={(v) => `${Math.round(v * 100)}%`}
          />
        </SectionCard>

        <SectionCard icon={Trophy} title="F1 Score" subtitle="Balanced precision/recall — higher is better">
          <MetricBarChart
            comparison={comparison}
            metricKey="f1"
            title="F1 Score"
            subtitle="2 · precision · recall / (precision + recall)"
            format={percent}
            axisFormat={(v) => `${Math.round(v * 100)}%`}
          />
        </SectionCard>

        <SectionCard icon={Timer} title="Processing Time" subtitle="Median wall-clock time for one full pass (ms)">
          <MetricBarChart
            comparison={comparison}
            metricKey="durationMs"
            title="Processing Time"
            subtitle="lower = lighter computational overhead"
            format={(v) => ms(v)}
            axisFormat={(v) => `${v.toFixed(v < 10 ? 1 : 0)}`}
          />
        </SectionCard>
      </div>

      {/* ---------------------- dynamic findings ---------------------- */}
      <SectionCard icon={BarChart3} title="Algorithm Comparison Summary" subtitle="Generated from the actual numbers above">
        <div className="prose" style={{ display: 'grid', gap: 10 }}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <span className="pill info">Best overall (F1)</span>
            <span>
              <b>{ranks.byF1[0].name}</b> achieves the highest F1 score of{' '}
              <b>{percent(ranks.byF1[0].metrics.f1, 1)}</b> on this dataset (detection rate{' '}
              {percent(ranks.byF1[0].metrics.recall, 1)}, false-positive rate{' '}
              {percent(ranks.byF1[0].metrics.fpr, 1)}).
            </span>
          </div>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <span className="pill info">Best detection rate</span>
            <span>
              <b>{ranks.byRecall.name}</b> catches {percent(ranks.byRecall.value, 1)} of injected
              anomalies; the most conservative detector is <b>{ranks.byFpr.name}</b> with a false
              positive rate of {percent(ranks.byFpr.value, 1)}.
            </span>
          </div>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <span className="pill info">Proposed detector</span>
            <span>
              The <b>Proposed Adaptive Detector</b> ranks <b>#{adaptiveRank}</b> of 4 by F1 on
              this trace ({percent(ranks.adaptive.metrics.f1, 1)}), with detection rate{' '}
              {percent(ranks.adaptive.metrics.recall, 1)} and FPR{' '}
              {percent(ranks.adaptive.metrics.fpr, 1)}.
            </span>
          </div>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <span className="pill info">Computational overhead</span>
            <span>
              The fastest detector is <b>{ranks.fastest.name}</b> ({ms(ranks.fastest.value)}); the
              proposed detector runs in {ms(ranks.adaptive.durationMs)} — about{' '}
              <b>{ranks.overhead.toFixed(1)}×</b> the fastest baseline while scoring four features
              instead of one.
            </span>
          </div>
        </div>
        <div className="table-note" style={{ marginTop: 12 }}>
          Regenerate data or change parameters and these sentences recompute — they always
          describe the results currently on screen.
        </div>
      </SectionCard>

      {/* ---------------------- experiments summary ---------------------- */}
      <SectionCard
        icon={FlaskIcon}
        title="Experimental Results"
        subtitle="Summary of the four controlled studies (run them on the Experiments page)"
        actions={
          <button className="btn btn-sm" onClick={() => runExperiment('exp1')} disabled={!dataset}>
            Quick-run Exp 1
          </button>
        }
        bodyClass="tight"
      >
        {expCount === 0 ? (
          <EmptyState
            icon={FlaskIcon}
            title="No experiments run yet"
            hint="Open the Experiments page and run one or more studies — their results will be included in the CSV export."
            action={
              <button className="btn btn-primary btn-sm" onClick={() => (window.location.hash = '/experiments')}>
                Go to Experiments
              </button>
            }
          />
        ) : (
          <div className="grid-4">
            {[
              ['Experiment 1', 'Traffic Intensity', experiments.exp1],
              ['Experiment 2', 'Anomaly Intensity', experiments.exp2],
              ['Experiment 3', 'Anomaly Type', experiments.exp3],
              ['Experiment 4', 'Adaptive Window', experiments.exp4],
            ].map(([label, name, res]) => (
              <div className="metric-def" key={label}>
                <div className="m-name">{name}</div>
                {res ? (
                  <>
                    <div className="m-formula">{res.rows.length} result rows</div>
                    <div className="m-desc">
                      Best F1 in study:{' '}
                      <b>
                        {label === 'Experiment 4'
                          ? `window ${[...res.rows].sort((a, b) => b.metrics.f1 - a.metrics.f1)[0].window}`
                          : [...res.rows].sort((a, b) => b.metrics.f1 - a.metrics.f1)[0].algoName}
                      </b>
                    </div>
                  </>
                ) : (
                  <div className="m-desc">Not run yet.</div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ---------------------- limitations ---------------------- */}
      <SectionCard icon={Scale} title="Limitations" subtitle="Scope and validity constraints of this study">
        <div className="grid-2">
          {LIMITATIONS.map((l) => {
            const Icon = l.icon
            return (
              <div className="rq-card" key={l.title}>
                <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
                  <span className="stat-icon" style={{ '--accent': '#f59e0b', '--accent-soft': 'rgba(245,158,11,.14)' }}>
                    <Icon size={15} />
                  </span>
                  <div>
                    <div className="rq-text" style={{ fontWeight: 650 }}>{l.title}</div>
                    <div className="m-desc" style={{ marginTop: 5 }}>{l.text}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </SectionCard>
    </div>
  )
}

/* local icon aliases kept out of the main import list for readability */
function TableIcon(props) {
  return <BarChart3 {...props} />
}
function FlaskIcon(props) {
  return <Target {...props} />
}
function SlidersIcon(props) {
  return <Info {...props} />
}
