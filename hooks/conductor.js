// The conductor: what each loop of a long set plays, and the mixer that cuts
// the rendered loops into bars for a gapless stream. Plain JavaScript like
// the engine, so the background player (player/techno.mjs) and the scripts
// share it.
//
// A set is the current track at a part of PLAN, plus how many loops it has
// played there. With auto on, each part plays its `loops`, then the next one;
// after the outro the next track comes in through a HANDOVERS shape and goes
// on from its build. With auto, the transitions come from `transitionsOf`
// (seeded by the track): a build-up on the last loop of a part with `rise`,
// a fall on the last loop of a drop, a swell into a new sound, a build-up
// before the low end swaps in the handover. The first loop of a drop (and of
// the new track after a swap) gets a crash, with auto a boom too.
import { PLAN, HANDOVERS, HANDOVER_LOOPS, atPart, onlyLayers, cleanTrack, encodeCode, transitionsOf, planOf } from './engine.js'

// A fresh set on a track (from its first part unless it has one). `at` is
// the position in the track's plan (a part can come twice in it).
export function newSet(track) {
  const t = cleanTrack(track)
  const plan = planOf(t)
  const k = t.part === null ? 0 : Math.max(0, plan.indexOf(t.part))
  return { track: atPart(t, plan[k]), loop: 0, handover: null, at: k }
}

// The position in the plan, for a set saved before 0.9 (no `at`).
export const posOf = (set) => set.at ?? Math.max(0, planOf(set.track).indexOf(set.track.part))

// What the next loop plays: the arguments of renderLoop. Only auto adds the
// transitions, since only auto knows what comes next.
export function loopSpec(set, { auto }) {
  const none = { rise: false, impact: false, build: null, fall: null, swell: false }
  if (set.handover) {
    const shape = HANDOVERS[set.handover.shape]
    const h = shape.steps[set.handover.step]
    const swap = auto && set.handover.step === shape.steps.length - 1 && set.handover.loop >= HANDOVER_LOOPS - 1
    return { ...none, track: onlyLayers(set.handover.from, h.from), with: h.to.length ? onlyLayers(atPart(set.track, shape.to), h.to) : null, ...(swap ? { rise: true, build: transitionsOf(set.handover.from).swap } : {}) }
  }
  const k = posOf(set), p = PLAN[set.track.part]
  const last = set.loop >= p.loops - 1
  const fx = auto ? transitionsOf(set.track) : null
  const rise = !!fx && last && fx.build[k] !== undefined
  const drop = p.section === 'drop' && set.loop === 0
  const landed = !!set.swapped && set.loop === 0
  return {
    track: set.track,
    with: null,
    rise,
    impact: drop || landed,
    build: rise ? fx.build[k] : fx && drop ? fx.build[k - 1] ?? null : fx && landed ? set.swapped : null,
    fall: fx && last ? fx.fall[k] ?? null : null,
    swell: !!(fx && last && fx.swell[k]),
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
    const shape = HANDOVERS[set.handover.shape]
    if (set.handover.step >= shape.steps.length) {
      // the new song lands with the crash and the boom of the swap build-up
      set.swapped = transitionsOf(set.handover.from).swap
      set.handover = null
      const plan = planOf(set.track)
      set.at = Math.max(0, plan.indexOf(shape.to))
      set.track = atPart(set.track, plan[set.at])
    }
    return set
  }
  const plan = planOf(set.track), k = posOf(set)
  if (k < plan.length - 1) {
    set.at = k + 1
    set.track = atPart(set.track, plan[k + 1])
    return set
  }
  const next = cleanTrack(nextTrack())
  const shape = transitionsOf(set.track).land
  set.handover = { from: set.track, step: 0, loop: 0, shape }
  set.track = { ...atPart(next, HANDOVERS[shape].to), bpm: set.track.bpm }
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

// What the deck calls the part that plays: its section (intro, groove,
// build, break, outro), a drop with its number, "mixing in" in a handover
// (Ruslan, 2026-10-05, option A: "kick - it's not clear what it means").
export const sectionLabel = (v) => (!v ? '' : v.section === 'handover' ? 'mixing in' : v.section === 'drop' ? v.name : v.section)
