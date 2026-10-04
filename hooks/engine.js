// Techno loop synth. Plain JavaScript with no Node or browser APIs, so the
// same file runs inside the mod, in node (scripts/render.mjs), and in a page.
//
// A track is a small state object. The phrase seeds everything: the key, the
// patterns, and the riff, whose notes are the phrase's own letters.

export const LAYERS = ['kick', 'bass', 'hats', 'clap', 'perc', 'acid', 'stab', 'rumble', 'voice', 'ride', 'pad']
export const MOODS = ['pitch black', 'dark', 'deep', 'warm', 'bright']
export const ENERGIES = ['minimal', 'rolling', 'driving', 'peak', 'rave']
const NOTE_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
// Low keys only: the sub root lands on e1..a1 (41..55 Hz), where techno sits.
const KEY_CLASSES = [4, 5, 6, 7, 9, 5, 7, 9] // e, f, f#, g, a, f, g, a
// The scales you can pick. Without a pick, the mood picks one:
// pitch black phrygian, dark and deep minor, warm and bright dorian.
export const SCALES = [
  { name: 'minor', steps: [0, 2, 3, 5, 7, 8, 10] }, // sad, the classic
  { name: 'dorian', steps: [0, 2, 3, 5, 7, 9, 10] }, // cool, a little hope
  { name: 'phrygian', steps: [0, 1, 3, 5, 7, 8, 10] }, // dark, tense
  { name: 'hijaz', steps: [0, 1, 4, 5, 7, 8, 10] }, // arabic
  { name: 'harmonic', steps: [0, 2, 3, 5, 7, 8, 11] }, // dramatic
]
// The three moods you pick from. Each sets the sound (the old mood number:
// filters, rumble, room) and the scale together, so they never disagree.
// Old codes keep their own m and k; a pair that is no preset shows its nearest.
// A mood also sets the tempo and lifts or lowers the energy of every part.
export const VIBES = [
  { name: 'sad', mood: 2, scale: 0, bpm: 122, lift: -1 }, // minor, a little more air, slower
  { name: 'mysterious', mood: 1, scale: 3, bpm: 127, lift: 0 }, // hijaz, the arabic one
  { name: 'dark', mood: 0, scale: 2, bpm: 132, lift: 1 }, // phrygian, pitch black, harder
]
export function vibeOf(t) {
  const exact = VIBES.findIndex((v) => v.mood === t.mood && v.scale === scaleOf(t))
  if (exact >= 0) return exact
  return t.mood >= 2 ? 0 : scaleOf(t) === 3 ? 1 : t.mood === 0 ? 2 : 1
}
export const moodName = (t) => VIBES[vibeOf(t)].name

// The track in another mood: its sound, scale, tempo, and the energy of its part.
export function withVibe(input, name) {
  const t = cleanTrack(input)
  const v = VIBES.find((it) => it.name === name)
  if (!v) return t
  const energy = t.part === null || t.part === undefined ? t.energy : clamp(PLAN[t.part].energy + v.lift, 0, 4)
  return { ...t, mood: v.mood, scale: v.scale, bpm: v.bpm, energy }
}
const scaleOf = (t) => t.scale ?? (t.mood === 0 ? 2 : t.mood >= 3 ? 1 : 0)
const CHORDS = [[0, 3, 7, 12], [0, 3, 7, 10], [0, 3, 7, 10], [0, 3, 7, 10, 14], [0, 5, 7, 10, 14]]
export const BARS = 8
export const STEPS = 16
export const BPM_MIN = 110
export const BPM_MAX = 150

// The layers the step grid shows (rumble has no steps of its own: it is the
// kick's tail; the pad is one long swell; the voice says the name once).
export const GRID_LAYERS = ['kick', 'hats', 'bass', 'perc', 'clap', 'ride', 'acid', 'stab']

// The build: a track starts with the kick alone and NEXT walks it through a
// long set, one part at a time. `part` in a track is an index here; null means
// the old full-track behaviour where mood and energy pick the layers.
export const SECTIONS = ['intro', 'groove', 'build', 'drop', 'break', 'outro']
// Minimal on purpose: music to work to. About seven minutes with auto: a long
// intro, three drops with a breakdown between them, and an outro that hands
// over to the next track layer by layer. No chord stabs (Ruslan, 2026-10-03:
// "they make the track less serious"); the ride and the dark pad take their place.
// `name` is what the part brings, for the pane ("rumble in 0:12"); `adds` is
// true when that is a new sound and not a new section. `layer` is the one new
// layer, for the dashed "next" row in the grid. `loops` is how long auto plays
// it. `rise` puts a riser on its last loop (a drop comes next). The voice says
// the track's name: a whisper in the second breakdown, a deep voice on drop 3.
const FULL = ['kick', 'bass', 'hats', 'rumble', 'perc', 'clap']
export const PLAN = [
  { section: 'intro', energy: 0, loops: 2, layers: ['kick'], name: 'kick', adds: true, layer: 'kick', go: 'start', tip: 'Just the kick' },
  { section: 'intro', energy: 0, loops: 2, layers: ['kick', 'bass'], name: 'deep bass', adds: true, layer: 'bass', go: 'add the deep bass', tip: 'Kick and a deep sub' },
  { section: 'groove', energy: 1, loops: 2, layers: ['kick', 'bass', 'hats'], name: 'hats', adds: true, layer: 'hats', go: 'add hats', tip: 'Offbeat hats, the groove rolls' },
  { section: 'groove', energy: 1, loops: 2, layers: ['kick', 'bass', 'hats', 'rumble'], name: 'rumble', adds: true, layer: 'rumble', go: 'add the rumble', tip: 'The rumble fills the low end' },
  { section: 'build', energy: 2, loops: 2, rise: true, layers: ['kick', 'bass', 'hats', 'rumble', 'perc'], name: 'percussion', adds: true, layer: 'perc', go: 'add percussion', tip: 'Percussion, then a rise' },
  { section: 'drop', energy: 3, loops: 4, layers: FULL, name: 'drop 1', adds: true, layer: 'clap', go: 'drop 1', tip: 'Drop 1: the clap comes in' },
  { section: 'break', energy: 1, loops: 2, rise: true, layers: ['hats', 'perc', 'pad'], name: 'breakdown', adds: true, layer: 'pad', go: 'the breakdown', tip: 'The kick drops out. A dark pad' },
  { section: 'drop', energy: 3, loops: 4, layers: [...FULL, 'ride'], name: 'drop 2', adds: true, layer: 'ride', go: 'drop 2', tip: 'Drop 2: the ride on top' },
  { section: 'break', energy: 1, loops: 2, rise: true, layers: ['perc', 'pad', 'voice'], name: 'breakdown 2', adds: false, go: 'the second breakdown', tip: 'Only the pad and a whisper' },
  { section: 'drop', energy: 3, loops: 4, layers: [...FULL, 'ride', 'voice'], name: 'drop 3', adds: false, go: 'drop 3', tip: 'Drop 3: everything, the last peak' },
  { section: 'outro', energy: 1, loops: 1, layers: ['kick', 'bass', 'hats', 'rumble', 'perc'], name: 'outro', adds: false, go: 'the outro', tip: 'The next track comes in' },
]
// Old codes (p0..p9) named parts of the old ten-part build; `parseCode` moves
// them to the same section here. New codes use a<n>.
const OLD_PARTS = [0, 1, 2, 3, 4, 5, 7, 6, 9, 10]

// The handover (auto, after the outro): the old track takes one layer out per
// step while the new one brings one in, then the whole low end swaps at once.
// Each step plays two loops; after the last one the new track goes on from its
// build (`HANDOVER_TO`), so the music never starts again from a lone kick.
export const HANDOVER = [
  { from: ['kick', 'bass', 'hats', 'rumble', 'perc'], to: ['hats'] },
  { from: ['kick', 'bass', 'rumble', 'perc'], to: ['hats', 'perc'] },
  { from: ['kick', 'bass', 'rumble'], to: ['hats', 'perc', 'clap'] },
]
export const HANDOVER_LOOPS = 2
export const HANDOVER_TO = 4

// ---------- seed helpers ----------

export function normalizePhrase(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .slice(0, 60)
    .trim()
}

function hash32(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = (r, list) => list[Math.floor(r() * list.length)]
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const toInt = (v, lo, hi, fallback) => (Number.isFinite(Number(v)) ? clamp(Math.round(Number(v)), lo, hi) : fallback)

// ---------- the track state ----------

// The default track for a phrase. Everything not given here comes from the phrase.
export function trackFor(phrase) {
  const p = normalizePhrase(phrase) || 'techno'
  const r = rng(hash32('track:' + p))
  const vibe = VIBES[Math.floor(r() * VIBES.length)]
  const bpm = vibe.bpm + Math.floor(r() * 3) - 1
  return { phrase: p, bpm, mood: vibe.mood, energy: 2, dice: 0, swing: 0, transpose: 0, scale: vibe.scale, part: null, layers: {}, steps: {} }
}

// The track at a part of the build: the plan's energy, the plan's layers
// (explicit mutes cleared), your own step edits kept.
export function atPart(input, part) {
  const t = cleanTrack(input)
  const p = clamp(part, 0, PLAN.length - 1)
  return { ...t, part: p, energy: clamp(PLAN[p].energy + VIBES[vibeOf(t)].lift, 0, 4), layers: {} }
}

// Fills gaps and clamps every field, so a state from a code or a tool call is safe.
export function cleanTrack(t) {
  const base = trackFor(t?.phrase)
  const layers = {}
  for (const name of LAYERS) {
    const v = t?.layers?.[name]
    if (v === true || v === false) layers[name] = v
  }
  const steps = {}
  for (const name of GRID_LAYERS) {
    const v = t?.steps?.[name]
    if (!Array.isArray(v)) continue
    const on = toInt(v[0], 0, 0xffff, 0), off = toInt(v[1], 0, 0xffff, 0) & ~on
    if (on || off) steps[name] = [on, off]
  }
  const part = t?.part === null || t?.part === undefined ? null : toInt(t.part, 0, PLAN.length - 1, null)
  return {
    phrase: base.phrase,
    bpm: toInt(t?.bpm, BPM_MIN, BPM_MAX, base.bpm),
    mood: toInt(t?.mood, 0, 4, base.mood),
    energy: toInt(t?.energy, 0, 4, base.energy),
    dice: toInt(t?.dice, 0, 999, 0),
    swing: toInt(t?.swing, 0, 3, 0),
    transpose: toInt(t?.transpose, 0, 11, 0),
    scale: t?.scale === null ? null : t?.scale === undefined ? base.scale : toInt(t.scale, 0, SCALES.length - 1, null),
    part,
    layers,
    steps,
  }
}

function character(t) {
  const r = rng(hash32('char:' + t.phrase))
  return { flavor: r() < 0.5 ? 'acid' : 'dub', keyClass: pick(r, KEY_CLASSES) }
}

// Which layers play: an explicit on/off wins, otherwise mood and energy decide.
export function activeLayers(t) {
  if (t.part !== null && t.part !== undefined) {
    const plan = PLAN[t.part].layers
    const out = {}
    for (const name of LAYERS) out[name] = t.layers[name] ?? (plan.includes(name) && (name !== 'rumble' || t.mood <= 2))
    return out
  }
  const auto = {
    kick: true,
    bass: true,
    hats: true,
    clap: t.energy >= 1,
    perc: t.energy >= 2,
    acid: false,
    stab: false,
    rumble: t.mood <= 1 && t.energy >= 1,
    voice: false,
    ride: t.energy >= 4,
    pad: false,
  }
  const out = {}
  for (const name of LAYERS) out[name] = t.layers[name] ?? auto[name]
  return out
}

export function noteName(t) {
  return NOTE_NAMES[(character(t).keyClass + t.transpose) % 12]
}

export function scaleName(t) {
  return SCALES[scaleOf(t)].name
}

export function keyName(t) {
  return noteName(t) + ' ' + scaleName(t)
}

export function describe(t) {
  return `${t.bpm} bpm · key ${keyName(t)} · mood ${moodName(t)} · energy ${ENERGIES[t.energy]}`
}

// ---------- share codes ----------
// late-night-deploy@128m1e2d3s1t5p4+acid-perc*kick00040000
// a<n> is the part of the build (p<n> in old codes); *<layer><on hex4><off hex4> are step edits.

const hex4 = (n) => n.toString(16).padStart(4, '0')

export function encodeCode(t) {
  let code = t.phrase.replace(/ /g, '-') + '@' + t.bpm + 'm' + t.mood + 'e' + t.energy
  if (t.dice) code += 'd' + t.dice
  if (t.swing) code += 's' + t.swing
  if (t.transpose) code += 't' + t.transpose
  if (t.scale !== null && t.scale !== undefined) code += 'k' + t.scale
  if (t.part !== null && t.part !== undefined) code += 'a' + t.part
  for (const name of LAYERS) if (name in t.layers) code += (t.layers[name] ? '+' : '-') + name
  for (const name of GRID_LAYERS) if (t.steps?.[name]) code += '*' + name + hex4(t.steps[name][0]) + hex4(t.steps[name][1])
  return code
}

export function parseCode(text) {
  const s = String(text ?? '').trim().toLowerCase().replace(/^\/?techno\s+/, '')
  const at = s.lastIndexOf('@')
  if (at <= 0) return null
  const m = s.slice(at + 1).match(/^(\d{2,3})(?:m([0-4]))?(?:e([0-4]))?(?:d(\d{1,3}))?(?:s([0-3]))?(?:t(\d{1,2}))?(?:k([0-4]))?(?:p(\d))?(?:a(\d{1,2}))?((?:[+-][a-z]+)*)((?:\*[a-z]+[0-9a-f]{8})*)$/)
  if (!m) return null
  const layers = {}
  for (const flag of m[10].match(/[+-][a-z]+/g) ?? []) {
    const name = flag.slice(1)
    if (!LAYERS.includes(name)) return null
    layers[name] = flag[0] === '+'
  }
  const steps = {}
  for (const edit of m[11].match(/\*[a-z]+[0-9a-f]{8}/g) ?? []) {
    const name = edit.slice(1, -8)
    if (!GRID_LAYERS.includes(name)) return null
    steps[name] = [parseInt(edit.slice(-8, -4), 16), parseInt(edit.slice(-4), 16)]
  }
  return cleanTrack({ phrase: s.slice(0, at), bpm: m[1], mood: m[2], energy: m[3], dice: m[4], swing: m[5], transpose: m[6], scale: m[7] ?? null, part: m[9] ?? (m[8] === undefined ? null : OLD_PARTS[m[8]]), layers, steps })
}

// ---------- the arrangement: what plays on each of the 128 steps ----------

const BASS_PATTERNS = ['..x...x...x...x.', '.xx..xx..xx..xx.', '..xx..xx..xx..xx', '.xxx.xxx.xxx.xxx', '..x..xx...x..xx.', '...x..x...x..x.x']
const PERC_PATTERNS = ['.x..x.....x..x..', '...x..x....x..x.', 'x..x..x..x..x...', '.x.x...x.x...x..', '..x....x..x...x.']
const STAB_PATTERNS = ['..x.......x.....', '...x......x.....', '..x..x....x.....', '.......x..x....x']
const ACID_PALETTE = [0, 7, 0, 4, 0, 2, 0, 6, 0, 9, 3, 0, 4, 7, 0, 1, 0, 5, 0, 4, 2, 0, 7, 0, 6, 0, 3, 4, 0, 7, 2, 0, 9, 0, 4, 5]

function charCode(ch) {
  const c = ch.charCodeAt(0)
  return c >= 97 ? c - 97 : 26 + (c - 48)
}

export function arrange(input) {
  const t = cleanTrack(input)
  const { keyClass } = character(t)
  const on = activeLayers(t)
  const r = rng(hash32('arr:' + t.phrase + ':' + t.dice))
  const scale = SCALES[scaleOf(t)].steps
  // the sub's root, e1..d#2: low enough to feel, the growl sits an octave up
  const root = 28 + (((keyClass + t.transpose) % 12) + 8) % 12
  // without a picked scale the mood keeps its old chord; a picked scale stacks its own
  // Chords stay dark: a minor triad and the octave where the scale has a minor
  // third, and root, fifth, octave where it has none (hijaz, the mysterious
  // mood). A major third or a seventh sounded bright and bluesy there
  // (Ruslan, 2026-10-04: "they destroy the vibe, something is off").
  const minorThird = scale[2] === 3
  const chordShape = t.scale === null ? CHORDS[t.mood] : minorThird ? [0, 3, 7, 12] : [0, 7, 12]
  const degree = (d) => scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7)

  const bassPattern = t.energy === 0 ? BASS_PATTERNS[0] : pick(r, BASS_PATTERNS)
  const bassIntervals = [0, 0, 12, 0, 0, 7, 0, 0].map((v) => (scale[1] === 1 && v === 7 ? 1 : v))
  const percPattern = pick(r, PERC_PATTERNS)
  const percKind = pick(r, ['rim', 'tom', 'bell'])
  const stabSlot = Math.floor(r() * STAB_PATTERNS.length)
  const kickGhost = t.energy >= 4 && r() < 0.6

  // The riff: one phrase character per step, so the phrase is the melody.
  // A space is a rest; a vowel is an accent.
  const chars = [...t.phrase]
  const offset = (t.dice * 3) % Math.max(1, chars.length)
  const riff = []
  for (let i = 0; i < STEPS; i++) {
    const ch = chars[(i + offset) % chars.length] ?? ' '
    if (ch === ' ') { riff.push(null); continue }
    const c = charCode(ch)
    const next = chars[(i + offset + 1) % chars.length] ?? ' '
    riff.push({
      note: root + 24 + degree(ACID_PALETTE[(c * 7 + t.dice * 5) % ACID_PALETTE.length]),
      accent: 'aeiou'.includes(ch),
      slide: next !== ' ' && (c * 13 + i) % 5 === 0,
    })
  }

  const ev = { kick: [], bass: [], hats: [], clap: [], perc: [], acid: [], stab: [], ride: [], pad: [] }
  for (let bar = 0; bar < BARS; bar++) {
    const last = bar === BARS - 1
    for (let s = 0; s < STEPS; s++) {
      const step = bar * STEPS + s
      // kick: four on the floor, dropped on the last beat of the loop for a lift
      if (s % 4 === 0 && !(last && s === 12 && t.energy <= 2)) ev.kick.push({ step, vel: 1 })
      if (kickGhost && s === 14 && bar % 2 === 1) ev.kick.push({ step, vel: 0.55 })
      // bass
      if (bassPattern[s] === 'x') ev.bass.push({ step, note: root + bassIntervals[(s + bar) % bassIntervals.length], vel: s % 4 === 2 ? 1 : 0.8 })
      // hats: closed on the offbeat, then 8ths, then a ghost 16th, then 16ths; open hats from peak energy
      const open = (t.energy >= 3 || t.mood >= 4) && s % 4 === 2
      if (open) ev.hats.push({ step, vel: 0.9, open: true })
      else if (t.energy === 0 ? s % 4 === 2 : t.energy === 1 ? s % 2 === 0 : t.energy === 2 ? s % 2 === 0 || s % 4 === 3 : true) ev.hats.push({ step, vel: s % 4 === 2 ? 1 : s % 2 === 0 ? 0.55 : 0.3, open: false })
      // clap on 2 and 4, with a roll into the loop point
      if (s === 4 || s === 12) ev.clap.push({ step, vel: 1 })
      if (last && t.energy >= 3 && s >= 13) ev.clap.push({ step, vel: 0.35 + 0.2 * (s - 13) })
      // perc, with a fill in bar 4
      if (percPattern[s] === 'x' || (bar === 3 && s >= 12 && s % 2 === 1)) ev.perc.push({ step, vel: s % 3 === 0 ? 1 : 0.7, kind: percKind })
      // acid
      const n = riff[s]
      if (n) ev.acid.push({ step, ...n })
      // stab: the pattern shifts every other bar so the chords breathe
      const stabPattern = STAB_PATTERNS[(stabSlot + (bar % 2)) % STAB_PATTERNS.length]
      if (stabPattern[s] === 'x') ev.stab.push({ step, notes: chordShape.map((i) => root + 24 + i), vel: 1 })
      // ride: every 8th, the offbeat ones ring out
      if (s % 2 === 0) ev.ride.push({ step, vel: s % 4 === 2 ? 1 : 0.55 })
    }
  }
  // the pad: one long swell over the loop, the root, the fifth, and the minor third above (or the octave)
  ev.pad.push({ step: 0, notes: minorThird ? [root + 12, root + 19, root + 27] : [root + 12, root + 19, root + 24] })
  // your step edits: the same on/off mask in every bar of the loop
  const chord = chordShape.map((i) => root + 24 + i)
  const fresh = { kick: () => ({ vel: 1 }), hats: () => ({ vel: 0.8, open: false }), bass: () => ({ note: root, vel: 0.9 }), perc: () => ({ vel: 0.85, kind: percKind }), clap: () => ({ vel: 1 }), acid: () => ({ note: root + 24, accent: false, slide: false }), stab: () => ({ notes: chord, vel: 1 }), ride: () => ({ vel: 0.8 }) }
  for (const [name, [onMask, offMask]] of Object.entries(t.steps)) {
    ev[name] = ev[name].filter((e) => !(offMask & (1 << (e.step % STEPS))))
    for (let bar = 0; bar < BARS; bar++) {
      for (let s = 0; s < STEPS; s++) {
        const step = bar * STEPS + s
        if (onMask & (1 << s) && !ev[name].some((e) => e.step === step)) ev[name].push({ step, ...fresh[name]() })
      }
    }
    ev[name].sort((x, y) => x.step - y.step)
  }
  for (const name of Object.keys(ev)) if (!on[name]) ev[name] = []
  return { track: t, on, root, events: ev, stepSeconds: 60 / t.bpm / 4, steps: BARS * STEPS, percKind }
}

// Adds or removes the hit at step `i` (0..15) of one layer, in every bar.
// An edit that puts the step back the way the pattern has it is dropped, so
// the share code stays short.
export function toggleStep(input, layer, i) {
  const t = cleanTrack(input)
  if (!GRID_LAYERS.includes(layer) || i < 0 || i >= STEPS) return t
  const all = { ...t, layers: Object.fromEntries(LAYERS.map((n) => [n, true])) }
  const want = grid(all)[layer][i] === '.'
  const rest = { ...t.steps }
  delete rest[layer]
  const base = grid({ ...all, steps: rest })[layer][i] !== '.'
  let [onMask, offMask] = t.steps[layer] ?? [0, 0]
  const bit = 1 << i
  onMask &= ~bit; offMask &= ~bit
  if (want !== base) { if (want) onMask |= bit; else offMask |= bit }
  return cleanTrack({ ...t, steps: { ...rest, ...(onMask || offMask ? { [layer]: [onMask, offMask] } : {}) } })
}

// One bar of the arrangement as text, for the pane: 'x' a hit, 'X' an accent.
export function grid(input, bar = 0) {
  const a = arrange(input)
  const out = {}
  for (const name of GRID_LAYERS) {
    if (!a.on[name]) continue
    const row = Array(STEPS).fill('.')
    for (const e of a.events[name]) {
      if (Math.floor(e.step / STEPS) !== bar) continue
      row[e.step % STEPS] = e.accent || e.open ? 'X' : 'x'
    }
    out[name] = row.join('')
  }
  return out
}

// ---------- DSP ----------

const TAU = Math.PI * 2
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12)

function soft(x) {
  if (x > 3) return 1
  if (x < -3) return -1
  const x2 = x * x
  return (x * (27 + x2)) / (27 + 9 * x2)
}

function polyblep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1 }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1 }
  return 0
}

// State-variable filter (Simper's trapezoidal form). mode: 0 low, 1 band, 2 high.
function svf() {
  let ic1 = 0, ic2 = 0, a1 = 0, a2 = 0, a3 = 0, k = 1
  return {
    set(fc, sr, q) {
      const g = Math.tan(Math.PI * Math.min(fc, sr * 0.45) / sr)
      k = 1 / q
      a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2
    },
    run(v0, mode) {
      const v3 = v0 - ic2
      const v1 = a1 * ic1 + a2 * v3
      const v2 = ic2 + a2 * ic1 + a3 * v3
      ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2
      return mode === 0 ? v2 : mode === 1 ? v1 : v0 - k * v1 - v2
    },
  }
}

function noiseSource(seed) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5
    return ((s >>> 0) / 4294967296) * 2 - 1
  }
}

// The kick: a sine that falls from a click to a deep tail, driven into a
// soft clipper, with a short filtered-noise transient on top.
function renderKick(buf, sr, at, vel, k, noise) {
  const start = Math.round(at * sr)
  const len = Math.min(Math.round(0.55 * sr), buf.length - start)
  const fade = Math.round(0.04 * sr)
  const hp = svf(); hp.set(3500, sr, 0.7)
  let ph = 0
  for (let i = 0; i < len; i++) {
    const t = i / sr
    const f = k.f1 + (k.f0 - k.f1) * Math.exp(-t / k.pitchDecay) + 260 * Math.exp(-t / 0.0045)
    ph += (TAU * f) / sr
    let amp = Math.exp(-t / k.ampDecay) * (0.75 + 0.25 * Math.exp(-t / 0.04))
    if (i > len - fade) amp *= (len - i) / fade
    let s = soft(Math.sin(ph) * amp * k.drive) * 0.95
    if (t < 0.006) s += hp.run(noise(), 2) * 0.45 * (1 - t / 0.006)
    buf[start + i] += s * vel
  }
}

// The bass: a driven sine sub at the note (e1..d#2, felt more than heard)
// under two detuned saws an octave up through a 4-pole low-pass, so it rolls
// and growls and still reads on laptop speakers. Saturated at the end.
function renderBass(buf, sr, at, dur, midi, vel, cutoff, grit, noise) {
  const start = Math.round(at * sr)
  const len = Math.min(Math.round(dur * sr), buf.length - start)
  const f = mtof(midi)
  const d1 = (f * 2.012) / sr, d2 = (f * 1.988) / sr, d0 = f / sr
  const lp1 = svf(), lp2 = svf()
  let p0 = 0, p1 = noise() * 0.5 + 0.5, p2 = noise() * 0.5 + 0.5
  const rel = Math.min(len, Math.round(0.008 * sr))
  for (let i = 0; i < len; i++) {
    const t = i / sr
    p0 += d0; if (p0 >= 1) p0 -= 1
    p1 += d1; if (p1 >= 1) p1 -= 1
    p2 += d2; if (p2 >= 1) p2 -= 1
    const saws = (2 * p1 - 1 - polyblep(p1, d1)) + (2 * p2 - 1 - polyblep(p2, d2))
    if ((i & 15) === 0) {
      const fc = cutoff * (1 + 2.4 * Math.exp(-t / 0.045))
      lp1.set(fc, sr, 0.8); lp2.set(fc, sr, 0.9)
    }
    const body = lp2.run(lp1.run(saws * 0.45, 0), 0)
    const sub = soft(Math.sin(TAU * p0) * 1.7)
    const env = Math.min(1, t / 0.004) * (0.7 + 0.3 * Math.exp(-t / 0.12)) * (i > len - rel ? (len - i) / rel : 1)
    buf[start + i] += soft((body * grit * 0.85 + sub) * 1.35) * 0.8 * env * vel
  }
}

// Hats: mostly high-passed noise with a little metal, so they hiss like a
// real 909 instead of buzzing like a chip.
const HAT_FREQS = [205.3, 304.4, 369.6, 522.7, 540, 800]

function renderHat(buf, sr, at, vel, open, tone, noise) {
  const start = Math.round(at * sr)
  const decay = open ? 0.2 : 0.026
  const len = Math.min(Math.round(decay * 6 * sr), buf.length - start)
  const hp = svf(); hp.set(8200, sr, 0.7)
  const bp = svf(); bp.set(11500, sr, 0.6)
  const phases = HAT_FREQS.map(() => 0)
  for (let i = 0; i < len; i++) {
    const t = i / sr
    let metal = 0
    for (let j = 0; j < 6; j++) {
      phases[j] += (HAT_FREQS[j] * tone * 2) / sr
      if (phases[j] >= 1) phases[j] -= 1
      metal += phases[j] < 0.5 ? 1 : -1
    }
    const x = metal * 0.035 + noise() * 0.9
    const env = Math.min(1, t / 0.0008) * Math.exp(-t / decay)
    const y = hp.run(x, 2)
    buf[start + i] += (y * 0.6 + bp.run(y, 1) * 0.8) * env * vel
  }
}

function renderClap(buf, sr, at, vel, noise) {
  const start = Math.round(at * sr)
  const len = Math.min(Math.round(0.35 * sr), buf.length - start)
  const bp = svf(); bp.set(1050, sr, 1.5)
  for (let i = 0; i < len; i++) {
    const t = i / sr
    let env = 0
    for (const o of [0, 0.011, 0.022]) if (t >= o) env = Math.max(env, Math.exp(-(t - o) / 0.0045))
    if (t >= 0.03) env = Math.max(env, 0.55 * Math.exp(-(t - 0.03) / 0.11))
    buf[start + i] += bp.run(noise(), 1) * env * vel * 2.2
  }
}

function renderPerc(buf, sr, at, vel, kind, pitch, noise) {
  const start = Math.round(at * sr)
  const len = Math.min(Math.round((kind === 'tom' ? 0.3 : 0.12) * sr), buf.length - start)
  let ph = 0, ph2 = 0
  for (let i = 0; i < len; i++) {
    const t = i / sr
    let s
    if (kind === 'tom') {
      const f = pitch * (1 + 0.8 * Math.exp(-t / 0.02))
      ph += f / sr
      s = Math.sin(TAU * ph) * Math.exp(-t / 0.09)
    } else if (kind === 'bell') {
      ph += (pitch * 4) / sr; ph2 += (pitch * 4 * 1.48) / sr
      s = Math.sin(TAU * ph + 1.5 * Math.sin(TAU * ph2)) * Math.exp(-t / 0.045) * 0.7
    } else {
      ph += (pitch * 6) / sr
      s = (Math.sin(TAU * ph) * 0.6 + noise() * 0.4) * Math.exp(-t / 0.012)
    }
    buf[start + i] += s * vel
  }
}

function renderStab(buf, sr, at, notes, vel, cutoff, noise) {
  const start = Math.round(at * sr)
  const len = Math.min(Math.round(0.4 * sr), buf.length - start)
  const flt = svf()
  const osc = []
  for (const n of notes) for (const d of [-0.12, 0, 0.12]) osc.push({ dt: mtof(n + d) / sr, ph: noise() * 0.5 + 0.5 })
  const gain = 0.5 / Math.sqrt(osc.length)
  for (let i = 0; i < len; i++) {
    const t = i / sr
    let x = 0
    for (const o of osc) {
      o.ph += o.dt; if (o.ph >= 1) o.ph -= 1
      x += 2 * o.ph - 1 - polyblep(o.ph, o.dt)
    }
    if ((i & 15) === 0) flt.set(cutoff * (1 + 1.5 * Math.exp(-t / 0.05)), sr, 1.4)
    const env = Math.min(1, t / 0.003) * Math.exp(-t / 0.11)
    buf[start + i] += flt.run(x * gain, 0) * env * vel
  }
}

// The acid line is one monophonic voice through the whole loop, so notes can
// slide into each other the way a TB-303 does.
function renderAcid(buf, sr, a, total, sweep) {
  const { stepSeconds, track: t } = a
  const byStep = new Map(a.events.acid.map((e) => [e.step, e]))
  const stepLen = stepSeconds * sr
  let ph = 0, freq = 110, target = 110, env = 0, amp = 0, accentAmt = 0
  let y1 = 0, y2 = 0, y3 = 0, y4 = 0
  const res = 0.55 + 0.08 * t.energy + (t.mood <= 1 ? 0.08 : 0)
  const fb = res * 3.6
  const decay = 0.12 + 0.05 * t.mood
  const glide = Math.exp(-1 / (0.035 * sr))
  let gateEnd = -1
  for (let i = 0; i < total; i++) {
    const stepF = i / stepLen
    const step = Math.floor(stepF) % a.steps
    if (i === Math.round(Math.floor(stepF) * stepLen)) {
      const e = byStep.get(step)
      const prev = byStep.get((step + a.steps - 1) % a.steps)
      if (e) {
        target = mtof(e.note)
        if (!(prev && prev.slide)) { env = 1; accentAmt = e.accent ? 1 : 0; freq = target }
        gateEnd = i + Math.round(stepLen * (e.slide ? 1.05 : 0.55))
      }
    }
    freq = target + (freq - target) * glide
    const gate = i < gateEnd ? 1 : 0
    amp += ((gate ? 1 : 0) - amp) * (gate ? 0.02 : 0.004)
    env *= Math.exp(-1 / (decay * sr))
    const dt = freq / sr
    ph += dt; if (ph >= 1) ph -= 1
    const saw = 2 * ph - 1 - polyblep(ph, dt)
    const fc = clamp(sweep(i) * (1 + (3.5 + 3 * accentAmt) * env), 60, 9000)
    const g = 1 - Math.exp((-TAU * fc) / sr)
    const x = soft(saw - fb * y4)
    y1 += g * (x - y1); y2 += g * (y1 - y2); y3 += g * (y2 - y3); y4 += g * (y3 - y4)
    buf[i] += soft(y4 * (2.2 + fb * 0.5)) * amp * (0.75 + 0.35 * accentAmt * env)
  }
}

// Freeverb: 8 combs and 4 allpasses per side.
function reverbSide(input, sr, room, damp, spread) {
  const scale = sr / 44100
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]
  const apT = [556, 441, 341, 225]
  {
    const combs = combT.map((n) => ({ b: new Float32Array(Math.round((n + spread) * scale)), i: 0, f: 0 }))
    const aps = apT.map((n) => ({ b: new Float32Array(Math.round((n + spread) * scale)), i: 0 }))
    const out = new Float32Array(input.length)
    for (let n = 0; n < input.length; n++) {
      const x = input[n] * 0.015
      let y = 0
      for (const c of combs) {
        const o = c.b[c.i]
        c.f = o * (1 - damp) + c.f * damp
        c.b[c.i] = x + c.f * room
        if (++c.i >= c.b.length) c.i = 0
        y += o
      }
      for (const a of aps) {
        const o = a.b[a.i]
        a.b[a.i] = y + o * 0.5
        if (++a.i >= a.b.length) a.i = 0
        y = o - y
      }
      out[n] = y
    }
    return out
  }
}

function reverb(inL, inR, sr, room, damp) {
  return [reverbSide(inL, sr, room, damp, 0), reverbSide(inR, sr, room, damp, 23)]
}

function pingPong(input, sr, delaySeconds, feedback) {
  const n = Math.round(delaySeconds * sr)
  const bl = new Float32Array(n), br = new Float32Array(n)
  const outL = new Float32Array(input.length), outR = new Float32Array(input.length)
  let i = 0, lpL = 0, lpR = 0, hpL = 0, hpR = 0
  const lp = 1 - Math.exp((-TAU * 2600) / sr)
  const hp = 1 - Math.exp((-TAU * 280) / sr)
  for (let s = 0; s < input.length; s++) {
    const dl = bl[i], dr = br[i]
    lpL += lp * (dl - lpL); lpR += lp * (dr - lpR)
    hpL += hp * (lpL - hpL); hpR += hp * (lpR - hpR)
    bl[i] = input[s] + (lpR - hpR) * feedback
    br[i] = (lpL - hpL) * feedback
    if (++i >= n) i = 0
    outL[s] = dl; outR[s] = dr
  }
  return [outL, outR]
}

// ---------- the voice ----------
// The mod records the track's name with a free macOS voice (`say`) and hands
// the clips in; the engine stays pure. A clip is { data: Float32Array, rate }.

// A 16-bit PCM WAV (as `say --file-format=WAVE` writes it) to a mono clip at
// peak 1. Walks the chunks, since `say` puts an FLLR chunk before the data.
export function decodeWav(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = (o) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3])
  if (bytes.length < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null
  let o = 12, rate = 0, channels = 1, bits = 16
  while (o + 8 <= bytes.length) {
    const id = tag(o), size = v.getUint32(o + 4, true)
    if (id === 'fmt ') { channels = v.getUint16(o + 10, true); rate = v.getUint32(o + 12, true); bits = v.getUint16(o + 22, true) }
    if (id === 'data') {
      if (bits !== 16 || !rate) return null
      const n = Math.floor(Math.min(size, bytes.length - o - 8) / 2 / channels)
      const data = new Float32Array(n)
      let peak = 0
      for (let i = 0; i < n; i++) { data[i] = v.getInt16(o + 8 + i * 2 * channels, true) / 32768; peak = Math.max(peak, Math.abs(data[i])) }
      if (peak > 0) for (let i = 0; i < n; i++) data[i] /= peak
      return { data, rate }
    }
    o += 8 + size + (size & 1)
  }
  return null
}

// Pitched down (the whisper three semitones, the deep voice four), band-passed
// like an old radio and driven a little. The echo and the room come from the sends.
function renderVoice(buf, sr, at, clip, pitch, gain) {
  const start = Math.round(at * sr)
  const inc = (clip.rate / sr) * pitch
  const n = Math.min(Math.floor((clip.data.length - 1) / inc), buf.length - start)
  const hp = svf(); hp.set(190, sr, 0.7)
  const lp = svf(); lp.set(4800, sr, 0.8)
  for (let i = 0; i < n; i++) {
    const p = i * inc, k = Math.floor(p), f = p - k
    const x = clip.data[k] * (1 - f) + clip.data[k + 1] * f
    buf[start + i] += soft(lp.run(hp.run(x, 2), 0) * 1.8) * gain
  }
}

// ---------- render ----------

// Renders one hit into its own buffer, so a drum is synthesized once per
// render and then copied to each step.
function template(sr, seconds, draw) {
  const buf = new Float32Array(Math.round(seconds * sr))
  draw(buf)
  return buf
}

function stamp(buf, tpl, at, vel, sr) {
  const start = Math.round(at * sr)
  const n = Math.min(tpl.length, buf.length - start)
  for (let i = 0; i < n; i++) buf[start + i] += tpl[i] * vel
}

// The ride: brighter, longer metal than the hats, so a drop opens up on top.
function renderRide(buf, sr, at, vel, tone, noise) {
  const start = Math.round(at * sr)
  const len = Math.min(Math.round(1.4 * sr), buf.length - start)
  const bp = svf(); bp.set(6800, sr, 0.9)
  const hp = svf(); hp.set(4200, sr, 0.7)
  const phases = HAT_FREQS.map(() => 0)
  for (let i = 0; i < len; i++) {
    const t = i / sr
    let metal = 0
    for (let j = 0; j < 6; j++) {
      phases[j] += (HAT_FREQS[j] * tone * 3.1) / sr
      if (phases[j] >= 1) phases[j] -= 1
      metal += phases[j] < 0.5 ? 1 : -1
    }
    const env = Math.min(1, t / 0.001) * (0.35 * Math.exp(-t / 0.02) + 0.65 * Math.exp(-t / 0.42))
    const x = metal * 0.12 + noise() * 0.5
    buf[start + i] += (bp.run(x, 1) * 0.9 + hp.run(noise(), 2) * 0.12) * env * vel
  }
}

// The pad: one dark swell over the loop, three detuned saws a note through a
// slow low-pass. It fades in over the first half and out over the last bars,
// so it breathes once per loop and the loop has no seam.
function renderPad(buf, sr, len, notes, cutoff, noise) {
  const osc = []
  for (const n of notes) for (const d of [-0.09, 0, 0.09]) osc.push({ dt: mtof(n + d) / sr, ph: noise() * 0.5 + 0.5 })
  const gain = 0.6 / Math.sqrt(osc.length)
  const lp1 = svf(), lp2 = svf()
  const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
  for (let i = 0; i < len && i < buf.length; i++) {
    const u = i / len
    let x = 0
    for (const o of osc) {
      o.ph += o.dt; if (o.ph >= 1) o.ph -= 1
      x += 2 * o.ph - 1 - polyblep(o.ph, o.dt)
    }
    if ((i & 31) === 0) {
      const fc = cutoff * (0.6 + 0.9 * Math.sin(Math.PI * u))
      lp1.set(fc, sr, 0.7); lp2.set(fc, sr, 0.9)
    }
    const env = smooth(u / 0.45) * smooth((1 - u) / 0.22)
    buf[i] += lp2.run(lp1.run(x * gain, 0), 0) * env
  }
}

// The riser: noise through a band-pass that climbs over the last four bars of
// the loop before a drop, louder as it goes.
function renderRiser(buf, sr, from, len, noise) {
  const bp = svf()
  for (let i = 0; i < len && from + i < buf.length; i++) {
    const u = i / len
    if ((i & 15) === 0) bp.set(250 * Math.pow(32, u), sr, 2.2)
    buf[from + i] += bp.run(noise(), 1) * u * u * 1.1
  }
}

// The crash on the first beat of a drop.
function renderCrash(buf, sr, at, noise) {
  const start = Math.round(at * sr)
  const len = Math.min(Math.round(2.2 * sr), buf.length - start)
  const hp = svf(); hp.set(3800, sr, 0.7)
  const phases = HAT_FREQS.map(() => 0)
  for (let i = 0; i < len; i++) {
    const t = i / sr
    let metal = 0
    for (let j = 0; j < 6; j++) {
      phases[j] += (HAT_FREQS[j] * 4.3) / sr
      if (phases[j] >= 1) phases[j] -= 1
      metal += phases[j] < 0.5 ? 1 : -1
    }
    buf[start + i] += hp.run(noise() * 0.8 + metal * 0.06, 2) * Math.min(1, t / 0.002) * Math.exp(-t / 0.7)
  }
}

// The level into the master's soft clip. Fixed, so a breakdown is quieter
// than a drop, as in a real set (it was a per-loop peak before 0.8).
const MASTER_GAIN = 0.65
const TAIL_SECONDS = 2.5

// The whole loop before the master: every bus mixed to stereo, with the
// tail (reverb, delay, the last hits) after the loop still separate.
// opts.rise: a riser over the last four bars and no kick in the last bar.
// opts.impact: a crash on the first beat.
export function mixdown(input, { sampleRate = 44100, voices = null, rise = false, impact = false } = {}) {
  const a = arrange(input)
  const t = a.track
  const sr = sampleRate
  const loop = Math.round(a.steps * a.stepSeconds * sr)
  const total = loop + Math.round(TAIL_SECONDS * sr)
  const noise = noiseSource(hash32('noise:' + t.phrase + ':' + t.dice))
  const r = rng(hash32('sound:' + t.phrase))
  const stepAt = (step, swingable) => step * a.stepSeconds + (swingable && step % 2 === 1 ? t.swing * 0.045 * a.stepSeconds : 0)
  const bus = () => new Float32Array(total)
  const kick = bus(), bass = bus(), hats = bus(), clap = bus(), perc = bus(), acid = bus(), stab = bus(), voice = bus(), ride = bus(), pad = bus(), fx = bus()
  const lastBar = (BARS - 1) * STEPS
  const kicks = rise ? a.events.kick.filter((e) => e.step < lastBar) : a.events.kick

  // the kick's tail sits on the key's root, so kick and sub are one note
  let tail = mtof(a.root)
  while (tail >= 56) tail /= 2
  const k = { f0: 140 + r() * 40, f1: tail, pitchDecay: 0.04 + r() * 0.015, ampDecay: 0.24 + r() * 0.06, drive: 1.9 + t.energy * 0.3 }
  const kickHit = template(sr, 0.55, (b) => renderKick(b, sr, 0, 1, k, noise))
  for (const e of kicks) stamp(kick, kickHit, stepAt(e.step, false), e.vel, sr)

  const bassCut = 160 + t.mood * 70 + t.energy * 45
  const bassGrit = 0.8 + 0.1 * t.energy - 0.1 * Math.min(t.mood, 2)
  // a bass note holds until the next one, at most two steps
  const bassAt = a.events.bass.map((e) => e.step)
  a.events.bass.forEach((e, i) => {
    const gap = ((bassAt[(i + 1) % bassAt.length] - e.step + a.steps - 1) % a.steps) + 1
    renderBass(bass, sr, stepAt(e.step, false), a.stepSeconds * Math.min(2, gap) * 0.9, e.note, e.vel, bassCut, bassGrit, noise)
  })

  const hatTone = 1.1 + r() * 0.5
  // two closed hats that alternate, so a run of 16ths does not sound like a machine gun
  const closedHats = [0, 1].map(() => template(sr, 0.16, (b) => renderHat(b, sr, 0, 1, false, hatTone, noise)))
  const openHat = template(sr, 1.2, (b) => renderHat(b, sr, 0, 1, true, hatTone, noise))
  for (const e of a.events.hats) stamp(hats, e.open ? openHat : closedHats[e.step % 2], stepAt(e.step, true), e.vel, sr)
  const clapHit = template(sr, 0.35, (b) => renderClap(b, sr, 0, 1, noise))
  for (const e of a.events.clap) stamp(clap, clapHit, stepAt(e.step, false), e.vel, sr)
  // a clap roll into the drop
  if (rise && a.on.clap) for (let s = 8; s < STEPS; s++) stamp(clap, clapHit, stepAt(lastBar + s, false), 0.25 + 0.06 * (s - 8), sr)
  const percPitch = 140 + r() * 120
  const percHit = template(sr, 0.3, (b) => renderPerc(b, sr, 0, 1, a.percKind, percPitch, noise))
  for (const e of a.events.perc) stamp(perc, percHit, stepAt(e.step, true), e.vel, sr)
  if (a.events.ride.length) {
    const rideHit = template(sr, 1.4, (b) => renderRide(b, sr, 0, 1, hatTone, noise))
    for (const e of a.events.ride) stamp(ride, rideHit, stepAt(e.step, true), e.vel, sr)
  }

  const loopSeconds = loop / sr
  if (a.events.acid.length) {
    const sweepBase = 260 + t.mood * 120
    const sweepDepth = 1.6 + t.energy * 0.9
    renderAcid(acid, sr, a, total, (i) => sweepBase * (1 + sweepDepth * (0.5 - 0.5 * Math.cos((TAU * (i / sr)) / loopSeconds))))
  }

  const stabCut = 450 + t.mood * 280 + t.energy * 120
  for (const e of a.events.stab) renderStab(stab, sr, stepAt(e.step, false), e.notes, e.vel, stabCut, noise)
  for (const e of a.events.pad) renderPad(pad, sr, loop, e.notes, 380 + t.mood * 90, noise)

  if (rise) renderRiser(fx, sr, Math.round(4 * STEPS * a.stepSeconds * sr), loop - Math.round(4 * STEPS * a.stepSeconds * sr), noise)
  if (impact) renderCrash(fx, sr, 0, noise)

  // the voice says the name once a loop: deep on a drop's first bar, a whisper in bar 3
  const drop = t.part !== null && t.part !== undefined && PLAN[t.part].section === 'drop'
  const clip = a.on.voice && voices ? (drop ? voices.deep : voices.whisper) : null
  if (clip) renderVoice(voice, sr, (drop ? 0 : 2 * STEPS) * a.stepSeconds, clip, drop ? 0.79 : 0.84, drop ? 0.75 : 0.85)

  // sidechain: everything but the kick ducks under each kick
  const duck = new Float32Array(total).fill(1)
  for (const e of kicks) {
    const s0 = Math.round(stepAt(e.step, false) * sr)
    for (let i = 0; i < Math.round(0.3 * sr) && s0 + i < total; i++) {
      const tt = i / sr
      const d = 1 - 0.7 * e.vel * Math.min(1, tt / 0.004) * Math.exp(-tt / 0.09)
      duck[s0 + i] = Math.min(duck[s0 + i], d)
    }
  }

  // sends
  const revIn = bus(), dlyIn = bus()
  for (let i = 0; i < total; i++) {
    revIn[i] = clap[i] * 0.6 + perc[i] * 0.35 + stab[i] * 0.35 + hats[i] * 0.12 + acid[i] * 0.12 + voice[i] * 0.55 + ride[i] * 0.15 + pad[i] * 0.5 + fx[i] * 0.6
    dlyIn[i] = stab[i] * 0.7 + acid[i] * 0.18 + perc[i] * 0.15 + voice[i] * 0.6
  }
  const room = 0.8 + (t.mood <= 1 ? 0.06 : 0)
  const [revL, revR] = reverb(revIn, revIn, sr, room, 0.35)
  const [dlyL, dlyR] = pingPong(dlyIn, sr, a.stepSeconds * 3, 0.5)

  // rumble: the kick through a long dark reverb, low-passed and heavily ducked
  let rumL = null
  if (a.on.rumble) {
    const rl = reverbSide(kick, sr, 0.9, 0.6, 0)
    rumL = new Float32Array(total)
    let lp1 = 0, lp2 = 0
    const g = 1 - Math.exp((-TAU * 130) / sr)
    for (let i = 0; i < total; i++) {
      lp1 += g * (rl[i] - lp1); lp2 += g * (lp1 - lp2)
      rumL[i] = lp2
    }
  }

  const levels = { kick: 0.9, bass: 1.05, hats: 0.4, clap: 0.7, perc: 0.22, acid: 0.45, stab: 0.75, ride: 0.16, pad: 1.2, fx: 0.32 }
  const left = new Float32Array(total), right = new Float32Array(total)
  for (let i = 0; i < total; i++) {
    const d = duck[i]
    const center = kick[i] * levels.kick + (bass[i] * levels.bass + clap[i] * levels.clap + acid[i] * levels.acid) * d + voice[i] * 0.8 * Math.sqrt(d) + (rumL ? rumL[i] * 1.35 * (d * d) : 0) + fx[i] * levels.fx
    const h = hats[i] * levels.hats, p = perc[i] * levels.perc, s = stab[i] * levels.stab * d, rd = ride[i] * levels.ride * Math.sqrt(d), pd = pad[i] * levels.pad * d
    left[i] = center + h * 0.8 + p * 1.15 + s + rd * 1.2 + pd + (revL[i] * 0.9 + dlyL[i] * 0.45) * d
    right[i] = center + h * 1.15 + p * 0.8 + s + rd * 0.8 + pd + (revR[i] * 0.9 + dlyR[i] * 0.45) * d
  }
  return { left, right, loop, total, sampleRate: sr, seconds: loopSeconds, stepSeconds: a.stepSeconds }
}

// The master, in place on n samples: high-pass at 25 Hz, a gentle 12 kHz
// low-pass that takes the digital edge off, a fixed gain into a soft clip
// that only rounds the kick's tip, then -1 dBFS at most.
function master(left, right, n) {
  let hpL = 0, hpR = 0, lpL = 0, lpR = 0
  const hpG = 1 - Math.exp((-TAU * 25) / 44100)
  const lpG = 1 - Math.exp((-TAU * 12000) / 44100)
  for (let i = 0; i < n; i++) {
    hpL += hpG * (left[i] - hpL); hpR += hpG * (right[i] - hpR)
    lpL += lpG * (left[i] - hpL - lpL); lpR += lpG * (right[i] - hpR - lpR)
    left[i] = soft(lpL * MASTER_GAIN) * 0.89
    right[i] = soft(lpR * MASTER_GAIN) * 0.89
  }
}

// Renders the 8-bar loop. The reverb and delay tails fold back onto the start,
// so the loop repeats without a seam.
export function render(input, opts = {}) {
  const m = mixdown(input, opts)
  const outL = m.left.slice(0, m.loop), outR = m.right.slice(0, m.loop)
  for (let i = 0; i < m.total - m.loop && i < m.loop; i++) { outL[i] += m.left[m.loop + i]; outR[i] += m.right[m.loop + i] }
  master(outL, outR, m.loop)
  return { left: outL, right: outR, sampleRate: m.sampleRate, seconds: m.seconds, stepSeconds: m.stepSeconds }
}

// One loop for a stream: no fold. `left` and `right` run past the loop by the
// tail, which the player adds onto whatever plays next.
// opts.with: a second track mixed in at the same tempo (the handover).
export function renderLoop(input, opts = {}) {
  const m = mixdown(input, opts)
  if (opts.with) {
    const o = mixdown({ ...opts.with, bpm: cleanTrack(input).bpm }, { ...opts, rise: false, impact: false, with: null })
    for (let i = 0; i < m.total && i < o.total; i++) { m.left[i] += o.left[i]; m.right[i] += o.right[i] }
  }
  master(m.left, m.right, m.total)
  return { left: m.left, right: m.right, loop: m.loop, sampleRate: m.sampleRate, seconds: m.seconds, stepSeconds: m.stepSeconds }
}

// A track with only these layers on, at a part of the build: for the handover.
export function onlyLayers(input, names) {
  const t = cleanTrack(input)
  return { ...t, layers: Object.fromEntries(LAYERS.map((n) => [n, names.includes(n)])) }
}

// The whole build as one clip: the first 4 bars of each part in order, then
// the last part's full 8 bars, fading out. `tracks` are the states you left
// each part in, so your tweaks and step edits are in the replay too.
export function renderSet(tracks, { sampleRate = 44100, voices = null } = {}) {
  const pieces = tracks.map((t, i) => {
    const a = render(t, { sampleRate, voices })
    const n = i === tracks.length - 1 ? a.left.length : Math.round(a.left.length / 2)
    return [a.left.subarray(0, n), a.right.subarray(0, n)]
  })
  const total = pieces.reduce((sum, [l]) => sum + l.length, 0)
  const left = new Float32Array(total), right = new Float32Array(total)
  let o = 0
  for (const [l, r] of pieces) { left.set(l, o); right.set(r, o); o += l.length }
  const fade = Math.min(total, Math.round(4 * sampleRate))
  for (let i = 0; i < fade; i++) { const g = i / fade; left[total - 1 - i] *= g; right[total - 1 - i] *= g }
  return { left, right, sampleRate, seconds: total / sampleRate }
}

// 16-bit stereo WAV. `startSeconds` rotates the loop so playback can begin
// mid-loop and stay on the beat after a change.
export function toWav({ left, right, sampleRate }, startSeconds = 0) {
  const n = left.length
  const offset = ((Math.round(startSeconds * sampleRate) % n) + n) % n
  const out = new Uint8Array(44 + n * 4)
  const v = new DataView(out.buffer)
  const str = (o, s) => { for (let i = 0; i < s.length; i++) out[o + i] = s.charCodeAt(i) }
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); str(8, 'WAVE')
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true)
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true)
  str(36, 'data'); v.setUint32(40, n * 4, true)
  let o = 44
  for (let k = 0; k < n; k++) {
    const i = (k + offset) % n
    v.setInt16(o, Math.round(clamp(left[i], -1, 1) * 32767), true)
    v.setInt16(o + 2, Math.round(clamp(right[i], -1, 1) * 32767), true)
    o += 4
  }
  return out
}
