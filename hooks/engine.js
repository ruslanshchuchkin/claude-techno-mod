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

// The edit card (Ruslan, 2026-10-04, layout B "focus card"): per sound, its
// instrument, its pattern, its notes and its tone; for the whole track, the
// master filters. Index 0 is always the sound the phrase gives (for perc,
// the phrase's own pick of rim, tom or bell).
export const INSTRUMENTS = {
  kick: ['deep', 'punchy', 'boom', 'hard'],
  bass: ['rolling', 'sub', 'growl', 'acid'],
  hats: ['tight', 'long', 'metal', 'dusty'],
  clap: ['room', 'snap', 'snare'],
  perc: ['phrase', 'rim', 'tom', 'bell'],
  acid: ['acid', 'square', 'pluck', 'soft'],
}
// Patterns to try, one bar of 16 steps. A pick becomes step edits, so it
// rides in the share code like a click on the grid.
export const PATTERNS = {
  kick: { 'four on the floor': 'x...x...x...x...', broken: 'x...x...x..x..x.', 'half time': 'x.......x.......', skip: 'x...x...x...x.x.' },
  bass: { offbeat: '..x...x...x...x.', rolling: '.xx..xx..xx..xx.', gallop: '.xxx.xxx.xxx.xxx', sparse: '..x.......x.....' },
  hats: { offbeat: '..x...x...x...x.', '8ths': 'x.x.x.x.x.x.x.x.', '16ths': 'xxxxxxxxxxxxxxxx', shuffle: '..x..xx...x..xx.' },
  clap: { '2 and 4': '....x.......x...', 'on 4': '............x...', push: '....x.....x.x...' },
  perc: { skip: '.x..x.....x..x..', shuffle: '...x..x....x..x.', steady: 'x..x..x..x..x...', broken: '.x.x...x.x...x..' },
  ride: { '8ths': 'x.x.x.x.x.x.x.x.', offbeat: '..x...x...x...x.', '16ths': 'xxxxxxxxxxxxxxxx' },
  acid: { '16ths': 'xxxxxxxxxxxxxxxx', sparse: 'x..x..x...x..x..', offbeat: '..x...x...x...x.', rolling: 'x.xx.xx.x.xx.xx.' },
}
// Sounds with notes you can set: one scale degree per step (0..14, written
// 0-9a-e; '.' keeps the pattern's note), the same in every bar.
export const NOTE_LAYERS = ['bass', 'acid']
// Sounds with a tone: [cut -3..3 (dark .. thin), grit 0..3].
export const TONE_LAYERS = ['kick', 'bass', 'hats', 'clap', 'perc', 'acid', 'ride', 'pad', 'rumble']
const NOTE_RE = /^[.0-9a-e]{16}$/

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
// A track's own order of parts (Ruslan, 2026-10-04: "remove a part like
// groove or add a new part ... with something recommended"): PLAN indexes,
// null for PLAN as it is. Auto walks it; a part can come twice.
export const planOf = (t) => t?.plan ?? PLAN.map((_, i) => i)
const sameAsPlan = (p) => p.length === PLAN.length && p.every((x, i) => x === i)

// What the song tab offers to add, the first fitting one recommended.
//   drop    a breakdown and a drop before the outro
//   groove  one more groove part after the groove
//   build   one more build before the first drop
//   break   a breakdown before the last drop
export function planAdds(input) {
  const plan = planOf(input)
  const drops = plan.filter((i) => PLAN[i].section === 'drop').length
  const grooves = plan.filter((i) => PLAN[i].section === 'groove').length
  const best = drops < 3 ? 'drop' : grooves < 2 ? 'groove' : drops < 5 ? 'drop' : 'build'
  return [['drop', 'breakdown and a drop'], ['groove', 'longer groove'], ['build', 'longer build'], ['break', 'a breakdown']].map(([id, label]) => ({ id, label, best: id === best }))
}

// Inserts a suggestion into the plan: { plan, at, count } (where it went).
export function planAdd(input, id) {
  const plan = [...planOf(input)]
  const lastIndex = (f) => { for (let k = plan.length - 1; k >= 0; k--) if (f(PLAN[plan[k]])) return k; return -1 }
  const firstIndex = (f) => plan.findIndex((i) => f(PLAN[i]))
  let at, parts
  if (id === 'drop') { const o = lastIndex((p) => p.section === 'outro'); at = o < 0 ? plan.length : o; parts = [6, 9] }
  else if (id === 'groove') { const g = lastIndex((p) => p.section === 'groove'); at = g < 0 ? Math.min(1, plan.length) : g + 1; parts = [3] }
  else if (id === 'build') { const d = firstIndex((p) => p.section === 'drop'); at = d < 0 ? plan.length : d; parts = [4] }
  else if (id === 'break') { const d = lastIndex((p) => p.section === 'drop'); at = d < 0 ? plan.length : d; parts = [6] }
  else return { plan, at: 0, count: 0 }
  if (plan.length + parts.length > 24) return { plan, at: 0, count: 0 }
  plan.splice(at, 0, ...parts)
  return { plan, at, count: parts.length }
}

// Old codes (p0..p9) named parts of the old ten-part build; `parseCode` moves
// them to the same section here. New codes use a<n>.
const OLD_PARTS = [0, 1, 2, 3, 4, 5, 7, 6, 9, 10]

// The handover (auto, after the outro): the old track takes its layers out
// while the new one comes in, and the new song starts from its beginning
// (Ruslan, 2026-10-04: "start the next song from the kick or hihats").
// Two shapes, picked by `transitionsOf(old).land`:
//   kick  the old track thins to its kick and hats, then the new song starts
//         from its own kick (part 0)
//   hats  the new song's hats come in over the old low end, then its kick and
//         bass land under them (part 2, "hats")
// Each step plays HANDOVER_LOOPS loops. The last loop builds up, the landing
// gets a crash and a boom.
export const HANDOVERS = {
  kick: { to: 0, steps: [{ from: ['kick', 'bass', 'hats', 'rumble', 'perc'], to: [] }, { from: ['kick', 'hats'], to: [] }] },
  hats: { to: 2, steps: [{ from: ['kick', 'bass', 'rumble', 'perc'], to: ['hats'] }, { from: ['kick', 'bass'], to: ['hats'] }] },
}
export const HANDOVER_LOOPS = 2

// The transitions auto plays (Ruslan, 2026-10-04: "i love all 3 ... do it
// randomly ... but so that it always fits the song"). The track's phrase and
// dice seed every pick, so a share code always plays the same transitions.
//   build: the loop before each drop (parts with `rise`)
//   fall:  the last loop of each drop, into the breakdown or the outro
//   swell: a short reversed cymbal into a new sound in the intro and groove
//   swap:  the build-up before the low end swaps in the handover
//   land:  where the next song starts after the handover, `kick` or `hats`
// The rules that make a pick fit: the mood weights the packs (sad leans on
// the riser and the filter, dark on the filter, echo and stutter), a song
// never plays the same build or fall twice in a row, and the last drop gets
// one of the two biggest builds.
export const BUILDS = ['riser', 'filter', 'echo', 'stutter']
export const FALLS = ['tapestop', 'washout', 'downlifter']
const BUILD_WEIGHTS = { sad: [3, 3, 2, 1], mysterious: [2, 2, 3, 2], dark: [1, 3, 3, 3] }
const FALL_WEIGHTS = { sad: [1, 3, 2], mysterious: [2, 2, 2], dark: [3, 1, 2] }
const LAND_WEIGHTS = { sad: [2, 1], mysterious: [1, 1], dark: [1, 2] }
const weighted = (r, names, weights, not = []) => {
  const ok = names.map((n, i) => (not.includes(n) ? 0 : weights[i]))
  let x = r() * ok.reduce((a, b) => a + b, 0)
  for (let i = 0; i < names.length; i++) if ((x -= ok[i]) < 0) return names[i]
  return names.find((n) => !not.includes(n))
}
export function transitionsOf(input) {
  const t = cleanTrack(input)
  const r = rng(hash32('fx:' + t.phrase + ':' + t.dice))
  const mood = moodName(t)
  const plan = planOf(t)
  const at = (k) => PLAN[plan[k]]
  // keyed by the position in the track's plan; a build goes on the part
  // right before a drop, a fall on the last loop of a drop
  const out = { build: {}, fall: {}, swell: {}, swap: null, land: 'kick' }
  let last = null
  const rises = plan.map((_, k) => (at(k).section !== 'drop' && at(k + 1)?.section === 'drop' ? k : -1)).filter((k) => k >= 0)
  for (const k of rises) {
    const final = k === rises[rises.length - 1]
    last = out.build[k] = weighted(r, BUILDS, BUILD_WEIGHTS[mood], [last, ...(final ? ['echo', 'stutter'] : [])])
  }
  last = null
  plan.forEach((_, k) => { if (at(k).section === 'drop') last = out.fall[k] = weighted(r, FALLS, FALL_WEIGHTS[mood], [last]) })
  plan.forEach((_, k) => { if (at(k + 1)?.adds && !rises.includes(k) && at(k).section !== 'drop' && at(k).section !== 'break') out.swell[k] = r() < 0.6 })
  out.swap = weighted(r, BUILDS, BUILD_WEIGHTS[mood], [out.build[rises[rises.length - 1]]])
  out.land = weighted(r, ['kick', 'hats'], LAND_WEIGHTS[mood])
  return out
}

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
  return { phrase: p, bpm, mood: vibe.mood, energy: 2, dice: 0, swing: 0, transpose: 0, scale: vibe.scale, part: null, layers: {}, steps: {}, inst: {}, notes: {}, tone: {}, master: [0, 0, 0] }
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
  const inst = {}
  for (const [name, list] of Object.entries(INSTRUMENTS)) { const v = toInt(t?.inst?.[name], 0, list.length - 1, 0); if (v) inst[name] = v }
  const notes = {}
  for (const name of NOTE_LAYERS) { const v = t?.notes?.[name]; if (typeof v === 'string' && NOTE_RE.test(v) && /[^.]/.test(v)) notes[name] = v }
  const tone = {}
  for (const name of TONE_LAYERS) {
    const v = t?.tone?.[name]
    if (!Array.isArray(v)) continue
    const cut = toInt(v[0], -3, 3, 0), grit = toInt(v[1], 0, 3, 0)
    if (cut || grit) tone[name] = [cut, grit]
  }
  let plan = Array.isArray(t?.plan) && t.plan.length >= 2 && t.plan.length <= 24 ? t.plan.map((x) => toInt(x, 0, PLAN.length - 1, 0)) : null
  if (plan && sameAsPlan(plan)) plan = null
  const mv = Array.isArray(t?.master) ? t.master : []
  const master = [toInt(mv[0], -3, 0, 0), toInt(mv[1], 0, 3, 0), toInt(mv[2], -2, 2, 0)]
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
    inst,
    notes,
    tone,
    master,
    plan,
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
  for (const name of Object.keys(INSTRUMENTS)) if (t.inst?.[name]) code += '%' + name + t.inst[name]
  for (const name of NOTE_LAYERS) if (t.notes?.[name]) code += '~' + name + t.notes[name]
  for (const name of TONE_LAYERS) if (t.tone?.[name]) code += '^' + name + (t.tone[name][0] + 3) + t.tone[name][1]
  const m = t.master ?? [0, 0, 0]
  if (m[0] || m[1] || m[2]) code += '!' + (m[0] + 3) + m[1] + (m[2] + 2)
  if (t.plan) code += '/' + t.plan.map((i) => i.toString(16)).join('')
  return code
}
const alt = (list) => '(?:' + list.join('|') + ')'
const CODE_RE = new RegExp('^(\\d{2,3})(?:m([0-4]))?(?:e([0-4]))?(?:d(\\d{1,3}))?(?:s([0-3]))?(?:t(\\d{1,2}))?(?:k([0-4]))?(?:p(\\d))?(?:a(\\d{1,2}))?((?:[+-][a-z]+)*)((?:\\*[a-z]+[0-9a-f]{8})*)' +
  '((?:%' + alt(Object.keys(INSTRUMENTS)) + '\\d)*)((?:~' + alt(NOTE_LAYERS) + '[.0-9a-e]{16})*)((?:\\^' + alt(TONE_LAYERS) + '[0-6][0-3])*)(?:!([0-3][0-3][0-4]))?(?:/([0-9a]{2,24}))?$')

export function parseCode(text) {
  const s = String(text ?? '').trim().toLowerCase().replace(/^\/?techno\s+/, '')
  const at = s.lastIndexOf('@')
  if (at <= 0) return null
  const m = s.slice(at + 1).match(CODE_RE)
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
  const inst = {}, notes = {}, tone = {}
  for (const x of m[12].match(/%[a-z]+\d/g) ?? []) inst[x.slice(1, -1)] = Number(x.slice(-1))
  for (const x of m[13].match(/~[a-z]+[.0-9a-e]{16}/g) ?? []) notes[x.slice(1, -16)] = x.slice(-16)
  for (const x of m[14].match(/\^[a-z]+\d\d/g) ?? []) tone[x.slice(1, -2)] = [Number(x.slice(-2, -1)) - 3, Number(x.slice(-1))]
  const master = m[15] ? [Number(m[15][0]) - 3, Number(m[15][1]), Number(m[15][2]) - 2] : [0, 0, 0]
  return cleanTrack({ phrase: s.slice(0, at), bpm: m[1], mood: m[2], energy: m[3], dice: m[4], swing: m[5], transpose: m[6], scale: m[7] ?? null, part: m[9] ?? (m[8] === undefined ? null : OLD_PARTS[m[8]]), layers, steps, inst, notes, tone, master, plan: m[16] ? [...m[16]].map((c) => parseInt(c, 16)) : null })
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
  const percPick = pick(r, ['rim', 'tom', 'bell'])
  const percKind = t.inst.perc ? INSTRUMENTS.perc[t.inst.perc] : percPick
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
  // your notes: a scale degree per step, over the bass root (or the riff's octave)
  for (const name of NOTE_LAYERS) {
    const line = t.notes[name]
    if (!line) continue
    const base = name === 'bass' ? root : root + 24
    for (const e of ev[name]) { const c = line[e.step % STEPS]; if (c !== '.') e.note = base + degree(parseInt(c, 36)) }
  }
  for (const name of Object.keys(ev)) if (!on[name]) ev[name] = []
  return { track: t, on, root, scale, events: ev, stepSeconds: 60 / t.bpm / 4, steps: BARS * STEPS, percKind, percPick }
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

// Sets one bar of a layer to a pattern (16 chars, 'x' a hit) as step edits
// against the phrase's own pattern, so the code stays short.
export function setPattern(input, layer, pattern) {
  const t = cleanTrack(input)
  if (!GRID_LAYERS.includes(layer) || !/^[x.]{16}$/.test(pattern)) return t
  const rest = { ...t.steps }
  delete rest[layer]
  const base = grid({ ...t, steps: rest, layers: Object.fromEntries(LAYERS.map((n) => [n, true])) })[layer]
  let on = 0, off = 0
  for (let i = 0; i < STEPS; i++) {
    if (pattern[i] === 'x' && base[i] === '.') on |= 1 << i
    if (pattern[i] === '.' && base[i] !== '.') off |= 1 << i
  }
  return cleanTrack({ ...t, steps: { ...rest, ...(on || off ? { [layer]: [on, off] } : {}) } })
}

// The scale degree (0..14) a note sits on over `base`, the nearest one.
function degreeOf(scale, base, note) {
  let best = 0, gap = 99
  for (let d = 0; d < 15; d++) {
    const semis = scale[d % 7] + 12 * Math.floor(d / 7)
    if (Math.abs(base + semis - note) < gap) { gap = Math.abs(base + semis - note); best = d }
  }
  return best
}

// A new note line that fits the scale: the bass leans on the root, the fifth
// and the octave; the melody walks the scale and leaps now and then.
export function suggestNotes(input, layer, seed) {
  const t = cleanTrack(input)
  const r = rng(hash32('notes:' + t.phrase + ':' + layer + ':' + seed))
  let line = ''
  if (layer === 'bass') {
    const pool = [0, 0, 0, 0, 0, 0, 7, 7, 4, 4, 2, 5]
    for (let i = 0; i < STEPS; i++) line += (i === 0 ? 0 : pool[Math.floor(r() * pool.length)]).toString(36)
  } else {
    let d = r() < 0.5 ? 0 : 4
    for (let i = 0; i < STEPS; i++) {
      line += d.toString(36)
      d = r() < 0.15 ? (d + 7) % 12 : clamp(d + Math.floor(r() * 5) - 2, 0, 11)
    }
  }
  return cleanTrack({ ...t, notes: { ...t.notes, [layer]: line } })
}

// The edit card's actions, as data: { kind, layer, ... }. Pure, so the
// player, the tests and Claude's jam tool all go through the same door.
export function editTrack(input, e) {
  const t = cleanTrack(input)
  const L = e?.layer
  switch (e?.kind) {
    case 'inst': return INSTRUMENTS[L] ? cleanTrack({ ...t, inst: { ...t.inst, [L]: toInt(e.value, 0, INSTRUMENTS[L].length - 1, 0) } }) : t
    case 'pattern': return PATTERNS[L]?.[e.name] ? setPattern(t, L, PATTERNS[L][e.name]) : t
    case 'reset-pattern': { const steps = { ...t.steps }; delete steps[L]; return cleanTrack({ ...t, steps }) }
    case 'note': {
      if (!NOTE_LAYERS.includes(L) || !(e.i >= 0 && e.i < STEPS)) return t
      const a = arrange({ ...t, layers: { ...t.layers, [L]: true } })
      const base = L === 'bass' ? a.root : a.root + 24
      const line = [...(t.notes[L] ?? '.'.repeat(STEPS))]
      const hit = a.events[L].find((x) => x.step === e.i)
      const now = line[e.i] !== '.' ? parseInt(line[e.i], 36) : hit ? degreeOf(a.scale, base, hit.note) : 0
      line[e.i] = (((now + (e.dir ?? 1)) % 8) + 8) % 8 + ''
      return cleanTrack({ ...t, notes: { ...t.notes, [L]: line.join('') } })
    }
    case 'suggest-notes': return NOTE_LAYERS.includes(L) ? suggestNotes(t, L, e.seed ?? 0) : t
    case 'reset-notes': { const notes = { ...t.notes }; delete notes[L]; return cleanTrack({ ...t, notes }) }
    case 'tone': {
      if (!TONE_LAYERS.includes(L)) return t
      const [cut, grit] = t.tone[L] ?? [0, 0]
      return cleanTrack({ ...t, tone: { ...t.tone, [L]: [clamp(cut + (e.cut ?? 0), -3, 3), clamp(grit + (e.grit ?? 0), 0, 3)] } })
    }
    case 'master': {
      const m = [...t.master]
      if (e.lp) m[0] = clamp(m[0] + e.lp, -3, 0)
      if (e.hp) m[1] = clamp(m[1] + e.hp, 0, 3)
      if (e.space) m[2] = clamp(m[2] + e.space, -2, 2)
      if (e.reset) m.fill(0)
      return cleanTrack({ ...t, master: m })
    }
    default: return t
  }
}

// What the edit card shows for one sound: its instruments, the pattern to
// try (and which one plays), its notes per step (names, or null on a rest),
// the scale's notes, and its tone.
export function soundInfo(input, layer) {
  const t = cleanTrack(input)
  const a = arrange({ ...t, layers: { ...t.layers, [layer]: true } })
  const row = GRID_LAYERS.includes(layer) ? grid({ ...t, layers: { ...t.layers, [layer]: true } })[layer] ?? '.'.repeat(STEPS) : null
  const insts = INSTRUMENTS[layer] ? INSTRUMENTS[layer].map((name, i) => ({ name: layer === 'perc' && i === 0 ? null : name, value: i })).filter((x) => x.name) : []
  const inst = layer === 'perc' ? a.percKind : INSTRUMENTS[layer]?.[t.inst[layer] ?? 0] ?? null
  const presets = Object.entries(PATTERNS[layer] ?? {}).map(([name, p]) => ({ name, on: !!row && [...p].every((c, i) => (c === 'x') === (row[i] !== '.')) }))
  let notes = null
  if (NOTE_LAYERS.includes(layer)) {
    notes = Array(STEPS).fill(null)
    for (const e of a.events[layer]) if (e.step < STEPS) notes[e.step] = NOTE_NAMES[e.note % 12]
  }
  const root = a.root % 12
  return {
    layer,
    insts,
    inst,
    presets,
    edited: !!t.steps[layer],
    notes,
    notesEdited: !!t.notes[layer],
    scale: a.scale.map((x) => NOTE_NAMES[(root + x) % 12]),
    tone: t.tone[layer] ?? [0, 0],
    hasTone: TONE_LAYERS.includes(layer),
  }
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
  const len = Math.min(Math.round(Math.max(0.55, k.ampDecay * 2.4) * sr), buf.length - start)
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
function renderBass(buf, sr, at, dur, midi, vel, cutoff, grit, noise, q = 0.8) {
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
      lp1.set(fc, sr, q); lp2.set(fc, sr, q + 0.1)
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
// tight, long, metal, dusty
const HAT_KINDS = [{ decay: 1, metal: 0.035, hp: 8200 }, { decay: 2.4, metal: 0.035, hp: 7600 }, { decay: 1.3, metal: 0.28, hp: 6500 }, { decay: 1.1, metal: 0.02, hp: 4200 }]

function renderHat(buf, sr, at, vel, open, tone, noise, v = HAT_KINDS[0]) {
  const start = Math.round(at * sr)
  const decay = (open ? 0.2 : 0.026) * v.decay
  const len = Math.min(Math.round(decay * 6 * sr), buf.length - start)
  const hp = svf(); hp.set(v.hp, sr, 0.7)
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
    const x = metal * v.metal + noise() * 0.9
    const env = Math.min(1, t / 0.0008) * Math.exp(-t / decay)
    const y = hp.run(x, 2)
    buf[start + i] += (y * 0.6 + bp.run(y, 1) * 0.8) * env * vel
  }
}

// room (the 909-ish clap), snap (short and higher), snare (a body under the noise)
function renderClap(buf, sr, at, vel, noise, kind = 0) {
  const start = Math.round(at * sr)
  const len = Math.min(Math.round(0.35 * sr), buf.length - start)
  const bp = svf(); bp.set(kind === 1 ? 1700 : kind === 2 ? 1900 : 1050, sr, kind === 2 ? 0.8 : 1.5)
  const tail = kind === 1 ? 0.04 : kind === 2 ? 0.13 : 0.11
  let ph = 0
  for (let i = 0; i < len; i++) {
    const t = i / sr
    let env = 0
    for (const o of kind === 2 ? [0] : [0, 0.011, 0.022]) if (t >= o) env = Math.max(env, Math.exp(-(t - o) / 0.0045))
    if (t >= 0.03 || kind === 2) env = Math.max(env, 0.55 * Math.exp(-Math.max(0, t - (kind === 2 ? 0.004 : 0.03)) / tail))
    let x = bp.run(noise(), 1) * env * 2.2
    if (kind === 2) { ph += (185 * (1 + 0.5 * Math.exp(-t / 0.01))) / sr; x += Math.sin(TAU * ph) * Math.exp(-t / 0.07) * 0.8 }
    buf[start + i] += x * vel
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
  // acid, square, pluck, soft
  const kind = t.inst?.acid ?? 0
  const res = (0.55 + 0.08 * t.energy + (t.mood <= 1 ? 0.08 : 0)) * [1, 0.85, 0.6, 0.3][kind]
  const fb = res * 3.6
  const decay = (0.12 + 0.05 * t.mood) * [1, 1, 0.35, 1.6][kind]
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
    const saw = kind === 1 ? (ph < 0.5 ? 1 : -1) + polyblep(ph, dt) - polyblep((ph + 0.5) % 1, dt) : 2 * ph - 1 - polyblep(ph, dt)
    const fc = clamp(sweep(i) * (kind === 3 ? 0.55 : 1) * (1 + (3.5 + 3 * accentAmt) * env), 60, 9000)
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

// The boom under a drop's first beat: a sine that falls to the sub, driven.
function renderBoom(buf, sr, at, f1) {
  const start = Math.round(at * sr)
  const len = Math.min(Math.round(1.8 * sr), buf.length - start)
  let ph = 0
  for (let i = 0; i < len; i++) {
    const t = i / sr
    ph += (f1 + (95 - f1) * Math.exp(-t / 0.09)) / sr
    buf[start + i] += Math.tanh(Math.sin(TAU * ph) * 1.8) * Math.min(1, t / 0.003) * Math.exp(-t / 0.55)
  }
}

// A crash played backwards: it swells into the drop and ends on the loop point.
function renderReverseCrash(buf, sr, end, len, noise, gain) {
  const tmp = new Float32Array(len)
  renderCrash(tmp, sr, 0, noise)
  const from = end - len
  for (let i = 0; i < len; i++) if (from + i >= 0 && from + i < buf.length) buf[from + i] += tmp[len - 1 - i] * gain
}

// The downlifter: noise through a band-pass that falls, loud at the start.
function renderDownlifter(buf, sr, from, len, noise) {
  const bp = svf()
  for (let i = 0; i < len && from + i < buf.length; i++) {
    const u = i / len
    if ((i & 15) === 0) bp.set(7000 * Math.pow(150 / 7000, Math.sqrt(u)), sr, 1.8)
    buf[from + i] += bp.run(noise(), 1) * Math.min(1, i / (0.03 * sr)) * Math.pow(1 - u, 1.6) * 1.3
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
// opts.build: how the loop before a drop builds up (null: the 0.8 riser).
//   'riser'   a riser over all 8 bars and a clap roll that speeds up
//   'filter'  the whole mix closes into a low-pass, then one beat of silence
//   'echo'    the bass fades out, the last bar is one clap thrown into the
//             echo, and a reversed crash swells into the drop
//   'stutter' a 4-bar riser, then the last bar repeats its first beat in
//             ever shorter slices while a high-pass opens
// With `impact`, each of them puts a boom under the drop that follows.
// opts.fall: how a drop ends (its last loop), see FALLS.
//   'tapestop'   the last two beats slow down to a stop, like a tape
//   'washout'    the last bar fades into a big reverb and echo
//   'downlifter' noise that falls over the last bar, into the next part
// opts.swell: a short reversed cymbal into the next part.
export function mixdown(input, { sampleRate = 44100, voices = null, rise = false, impact = false, build = null, fall = null, swell = false } = {}) {
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
  const kicks = rise && build !== 'stutter' ? a.events.kick.filter((e) => e.step < lastBar) : a.events.kick

  // the kick's tail sits on the key's root, so kick and sub are one note
  let tail = mtof(a.root)
  while (tail >= 56) tail /= 2
  const k0 = { f0: 140 + r() * 40, f1: tail, pitchDecay: 0.04 + r() * 0.015, ampDecay: 0.24 + r() * 0.06, drive: 1.9 + t.energy * 0.3 }
  // deep, punchy, boom, hard
  const k = [k0, { ...k0, f0: k0.f0 * 1.25, ampDecay: k0.ampDecay * 0.6, drive: k0.drive + 0.6 }, { ...k0, ampDecay: k0.ampDecay * 1.7, pitchDecay: k0.pitchDecay * 1.5, drive: k0.drive * 0.85 }, { ...k0, drive: k0.drive * 2, ampDecay: k0.ampDecay * 0.85 }][t.inst.kick ?? 0]
  const kickHit = template(sr, Math.max(0.55, k.ampDecay * 2.4), (b) => renderKick(b, sr, 0, 1, k, noise))
  for (const e of kicks) stamp(kick, kickHit, stepAt(e.step, false), e.vel, sr)

  const bassCut = 160 + t.mood * 70 + t.energy * 45
  const bassGrit = 0.8 + 0.1 * t.energy - 0.1 * Math.min(t.mood, 2)
  // a bass note holds until the next one, at most two steps
  const bassAt = a.events.bass.map((e) => e.step)
  a.events.bass.forEach((e, i) => {
    const gap = ((bassAt[(i + 1) % bassAt.length] - e.step + a.steps - 1) % a.steps) + 1
    // rolling, sub, growl, acid
    const bv = [[1, 1, 0.8], [1, 0.12, 0.7], [1.6, 1.7, 0.8], [2.3, 1.1, 2.6]][t.inst.bass ?? 0]
    renderBass(bass, sr, stepAt(e.step, false), a.stepSeconds * Math.min(2, gap) * 0.9, e.note, e.vel, bassCut * bv[0], bassGrit * bv[1], noise, bv[2])
  })

  const hatTone = 1.1 + r() * 0.5
  // two closed hats that alternate, so a run of 16ths does not sound like a machine gun
  const hatKind = HAT_KINDS[t.inst.hats ?? 0]
  const closedHats = [0, 1].map(() => template(sr, 0.16 * hatKind.decay, (b) => renderHat(b, sr, 0, 1, false, hatTone, noise, hatKind)))
  const openHat = template(sr, 1.2 * hatKind.decay, (b) => renderHat(b, sr, 0, 1, true, hatTone, noise, hatKind))
  for (const e of a.events.hats) stamp(hats, e.open ? openHat : closedHats[e.step % 2], stepAt(e.step, true), e.vel, sr)
  const clapHit = template(sr, 0.35, (b) => renderClap(b, sr, 0, 1, noise, t.inst.clap ?? 0))
  for (const e of a.events.clap) stamp(clap, clapHit, stepAt(e.step, false), e.vel, sr)
  // a clap roll into the drop: the 'riser' build speeds it up over four bars
  if (rise && build === 'riser') {
    for (let s = 4 * STEPS; s < BARS * STEPS; s++) {
      const every = s < 6 * STEPS ? 4 : s < lastBar ? 2 : 1
      if (s % every === 0) stamp(clap, clapHit, stepAt(s, false), 0.18 + 0.55 * ((s - 4 * STEPS) / (4 * STEPS)), sr)
    }
  } else if (rise && build !== 'echo' && a.on.clap) for (let s = 8; s < STEPS; s++) stamp(clap, clapHit, stepAt(lastBar + s, false), 0.25 + 0.06 * (s - 8), sr)
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

  const barLen = Math.round(STEPS * a.stepSeconds * sr)
  const lastBarAt = loop - barLen
  if (rise && build === 'riser') renderRiser(fx, sr, 0, loop, noise)
  else if (rise && build === 'stutter') renderRiser(fx, sr, loop - 4 * barLen, 3 * barLen, noise)
  else if (rise && build !== 'echo') renderRiser(fx, sr, Math.round(4 * STEPS * a.stepSeconds * sr), loop - Math.round(4 * STEPS * a.stepSeconds * sr), noise)
  if (impact) renderCrash(fx, sr, 0, noise)
  const boom = impact && build ? bus() : null
  if (boom) renderBoom(boom, sr, 0, tail)
  // the echo build: the bass fades out over four bars, the last bar keeps
  // only one clap thrown into a long echo, and a reversed crash
  const toss = rise && build === 'echo' ? bus() : null
  if (toss) {
    const fadeFrom = loop - 4 * barLen
    for (let i = fadeFrom; i < total; i++) bass[i] *= i >= lastBarAt ? 0 : 1 - (i - fadeFrom) / (3 * barLen)
    const cut = (b) => { for (let i = lastBarAt; i < total; i++) b[i] *= i < lastBarAt + 200 ? 1 - (i - lastBarAt) / 200 : 0 }
    for (const b of [hats, clap, perc, ride, acid]) cut(b)
    stamp(toss, clapHit, stepAt(lastBar, false), 1, sr)
    renderReverseCrash(fx, sr, loop, Math.round(8 * a.stepSeconds * sr), noise, 1.4)
  }
  if (swell) renderReverseCrash(fx, sr, loop, Math.round(4 * a.stepSeconds * sr), noise, 0.8)
  if (fall === 'downlifter') renderDownlifter(fx, sr, lastBarAt, total - lastBarAt, noise)

  // the voice says the name once a loop: deep on a drop's first bar, a whisper in bar 3
  const drop = t.part !== null && t.part !== undefined && PLAN[t.part].section === 'drop'
  const clip = a.on.voice && voices ? (drop ? voices.deep : voices.whisper) : null
  if (clip) renderVoice(voice, sr, (drop ? 0 : 2 * STEPS) * a.stepSeconds, clip, drop ? 0.79 : 0.84, drop ? 0.75 : 0.85)

  // your tone per sound: a filter (dark or thin) and grit
  const buses = { kick, bass, hats, clap, perc, acid, ride, pad }
  for (const [name, [cut, grit]] of Object.entries(t.tone)) if (buses[name]) toneBus(buses[name], sr, cut, grit)

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
  // the washout: the last bar sends far more into the reverb and the echo,
  // while the dry sound fades out under it
  const dry = fall === 'washout' ? new Float32Array(total).fill(1) : null
  if (dry) for (let i = lastBarAt; i < total; i++) {
    const u = Math.min(1, (i - lastBarAt) / barLen)
    dry[i] = i >= loop ? 0 : 1 - u
    revIn[i] = (revIn[i] + kick[i] * 0.25 + hats[i] * 0.3 + bass[i] * 0.15) * (1 + 1.8 * u)
    dlyIn[i] = (dlyIn[i] + clap[i] * 0.5 + hats[i] * 0.3) * (1 + 1.5 * u)
  }
  const room = 0.8 + (t.mood <= 1 ? 0.06 : 0)
  const [revL, revR] = reverb(revIn, revIn, sr, room, 0.35)
  // the master's space: more or less of the reverb
  if (t.master[2]) { const g = 1 + 0.45 * t.master[2]; for (let i = 0; i < total; i++) { revL[i] *= g; revR[i] *= g } }
  const [dlyL, dlyR] = pingPong(dlyIn, sr, a.stepSeconds * 3, 0.5)
  const [tossL, tossR] = toss ? pingPong(toss, sr, a.stepSeconds * 3, 0.78) : [null, null]
  if (toss) { const [tl, tr] = reverb(toss, toss, sr, 0.9, 0.3); for (let i = 0; i < total; i++) { tossL[i] = tossL[i] * 1.6 + tl[i] * 0.9 + toss[i] * 0.7; tossR[i] = tossR[i] * 1.6 + tr[i] * 0.9 + toss[i] * 0.7 } }

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
    if (t.tone.rumble) toneBus(rumL, sr, t.tone.rumble[0], t.tone.rumble[1])
  }

  const levels = { kick: 0.9, bass: 1.05, hats: 0.4, clap: 0.7, perc: 0.22, acid: 0.45, stab: 0.75, ride: 0.16, pad: 1.2, fx: 0.32 }
  const left = new Float32Array(total), right = new Float32Array(total)
  for (let i = 0; i < total; i++) {
    const d = duck[i]
    const center = kick[i] * levels.kick + (bass[i] * levels.bass + clap[i] * levels.clap + acid[i] * levels.acid) * d + voice[i] * 0.8 * Math.sqrt(d) + (rumL ? rumL[i] * 1.35 * (d * d) : 0) + fx[i] * levels.fx
    const h = hats[i] * levels.hats, p = perc[i] * levels.perc, s = stab[i] * levels.stab * d, rd = ride[i] * levels.ride * Math.sqrt(d), pd = pad[i] * levels.pad * d
    const w = dry ? dry[i] : 1, wet = dry ? 1 + (1 - dry[i]) * 0.6 : 1
    left[i] = (center + h * 0.8 + p * 1.15 + s + rd * 1.2 + pd) * w + (revL[i] * 0.9 + dlyL[i] * 0.45) * (dry ? wet : d)
    right[i] = (center + h * 1.15 + p * 0.8 + s + rd * 0.8 + pd) * w + (revR[i] * 0.9 + dlyR[i] * 0.45) * (dry ? wet : d)
    if (boom) { left[i] += boom[i] * 0.6; right[i] += boom[i] * 0.6 }
    if (toss) { left[i] += tossL[i] * 0.6; right[i] += tossR[i] * 0.6 }
  }
  // the filter build: everything but the riser closes into a resonant
  // low-pass over the loop, most of it in the last four bars, then the
  // last beat (and the tail) is silence
  if (rise && build === 'filter') {
    const fl = svf(), fr = svf()
    const gap = loop - 4 * Math.round(a.stepSeconds * sr)
    for (let i = 0; i < total; i++) {
      if (i >= gap) { left[i] = 0; right[i] = 0; continue }
      if ((i & 15) === 0) { const u = Math.pow(i / gap, 1.8); const fc = 12000 * Math.pow(220 / 12000, u); fl.set(fc, sr, 1.6); fr.set(fc, sr, 1.6) }
      const f = fx[i] * levels.fx
      left[i] = fl.run(left[i] - f, 0) + f
      right[i] = fr.run(right[i] - f, 0) + f
    }
  }
  // the stutter: beats 2..4 of the last bar repeat the first beat in 1/8,
  // then 1/16, then 1/32 slices, through a high-pass that opens
  if (rise && build === 'stutter') {
    const beat = 4 * Math.round(a.stepSeconds * sr)
    const srcL = left.slice(lastBarAt, lastBarAt + beat), srcR = right.slice(lastBarAt, lastBarAt + beat)
    const hl = svf(), hr = svf()
    for (let i = lastBarAt + beat; i < total; i++) {
      if (i >= loop) { left[i] = 0; right[i] = 0; continue }
      const rel = i - lastBarAt - beat
      const slice = Math.max(1, Math.round(beat / 2) >> Math.min(2, Math.floor(rel / beat)))
      const k = rel % slice
      const edge = Math.min(1, k / 64, (slice - k) / 64)
      if ((i & 15) === 0) { const fc = 60 * Math.pow(25, rel / (loop - lastBarAt - beat)); hl.set(fc, sr, 0.9); hr.set(fc, sr, 0.9) }
      left[i] = hl.run(srcL[k] * edge, 2)
      right[i] = hr.run(srcR[k] * edge, 2)
    }
  }
  // the tape stop: the last two beats slow down to nothing, pitch and all
  if (fall === 'tapestop') {
    const from = loop - 8 * Math.round(a.stepSeconds * sr)
    const n = loop - from
    const srcL = left.slice(from, loop), srcR = right.slice(from, loop)
    let pos = 0
    for (let i = from; i < total; i++) {
      if (i >= loop) { left[i] = 0; right[i] = 0; continue }
      const u = (i - from) / n
      const j = Math.floor(pos), fr = pos - j
      const g = 1 - u * u
      left[i] = (srcL[j] * (1 - fr) + srcL[Math.min(n - 1, j + 1)] * fr) * g
      right[i] = (srcR[j] * (1 - fr) + srcR[Math.min(n - 1, j + 1)] * fr) * g
      pos += Math.pow(1 - u, 1.3)
    }
  }
  return { left, right, loop, total, sampleRate: sr, seconds: loopSeconds, stepSeconds: a.stepSeconds, master: t.master }
}

// A sound's tone, in place: cut < 0 closes a low-pass (dark), cut > 0 opens
// a high-pass (thin); grit drives it into a soft clip at about the same level.
function toneBus(b, sr, cut, grit) {
  if (cut) {
    const f = svf()
    f.set(cut < 0 ? 9000 * Math.pow(0.38, -cut) : 35 * Math.pow(3, cut), sr, 0.75)
    const mode = cut < 0 ? 0 : 2
    for (let i = 0; i < b.length; i++) b[i] = f.run(b[i], mode)
  }
  if (grit) {
    const g = 1 + grit * 1.6, norm = 0.6 / Math.tanh(0.6 * g)
    for (let i = 0; i < b.length; i++) b[i] = Math.tanh(b[i] * g) * norm
  }
}

// The master, in place on n samples: high-pass at 25 Hz, a gentle 12 kHz
// low-pass that takes the digital edge off, a fixed gain into a soft clip
// that only rounds the kick's tip, then -1 dBFS at most.
// m: the track's master [low-pass -3..0, high-pass 0..3, space].
function master(left, right, n, m = [0, 0, 0]) {
  if (m[0] || m[1]) {
    const lpl = svf(), lpr = svf(), hpl = svf(), hpr = svf()
    lpl.set(12000 * Math.pow(0.42, -m[0]), 44100, 0.9); lpr.set(12000 * Math.pow(0.42, -m[0]), 44100, 0.9)
    hpl.set(25 * Math.pow(3.2, m[1]), 44100, 0.75); hpr.set(25 * Math.pow(3.2, m[1]), 44100, 0.75)
    for (let i = 0; i < n; i++) {
      left[i] = hpl.run(lpl.run(left[i], 0), 2)
      right[i] = hpr.run(lpr.run(right[i], 0), 2)
    }
  }
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
  master(outL, outR, m.loop, m.master)
  return { left: outL, right: outR, sampleRate: m.sampleRate, seconds: m.seconds, stepSeconds: m.stepSeconds }
}

// One loop for a stream: no fold. `left` and `right` run past the loop by the
// tail, which the player adds onto whatever plays next.
// opts.with: a second track mixed in at the same tempo (the handover).
export function renderLoop(input, opts = {}) {
  const m = mixdown(input, opts)
  if (opts.with) {
    const o = mixdown({ ...opts.with, bpm: cleanTrack(input).bpm }, { ...opts, rise: false, impact: false, build: null, fall: null, swell: false, with: null })
    for (let i = 0; i < m.total && i < o.total; i++) { m.left[i] += o.left[i]; m.right[i] += o.right[i] }
  }
  master(m.left, m.right, m.total, m.master)
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
