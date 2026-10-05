// The build-up loop into drop 1, as auto plays it, for the README demo.
//   node scripts/readme-media/demo-audio.mjs "late night deploy" own out.wav ["claude techno mod"]
// With a fourth argument, the macOS voices say that line instead of the
// track's name (the deep voice lands on the drop's first bar).
import { writeFileSync, readFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { trackFor, withVibe, renderLoop, toWav, encodeCode, decodeWav, PLAN } from '../../hooks/engine.js'
import { newSet, loopSpec, afterLoop, mixer } from '../../hooks/conductor.js'
const [phrase, vibe, out, line] = process.argv.slice(2)
let t = vibe === 'own' ? trackFor(phrase) : withVibe(trackFor(phrase), vibe)

// the same voices and rates as the player (player/techno.mjs, say())
function say(voice, rate, text) {
  const f = join(tmpdir(), `techno-demo-${voice}.wav`)
  execFileSync('say', ['-v', voice, '-r', String(rate), '-o', f, '--file-format=WAVE', '--data-format=LEI16@22050', '--', text])
  const clip = decodeWav(new Uint8Array(readFileSync(f)))
  rmSync(f)
  return clip
}
const voices = line ? { whisper: say('Whisper', 150, line), deep: say('Daniel', 120, line) } : null
if (voices) t = { ...t, layers: { ...t.layers, voice: true } }

const set = newSet(t); set.at = 4; set.track = { ...set.track, part: 4 }; set.loop = PLAN[4].loops - 1
const mix = mixer(), bars = []
for (let n = 0; n < 2; n++) {
  const spec = loopSpec(set, { auto: true })
  console.log(PLAN[set.track.part].name, spec.rise ? 'build ' + spec.build : '', spec.impact ? 'crash' : '', voices ? 'voice' : '')
  const r = renderLoop(spec.track, { rise: spec.rise, impact: spec.impact, build: spec.build, fall: spec.fall, swell: spec.swell, with: spec.with, voices })
  for (let k = 0; k < 8; k++) bars.push(mix.bar(r, k))
  afterLoop(set, { auto: true, nextTrack: () => t })
}
const len = bars.reduce((s, b) => s + b.length / 2, 0), left = new Float32Array(len), right = new Float32Array(len)
let o = 0; for (const b of bars) for (let i = 0; i < b.length / 2; i++, o++) { left[o] = b[i * 2]; right[o] = b[i * 2 + 1] }
writeFileSync(out, toWav({ left, right, sampleRate: 44100 }))
console.log(encodeCode(t), (len / 44100).toFixed(1) + 's')
