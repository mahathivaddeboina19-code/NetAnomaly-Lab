/**
 * ---------------------------------------------------------------------------
 * useLiveTraffic.js — Simulated real-time traffic stream for the dashboard
 * ---------------------------------------------------------------------------
 * Produces an endlessly running stream of observations and scores the newest
 * point against a rolling robust baseline (the same statistics the proposed
 * adaptive detector uses), yielding a live Normal / Warning / Anomaly status.
 * ---------------------------------------------------------------------------
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createTrafficStream } from '../core/simulator.js'
import { scoreAgainstHistory } from '../core/algorithms.js'
import { randomSeed } from '../core/prng.js'

const MAX_POINTS = 110
const TICK_MS = 900

export function useLiveTraffic({ trafficIntensity, anomalyIntensity, anomalyTypes }) {
  const [points, setPoints] = useState([])
  const [paused, setPaused] = useState(false)
  const streamRef = useRef(null)

  // (Re)create the stream whenever the traffic profile changes.
  useEffect(() => {
    streamRef.current = createTrafficStream({
      trafficIntensity,
      anomalyIntensity,
      anomalyTypes,
      seed: randomSeed(),
    })
    const warm = []
    for (let i = 0; i < 45; i++) warm.push(streamRef.current.next())
    setPoints(warm)
  }, [trafficIntensity, anomalyIntensity, anomalyTypes])

  // Append one observation per tick.
  useEffect(() => {
    if (paused) return undefined
    const id = setInterval(() => {
      const rec = streamRef.current.next()
      setPoints((prev) => [...prev.slice(-(MAX_POINTS - 1)), rec])
    }, TICK_MS)
    return () => clearInterval(id)
  }, [paused])

  const verdict = useMemo(() => scoreAgainstHistory(points, 3.5, 60), [points])
  const latest = points.length ? points[points.length - 1] : null

  const togglePause = useCallback(() => setPaused((p) => !p), [])

  return { points, paused, togglePause, verdict, latest }
}
