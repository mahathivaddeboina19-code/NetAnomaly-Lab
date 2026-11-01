/**
 * ---------------------------------------------------------------------------
 * metrics.js — Evaluation metrics for binary anomaly detection
 * ---------------------------------------------------------------------------
 * Ground truth: label 0 = normal, label 1 = anomaly.
 * Prediction:   0 = normal,  1 = anomaly.
 *
 *              predicted anomaly     predicted normal
 *   actual      TP          FN
 *   anomaly     (hit)       (missed)
 *
 *   actual      FP          TN
 *   normal      (false      (correct
 *                alarm)      reject)
 *
 * Detection Rate (Recall) = TP / (TP + FN)
 * False Positive Rate     = FP / (FP + TN)
 * Precision               = TP / (TP + FP)
 * F1                      = 2 · precision · recall / (precision + recall)
 * Accuracy                = (TP + TN) / all
 *
 * Convention used here: when a denominator is zero (e.g. a dataset without
 * any anomalies), the metric is reported as 0 rather than NaN so charts and
 * tables stay readable. Such cases are noted in the methodology page.
 * ---------------------------------------------------------------------------
 */

const safeDiv = (num, den) => (den > 0 ? num / den : 0)

export function computeMetrics(actual, predicted) {
  let tp = 0
  let fp = 0
  let tn = 0
  let fn = 0
  const n = Math.min(actual.length, predicted.length)

  for (let i = 0; i < n; i++) {
    const a = actual[i] ? 1 : 0
    const p = predicted[i] ? 1 : 0
    if (a === 1 && p === 1) tp++
    else if (a === 0 && p === 1) fp++
    else if (a === 0 && p === 0) tn++
    else fn++
  }

  const precision = safeDiv(tp, tp + fp)
  const recall = safeDiv(tp, tp + fn) // a.k.a. detection rate
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0

  return {
    tp,
    fp,
    tn,
    fn,
    total: n,
    accuracy: safeDiv(tp + tn, n),
    precision,
    recall,
    detectionRate: recall,
    fpr: safeDiv(fp, fp + tn),
    fnr: safeDiv(fn, fn + tp),
    f1,
  }
}
