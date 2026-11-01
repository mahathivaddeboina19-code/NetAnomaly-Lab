/**
 * ---------------------------------------------------------------------------
 * Methodology — the academic backbone of the project
 * ---------------------------------------------------------------------------
 * Problem statement, research gap, proposed solution, the four research
 * questions, the evaluation metrics and the end-to-end study pipeline.
 * ---------------------------------------------------------------------------
 */

import {
  ArrowRight,
  BookOpen,
  HelpCircle,
  Lightbulb,
  Microscope,
  Scale,
  Target,
  Zap,
} from 'lucide-react'
import { SectionCard } from '../components/ui.jsx'

const PIPELINE = [
  { n: '01', t: 'Real-world Problem', d: 'Traffic spikes, scans, floods & protocol shifts signal trouble' },
  { n: '02', t: 'Traffic Simulation', d: 'Labelled synthetic traces with adjustable intensity' },
  { n: '03', t: 'Feature Analysis', d: 'pps, bps, unique ports, ICMP ratio' },
  { n: '04', t: 'Four Algorithms', d: 'Fixed, moving-average, statistical, proposed adaptive' },
  { n: '05', t: 'Experiments', d: 'Intensity, anomaly mix, detector configuration' },
  { n: '06', t: 'Performance Metrics', d: 'Recall, FPR, FNR, precision, F1, time' },
  { n: '07', t: 'Research Findings', d: 'Comparison, limitations, exportable report' },
]

const RESEARCH_QUESTIONS = [
  {
    id: 'RQ1',
    text: 'How do fixed-threshold, moving-average, statistical, and adaptive methods compare in detecting network anomalies?',
    how: 'Experiment 1 & 2 plus the main comparison table.',
  },
  {
    id: 'RQ2',
    text: 'Does multi-feature analysis improve the detection of anomalies that do not significantly increase packet rate?',
    how: 'Experiment 3 (port-scan & protocol-distribution scenarios) + feature statistics.',
  },
  {
    id: 'RQ3',
    text: 'How does the adaptive detector perform when normal network traffic patterns change?',
    how: 'Experiment 1 across low/medium/high traffic intensity.',
  },
  {
    id: 'RQ4',
    text: 'What processing overhead does the proposed detector introduce compared with baseline methods?',
    how: 'Processing-time column everywhere + Experiment 4 window sizes.',
  },
]

const METRIC_DEFS = [
  {
    name: 'Detection Rate (Recall)',
    formula: 'TP / (TP + FN)',
    desc: 'Fraction of real anomalies the detector catches. Also called true-positive rate or sensitivity.',
  },
  {
    name: 'False Positive Rate',
    formula: 'FP / (FP + TN)',
    desc: 'Fraction of normal records wrongly flagged as anomalous — the cost of alert fatigue.',
  },
  {
    name: 'False Negative Rate',
    formula: 'FN / (FN + TP)',
    desc: 'Fraction of real anomalies missed. FNR = 1 − Detection Rate.',
  },
  {
    name: 'Precision',
    formula: 'TP / (TP + FP)',
    desc: 'Of all alarms raised, how many were correct.',
  },
  {
    name: 'Recall',
    formula: 'TP / (TP + FN)',
    desc: 'Same quantity as Detection Rate; reported here under its standard name.',
  },
  {
    name: 'F1 Score',
    formula: '2 · precision · recall / (precision + recall)',
    desc: 'Harmonic mean of precision and recall — a single balanced score for ranking detectors.',
  },
  {
    name: 'Processing Time',
    formula: 'median( t_detect ) over 3 runs',
    desc: 'Wall-clock time for one full pass over the dataset — the lightweight-overhead measure (RQ4).',
  },
  {
    name: 'Accuracy',
    formula: '(TP + TN) / (TP + TN + FP + FN)',
    desc: 'Overall correctness. Can be misleading when anomalies are rare, so it is reported alongside F1.',
  },
]

export function Methodology() {
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h2>Research &amp; Methodology</h2>
          <div className="sub">
            This page documents the academic framing of the mini-project: what problem is being
            studied, what is missing in existing approaches, what is proposed, and how it is
            evaluated.
          </div>
        </div>
      </div>

      {/* ------------------------- study pipeline ------------------------- */}
      <SectionCard
        icon={Zap}
        title="Study Pipeline"
        subtitle="The story this application tells, from problem to findings"
      >
        <div className="flow">
          {PIPELINE.map((s, i) => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'stretch', gap: 8, flex: 1, minWidth: 0 }}>
              <div className="flow-step" style={{ flex: 1, minWidth: 132 }}>
                <div className="n">{s.n}</div>
                <div className="t">{s.t}</div>
                <div className="d">{s.d}</div>
              </div>
              {i < PIPELINE.length - 1 ? (
                <div className="flow-arrow">
                  <ArrowRight size={14} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid-2">
        {/* ---------------------- problem statement ---------------------- */}
        <SectionCard icon={Target} title="Problem Statement">
          <p className="prose">
            Abnormal network traffic patterns can indicate network failures or security
            incidents. Sudden traffic bursts, port-scanning sweeps, packet floods and unusual
            protocol mixes all leave statistical fingerprints in ordinary flow measurements.
          </p>
          <p className="prose" style={{ marginTop: 10 }}>
            Traditional <strong>fixed thresholds</strong> may not adapt well to changing network
            conditions and may <strong>miss anomalies that affect features other than packet
            volume</strong> — a port scan barely changes packets-per-second while completely
            distorting the destination-port distribution.
          </p>
        </SectionCard>

        {/* ------------------------- research gap ------------------------ */}
        <SectionCard icon={Microscope} title="Research Gap">
          <p className="prose">
            Single-feature and fixed-threshold approaches may not adapt effectively to changing
            traffic patterns, and they are structurally blind to anomalies that manifest in
            other dimensions:
          </p>
          <ul className="prose" style={{ marginTop: 10, paddingLeft: 18, display: 'grid', gap: 6 }}>
            <li>Static thresholds over-fire during busy hours and under-fire at night.</li>
            <li>Port-scan activity is invisible to packet-rate-only detectors.</li>
            <li>Protocol-distribution shifts (e.g. ICMP flooding) do not raise volume much.</li>
            <li>Means and standard deviations are dragged around by the very anomalies a detector should catch.</li>
          </ul>
        </SectionCard>

        {/* ---------------------- proposed solution ---------------------- */}
        <SectionCard icon={Lightbulb} title="Proposed Solution">
          <p className="prose">
            A <strong>lightweight adaptive multi-feature anomaly detection approach</strong> that
            uses historical traffic behaviour and robust statistical techniques:
          </p>
          <ul className="prose" style={{ marginTop: 10, paddingLeft: 18, display: 'grid', gap: 6 }}>
            <li>
              A <strong>rolling baseline</strong> of recent observations instead of one global
              threshold — the detector follows load changes.
            </li>
            <li>
              <strong>Robust statistics (median &amp; median absolute deviation)</strong> so that
              earlier anomalies cannot poison the baseline.
            </li>
            <li>
              <strong>Four features</strong> analysed together: packets/s, bytes/s, unique
              destination ports and ICMP ratio.
            </li>
            <li>
              Per-feature normalisation (robust z-score) lets one lightweight rule cover features
              with completely different units and scales.
            </li>
          </ul>
        </SectionCard>

        {/* ------------------------ research questions ------------------- */}
        <SectionCard icon={HelpCircle} title="Research Questions">
          <div className="stack" style={{ gap: 10 }}>
            {RESEARCH_QUESTIONS.map((rq) => (
              <div className="rq-card" key={rq.id}>
                <span className="rq-id">{rq.id}</span>
                <div className="rq-text">{rq.text}</div>
                <div className="m-desc" style={{ marginTop: 6 }}>
                  <b>Where it is answered:</b> {rq.how}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* ------------------------- evaluation metrics --------------------- */}
      <SectionCard
        icon={Scale}
        title="Evaluation Metrics"
        subtitle="How each detector is scored against the ground-truth labels (0 = normal, 1 = anomaly)"
      >
        <div className="grid-3">
          {METRIC_DEFS.map((m) => (
            <div className="metric-def" key={m.name + m.formula}>
              <div className="m-name">{m.name}</div>
              <div className="m-formula">{m.formula}</div>
              <div className="m-desc">{m.desc}</div>
            </div>
          ))}
        </div>
        <div className="table-note" style={{ marginTop: 12 }}>
          Confusion-matrix convention: <b>TP</b> = anomaly flagged correctly, <b>FP</b> = normal
          record flagged, <b>FN</b> = anomaly missed, <b>TN</b> = normal record accepted. When a
          denominator is zero (e.g. a dataset without anomalies) the metric is reported as 0.
        </div>
      </SectionCard>

      {/* ------------------------- reproducibility ----------------------- */}
      <SectionCard icon={BookOpen} title="Reproducibility &amp; Ethics Notes">
        <div className="grid-3">
          <div className="metric-def">
            <div className="m-name">Seeded generation</div>
            <div className="m-desc">
              Every dataset is produced by a seeded PRNG (mulberry32). Re-entering a seed
              reproduces the exact same trace, so figures in a report can be regenerated.
            </div>
          </div>
          <div className="metric-def">
            <div className="m-name">No look-ahead</div>
            <div className="m-desc">
              Rolling detectors only use observations strictly earlier than the point being
              judged, mirroring an online deployment where the future is unknown.
            </div>
          </div>
          <div className="metric-def">
            <div className="m-name">No real traffic, no claims</div>
            <div className="m-desc">
              All data is simulated in-browser. This prototype does not claim real-world
              intrusion-detection capability; it demonstrates the methodology and the metrics.
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={BookOpen} title="Suggested Presentation Flow" subtitle="For the faculty demonstration">
        <div className="prose">
          <b>1.</b> Dashboard → show the live monitor and status indicator.{' '}
          <b>2.</b> Simulator → generate a dataset, explain labels.{' '}
          <b>3.</b> Algorithms → adjust a threshold and watch metrics change.{' '}
          <b>4.</b> Analysis → point out a port-scan that packet-rate detectors miss.{' '}
          <b>5.</b> Experiments → run all four studies.{' '}
          <b>6.</b> Results → comparison charts, summary, export the CSV.{' '}
          <b>7.</b> Methodology → research questions and limitations.
        </div>
      </SectionCard>
    </div>
  )
}
