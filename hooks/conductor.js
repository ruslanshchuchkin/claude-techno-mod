// The conductor: what each loop of a long set plays, and the mixer that cuts
// the rendered loops into bars for a gapless stream. Plain JavaScript like
// the engine, so the background player (player/techno.mjs) and the scripts
// share it.
//
// A set is the current track at a part of PLAN, plus how many loops it has
// played there. With auto on, each part plays its `loops`, then the next one;
// after the outro the next track comes in through the HANDOVER steps and goes
// on from its build. The last loop of a part with `rise` gets a riser, the
// first loop of a drop a crash.
import { PLAN, HANDOVER, HANDOVER_LOOPS, HANDOVER_TO, atPart, onlyLayers, cleanTrack, encodeCode } from './engine.js'

// A fresh set on a track (from its first part unless it has one).
export function newSet(track) {
  const t = cleanTrack(track)
  return { track: t.part === null ? atPart(t, 0) : t, loop: 0, handover: null }
}

// What the next loop plays: the arguments of renderLoop. `auto` adds the
// riser, which only makes sense when the drop is sure to come next.
export function loopSpec(set, { auto }) {
  if (set.handover) {
    const h = HANDOVER[set.handover.step]
    return { track: onlyLayers(set.handover.from, h.from), with: onlyLayers(atPart(set.track, HANDOVER_TO), h.to), rise: false, impact: false }
  }
  const p = PLAN[set.track.part]
  return { track: set.track, rise: auto && !!p.rise && set.loop >= p.loops - 1, impact: p.section === 'drop' && set.loop === 0, with: null }
}

// The key of a spec, so the player renders a loop once and reuses it.
export const specKey = (spec) => [encodeCode(spec.track), spec.with ? encodeCode(spec.with) : '', spec.rise ? 'r' : '', spec.impact ? 'i' : ''].join('|')

// Moves on by one part, or one handover step. `nextTrack()` gives the track
// that comes in after the outro. Returns the set (mutated).
export function stepOn(set, nextTrack) {
  set.loop = 0
  if (set.handover) {
    set.handover.step++
    set.handover.loop = 0
    if (set.handover.step >= HANDOVER.length) {
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
