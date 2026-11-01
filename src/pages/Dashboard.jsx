/**
 * ---------------------------------------------------------------------------
 * Dashboard — the main operations overview
 * ---------------------------------------------------------------------------
 *  • six headline statistics (driven by the currently selected algorithm),
 *  • a live simulated traffic monitor with a Normal/Warning/Anomaly status,
 *  • recent anomaly alerts,
 *  • traffic distribution summary (normal vs anomaly + per-scenario counts).
 * ---------------------------------------------------------------------------
 */

import { useMemo } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Filter,
  Gauge,
  Pause,
  Play,
  ShieldCheck,
  Target,
  Timer,
  Zap,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useApp } from '../state/AppContext.jsx'
import { useLiveTraffic } from '../state/useLiveTraffic.js'
import { scoreAgainstHistory, ALGORITHMS, ALGO_SHORT } from '../core/algorithms.js'
import { StatCard, SectionCard, StatusPill, EmptyState } from '../components/ui.jsx'
import { Segmented } from '../components/controls.jsx'
import { ChartTooltip } from '../components/ChartTooltip.jsx'
import { C, ALGO_COLORS, STATUS_COLORS, tickCompact } from '../utils/chart.js'
import { compact, dateTime, number, percent, ms, timeOfDay } from '../utils/format.js'

const EVIDENCE_NAMES = {
  pps: 'packet rate',
  bps: 'byte rate',
  ports: 'unique ports',
  icmp: 'ICMP ratio',
}

export function Dashboard({ navigate }) {
  const {
    dataset,
    results,
    comparison,
    activeAlgorithm,
    setActiveAlgorithm,
    config,
  } = useApp()

  const algo = ALGORITHMS.find((a) => a.key === activeAlgorithm)
  const run = results?.[activeAlgorithm]
  const metrics = run?.metrics

  /* ---------------- live simulated feed ---------------- */
  const live = useLiveTraffic(config)

  const liveData = useMemo(() => {
    // Score every live point against the history up to that moment so the
    // feed shows detected (orange ring) anomalies like the offline charts.
    return live.points.map((p, i) => ({
      i,
      time: timeOfDay(p.t),
      value: p.pps,
      actual: p.label === 1 ? p.pps : null,
      detected:
        i >= 15 && scoreAgainstHistory(live.points.slice(0, i + 1), 3.5, 60).status === 'anomaly'
          ? p.pps
          : null,
    }))
  }, [live.points])

  /* ---------------- alerts from the current dataset ---------------- */
  const alerts = useMemo(() => {
    if (!dataset || !run) return []
    const out = []
    for (let i = dataset.records.length - 1; i >= 0 && out.length < 7; i--) {
      if (run.preds[i] === 1) {
        const r = dataset.records[i]
        out.push({
          i,
          record: r,
          isTruePositive: r.label === 1,
          evidence: run.evidence?.[i],
        })
      }
    }
    return out
  }, [dataset, run])

  /* ---------------- distribution summary ---------------- */
  const donutData = useMemo(() => {
    if (!dataset) return []
    const { normalCount, anomalyCount } = dataset.meta
    return [
      { name: 'Normal traffic', value: normalCount, color: C.blue },
      { name: 'Detected anomalies', value: anomalyCount, color: C.red },
    ]
  }, [dataset])

  const scenarioBars = useMemo(() => {
    if (!dataset) return []
    const counts = dataset.meta.scenarioCounts
    const palette = {
      Normal: C.blue,
      'Traffic Burst': '#f97316',
      'Port-Scan-Like Activity': C.purple,
      'Packet Flood': C.red,
      'Protocol Distribution Anomaly': C.orange,
    }
    const total = dataset.meta.observations || 1
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        count,
        share: count / total,
        color: palette[name] || C.slate,
      }))
  }, [dataset])

  /* ---------------- empty state ---------------- */
  if (!dataset || !comparison) {
    return (
      <div className="card">
        <EmptyState
          icon={Gauge}
          title="No traffic dataset yet"
          hint="Generate a simulated traffic dataset to populate the dashboard."
          action={
            <button className="btn btn-primary" onClick={() => navigate('/simulator')}>
              Open Traffic Simulator
            </button>
          }
        />
      </div>
    )
  }

  const statusLabel =
    live.verdict.status === 'anomaly'
      ? 'Anomaly'
      : live.verdict.status === 'warning'
        ? 'Warning'
        : 'Normal'
  const statusColor = STATUS_COLORS[live.verdict.status] || C.green

  return (
    <div className="stack">
      {/* page heading + algorithm selector */}
      <div className="page-head">
        <div>
          <h2>Network Operations Overview</h2>
          <div className="sub">
            Simulated traffic is scored continuously by the four detectors. All figures below
            update whenever you regenerate data or change an algorithm parameter.
          </div>
        </div>
        <div className="row">
          <span className="small muted">Detector:</span>
          <Segmented
            options={ALGORITHMS.map((a) => ({ value: a.key, label: ALGO_SHORT[a.key] }))}
            value={activeAlgorithm}
            onChange={setActiveAlgorithm}
          />
        </div>
      </div>

      {/* ---------------- six headline statistic cards ---------------- */}
      <div className="grid-stats">
        <StatCard
          label="Total Observations"
          value={number(dataset.meta.observations)}
          foot={`Seed ${dataset.meta.seed} · generated ${dateTime(dataset.meta.generatedAt.getTime())}`}
          icon={Activity}
          accent="blue"
        />
        <StatCard
          label="Normal Traffic"
          value={number(dataset.meta.normalCount)}
          foot={`${percent(dataset.meta.normalCount / dataset.meta.observations, 1)} labelled normal`}
          icon={ShieldCheck}
          accent="green"
        />
        <StatCard
          label="Detected Anomalies"
          value={number(metrics ? metrics.tp + metrics.fp : 0)}
          foot={`${ALGO_SHORT[activeAlgorithm]} detector · ${metrics ? metrics.tp : 0} confirmed correct`}
          icon={AlertTriangle}
          accent="red"
        />
        <StatCard
          label="Detection Rate"
          value={percent(metrics?.recall ?? 0, 1)}
          foot={`TP ${metrics?.tp ?? 0} / ${((metrics?.tp ?? 0) + (metrics?.fn ?? 0))} actual anomalies`}
          icon={Target}
          accent="blue"
        />
        <StatCard
          label="False Positive Rate"
          value={percent(metrics?.fpr ?? 0, 1)}
          foot={`FP ${metrics?.fp ?? 0} of ${((metrics?.fp ?? 0) + (metrics?.tn ?? 0))} normal records`}
          icon={Filter}
          accent="orange"
        />
        <StatCard
          label="Processing Time"
          value={ms(run?.durationMs ?? 0)}
          foot={`${algo.name} · median of repeated runs`}
          icon={Timer}
          accent="purple"
        />
      </div>

      {/* ---------------- live monitor + current status ---------------- */}
      <div className="split-main">
        <SectionCard
          icon={Zap}
          title="Live Traffic Monitor"
          subtitle="Simulated real-time feed · one observation per second of wall time"
          actions={
            <button className="btn btn-sm" onClick={live.togglePause}>
              {live.paused ? <Play size={13} /> : <Pause size={13} />}
              {live.paused ? 'Resume' : 'Pause'}
            </button>
          }
        >
          <div style={{ width: '100%', height: 270 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={liveData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <XAxis
                  dataKey="i"
                  tick={{ fill: C.axis, fontSize: 11 }}
                  axisLine={{ stroke: C.axisLine }}
                  tickLine={false}
                  tickFormatter={(i) => liveData[i]?.time ?? ''}
                  interval={Math.max(1, Math.floor(liveData.length / 6))}
                />
                <YAxis
                  tick={{ fill: C.axis, fontSize: 11 }}
                  axisLine={{ stroke: C.axisLine }}
                  tickLine={false}
                  width={48}
                  tickFormatter={tickCompact}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(59,130,246,0.06)' }}
                  content={
                    <ChartTooltip
                      format={(v) => `${number(Math.round(v))} pps`}
                      title={(_, payload) => payload?.[0]?.payload?.time}
                    />
                  }
                />
                <Bar dataKey="value" name="Packets/s" fill={C.blue} isAnimationActive={false}>
                  {liveData.map((d, i) => (
                    <Cell
                      key={i}
                      fill={
                        d.detected
                          ? C.orange
                          : d.actual
                            ? C.red
                            : 'rgba(59,130,246,0.85)'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="legend-custom">
            <span className="li">
              <span className="legend-swatch" style={{ background: C.blue }} /> Normal
            </span>
            <span className="li">
              <span className="legend-swatch" style={{ background: C.red }} /> Actual anomaly
            </span>
            <span className="li">
              <span className="legend-swatch" style={{ background: C.orange }} /> Detected
            </span>
            <span className="li faint">last: {live.latest ? `${number(live.latest.pps)} pps` : '—'}</span>
          </div>
        </SectionCard>

        <SectionCard icon={Gauge} title="Current Network Status" subtitle="Rolling robust baseline (median / MAD)">
          <div className="status-hero">
            <span
              className="status-word"
              style={{ color: statusColor, textShadow: `0 0 24px ${statusColor}55` }}
            >
              {statusLabel}
            </span>
            <StatusPill status={live.verdict.status} label={`Live · ${statusLabel}`} pulse />
            <div className="status-note">
              {live.verdict.worst
                ? `${live.verdict.worst.label} is ${live.verdict.worst.z.toFixed(1)}× the rolling baseline (k = 3.5).`
                : 'Collecting baseline observations…'}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="readout">
              <span className="r-label">Packets per second</span>
              <span className="r-val">
                {live.latest ? number(live.latest.pps) : '—'}
                {live.verdict.baseline ? (
                  <span className="faint"> / {number(Math.round(live.verdict.baseline.pps.med))}</span>
                ) : null}
              </span>
            </div>
            <div className="readout">
              <span className="r-label">Bytes per second</span>
              <span className="r-val">
                {live.latest ? compact(live.latest.bps) : '—'}
                {live.verdict.baseline ? (
                  <span className="faint"> / {compact(Math.round(live.verdict.baseline.bps.med))}</span>
                ) : null}
              </span>
            </div>
            <div className="readout">
              <span className="r-label">Unique destination ports</span>
              <span className="r-val">
                {live.latest ? number(live.latest.ports) : '—'}
                {live.verdict.baseline ? (
                  <span className="faint"> / {number(Math.round(live.verdict.baseline.ports.med))}</span>
                ) : null}
              </span>
            </div>
            <div className="readout">
              <span className="r-label">ICMP ratio</span>
              <span className="r-val">
                {live.latest ? percent(live.latest.icmp, 1) : '—'}
                {live.verdict.baseline ? (
                  <span className="faint"> / {percent(live.verdict.baseline.icmp.med, 1)}</span>
                ) : null}
              </span>
            </div>
          </div>
          <div className="field-hint" style={{ marginTop: 8 }}>
            Values show <b>current / rolling median</b> for each feature.
          </div>
        </SectionCard>
      </div>

      {/* ---------------- alerts + distribution ---------------- */}
      <div className="grid-2">
        <SectionCard
          icon={AlertTriangle}
          title="Recent Anomaly Alerts"
          subtitle={`Raised by: ${algo.name} · newest first`}
          actions={
            <button className="btn btn-sm btn-ghost" onClick={() => navigate('/analysis')}>
              Inspect →
            </button>
          }
        >
          {alerts.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No alarms raised"
              hint="The selected detector has not flagged any observation in the current dataset."
            />
          ) : (
            <div className="alert-list">
              {alerts.map((a) => (
                <div
                  key={a.i}
                  className={`alert-item ${a.isTruePositive ? 'anomaly' : 'warning'}`}
                >
                  <div className="alert-icon">
                    <AlertTriangle size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="alert-title">
                      {a.isTruePositive ? a.record.scenario : 'False alarm (normal traffic)'}
                    </div>
                    <div className="alert-meta">
                      {timeOfDay(a.record.t)} · index #{a.i} · {number(a.record.pps)} pps ·{' '}
                      {compact(a.record.bps)} B/s · {a.record.ports} ports ·{' '}
                      {percent(a.record.icmp, 1)} ICMP
                      {a.evidence
                        ? ` · triggered by ${EVIDENCE_NAMES[a.evidence] || a.evidence}`
                        : ''}
                    </div>
                  </div>
                  <StatusPill status={a.isTruePositive ? 'anomaly' : 'warning'} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          icon={BarChart3}
          title="Traffic Distribution Summary"
          subtitle="Ground-truth composition of the current dataset"
        >
          <div className="grid" style={{ gridTemplateColumns: '170px minmax(0,1fr)', gap: 14 }}>
            <div style={{ height: 170 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={44}
                    outerRadius={72}
                    paddingAngle={3}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {donutData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip format={(v) => number(v)} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ alignSelf: 'center' }}>
              {donutData.map((d) => (
                <div className="scenario-bar" key={d.name}>
                  <span className="name" style={{ minWidth: 0 }}>
                    <span
                      className="legend-swatch"
                      style={{ background: d.color, display: 'inline-block', marginRight: 7 }}
                    />
                    {d.name}
                  </span>
                  <span className="val">{number(d.value)}</span>
                </div>
              ))}
              <div className="field-hint" style={{ marginTop: 6 }}>
                Anomaly rate in this trace:{' '}
                <b className="text-red">{percent(dataset.meta.anomalyRate, 1)}</b>
              </div>
            </div>
          </div>

          <div className="divider" style={{ margin: '14px 0 10px' }} />
          <div className="field-label" style={{ marginBottom: 6 }}>
            Scenario breakdown
          </div>
          {scenarioBars.map((s) => (
            <div className="scenario-bar" key={s.name}>
              <span className="name">{s.name}</span>
              <span className="track">
                <span
                  className="fill"
                  style={{ width: `${Math.max(2, s.share * 100)}%`, background: s.color }}
                />
              </span>
              <span className="val">
                {number(s.count)} · {percent(s.share, 1)}
              </span>
            </div>
          ))}
        </SectionCard>
      </div>

      {/* ---------------- compact four-algorithm snapshot ---------------- */}
      <SectionCard
        icon={Gauge}
        title="Algorithm Snapshot"
        subtitle="Same dataset, same ground truth — results update live with your parameters"
        actions={
          <button className="btn btn-sm" onClick={() => navigate('/results')}>
            Full comparison →
          </button>
        }
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
                <th>FPR</th>
                <th>F1</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((r) => (
                <tr key={r.key}>
                  <td className="primary">
                    <span
                      className="legend-swatch"
                      style={{
                        background: ALGO_COLORS[r.key],
                        display: 'inline-block',
                        marginRight: 8,
                      }}
                    />
                    {r.name}
                    {r.key === activeAlgorithm ? (
                      <span className="pill info" style={{ marginLeft: 8, padding: '1px 8px' }}>
                        viewing
                      </span>
                    ) : null}
                  </td>
                  <td className="num">{percent(r.metrics.accuracy, 1)}</td>
                  <td className="num">{percent(r.metrics.precision, 1)}</td>
                  <td className="num">{percent(r.metrics.recall, 1)}</td>
                  <td className="num">{percent(r.metrics.fpr, 1)}</td>
                  <td className="num">{percent(r.metrics.f1, 2)}</td>
                  <td className="num">{ms(r.durationMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}
