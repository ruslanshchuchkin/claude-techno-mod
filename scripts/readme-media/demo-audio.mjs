// The build-up loop into drop 1, as auto plays it, for the README demo.
import { writeFileSync } from 'node:fs'
import { trackFor, withVibe, renderLoop, toWav, encodeCode, PLAN } from '../../hooks/engine.js'
import { newSet, loopSpec, afterLoop, mixer } from '../../hooks/conductor.js'
const [phrase, vibe, out] = process.argv.slice(2)
const t = vibe === 'own' ? trackFor(phrase) : withVibe(trackFor(phrase), vibe)
const set = newSet(t); set.at = 4; set.track = { ...set.track, part: 4 }; set.loop = PLAN[4].loops - 1
const mix = mixer(), bars = []
for (let n = 0; n < 2; n++) {
  const spec = loopSpec(set, { auto: true })
  console.log(PLAN[set.track.part].name, spec.rise ? 'build ' + spec.build : '', spec.impact ? 'crash' : '')
  const r = renderLoop(spec.track, { rise: spec.rise, impact: spec.impact, build: spec.build, fall: spec.fall, swell: spec.swell, with: spec.with })
  for (let k = 0; k < 8; k++) bars.push(mix.bar(r, k))
  afterLoop(set, { auto: true, nextTrack: () => t })
}
const len = bars.reduce((s, b) => s + b.length / 2, 0), left = new Float32Array(len), right = new Float32Array(len)
let o = 0; for (const b of bars) for (let i = 0; i < b.length / 2; i++, o++) { left[o] = b[i * 2]; right[o] = b[i * 2 + 1] }
writeFileSync(out, toWav({ left, right, sampleRate: 44100 }))
console.log(encodeCode(t), (len / 44100).toFixed(1) + 's')
