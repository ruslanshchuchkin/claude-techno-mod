// Render the build into drop 1 once per build-up pack, to compare them:
// two loops of the build part (the second one builds up), then two loops of
// drop 1. Writes one WAV per pack into the folder.
//   node scripts/buildups.mjs "late night deploy" previews/buildups
import { writeFileSync, mkdirSync } from 'node:fs'
import { trackFor, parseCode, atPart, renderLoop, toWav, BUILDS } from '../hooks/engine.js'
import { mixer } from '../hooks/conductor.js'

const [phrase = 'late night deploy', dir = 'previews/buildups'] = process.argv.slice(2)
const t = parseCode(phrase) ?? trackFor(phrase)
mkdirSync(dir, { recursive: true })

const packs = [['0-now', null], ...BUILDS.map((b, i) => [`${i + 1}-${b}`, b])]
for (const [name, build] of packs) {
  const loops = [
    [atPart(t, 4), {}],
    [atPart(t, 4), { rise: true, build }],
    [atPart(t, 5), { impact: true, build }],
    [atPart(t, 5), {}],
  ]
  const mix = mixer()
  const bars = []
  for (const [track, opts] of loops) {
    const r = renderLoop(track, opts)
    for (let k = 0; k < 8; k++) bars.push(mix.bar(r, k))
  }
  const n = bars.reduce((s, x) => s + x.length / 2, 0)
  const left = new Float32Array(n), right = new Float32Array(n)
  let o = 0
  for (const x of bars) for (let i = 0; i < x.length / 2; i++, o++) { left[o] = x[i * 2]; right[o] = x[i * 2 + 1] }
  writeFileSync(`${dir}/${name}.wav`, toWav({ left, right, sampleRate: 44100 }))
  console.log(name, (n / 44100).toFixed(1) + ' s')
}
