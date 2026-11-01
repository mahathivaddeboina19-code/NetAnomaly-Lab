# Adaptive Network Traffic Anomaly Detection Using Lightweight Statistical Methods

A research-oriented **Computer Networks mini-project**: a complete dashboard that
simulates network traffic, detects anomalies with four different statistical
methods, compares them under controlled experiments, and exports the results.

> **Academic demonstration only.** All traffic in this application is **simulated
> in the browser**. The system does not capture real network traffic and does not
> claim to be a real-world intrusion detection/prevention system.

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build → dist/
npm test         # headless smoke test + full behavioural verification
```

No API keys, servers or paid services are required — every calculation runs
locally in the browser.

---

## The study pipeline

**Real-World Problem → Traffic Simulation → Feature Analysis → Four Detection
Algorithms → Experimental Scenarios → Baseline Comparison → Performance Metrics
→ Results → Research Findings**

Each stage has its own page (left sidebar): Dashboard, Traffic Simulator,
Detection Algorithms, Traffic Analysis, Experiments, Results, Research
Methodology.

---

## Traffic simulation

Each observation contains: timestamp, packets per second, bytes per second,
unique destination ports, ICMP ratio, scenario name and a ground-truth label
(`Normal = 0`, `Anomaly = 1`).

Scenarios: **Normal** (diurnal pattern + jitter + benign micro-bursts),
**Traffic Burst**, **Port-Scan-Like Activity**, **Packet Flood** and
**Protocol Distribution Anomaly**. Users control observation count, traffic
intensity, anomaly intensity, anomaly mix and the random seed (seeded PRNG ⇒
reproducible traces). A separate sample of known-normal traffic is returned as a
*calibration period* for the detectors that need a baseline.

## The four detectors

| # | Detector | Rule |
|---|----------|------|
| 1 | **Fixed Threshold** | `pps > threshold` → anomaly. Genuinely fixed at a user-configured constant (default **200 pps**) — it never recalibrates itself. |
| 2 | **Moving Average** | `|pps − rolling mean| > k·σ` over a configurable window (10–100) of past observations. |
| 3 | **Statistical Threshold** | `pps > μ + 3σ`, where μ and σ are learned from the normal calibration sample. |
| 4 | **Proposed Adaptive Detector** | Rolling **median / MAD** baselines over **four features** (pps, bps, unique ports, ICMP ratio); robust z-score per feature; flags when any feature exceeds `k`. Baseline seeded by the calibration period until the window fills, then adapts continuously. |

All four detectors consume identical records and identical ground truth, and are
timed the same way (median of repeated in-memory passes). **No result is
hard-coded** — the proposed detector is evaluated exactly like the baselines and
the tables show whatever the simulation produces.

## Experiments

1. **Traffic Intensity** — low / medium / high background load (RQ1, RQ3)
2. **Anomaly Intensity** — low / medium / high anomaly strength (RQ1)
3. **Anomaly Type** — burst, port scan, flood, protocol anomaly (RQ2)
4. **Adaptive Configuration** — rolling windows 20 / 50 / 100 (RQ4)

Datasets are seeded, so experiments are reproducible. Fairness protocol: the
fixed threshold keeps its configured value across runs (that is its defining
limitation), the statistical detector recalibrates per run, and the rolling
detectors adapt inside each run.

## Metrics

Accuracy, Precision, Detection Rate (Recall), False Positive Rate, False
Negative Rate, F1 Score and Processing Time — defined on the Methodology page
against the TP/FP/FN/TN confusion matrix.

## Project structure

```
src/
├── core/            # research engine (framework-free, fully commented)
│   ├── simulator.js # labelled synthetic traffic generator + live stream
│   ├── algorithms.js# the four detectors + fair timing/evaluation runner
│   ├── metrics.js   # confusion matrix + evaluation metrics
│   ├── experiments.js # the four controlled studies
│   └── prng.js      # seeded PRNG (mulberry32) for reproducibility
├── state/           # shared app state (dataset, params, results) + live feed
├── pages/           # Dashboard, Simulator, Algorithms, Analysis,
│                    # Experiments, Results, Methodology
├── components/      # sidebar, header, cards, charts, form controls
├── styles/          # theme / layout / component stylesheets
└── utils/           # formatting, chart helpers, CSV export
scripts/
├── smoke.mjs        # headless render + engine sanity test
└── verify.mjs       # behavioural checks (scenarios, isolation, export, …)
```

## Building & deployment

```bash
npm ci         # reproducible install from package-lock.json
npm run build  # production bundle → dist/
```

The build uses **relative asset URLs** (`base: './'`) and the app uses a **hash
router** (`#/dashboard`, `#/simulator`, …), so `dist/` can be uploaded as-is to
any static host — Netlify, Vercel, Cloudflare Pages, GitHub Pages (including
sub-path project sites), S3/CloudFront or any plain web server — with **no
rewrite/redirect rules required**.

Verify a build locally with `npx vite preview`.

## Testing

```bash
npm test   # runs both scripts
```

* `scripts/smoke.mjs` — generates data, runs every detector and experiment,
  checks metric sanity and the CSV report, then server-renders all seven pages
  in both populated and empty states.
* `scripts/verify.mjs` — behavioural verification: every scenario in isolation,
  intensity/difficulty scaling, parameter isolation (changing the fixed
  threshold affects *only* the fixed detector), dashboard metric updates,
  rendered values in tables/charts, CSV sections and research-language checks.

## Limitations

- The traffic data is **simulated**; no real network capture is analysed.
- Results depend on the selected simulation parameters (intensity, anomaly mix,
  seed, observation count).
- Synthetic traffic cannot fully represent all real-world network behaviour.
- The system is an **academic demonstration and research prototype**, not a
  production IDS.
