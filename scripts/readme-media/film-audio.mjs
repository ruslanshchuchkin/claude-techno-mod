// The audio of the launch film: a montage of real loops of one auto set,
// cut on bar lines. The set walks as the player walks it (loopSpec, afterLoop),
// with the engine's own voices saying the track's name (Whisper in breakdown 2,
// Daniel on drop 3), then the handover into the next track.
//   node scripts/readme-media/film-audio.mjs "deep focus" "ship it" out-dir
// Writes out-dir/film.wav and out-dir/film.json (one entry per bar).
import { writeFileSync, readFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { trackFor, renderLoop, toWav, grid, decodeWav, activeLayers, PLAN } from '../../hooks/engine.js'
import { newSet, loopSpec, afterLoop, mixer } from '../../hooks/conductor.js'
const [phrase, nextPhrase, dir] = process.argv.slice(2)

// the same voices and rates as the player (player/techno.mjs, say())
function say(voice, rate, text) {
  const f = join(tmpdir(), `techno-film-${voice}.wav`)
  execFileSync('say', ['-v', voice, '-r', String(rate), '-o', f, '--file-format=WAVE', '--data-format=LEI16@22050', '--', text])
  const clip = decodeWav(new Uint8Array(readFileSync(f)))
  rmSync(f)
  return clip
}
const voices = { whisper: say('Whisper', 150, phrase), deep: say('Daniel', 120, phrase) }

// walk the whole set once, keep every loop's spec and where it sits
const set = newSet(trackFor(phrase)), loops = []
while (loops.length < 40) {
  const spec = structuredClone(loopSpec(set, { auto: true }))
  loops.push({ spec, part: set.track.part, loop: set.loop, handover: set.handover ? { step: set.handover.step, loop: set.handover.loop, from: set.handover.from.phrase } : null })
  if (set.handover && set.handover.step === 1) break
  afterLoop(set, { auto: true, nextTrack: () => trackFor(nextPhrase) })
}
const find = (fn) => loops.findIndex(fn)
const last = (part) => loops.findLastIndex((l) => !l.handover && l.part === part)
// the montage: [loop index, first bar, bars, the film's section]
const SEGMENTS = [
  [last(4), 0, 8, 'problems'],                            // the riser into drop 1
  [find((l) => l.part === 5), 0, 8, 'reveal'],            // drop 1
  [last(8), 1, 7, 'voice'],                               // breakdown 2: the whisper, the riser
  [find((l) => l.part === 9), 0, 4, 'auto'],              // drop 3: the deep voice on bar 1
  [find((l) => l.handover), 0, 8, 'never stops'],         // the handover into the next track
  [find((l) => l.handover) + 1, 0, 4, 'star'],
]

const mix = mixer(), bars = [], timeline = [], renders = new Map()
let t = 0
for (const [i, first, n, film] of SEGMENTS) {
  const L = loops[i]
  if (!renders.has(i)) renders.set(i, renderLoop(L.spec.track, { ...L.spec, voices }))
  const r = renders.get(i)
  const on = activeLayers(L.spec.track)
  const drop = PLAN[L.part].section === 'drop'
  for (let k = first; k < first + n; k++) {
    const b = mix.bar(r, k)
    const voice = on.voice ? (drop && k === 0 ? 'deep' : !drop && k === 2 ? 'whisper' : null) : null
    // the film dips the music under the engine's own voice, so a viewer hears
    // it; the voice itself is the engine's render, untouched
    if (voice) {
      if (!renders.has(-i - 1)) renders.set(-i - 1, renderLoop(L.spec.track, { ...L.spec }))
      const dry = renders.get(-i - 1), from = Math.round((k * r.loop) / 8)
      const hold = (voice === 'deep' ? 1.3 : 1.6) * 44100
      for (let j = 0; j < b.length / 2; j++) {
        const g = 1 - 0.65 * Math.min(1, j / 2200, Math.max(0, (hold - j) / 13000))
        for (const c of [0, 1]) { const m = (c ? dry.right : dry.left)[from + j]; b[j * 2 + c] -= (1 - g) * m }
      }
    }
    // a 4 ms fade at a cut, so a jump between loops never clicks
    if (k === first) for (let j = 0; j < 176; j++) { b[j * 2] *= j / 176; b[j * 2 + 1] *= j / 176 }
    if (k === first + n - 1) for (let j = 0; j < 176; j++) { const e = b.length / 2 - 1 - j; b[e * 2] *= j / 176; b[e * 2 + 1] *= j / 176 }
    bars.push(b)
    const dur = b.length / 2 / 44100
    timeline.push({ t, dur, film, bar: k, part: L.part, section: L.handover ? 'mixing in' : PLAN[L.part].section === 'drop' ? PLAN[L.part].name : PLAN[L.part].section,
      phrase: L.spec.with?.phrase ?? L.spec.track.phrase, from: L.handover?.from ?? null, bpm: L.spec.track.bpm, grid: grid(L.spec.track, k), voice, rise: !!L.spec.rise, impact: !!L.spec.impact && k === 0 })
    t += dur
  }
}
const len = bars.reduce((s, b) => s + b.length / 2, 0), left = new Float32Array(len), right = new Float32Array(len)
let o = 0; for (const b of bars) for (let i = 0; i < b.length / 2; i++, o++) { left[o] = b[i * 2]; right[o] = b[i * 2 + 1] }
writeFileSync(`${dir}/film.wav`, toWav({ left, right, sampleRate: 44100 }))
writeFileSync(`${dir}/film.json`, JSON.stringify({ phrase, next: nextPhrase, loops: PLAN.map((p) => p.loops), bars: timeline }))
for (const b of timeline) console.log(b.t.toFixed(2), b.film.padEnd(12), b.section.padEnd(10), 'bar', b.bar, b.phrase, b.from ? '<- ' + b.from : '', b.voice ?? '', b.impact ? 'impact' : '')
console.log((len / 44100).toFixed(1) + 's')
