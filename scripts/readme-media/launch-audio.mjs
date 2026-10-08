// The audio of the launch video, as the player plays it: the riser into
// drop 1 in "sad", "darker" lands on the next bar (the player renders the
// loop again and plays the same bar of it), then drop 1 in "dark".
//   node scripts/readme-media/launch-audio.mjs "late night deploy" out-dir
// Writes out-dir/launch.wav and out-dir/launch.json (one entry per bar, for
// launch-video.py).
import { writeFileSync } from 'node:fs'
import { trackFor, withVibe, renderLoop, toWav, grid, moodName, PLAN } from '../../hooks/engine.js'
import { newSet, loopSpec, afterLoop, mixer } from '../../hooks/conductor.js'
const [phrase, dir] = process.argv.slice(2)
const FIRST = 3, CHANGE = 5, SECONDS = 46 // start on bar 3 of the riser loop; "darker" lands on bar 5
const own = trackFor(phrase)
const sad = withVibe(own, 'sad'), dark = withVibe(own, 'dark')

const set = newSet(sad); set.at = 4; set.track = { ...set.track, part: 4 }; set.loop = PLAN[4].loops - 1
const loopsBefore = PLAN.slice(0, 4).reduce((s, p) => s + p.loops, 0) + set.loop
const mix = mixer(), bars = [], timeline = []
let t = 0, k = FIRST, pos = loopsBefore, mood = sad
while (t < SECONDS) {
  if (k === CHANGE && pos === loopsBefore) { mood = dark; set.track = { ...withVibe(set.track, 'dark') } }
  const spec = loopSpec(set, { auto: true })
  const r = renderLoop(spec.track, { rise: spec.rise, impact: spec.impact, build: spec.build, fall: spec.fall, swell: spec.swell, with: spec.with })
  for (; k < 8 && t < SECONDS; k++) {
    if (k === CHANGE && pos === loopsBefore && mood !== dark) break
    const b = mix.bar(r, k)
    const dur = b.length / 2 / 44100
    bars.push(b)
    const g = grid(spec.track, k)
    timeline.push({ t, dur, bar: k, pos, part: set.track.part, section: PLAN[set.track.part].section === 'drop' ? PLAN[set.track.part].name : PLAN[set.track.part].section,
      mood: moodName(spec.track), bpm: spec.track.bpm, build: spec.build ?? null, grid: g, next: PLAN[set.track.part + 1]?.layer ?? null })
    t += dur
  }
  if (k < 8) continue // the change: render this loop again in the new mood
  k = 0; pos++
  afterLoop(set, { auto: true, nextTrack: () => dark })
}
const len = bars.reduce((s, b) => s + b.length / 2, 0), left = new Float32Array(len), right = new Float32Array(len)
let o = 0; for (const b of bars) for (let i = 0; i < b.length / 2; i++, o++) { left[o] = b[i * 2]; right[o] = b[i * 2 + 1] }
writeFileSync(`${dir}/launch.wav`, toWav({ left, right, sampleRate: 44100 }))
writeFileSync(`${dir}/launch.json`, JSON.stringify({ phrase, loops: PLAN.map((p) => p.loops), bars: timeline }))
for (const b of timeline) console.log(b.t.toFixed(2), b.section, 'bar', b.bar, b.mood, b.bpm, b.build ?? '')
