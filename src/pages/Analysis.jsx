/**
 * ---------------------------------------------------------------------------
 * Analysis — feature-level inspection of the traffic trace
 * ---------------------------------------------------------------------------
 *  • full-width packets-per-second timeline with ground truth + detections,
 *  • the same timeline for each of the four traffic features,
 *  • a feature statistics table (normal vs anomalous means) that helps
 *    explain *why* a detector did or did not fire.
 * ---------------------------------------------------------------------------
 */

import { useMemo } from 'react'
import { Activity, BarChart3, GitCompare, Layers, LineChart as LineIcon } from 'lucide-react'
import { useApp } from '../state/AppContext.jsx'
import { ALGORITHMS, ALGO_SHORT } from '../core/algorithms.js'
import { SectionCard, EmptyState, StatCard, StatusPill } from '../components/ui.jsx'
import { Segmented } from '../components/controls.jsx'
import { TimelineChart } from '../components/TimelineChart.jsx'
import { compact, FEATURE_LABELS, ms, number, percent } from '../utils/format.js'

const FEATURES = [
  { key: 'pps', label: 'Packets per Second', fmt: (v) => number(Math.round(v)) },
  { key: 'bps', label: 'Bytes per Second', fmt: (v) => compact(v) },
  { key: 'ports', label: 'Unique Destination Ports', fmt: (v) => number(Math.round(v)) },
  { key: 'icmp', label: 'ICMP Ratio', fmt: (v) => percent(v, 1) },
]

function statsFor(values) {
  if (!values.length) return { mean: 0, sd: 0, max: 0 }
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length)
  return { mean, sd, max: Math.max(...values) }
}

export function Analysis() {
  const { dataset, results, activeAlgorithm, setActiveAlgorithm } = useApp()
  const algo = ALGORITHMS.find((a) => a.key === activeAlgorithm)
  const run = results?.[activeAlgorithm]

  const predictions = useMemo(() => run?.preds ?? null, [run])

  const featureStats = useMemo(() => {
    if (!dataset) return []
    const normal = dataset.records.filter((r) => r.label === 0)
    const anomalous = dataset.records.filter((r) => r.label === 1)
    return FEATURES.map((f) => {
      const n = statsFor(normal.map((r) => r[f.key]))
      const a = statsFor(anomalous.map((r) => r[f.key]))
      const all = statsFor(dataset.records.map((r) => r[f.key]))
      return { ...f, n, a, all }
    })
  }, [dataset])

  if (!dataset || !run) {
    return (
      <div className="card">
        <EmptyState
          icon={LineIcon}
          title="Nothing to analyse yet"
          hint="Generate a traffic dataset on the Traffic Simulator page first."
        />
      </div>
    )
  }

  const m = run.metrics

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h2>Traffic Analysis</h2>
          <div className="sub">
            Pick an algorithm to project its alarms onto the timeline. A red dot inside an orange
            ring is a correctly detected anomaly; a lone red dot was missed, a lone ring was a
            false alarm.
          </div>
        </div>
        <div className="row">
          <span className="small muted">Algorithm:</span>
          <Segmented
            options={ALGORITHMS.map((a) => ({ value: a.key, label: ALGO_SHORT[a.key] }))}
            value={activeAlgorithm}
            onChange={setActiveAlgorithm}
          />
        </div>
      </div>

      {/* ------------- selected-detector summary strip ------------- */}
      <div className="grid-stats">
        <StatCard
          label="Detector"
          value={ALGO_SHORT[activeAlgorithm]}
          foot={`${run.durationMs < 100 ? 'lightweight pass' : 'full pass'} · ${number(m.total)} records`}
          icon={GitCompare}
          accent="blue"
        />
        <StatCard
          label="True Positives"
          value={number(m.tp)}
          foot="anomalies correctly flagged"
          icon={Activity}
          accent="green"
        />
        <StatCard
          label="Missed (FN)"
          value={number(m.fn)}
          foot={percent(m.fnr, 1) + ' of actual anomalies'}
          icon={BarChart3}
          accent="red"
        />
        <StatCard
          label="False Alarms (FP)"
          value={number(m.fp)}
          foot={percent(m.fpr, 1) + ' of normal records'}
          icon={Layers}
          accent="orange"
        />
      </div>

      {/* ------------- master traffic timeline ------------- */}
      <SectionCard
        icon={LineIcon}
        title="Traffic Timeline — Packets per Second"
        subtitle={`${algo.name}: ${number(m.tp + m.fp)} alarms across ${number(m.total)} observations`}
        actions={<StatusPill status="info" label={`Dataset seed ${dataset.meta.seed}`} />}
      >
        <TimelineChart
          records={dataset.records}
          predictions={predictions}
          dataKey="pps"
          height={340}
        />
      </SectionCard>

      {/* ------------- per-feature timelines ------------- */}
      <SectionCard
        icon={Layers}
        title="Feature Analysis"
        subtitle="Each traffic feature of the same trace, with the selected detector’s alarms overlaid"
      >
        <div className="grid-2">
          {FEATURES.map((f) => {
            const stats = featureStats.find((s) => s.key === f.key)
            return (
              <div
                key={f.key}
                style={{
                  border: '1px solid var(--line-soft)',
                  borderRadius: 12,
                  padding: '12px 12px 8px',
                  background: 'rgba(8,16,32,0.45)',
                }}
              >
                <div className="row-between" style={{ marginBottom: 4 }}>
                  <span className="field-label">{FEATURE_LABELS[f.key]}</span>
                  <span className="tiny faint">
                    normal μ {f.fmt(stats.n.mean)} · anomaly μ {f.fmt(stats.a.mean)} · max{' '}
                    {f.fmt(stats.all.max)}
                  </span>
                </div>
                <TimelineChart
                  records={dataset.records}
                  predictions={predictions}
                  dataKey={f.key}
                  height={210}
                  valueLabel={f.label}
                  formatValue={f.fmt}
                  showLegend={false}
                />
              </div>
            )
          })}
        </div>
        <div className="legend-custom" style={{ paddingTop: 12 }}>
          <span className="li">
            <span className="legend-line" style={{ background: '#3b82f6' }} /> Normal traffic
          </span>
          <span className="li">
            <span className="legend-swatch" style={{ background: '#ef4444' }} /> Actual anomaly
          </span>
          <span className="li">
            <span
              className="legend-swatch"
              style={{ background: 'transparent', border: '2px solid #f59e0b' }}
            />{' '}
            Detected by {ALGO_SHORT[activeAlgorithm]}
          </span>
        </div>
      </SectionCard>

      {/* ------------- feature statistics table ------------- */}
      <SectionCard
        icon={BarChart3}
        title="Feature Statistics"
        subtitle="How strongly each feature separates normal from anomalous traffic in this trace"
        bodyClass="tight"
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Mean (normal)</th>
                <th>Mean (anomaly)</th>
                <th>Ratio</th>
                <th>Std (all)</th>
                <th>Max</th>
              </tr>
            </thead>
            <tbody>
              {featureStats.map((f) => {
                const ratio = f.n.mean > 0 ? f.a.mean / f.n.mean : 0
                return (
                  <tr key={f.key}>
                    <td className="primary">{FEATURE_LABELS[f.key]}</td>
                    <td className="num">{f.fmt(f.n.mean)}</td>
                    <td className="num">{f.fmt(f.a.mean)}</td>
                    <td className={`num ${ratio >= 2 ? 'best' : ''}`}>
                      {ratio ? `${ratio.toFixed(2)}×` : '—'}
                    </td>
                    <td className="num">{f.fmt(f.all.sd)}</td>
                    <td className="num">{f.fmt(f.all.max)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="table-note">
          Features with a low anomaly/normal ratio (often packet rate alone) explain why
          single-feature detectors miss port-scan and protocol-distribution anomalies — the
          motivation for multi-feature analysis (RQ2).
        </div>
      </SectionCard>
    </div>
  )
}
