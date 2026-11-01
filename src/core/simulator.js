/**
 * ---------------------------------------------------------------------------
 * simulator.js — Synthetic network traffic generator
 * ---------------------------------------------------------------------------
 * Generates realistic-looking flow observations. Every observation carries
 * the features used by the detectors:
 *
 *   t        — timestamp (epoch ms)
 *   pps      — packets per second
 *   bps      — bytes per second
 *   ports    — number of unique destination ports (port-scan indicator)
 *   icmp     — ratio of ICMP traffic in [0, 1] (protocol-distribution indicator)
 *   scenario — "Normal" or the injected anomaly type
 *   label    — ground truth: 0 = normal, 1 = anomaly
 *
 * The generator mixes:
 *   1. A diurnal (slow sinusoidal) load pattern + Gaussian jitter.
 *   2. Occasional *benign* micro-bursts (labelled normal on purpose — real
 *      networks always contain such spikes, and they are what produces false
 *      positives for naive detectors).
 *   3. Injected anomaly events of four types, scaled by the chosen
 *      "anomaly intensity" (low / medium / high).
 *
 * A separate calibration sample of purely normal traffic is returned as well.
 * The statistical and adaptive detectors use it to build their *initial*
 * baseline, mirroring a short "learning period" of known-healthy operation.
 * ---------------------------------------------------------------------------
 */

import { makeRng, randomSeed } from './prng.js'

/** The four anomaly scenarios required by the project specification. */
export const ANOMALY_TYPES = [
  { id: 'burst', label: 'Traffic Burst', short: 'Burst' },
  { id: 'portscan', label: 'Port-Scan-Like Activity', short: 'Port Scan' },
  { id: 'flood', label: 'Packet Flood', short: 'Flood' },
  { id: 'icmp', label: 'Protocol Distribution Anomaly', short: 'ICMP Anomaly' },
]

/** Traffic intensity presets: the *normal* operating envelope of the network. */
export const INTENSITY_PRESETS = {
  low: {
    label: 'Low',
    pps: [40, 95],
    ports: [4, 16],
    icmp: [0.005, 0.045],
    jitter: 0.13,
  },
  medium: {
    label: 'Medium',
    pps: [160, 380],
    ports: [8, 30],
    icmp: [0.005, 0.055],
    jitter: 0.15,
  },
  high: {
    label: 'High',
    pps: [520, 1050],
    ports: [12, 45],
    icmp: [0.005, 0.06],
    jitter: 0.18,
  },
}

/** Multiplier applied to anomaly magnitudes per anomaly intensity level. */
const ANOMALY_SCALE = { low: 0.35, medium: 0.9, high: 1.6 }

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const lerp = (a, b, t) => a + (b - a) * t

/**
 * Produce one *normal* traffic observation.
 * `phase` in [0,1] positions the observation along a slow diurnal cycle so the
 * dataset shows a believable daily rise/fall of load.
 */
function normalPoint(rng, intensityKey, phase) {
  const p = INTENSITY_PRESETS[intensityKey]

  // Slow diurnal component (±15%) plus a faster variation (±6%).
  const diurnal = 1 + 0.15 * Math.sin(phase * Math.PI * 2) + 0.06 * Math.sin(phase * Math.PI * 6)

  // Packets per second: uniform draw inside the envelope, modulated by the
  // diurnal pattern and Gaussian jitter.
  let pps = lerp(p.pps[0], p.pps[1], rng.uniform()) * diurnal * (1 + rng.gauss(0, p.jitter))

  // ~4% of normal observations get a benign micro-burst (still labelled 0).
  // These make the false-positive comparison between algorithms meaningful.
  const benignBurst = rng.uniform() < 0.04
  if (benignBurst) pps *= 1.45 + rng.uniform() * 0.45

  pps = Math.max(4, Math.round(pps))

  // Bytes per second follow from packet rate × average packet size (64–1400 B).
  const avgPacketBytes = rng.int(90, 1400)
  const bps = Math.max(64, Math.round(pps * avgPacketBytes * (1 + rng.gauss(0, 0.1))))

  // Unique destination ports seen in the interval.
  let ports = Math.round(lerp(p.ports[0], p.ports[1], rng.uniform()) * (1 + 0.12 * (diurnal - 1)) * (1 + rng.gauss(0, 0.16)))
  ports = clamp(ports, 1, 60)

  // ICMP ratio: small in healthy traffic (well under 10%).
  const icmp = clamp(rng.gauss(lerp(p.icmp[0], p.icmp[1], rng.uniform()), 0.012), 0.001, 0.12)

  return { pps, bps, ports, icmp }
}

/** Typical duration (in observations) of each anomaly scenario. */
function eventDuration(typeId, rng) {
  switch (typeId) {
    case 'burst':
      return rng.int(4, 10)
    case 'portscan':
      return rng.int(6, 14)
    case 'flood':
      return rng.int(3, 8)
    case 'icmp':
      return rng.int(8, 20)
    default:
      return 6
  }
}

/**
 * Transform a normal observation into an anomalous one by amplifying the
 * features that characterize each attack-like scenario.
 * `s` is the anomaly-intensity scale (0.35 low / 0.9 medium / 1.6 high).
 */
function applyAnomaly(point, typeId, s, rng) {
  const out = { ...point }
  switch (typeId) {
    case 'burst': {
      // Sudden, short-lived surge in packets and bytes.
      out.pps = Math.round(out.pps * (1.6 + 1.1 * s) * (1 + rng.gauss(0, 0.07)))
      out.bps = Math.round(out.bps * (1.5 + 1.0 * s) * (1 + rng.gauss(0, 0.07)))
      out.ports = clamp(Math.round(out.ports * (1.1 + 0.25 * s)), 1, 300)
      break
    }
    case 'portscan': {
      // Sweeping many destination ports — a classic reconnaissance pattern.
      // Packet rate rises only slightly: single-feature detectors miss it.
      out.ports = clamp(out.ports + Math.round(55 + 170 * s + rng.gauss(0, 15)), 1, 1400)
      out.pps = Math.round(out.pps * (1.05 + 0.35 * s))
      out.bps = Math.round(out.bps * (1.05 + 0.3 * s))
      break
    }
    case 'flood': {
      // Volumetric attack: extreme packet and byte rates (e.g. flood traffic).
      out.pps = Math.round(out.pps * (3.2 + 4.2 * s) * (1 + rng.gauss(0, 0.08)))
      out.bps = Math.round(out.bps * (3.5 + 5.0 * s) * (1 + rng.gauss(0, 0.08)))
      out.ports = clamp(Math.round(out.ports * (1.1 + 0.3 * s)), 1, 400)
      break
    }
    case 'icmp': {
      // Protocol-distribution anomaly: ICMP dominates the traffic mix while
      // the packet rate grows only marginally.
      out.icmp = clamp(rng.gauss(0.16 + 0.36 * s, 0.03), 0.1, 0.95)
      out.pps = Math.round(out.pps * (1.1 + 0.3 * s))
      out.bps = Math.round(out.bps * (1.1 + 0.3 * s))
      break
    }
    default:
      break
  }
  out.pps = Math.max(4, out.pps)
  out.bps = Math.max(64, out.bps)
  return out
}

/**
 * Main entry point: build a full labelled dataset.
 *
 * @param {object} options
 * @param {number} options.observations      number of records (100–5000)
 * @param {'low'|'medium'|'high'} options.trafficIntensity
 * @param {'low'|'medium'|'high'} options.anomalyIntensity
 * @param {string[]} options.anomalyTypes    anomaly ids to inject
 * @param {number} [options.seed]            PRNG seed for reproducibility
 * @returns {{records: Array, calibration: Array, meta: object}}
 */
export function generateTraffic({
  observations = 600,
  trafficIntensity = 'medium',
  anomalyIntensity = 'medium',
  anomalyTypes = ANOMALY_TYPES.map((t) => t.id),
  seed = randomSeed(),
} = {}) {
  const n = Math.max(50, Math.min(5000, Math.round(observations) || 600))
  const rng = makeRng(seed)
  const scale = ANOMALY_SCALE[anomalyIntensity] ?? 1
  const selected = (anomalyTypes || []).filter((id) => ANOMALY_TYPES.some((t) => t.id === id))

  // ---- 1. Baseline: a continuous stream of normal traffic ------------------
  const records = []
  const start = Date.now() - (n - 1) * 1000 // 1-second observation intervals
  for (let i = 0; i < n; i++) {
    const point = normalPoint(rng, trafficIntensity, i / n)
    records.push({
      t: start + i * 1000,
      ...point,
      scenario: 'Normal',
      label: 0,
    })
  }

  // ---- 2. Inject anomaly events (contiguous blocks of labelled records) ----
  const events = []
  if (selected.length > 0) {
    let idx = 12 + rng.int(0, 12)
    let guard = 0
    while (idx < n - 10 && guard++ < 500) {
      const type = rng.pick(selected)
      const dur = eventDuration(type, rng)
      if (idx + dur >= n) break
      events.push({ start: idx, end: idx + dur, type })
      idx += dur + rng.int(20, 50) // quiet gap between events
    }
  }
  const typeById = Object.fromEntries(ANOMALY_TYPES.map((t) => [t.id, t]))
  for (const ev of events) {
    for (let i = ev.start; i < ev.end; i++) {
      const mutated = applyAnomaly(records[i], ev.type, scale, rng)
      records[i] = {
        ...records[i],
        ...mutated,
        scenario: typeById[ev.type].label,
        label: 1,
      }
    }
  }

  // ---- 3. Calibration sample: pure normal traffic (baseline learning) ------
  const calRng = makeRng((seed ^ 0x9e3779b9) >>> 0)
  const calibration = []
  for (let i = 0; i < 150; i++) {
    calibration.push({ t: start - (150 - i) * 1000, ...normalPoint(calRng, trafficIntensity, i / 150) })
  }

  // ---- 4. Metadata used by dashboards and experiment tables ---------------
  const anomalyCount = records.reduce((acc, r) => acc + r.label, 0)
  const scenarioCounts = {}
  for (const r of records) scenarioCounts[r.scenario] = (scenarioCounts[r.scenario] || 0) + 1

  const meta = {
    seed,
    trafficIntensity,
    anomalyIntensity,
    anomalyTypes: selected,
    observations: records.length,
    anomalyCount,
    normalCount: records.length - anomalyCount,
    anomalyRate: records.length ? anomalyCount / records.length : 0,
    scenarioCounts,
    generatedAt: new Date(),
  }

  return { records, calibration, meta }
}

/**
 * Streaming version of the simulator, used by the dashboard's live traffic
 * monitor. `next()` returns one new observation at a time; anomalies appear
 * occasionally, exactly as in the batch generator.
 */
export function createTrafficStream({
  trafficIntensity = 'medium',
  anomalyIntensity = 'medium',
  anomalyTypes = ANOMALY_TYPES.map((t) => t.id),
  seed = randomSeed(),
} = {}) {
  const rng = makeRng(seed)
  const scale = ANOMALY_SCALE[anomalyIntensity] ?? 1
  const selected = (anomalyTypes || []).filter((id) => ANOMALY_TYPES.some((t) => t.id === id))
  const typeById = Object.fromEntries(ANOMALY_TYPES.map((t) => [t.id, t]))

  let clock = Date.now()
  let i = 0
  let active = null // { type, remaining }
  let untilNext = rng.int(12, 30) // observations until the next event

  return {
    next() {
      clock += 1000
      i += 1
      const point = normalPoint(rng, trafficIntensity, (i % 120) / 120)
      let rec = { t: clock, ...point, scenario: 'Normal', label: 0 }

      if (active) {
        const mutated = applyAnomaly(rec, active.type, scale, rng)
        rec = { ...rec, ...mutated, scenario: typeById[active.type].label, label: 1 }
        active.remaining -= 1
        if (active.remaining <= 0) {
          active = null
          untilNext = rng.int(14, 40)
        }
      } else if (selected.length > 0) {
        untilNext -= 1
        if (untilNext <= 0) {
          const type = rng.pick(selected)
          active = { type, remaining: eventDuration(type, rng) }
        }
      }
      return rec
    },
  }
}
