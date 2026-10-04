// Fast checks in node, without a session: the version matches plugin.json,
// every part of the plan renders, the handover renders, and a render is fast.
// `claude plugin test` is the real test of the mod.
import { readFileSync } from 'node:fs'
import { trackFor, atPart, renderLoop, arrange, withVibe, PLAN, HANDOVERS, VIBES, BUILDS, FALLS, INSTRUMENTS, TONE_LAYERS, editTrack } from '../hooks/engine.js'
import { newSet, loopSpec, afterLoop } from '../hooks/conductor.js'

const fail = (msg) => { console.error('FAIL', msg); process.exitCode = 1 }
const plugin = JSON.parse(readFileSync(new URL('../.claude-plugin/plugin.json', import.meta.url), 'utf8')).version
const mod = readFileSync(new URL('../hooks/register.js', import.meta.url), 'utf8').match(/const VERSION = '([^']+)'/)[1]
if (plugin !== mod) fail(`VERSION ${mod} in register.js, ${plugin} in plugin.json`)

const t = trackFor('smoke test')
for (let p = 0; p < PLAN.length; p++) {
  const t0 = performance.now()
  const r = renderLoop(atPart(t, p), { rise: !!PLAN[p].rise, impact: PLAN[p].section === 'drop' })
  const ms = performance.now() - t0
  let peak = 0
  for (const x of r.left) peak = Math.max(peak, Math.abs(x))
  if (!(peak > 0.05 && peak <= 0.9)) fail(`part ${p} peak ${peak}`)
  if (ms > 1500) fail(`part ${p} took ${ms} ms`)
}
const set = newSet(atPart(t, PLAN.length - 1))
afterLoop(set, { auto: true, nextTrack: () => trackFor('next one') })
const handoverSteps = HANDOVERS[set.handover.shape].steps.length
for (let i = 0; i < handoverSteps; i++) {
  const spec = loopSpec(set, { auto: true })
  const r = renderLoop(spec.track, { with: spec.with })
  if (!r.left.some((x) => x !== 0)) fail('handover step ' + i + ' is silent')
  afterLoop(set, { auto: true, nextTrack: () => trackFor('next one') })
  afterLoop(set, { auto: true, nextTrack: () => trackFor('next one') })
}
// every build-up pack renders the loop before a drop and the drop; the
// filter one ends on a beat of silence
for (const build of BUILDS) {
  const r = renderLoop(atPart(t, 4), { rise: true, build })
  const d = renderLoop(atPart(t, 5), { impact: true, build })
  let peak = 0
  for (const x of [...r.left, ...d.left]) peak = Math.max(peak, Math.abs(x))
  if (!(peak > 0.05 && peak <= 0.9)) fail(`build ${build} peak ${peak}`)
  const lastBeat = r.left.subarray(r.loop - Math.round(r.stepSeconds * 44100 * 2), r.loop)
  if (build === 'filter' && lastBeat.some((x) => Math.abs(x) > 1e-4)) fail('the filter build is not silent before the drop')
}
// every fall renders the last loop of a drop, and the swell the loop before a new sound
for (const fall of [...FALLS, null]) {
  const r = renderLoop(atPart(t, 5), { fall, swell: fall === null })
  let peak = 0
  for (const x of r.left) peak = Math.max(peak, Math.abs(x))
  if (!(peak > 0.05 && peak <= 0.9)) fail(`fall ${fall ?? 'swell'} peak ${peak}`)
}
// every instrument, a tone on every sound and the master render in range
{
  let x = atPart(t, 9)
  for (const [layer, list] of Object.entries(INSTRUMENTS)) {
    for (let v = 0; v < list.length; v++) {
      const r = renderLoop(editTrack(x, { kind: 'inst', layer, value: v }))
      let peak = 0
      for (const y of r.left) peak = Math.max(peak, Math.abs(y))
      if (!(peak > 0.05 && peak <= 0.9)) fail(`${layer} ${list[v]} peak ${peak}`)
    }
  }
  for (const layer of TONE_LAYERS) x = editTrack(x, { kind: 'tone', layer, cut: layer.length % 2 ? -2 : 2, grit: 2 })
  x = editTrack(editTrack(x, { kind: 'master', lp: -2, hp: 1, space: 2 }), { kind: 'suggest-notes', layer: 'bass', seed: 1 })
  const r = renderLoop({ ...x, layers: { acid: true } })
  if (!r.left.some((y) => Math.abs(y) > 0.05)) fail('the edited track is silent')
}
// chords stay dark in every mood: no major third, no seventh over the root
for (const v of VIBES) {
  const a = arrange({ ...withVibe(trackFor('chord check'), v.name), layers: { stab: true, pad: true } })
  for (const notes of [a.events.stab[0].notes, a.events.pad[0].notes]) {
    const bad = notes.map((n) => (n - notes[0]) % 12).filter((i) => i === 4 || i === 10 || i === 11)
    if (bad.length) fail(`${v.name}: a bright interval in the chord ${notes}`)
  }
}
console.log(process.exitCode ? 'smoke: failed' : `smoke: ok (v${plugin})`)
