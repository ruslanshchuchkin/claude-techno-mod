// The conductor: what each loop of a long set plays, and the mixer that cuts
// the rendered loops into bars for a gapless stream. Plain JavaScript like
// the engine, so the background player (player/techno.mjs) and the scripts
// share it.
//
// A set is the current track at a part of PLAN, plus how many loops it has
// played there. With auto on, each part plays its `loops`, then the next one;
// after the outro the next track comes in through the HANDOVER steps and goes
// on from its build. With auto, the transitions come from `transitionsOf`
// (seeded by the track): a build-up on the last loop of a part with `rise`,
// a fall on the last loop of a drop, a swell into a new sound, a build-up
// before the low end swaps in the handover. The first loop of a drop (and of
// the new track after a swap) gets a crash, with auto a boom too.
import { PLAN, HANDOVER, HANDOVER_LOOPS, HANDOVER_TO, atPart, onlyLayers, cleanTrack, encodeCode, transitionsOf } from './engine.js'

// A fresh set on a track (from its first part unless it has one).
export function newSet(track) {
  const t = cleanTrack(track)
  return { track: t.part === null ? atPart(t, 0) : t, loop: 0, handover: null }
}

// What the next loop plays: the arguments of renderLoop. Only auto adds the
// transitions, since only auto knows what comes next.
export function loopSpec(set, { auto }) {
  const none = { rise: false, impact: false, build: null, fall: null, swell: false }
  if (set.handover) {
    const h = HANDOVER[set.handover.step]
    const swap = auto && set.handover.step === HANDOVER.length - 1 && set.handover.loop >= HANDOVER_LOOPS - 1
    return { ...none, track: onlyLayers(set.handover.from, h.from), with: onlyLayers(atPart(set.track, HANDOVER_TO), h.to), ...(swap ? { rise: true, build: transitionsOf(set.handover.from).swap } : {}) }
  }
  const i = set.track.part, p = PLAN[i]
  const last = set.loop >= p.loops - 1
  const fx = auto ? transitionsOf(set.track) : null
  const rise = !!fx && !!p.rise && last
  const drop = p.section === 'drop' && set.loop === 0
  const landed = !!set.swapped && set.loop === 0
  return {
    track: set.track,
    with: null,
    rise,
    impact: drop || landed,
    build: rise ? fx.build[i] : fx && drop ? fx.build[i - 1] ?? null : fx && landed ? set.swapped : null,
    fall: fx && last ? fx.fall[i] ?? null : null,
    swell: !!(fx && last && fx.swell[i]),
  }
}

// The key of a spec, so the player renders a loop once and reuses it.
export const specKey = (spec) => [encodeCode(spec.track), spec.with ? encodeCode(spec.with) : '', spec.rise ? 'r' : '', spec.impact ? 'i' : '', spec.build ?? '', spec.fall ?? '', spec.swell ? 's' : ''].join('|')

// Moves on by one part, or one handover step. `nextTrack()` gives the track
// that comes in after the outro. Returns the set (mutated).
export function stepOn(set, nextTrack) {
  set.loop = 0
  set.swapped = null
  if (set.handover) {
    set.handover.step++
    set.handover.loop = 0
    if (set.handover.step >= HANDOVER.length) {
      // the new track lands with the crash and the boom of the swap build-up
      set.swapped = transitionsOf(set.handover.from).swap
      set.handover = null
      set.track = atPart(set.track, HANDOVER_TO)
    }
    return set
  }
  if (set.track.part < PLAN.length - 1) {
    set.track = atPart(set.track, set.track.part + 1)
    return set
  }
  const next = cleanTrack(nextTrack())
  set.handover = { from: set.track, step: 0, loop: 0 }
  set.track = { ...atPart(next, HANDOVER_TO), bpm: set.track.bpm }
  return set
}

// After a loop played to its end: with auto, count it and move on when the
// part (or the handover step) has had its loops.
export function afterLoop(set, { auto, nextTrack }) {
  if (!auto) return set
  if (set.handover) {
    set.handover.loop++
    if (set.handover.loop >= HANDOVER_LOOPS) stepOn(set, nextTrack)
    return set
  }
  set.loop++
  if (set.loop >= PLAN[set.track.part].loops) stepOn(set, nextTrack)
  return set
}

// How many loops are left in this part (or handover step), this one included.
export function loopsLeft(set) {
  if (set.handover) return HANDOVER_LOOPS - set.handover.loop
  return Math.max(1, PLAN[set.track.part].loops - set.loop)
}

// A soft knee over 0.9, so a tail added on a full bar never clips.
const knee = (v) => (v > 0.9 ? 0.9 + 0.09 * Math.tanh((v - 0.9) / 0.09) : v < -0.9 ? -0.9 - 0.09 * Math.tanh((-v - 0.9) / 0.09) : v)

// The mixer cuts a rendered loop into its 8 bars and adds the tail of the
// loop before (reverb, delay) onto the start of the next one. A bar is one
// interleaved stereo Float32Array.
export function mixer() {
  let carryL = new Float32Array(0), carryR = new Float32Array(0)
  return {
    // bar `k` (0..7) of the render `r`; the last bar hands the render's tail on
    bar(r, k) {
      const from = Math.round((k * r.loop) / 8), to = Math.round(((k + 1) * r.loop) / 8)
      const n = to - from
      const out = new Float32Array(n * 2)
      for (let i = 0; i < n; i++) {
        out[i * 2] = knee(r.left[from + i] + (i < carryL.length ? carryL[i] : 0))
        out[i * 2 + 1] = knee(r.right[from + i] + (i < carryR.length ? carryR[i] : 0))
      }
      carryL = carryL.length > n ? carryL.subarray(n) : new Float32Array(0)
      carryR = carryR.length > n ? carryR.subarray(n) : new Float32Array(0)
      if (k === 7) {
        const tl = r.left.subarray(r.loop), tr = r.right.subarray(r.loop)
        const len = Math.max(tl.length, carryL.length)
        const nl = new Float32Array(len), nr = new Float32Array(len)
        nl.set(carryL); nr.set(carryR)
        for (let i = 0; i < tl.length; i++) { nl[i] += tl[i]; nr[i] += tr[i] }
        carryL = nl; carryR = nr
      }
      return out
    },
  }
}
