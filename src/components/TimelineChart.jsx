/**
 * ---------------------------------------------------------------------------
 * TimelineChart — the signature visual of the dashboard
 * ---------------------------------------------------------------------------
 * Draws one feature (default: packets per second) over time and overlays:
 *   • blue line  → the traffic curve (normal observations),
 *   • red dots   → ground-truth anomalies (Actual Label = 1),
 *   • orange rings → observations flagged by the selected algorithm.
 * A red dot wearing an orange ring is a true positive; a lone red dot is a
 * missed anomaly (FN) and a lone orange ring is a false alarm (FP).
 * ---------------------------------------------------------------------------
 */

import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { C, axis as axisStyle, buildTimelineData, tickCompact } from '../utils/chart.js'
import { ChartTooltip } from './ChartTooltip.jsx'

export function TimelineChart({
  records = [],
  predictions = null,
  dataKey = 'pps',
  height = 300,
  valueLabel = 'Packets per second',
  formatValue = (v) => tickCompact(v),
  showLegend = true,
}) {
  const data = useMemo(
    () => buildTimelineData(records, predictions, dataKey),
    [records, predictions, dataKey],
  )

  if (!data.length) {
    return (
      <div className="empty" style={{ height }}>
        <div className="title">No data to plot</div>
        <div className="hint">Generate traffic data on the Traffic Simulator page first.</div>
      </div>
    )
  }

  const interval = Math.max(1, Math.floor(data.length / 7))

  return (
    <div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 14, bottom: 4, left: 4 }}>
            <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="i"
              {...axisStyle}
              interval={interval}
              tickFormatter={(i) => data[i]?.time ?? ''}
              minTickGap={24}
            />
            <YAxis {...axisStyle} width={52} tickFormatter={tickCompact} />
            <Tooltip
              cursor={{ stroke: 'rgba(148,163,184,0.35)', strokeDasharray: '3 3' }}
              content={
                <ChartTooltip
                  format={(v) => formatValue(v)}
                  title={(_, payload) => payload?.[0]?.payload?.time}
                />
              }
            />
            {/* main traffic curve */}
            <Line
              type="monotone"
              dataKey="value"
              name={valueLabel}
              stroke={C.blue}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            {/* ground-truth anomalies */}
            <Line
              type="linear"
              dataKey="actual"
              name="Actual anomaly"
              stroke="none"
              connectNulls={false}
              dot={{ r: 3.4, fill: C.red, strokeWidth: 0 }}
              isAnimationActive={false}
            />
            {/* algorithm detections (only when predictions are supplied) */}
            {predictions ? (
              <Line
                type="linear"
                dataKey="detected"
                name="Detected"
                stroke="none"
                connectNulls={false}
                dot={{ r: 4.8, fill: 'none', stroke: C.orange, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {showLegend ? (
        <div className="legend-custom">
          <span className="li">
            <span className="legend-line" style={{ background: C.blue }} /> Normal traffic
          </span>
          <span className="li">
            <span className="legend-swatch" style={{ background: C.red }} /> Actual anomaly
          </span>
          {predictions ? (
            <span className="li">
              <span
                className="legend-swatch"
                style={{ background: 'transparent', border: `2px solid ${C.orange}` }}
              />{' '}
              Detected by algorithm
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
