/**
 * ChartTooltip — one dark tooltip shared by every Recharts visualisation.
 */
export function ChartTooltip({ active, payload, label, format, title }) {
  if (!active || !payload?.length) return null
  const items = payload.filter((p) => p.value !== null && p.value !== undefined && p.value === p.value)
  if (!items.length) return null

  const heading = title ? title(label, payload) : null

  return (
    <div className="chart-tooltip">
      {heading ? <div className="chart-tooltip-title">{heading}</div> : null}
      {items.map((p, i) => (
        <div className="chart-tooltip-row" key={`${p.dataKey}-${i}`}>
          <span
            className="dot"
            style={{ background: p.color || p.stroke || p.fill || '#3b82f6' }}
          />
          <span className="name">{p.name}</span>
          <span className="val">{format ? format(p.value, p.dataKey) : p.value}</span>
        </div>
      ))}
    </div>
  )
}
