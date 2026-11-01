/**
 * ---------------------------------------------------------------------------
 * Simulator — generate labelled synthetic network traffic
 * ---------------------------------------------------------------------------
 * Controls: number of observations, traffic intensity, anomaly intensity and
 * the anomaly types to inject (plus an optional seed for reproducibility).
 * The preview table shows the first 100 records of the generated dataset.
 * ---------------------------------------------------------------------------
 */

import { useMemo, useState } from 'react'
import { AlertTriangle, Database, Info, PlayCircle, Radio, ScrollText } from 'lucide-react'
import { useApp } from '../state/AppContext.jsx'
import { ANOMALY_TYPES } from '../core/simulator.js'
import { SectionCard, EmptyState, StatusPill, StatCard } from '../components/ui.jsx'
import { ChipGroup, NumberField, Segmented } from '../components/controls.jsx'
import { TimelineChart } from '../components/TimelineChart.jsx'
import { compact, dateTime, number, percent, timeOfDay } from '../utils/format.js'

const INTENSITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const ROWS_PREVIEW = 100

export function Simulator() {
  const { config, setConfig, generate, dataset } = useApp()

  // Local form state mirrors the context config; validated before generating.
  const [form, setForm] = useState(config)
  const [seedTouched, setSeedTouched] = useState(false)

  const obsNumber = Number(form.observations)
  const obsError =
    form.observations === '' || Number.isNaN(obsNumber)
      ? 'Enter a number of observations.'
      : obsNumber < 100 || obsNumber > 5000
        ? 'Observations must be between 100 and 5000.'
        : null

  const canGenerate = !obsError

  const handleGenerate = () => {
    if (!canGenerate) return
    generate({
      observations: Math.round(obsNumber),
      trafficIntensity: form.trafficIntensity,
      anomalyIntensity: form.anomalyIntensity,
      anomalyTypes: form.anomalyTypes,
      seed: form.seed,
    })
  }

  const previewRows = useMemo(
    () => (dataset ? dataset.records.slice(0, ROWS_PREVIEW) : []),
    [dataset],
  )

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h2>Network Traffic Simulation</h2>
          <div className="sub">
            Generates realistic-looking observations with a diurnal load pattern, Gaussian jitter
            and labelled anomaly injections. Every record carries a ground-truth label
            (<b>Normal = 0</b>, <b>Anomaly = 1</b>) used to evaluate the detectors.
          </div>
        </div>
      </div>

      {/* ------------------------- generation controls ---------------------- */}
      <SectionCard
        icon={Radio}
        title="Simulation Controls"
        subtitle="Choose the dataset size, load level, anomaly strength and anomaly mix"
        actions={
          <button className="btn btn-primary" onClick={handleGenerate} disabled={!canGenerate}>
            <PlayCircle size={15} />
            Generate Traffic Data
          </button>
        }
      >
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <NumberField
            label="Number of observations"
            value={form.observations}
            min={100}
            max={5000}
            onChange={(v) => setForm((f) => ({ ...f, observations: v }))}
            error={obsError}
            hint={!obsError ? 'Between 100 and 5000 (1 record = 1 second).' : undefined}
          />

          <div className="field">
            <span className="field-label">Traffic intensity</span>
            <Segmented
              options={INTENSITY_OPTIONS}
              value={form.trafficIntensity}
              onChange={(v) => setForm((f) => ({ ...f, trafficIntensity: v }))}
            />
            <span className="field-hint">Normal operating load of the network.</span>
          </div>

          <div className="field">
            <span className="field-label">Anomaly intensity</span>
            <Segmented
              options={INTENSITY_OPTIONS}
              value={form.anomalyIntensity}
              onChange={(v) => setForm((f) => ({ ...f, anomalyIntensity: v }))}
            />
            <span className="field-hint">How aggressive the injected anomalies are.</span>
          </div>

          <NumberField
            label="Random seed (optional)"
            value={form.seed}
            onChange={(v) => {
              setSeedTouched(true)
              setForm((f) => ({ ...f, seed: v }))
            }}
            placeholder="e.g. 42"
            hint={
              seedTouched && form.seed !== '' && Number.isNaN(Number(form.seed))
                ? undefined
                : 'Leave blank for a fresh random trace. Same seed → same data.'
            }
            error={
              seedTouched && form.seed !== '' && Number.isNaN(Number(form.seed))
                ? 'Seed must be numeric.'
                : undefined
            }
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <span className="field-label">Types of anomalies to simulate</span>
          <div style={{ marginTop: 8 }}>
            <ChipGroup
              options={ANOMALY_TYPES.map((t) => ({ value: t.id, label: t.label }))}
              value={form.anomalyTypes}
              onChange={(v) => setForm((f) => ({ ...f, anomalyTypes: v }))}
            />
          </div>
          {form.anomalyTypes.length === 0 ? (
            <div className="banner warn" style={{ marginTop: 12 }}>
              <AlertTriangle size={15} />
              <span>
                No anomaly types selected — the generated dataset will contain only normal
                traffic (all labels = 0), which is useful for studying false positives.
              </span>
            </div>
          ) : null}
        </div>
      </SectionCard>

      {!dataset ? (
        <div className="card">
          <EmptyState
            icon={Database}
            title="No dataset generated yet"
            hint="Set your simulation parameters and press “Generate Traffic Data”."
          />
        </div>
      ) : (
        <>
          {/* --------------------------- summary chips ----------------------- */}
          <div className="grid-stats">
            <StatCard
              label="Observations"
              value={number(dataset.meta.observations)}
              foot={`seed ${dataset.meta.seed}`}
              icon={Database}
              accent="blue"
            />
            <StatCard
              label="Normal (0)"
              value={number(dataset.meta.normalCount)}
              foot={percent(dataset.meta.normalCount / dataset.meta.observations, 1)}
              icon={ScrollText}
              accent="green"
            />
            <StatCard
              label="Anomalies (1)"
              value={number(dataset.meta.anomalyCount)}
              foot={percent(dataset.meta.anomalyRate, 1)}
              icon={AlertTriangle}
              accent="red"
            />
            <StatCard
              label="Traffic Intensity"
              value={dataset.meta.trafficIntensity}
              foot={`anomaly intensity: ${dataset.meta.anomalyIntensity}`}
              icon={Radio}
              accent="cyan"
            />
            <StatCard
              label="Anomaly Types"
              value={dataset.meta.anomalyTypes.length}
              foot={
                dataset.meta.anomalyTypes.length
                  ? `${dataset.meta.anomalyTypes.length} of ${ANOMALY_TYPES.length} enabled`
                  : 'normal traffic only'
              }
              icon={Info}
              accent="purple"
            />
            <StatCard
              label="Generated"
              value={dateTime(dataset.meta.generatedAt.getTime()).split(', ')[1] || '—'}
              foot={dateTime(dataset.meta.generatedAt.getTime()).split(', ')[0]}
              icon={PlayCircle}
              accent="orange"
            />
          </div>

          {/* --------------------------- preview chart ----------------------- */}
          <SectionCard
            icon={Radio}
            title="Generated Traffic Timeline"
            subtitle="Packets per second with ground-truth anomalies marked in red"
          >
            <TimelineChart records={dataset.records} dataKey="pps" height={300} />
          </SectionCard>

          {/* --------------------------- preview table ----------------------- */}
          <SectionCard
            icon={ScrollText}
            title="Observation Records"
            subtitle={`First ${Math.min(ROWS_PREVIEW, dataset.records.length)} of ${number(dataset.records.length)} records`}
            actions={
              <span className="pill neutral">
                interval: 1 s · fields: t, pps, bps, ports, icmp, scenario, label
              </span>
            }
            bodyClass="tight"
          >
            <div className="table-wrap" style={{ maxHeight: 460, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Timestamp</th>
                    <th>Packets/s</th>
                    <th>Bytes/s</th>
                    <th>Unique ports</th>
                    <th>ICMP ratio</th>
                    <th>Scenario</th>
                    <th>Actual label</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, i) => (
                    <tr key={r.t + '-' + i}>
                      <td className="num">{i}</td>
                      <td className="num mono">{timeOfDay(r.t)}</td>
                      <td className="num">{number(r.pps)}</td>
                      <td className="num">{compact(r.bps)}</td>
                      <td className="num">{number(r.ports)}</td>
                      <td className="num">{percent(r.icmp, 1)}</td>
                      <td>
                        {r.label === 1 ? (
                          <span className="pill anomaly" style={{ padding: '1px 9px' }}>
                            {r.scenario}
                          </span>
                        ) : (
                          <span className="pill neutral" style={{ padding: '1px 9px' }}>
                            Normal
                          </span>
                        )}
                      </td>
                      <td className="primary num">
                        {r.label}{' '}
                        <StatusPill
                          status={r.label === 1 ? 'anomaly' : 'normal'}
                          label={r.label === 1 ? 'Anomaly' : 'Normal'}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-note">
              Preview limited to {ROWS_PREVIEW} rows for readability — the detectors always use
              the complete dataset.
            </div>
          </SectionCard>
        </>
      )}
    </div>
  )
}
