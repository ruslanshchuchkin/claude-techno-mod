// Render a track to a WAV file from the shell, for listening and checks.
//   node scripts/render.mjs "late night deploy" out.wav
//   node scripts/render.mjs "late-night-deploy@128m1e3+acid" out.wav
import { writeFileSync } from 'node:fs'
import { trackFor, parseCode, render, toWav, describe, encodeCode, grid } from '../hooks/engine.js'

const [input = 'techno', out = 'out.wav', repeats = '1'] = process.argv.slice(2)
const track = parseCode(input) ?? trackFor(input)
const t0 = performance.now()
const audio = render(track)
const ms = Math.round(performance.now() - t0)
let wav = toWav(audio)
if (Number(repeats) > 1) {
  // repeat the loop in the file, to hear the seam
  const body = wav.subarray(44)
  const full = new Uint8Array(44 + body.length * Number(repeats))
  full.set(wav.subarray(0, 44))
  for (let i = 0; i < Number(repeats); i++) full.set(body, 44 + i * body.length)
  const v = new DataView(full.buffer)
  v.setUint32(4, 36 + body.length * Number(repeats), true)
  v.setUint32(40, body.length * Number(repeats), true)
  wav = full
}
writeFileSync(out, wav)
console.log(encodeCode(track))
console.log(describe(track))
console.log(`rendered ${audio.seconds.toFixed(1)}s in ${ms}ms, ${(wav.length / 1e6).toFixed(2)} MB`)
for (const [k, v] of Object.entries(grid(track, 0))) console.log(k.padEnd(6), v)
