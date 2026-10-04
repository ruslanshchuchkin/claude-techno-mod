// Render a whole auto set to a WAV: one track from the kick through its three
// drops, the handover, and a minute of the next track. For listening checks.
//   node scripts/set.mjs "ship it" "warehouse 4am" out.wav
import { writeFileSync } from 'node:fs'
import { trackFor, parseCode, renderLoop, toWav, PLAN } from '../hooks/engine.js'
import { newSet, loopSpec, afterLoop, mixer } from '../hooks/conductor.js'

const [a = 'ship it', b = 'warehouse 4am', out = 'set.wav', extra = '4'] = process.argv.slice(2)
const first = parseCode(a) ?? trackFor(a)
const next = parseCode(b) ?? trackFor(b)
const set = newSet(first)
const mix = mixer()
const bars = []
let loops = 0, handedOver = false, after = 0
const t0 = performance.now()
while (true) {
  const spec = loopSpec(set, { auto: true })
  const r = renderLoop(spec.track, { rise: spec.rise, impact: spec.impact, build: spec.build, fall: spec.fall, swell: spec.swell, with: spec.with })
  const where = set.handover ? `handover ${set.handover.step + 1}` : `${PLAN[set.track.part].name}`
  console.log(String(loops).padStart(2), (bars.reduce((s, x) => s + x.length / 2, 0) / 44100).toFixed(0).padStart(4) + 's', set.track.phrase.padEnd(16), where.padEnd(14), spec.rise ? 'build: ' + spec.build : '', spec.impact ? 'crash' + (spec.build ? ' + boom' : '') : '', spec.fall ? 'fall: ' + spec.fall : '', spec.swell ? 'swell' : '')
  for (let k = 0; k < 8; k++) bars.push(mix.bar(r, k))
  loops++
  if (set.handover) handedOver = true
  if (handedOver && !set.handover) after++
  afterLoop(set, { auto: true, nextTrack: () => next })
  if (after >= Number(extra)) break
}
const n = bars.reduce((s, x) => s + x.length / 2, 0)
const left = new Float32Array(n), right = new Float32Array(n)
let o = 0
for (const x of bars) for (let i = 0; i < x.length / 2; i++, o++) { left[o] = x[i * 2]; right[o] = x[i * 2 + 1] }
writeFileSync(out, toWav({ left, right, sampleRate: 44100 }))
console.log(`${loops} loops, ${(n / 44100 / 60).toFixed(1)} min, rendered in ${((performance.now() - t0) / 1000).toFixed(1)} s`)
