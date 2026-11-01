/**
 * ---------------------------------------------------------------------------
 * prng.js — Deterministic pseudo-random number generation
 * ---------------------------------------------------------------------------
 * The whole application is driven by *simulated* traffic, so we need a random
 * number generator that can be seeded. A seeded generator makes every
 * experiment reproducible: the same seed always produces the same traffic
 * trace, which is essential when comparing detection algorithms fairly.
 *
 * We use the mulberry32 algorithm — a small, fast, well-distributed 32-bit
 * generator (public domain).
 * ---------------------------------------------------------------------------

 */

/** mulberry32: returns a function producing uniform floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Generate a random 32-bit seed (used when the user leaves seed blank). */
export function randomSeed() {
  return (Math.random() * 0xffffffff) >>> 0
}

/**
 * Create a convenience wrapper with the distribution helpers the traffic
 * simulator needs.
 */
export function makeRng(seed) {
  const next = mulberry32(seed)
  let spare = null // for the Box–Muller "spare" gaussian value

  const rng = {
    /** Uniform float in [0, 1). */
    uniform: () => next(),

    /** Uniform integer in [min, max] (inclusive). */
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,

    /** Pick a random element from an array. */
    pick: (arr) => arr[Math.floor(next() * arr.length) % arr.length],

    /**
     * Gaussian (normal) sample via the Box–Muller transform.
     * Network jitter is well approximated by a normal distribution around a
     * slowly varying mean, so this is the workhorse of the simulator.
     */
    gauss: (mean = 0, sd = 1) => {
      if (spare !== null) {
        const v = spare
        spare = null
        return mean + sd * v
      }
      let u, v, s
      do {
        u = next() * 2 - 1
        v = next() * 2 - 1
        s = u * u + v * v
      } while (s === 0 || s >= 1)
      const m = Math.sqrt((-2 * Math.log(s)) / s)
      spare = v * m
      return mean + sd * u * m
    },
  }
  return rng
}
