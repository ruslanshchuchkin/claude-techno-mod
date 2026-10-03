// Techno loop synth. Plain JavaScript with no Node or browser APIs, so the
// same file runs inside the mod, in node (scripts/render.mjs), and in a page.
//
// A track is a small state object. The phrase seeds everything: the key, the
// patterns, and the riff, whose notes are the phrase's own letters.

export const LAYERS = ['kick', 'bass', 'hats', 'clap', 'perc', 'acid', 'stab', 'rumble']
export const MOODS = ['pitch black', 'dark', 'deep', 'warm', 'bright']
export const ENERGIES = ['minimal', 'rolling', 'driving', 'peak', 'rave']
const NOTE_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
const KEY_CLASSES = [9, 5, 7, 2, 0, 4, 10, 1] // a, f, g, d, c, e, a#, c#
const SCALES = [
  [0, 1, 3, 5, 7, 8, 10], // phrygian
  [0, 2, 3, 5, 7, 8, 10], // aeolian
  [0, 2, 3, 5, 7, 8, 10],
  [0, 2, 3, 5, 7, 9, 10], // dorian
  [0, 2, 3, 5, 7, 9, 10],
]
const CHORDS = [[0, 3, 7, 12], [0, 3, 7, 10], [0, 3, 7, 10], [0, 3, 7, 10, 14], [0, 5, 7, 10, 14]]
export const BARS = 8
const STEPS = 16
export const BPM_MIN = 110
export const BPM_MAX = 150

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
  return { phrase: p, bpm: 124 + Math.floor(r() * 12), mood: 1 + Math.floor(r() * 3), energy: 2, dice: 0, swing: 0, transpose: 0, layers: {} }
}

// Fills gaps and clamps every field, so a state from a code or a tool call is safe.
export function cleanTrack(t) {
  const base = trackFor(t?.phrase)
  const layers = {}
  for (const name of LAYERS) {
    const v = t?.layers?.[name]
    if (v === true || v === false) layers[name] = v
  }
  return {
    phrase: base.phrase,
    bpm: toInt(t?.bpm, BPM_MIN, BPM_MAX, base.bpm),
    mood: toInt(t?.mood, 0, 4, base.mood),
    energy: toInt(t?.energy, 0, 4, base.energy),
    dice: toInt(t?.dice, 0, 999, 0),
    swing: toInt(t?.swing, 0, 3, 0),
    transpose: toInt(t?.transpose, 0, 11, 0),
    layers,
  }
}

function character(t) {
  const r = rng(hash32('char:' + t.phrase))
  return { flavor: r() < 0.5 ? 'acid' : 'dub', keyClass: pick(r, KEY_CLASSES) }
}

// Which layers play: an explicit on/off wins, otherwise mood and energy decide.
export function activeLayers(t) {
  const { flavor } = character(t)
  const auto = {
    kick: true,
    bass: true,
    hats: true,
    clap: t.energy >= 1,
    perc: t.energy >= 2,
    acid: flavor === 'acid' || t.energy >= 4,
    stab: flavor === 'dub' || t.energy >= 4,
    rumble: t.mood <= 1 && t.energy >= 1,
  }
  const out = {}
  for (const name of LAYERS) out[name] = t.layers[name] ?? auto[name]
  return out
}

export function keyName(t) {
  const { keyClass } = character(t)
  const scale = t.mood === 0 ? 'phrygian' : t.mood >= 3 ? 'dorian' : 'minor'
  return NOTE_NAMES[(keyClass + t.transpose) % 12] + ' ' + scale
}

export function describe(t) {
  return `${t.bpm} bpm · ${keyName(t)} · ${MOODS[t.mood]} · ${ENERGIES[t.energy]}`
}

// ---------- share codes ----------
// late-night-deploy@128m1e2d3s1t5+acid-perc

export function encodeCode(t) {
  let code = t.phrase.replace(/ /g, '-') + '@' + t.bpm + 'm' + t.mood + 'e' + t.energy
  if (t.dice) code += 'd' + t.dice
  if (t.swing) code += 's' + t.swing
  if (t.transpose) code += 't' + t.transpose
  for (const name of LAYERS) if (name in t.layers) code += (t.layers[name] ? '+' : '-') + name
  return code
}

export function parseCode(text) {
  const s = String(text ?? '').trim().toLowerCase().replace(/^\/?techno\s+/, '')
  const at = s.lastIndexOf('@')
  if (at <= 0) return null
  const m = s.slice(at + 1).match(/^(\d{2,3})(?:m([0-4]))?(?:e([0-4]))?(?:d(\d{1,3}))?(?:s([0-3]))?(?:t(\d{1,2}))?((?:[+-][a-z]+)*)$/)
  if (!m) return null
  const layers = {}
  for (const flag of m[7].match(/[+-][a-z]+/g) ?? []) {
    const name = flag.slice(1)
    if (!LAYERS.includes(name)) return null
    layers[name] = flag[0] === '+'
  }
  return cleanTrack({ phrase: s.slice(0, at), bpm: m[1], mood: m[2], energy: m[3], dice: m[4], swing: m[5], transpose: m[6], layers })
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
  const scale = SCALES[t.mood]
  const root = 36 + ((keyClass + t.transpose) % 12) // bass root, c2..b2
  const degree = (d) => scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7)

  const bassPattern = t.energy === 0 ? BASS_PATTERNS[0] : pick(r, BASS_PATTERNS)
  const bassIntervals = [0, 0, 12, 0, 0, 7, 0, 0].map((v) => (t.mood === 0 && v === 7 ? 1 : v))
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
      note: root + 12 + degree(ACID_PALETTE[(c * 7 + t.dice * 5) % ACID_PALETTE.length]),
      accent: 'aeiou'.includes(ch),
      slide: next !== ' ' && (c * 13 + i) % 5 === 0,
    })
  }

  const ev = { kick: [], bass: [], hats: [], clap: [], perc: [], acid: [], stab: [] }
  for (let bar = 0; bar < BARS; bar++) {
    const last = bar === BARS - 1
    for (let s = 0; s < STEPS; s++) {
      const step = bar * STEPS + s
      // kick: four on the floor, dropped on the last beat of the loop for a lift
      if (s % 4 === 0 && !(last && s === 12 && t.energy <= 2)) ev.kick.push({ step, vel: 1 })
      if (kickGhost && s === 14 && bar % 2 === 1) ev.kick.push({ step, vel: 0.55 })
      // bass
      if (bassPattern[s] === 'x') ev.bass.push({ step, note: root + bassIntervals[(s + bar) % bassIntervals.length], vel: s % 4 === 2 ? 1 : 0.8 })
      // hats: closed on the offbeat, then 8ths, then 16ths; open hats from peak energy
      const open = (t.energy >= 3 || t.mood >= 4) && s % 4 === 2
      if (open) ev.hats.push({ step, vel: 0.9, open: true })
      else if (t.energy === 0 ? s % 4 === 2 : t.energy === 1 ? s % 2 === 0 : true) ev.hats.push({ step, vel: s % 4 === 2 ? 1 : s % 2 === 0 ? 0.55 : 0.35, open: false })
      // clap on 2 and 4, with a roll into the loop point
      if (s === 4 || s === 12) ev.clap.push({ step, vel: 1 })
      if (last && t.energy >= 2 && s >= 13) ev.clap.push({ step, vel: 0.35 + 0.2 * (s - 13) })
      // perc, with a fill in bar 4
      if (percPattern[s] === 'x' || (bar === 3 && s >= 12 && s % 2 === 1)) ev.perc.push({ step, vel: s % 3 === 0 ? 1 : 0.7, kind: percKind })
      // acid
      const n = riff[s]
      if (n) ev.acid.push({ step, ...n })
      // stab: the pattern shifts every other bar so the chords breathe
      const stabPattern = STAB_PATTERNS[(stabSlot + (bar % 2)) % STAB_PATTERNS.length]
      if (stabPattern[s] === 'x') ev.stab.push({ step, notes: CHORDS[t.mood].map((i) => root + 24 + i), vel: 1 })
    }
  }
  for (const name of Object.keys(ev)) if (!on[name]) ev[name] = []
  return { track: t, on, root, events: ev, stepSeconds: 60 / t.bpm / 4, steps: BARS * STEPS, percKind }
}

// One bar of the arrangement as text, for the pane: 'x' a hit, 'X' an accent.
export function grid(input, bar = 0) {
  const a = arrange(input)
  const out = {}
  for (const name of ['kick', 'bass', 'hats', 'clap', 'perc', 'acid', 'stab']) {
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

function renderKick(buf, sr, at, vel, k, noise) {
  const start = Math.round(at * sr)
  const len = Math.min(Math.round(0.42 * sr), buf.length - start)
  const fade = Math.round(0.03 * sr)
  let ph = 0
  for (let i = 0; i < len; i++) {
    const t = i / sr
    const f = k.f1 + (k.f0 - k.f1) * Math.exp(-t / k.pitchDecay)
    ph += (TAU * f) / sr
    let amp = Math.exp(-t / k.ampDecay)
    if (i > len - fade) amp *= (len - i) / fade
    let s = soft(Math.sin(ph) * amp * k.drive) * 0.9
    if (t < 0.004) s += noise() * 0.35 * (1 - t / 0.004)
    buf[start + i] += s * vel
  }
}

function renderBass(buf, sr, at, dur, midi, vel, cutoff, noise) {
  const start = Math.round(at * sr)
  const len = Math.min(Math.round(dur * sr), buf.length - start)
  const f = mtof(midi), dt = f / sr
  const flt = svf()
  let ph = noise() * 0.5 + 0.5
  for (let i = 0; i < len; i++) {
    const t = i / sr
    ph += dt; if (ph >= 1) ph -= 1
    const saw = 2 * ph - 1 - polyblep(ph, dt)
    const sub = Math.sin(TAU * ph)
    if ((i & 15) === 0) flt.set(cutoff * (1 + 3 * Math.exp(-t / 0.035)), sr, 1.1)
    const env = Math.min(1, t / 0.002) * Math.exp(-t / 0.11) * (i > len - 64 ? (len - i) / 64 : 1)
    buf[start + i] += (flt.run(saw * 0.75, 0) + sub * 0.3) * env * vel
  }
}

const HAT_FREQS = [205.3, 304.4, 369.6, 522.7, 540, 800]

function renderHat(buf, sr, at, vel, open, tone, noise) {
  const start = Math.round(at * sr)
  const decay = open ? 0.16 : 0.028
  const len = Math.min(Math.round(decay * 7 * sr), buf.length - start)
  const hp = svf(); hp.set(7200, sr, 0.9)
  const bp = svf(); bp.set(10500, sr, 0.8)
  const phases = HAT_FREQS.map(() => 0)
  for (let i = 0; i < len; i++) {
    const t = i / sr
    let metal = 0
    for (let j = 0; j < 6; j++) {
      phases[j] += (HAT_FREQS[j] * tone) / sr
      if (phases[j] >= 1) phases[j] -= 1
      metal += phases[j] < 0.5 ? 1 : -1
    }
    const x = metal * 0.12 + noise() * 0.6
    const env = Math.exp(-t / decay)
    buf[start + i] += bp.run(hp.run(x, 2), 1) * env * vel * 1.4
  }
}

function renderClap(buf, sr, at, vel, noise) {
  const start = Math.round(at * sr)
  const len = Math.min(Math.round(0.35 * sr), buf.length - start)
  const bp = svf(); bp.set(1250, sr, 1.6)
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
  for (const n of notes) for (const d of [-0.08, 0.08]) osc.push({ dt: mtof(n + d) / sr, ph: noise() * 0.5 + 0.5 })
  const gain = 0.5 / Math.sqrt(osc.length)
  for (let i = 0; i < len; i++) {
    const t = i / sr
    let x = 0
    for (const o of osc) {
      o.ph += o.dt; if (o.ph >= 1) o.ph -= 1
      x += 2 * o.ph - 1 - polyblep(o.ph, o.dt)
    }
    if ((i & 15) === 0) flt.set(cutoff * (1 + 1.5 * Math.exp(-t / 0.05)), sr, 1.4)
    const env = Math.min(1, t / 0.003) * Math.exp(-t / 0.075)
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
function reverb(inL, inR, sr, room, damp) {
  const scale = sr / 44100
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]
  const apT = [556, 441, 341, 225]
  const side = (input, spread) => {
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
  return [side(inL, 0), side(inR, 23)]
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

// ---------- render ----------

// Renders the 8-bar loop. The reverb and delay tails fold back onto the start,
// so the loop repeats without a seam.
export function render(input, { sampleRate = 44100 } = {}) {
  const a = arrange(input)
  const t = a.track
  const sr = sampleRate
  const loop = Math.round(a.steps * a.stepSeconds * sr)
  const total = loop + Math.round(2.5 * sr)
  const noise = noiseSource(hash32('noise:' + t.phrase + ':' + t.dice))
  const r = rng(hash32('sound:' + t.phrase))
  const stepAt = (step, swingable) => step * a.stepSeconds + (swingable && step % 2 === 1 ? t.swing * 0.045 * a.stepSeconds : 0)
  const bus = () => new Float32Array(total)
  const kick = bus(), bass = bus(), hats = bus(), clap = bus(), perc = bus(), acid = bus(), stab = bus()

  const k = { f0: 190 + r() * 50, f1: 44 + r() * 10, pitchDecay: 0.03 + r() * 0.015, ampDecay: 0.15 + r() * 0.06, drive: 1.3 + t.energy * 0.25 }
  for (const e of a.events.kick) renderKick(kick, sr, stepAt(e.step, false), e.vel, k, noise)

  const bassCut = 180 + t.mood * 90 + t.energy * 25
  for (const e of a.events.bass) renderBass(bass, sr, stepAt(e.step, false), a.stepSeconds * 0.95, e.note, e.vel, bassCut, noise)

  const hatTone = 1.1 + r() * 0.5
  for (const e of a.events.hats) renderHat(hats, sr, stepAt(e.step, true), e.vel, e.open, hatTone, noise)
  for (const e of a.events.clap) renderClap(clap, sr, stepAt(e.step, false), e.vel, noise)
  const percPitch = 140 + r() * 120
  for (const e of a.events.perc) renderPerc(perc, sr, stepAt(e.step, true), e.vel, e.kind, percPitch, noise)

  const loopSeconds = loop / sr
  const sweepBase = 260 + t.mood * 120
  const sweepDepth = 1.6 + t.energy * 0.9
  renderAcid(acid, sr, a, total, (i) => sweepBase * (1 + sweepDepth * (0.5 - 0.5 * Math.cos((TAU * (i / sr)) / loopSeconds))))

  const stabCut = 600 + t.mood * 350 + t.energy * 150
  for (const e of a.events.stab) renderStab(stab, sr, stepAt(e.step, false), e.notes, e.vel, stabCut, noise)

  // sidechain: everything but the kick ducks under each kick
  const duck = new Float32Array(total).fill(1)
  for (const e of a.events.kick) {
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
    revIn[i] = clap[i] * 0.6 + perc[i] * 0.35 + stab[i] * 0.35 + hats[i] * 0.12 + acid[i] * 0.12
    dlyIn[i] = stab[i] * 0.7 + acid[i] * 0.18 + perc[i] * 0.15
  }
  const room = 0.8 + (t.mood <= 1 ? 0.06 : 0)
  const [revL, revR] = reverb(revIn, revIn, sr, room, 0.35)
  const [dlyL, dlyR] = pingPong(dlyIn, sr, a.stepSeconds * 3, 0.5)

  // rumble: the kick through a long dark reverb, low-passed and heavily ducked
  let rumL = null
  if (a.on.rumble) {
    const [rl] = reverb(kick, kick, sr, 0.9, 0.6)
    rumL = new Float32Array(total)
    let lp1 = 0, lp2 = 0
    const g = 1 - Math.exp((-TAU * 130) / sr)
    for (let i = 0; i < total; i++) {
      lp1 += g * (rl[i] - lp1); lp2 += g * (lp1 - lp2)
      rumL[i] = lp2
    }
  }

  const levels = { kick: 0.8, bass: 0.9, hats: 0.66, clap: 1.0, perc: 0.27, acid: 0.52, stab: 0.95 }
  const left = new Float32Array(total), right = new Float32Array(total)
  for (let i = 0; i < total; i++) {
    const d = duck[i]
    const center = kick[i] * levels.kick + (bass[i] * levels.bass + clap[i] * levels.clap + acid[i] * levels.acid) * d + (rumL ? rumL[i] * 1.1 * (d * d) : 0)
    const h = hats[i] * levels.hats, p = perc[i] * levels.perc, s = stab[i] * levels.stab * d
    left[i] = center + h * 0.8 + p * 1.15 + s + (revL[i] * 0.9 + dlyL[i] * 0.45) * d
    right[i] = center + h * 1.15 + p * 0.8 + s + (revR[i] * 0.9 + dlyR[i] * 0.45) * d
  }

  // fold the tail onto the start, cut to the loop, then master
  const outL = left.slice(0, loop), outR = right.slice(0, loop)
  for (let i = 0; i < total - loop && i < loop; i++) { outL[i] += left[loop + i]; outR[i] += right[loop + i] }
  // high-pass at 25 Hz, bring the peak to 1.25 so the soft clip only rounds
  // the kick's tip, then set the final peak at -1 dBFS
  let hpL = 0, hpR = 0, peak = 0
  const hpG = 1 - Math.exp((-TAU * 25) / sr)
  for (let i = 0; i < loop; i++) {
    hpL += hpG * (outL[i] - hpL); hpR += hpG * (outR[i] - hpR)
    outL[i] -= hpL; outR[i] -= hpR
    peak = Math.max(peak, Math.abs(outL[i]), Math.abs(outR[i]))
  }
  const pre = peak > 0 ? 1.25 / peak : 1
  peak = 0
  for (let i = 0; i < loop; i++) {
    outL[i] = soft(outL[i] * pre); outR[i] = soft(outR[i] * pre)
    peak = Math.max(peak, Math.abs(outL[i]), Math.abs(outR[i]))
  }
  const norm = peak > 0 ? 0.89 / peak : 1
  for (let i = 0; i < loop; i++) { outL[i] *= norm; outR[i] *= norm }
  return { left: outL, right: outR, sampleRate: sr, seconds: loopSeconds, stepSeconds: a.stepSeconds }
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
