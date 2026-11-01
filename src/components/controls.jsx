/**
 * ---------------------------------------------------------------------------
 * controls.jsx — form primitives used by the simulator & algorithms pages
 *   Segmented, ChipGroup, NumberField, RangeField, SelectField, Checkbox
 * ---------------------------------------------------------------------------
 */

export function Segmented({ options, value, onChange, green = false }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`seg-btn ${value === opt.value ? 'active' : ''} ${
            value === opt.value && green ? 'green' : ''
          }`}
          onClick={() => onChange(opt.value)}
          title={opt.title}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function ChipGroup({ options, value = [], onChange }) {
  const toggle = (v) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  return (
    <div className="chips">
      {options.map((opt) => {
        const on = value.includes(opt.value)
        return (
          <button
            key={opt.value}
            type="button"
            className={`chip ${on ? 'on' : ''}`}
            onClick={() => toggle(opt.value)}
            aria-pressed={on}
          >
            <span className="tick">{on ? '✓' : ''}</span>
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  hint,
  error,
  placeholder,
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        type="number"
        className={`input ${error ? 'error' : ''}`}
        value={value}
        min={min}
        max={max}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? (
        <span className="field-hint" style={{ color: 'var(--red)' }}>
          {error}
        </span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </label>
  )
}

export function RangeField({ label, value, onChange, min, max, step = 1, display }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <div className="range-row">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="range-val">{display ? display(value) : value}</span>
      </div>
    </label>
  )
}

export function SelectField({ label, value, onChange, options, hint }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}

export function Checkbox({ label, checked, onChange }) {
  return (
    <label className="checkbox-row">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}
