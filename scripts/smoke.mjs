// Fast checks in node, without a session: the version matches plugin.json,
// every part of the plan renders, the handover renders, and a render is fast.
// `claude plugin test` is the real test of the mod.
import { readFileSync } from 'node:fs'
import { trackFor, atPart, renderLoop, PLAN, HANDOVER } from '../hooks/engine.js'
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
for (let i = 0; i < HANDOVER.length; i++) {
  const spec = loopSpec(set, { auto: true })
  const r = renderLoop(spec.track, { with: spec.with })
  if (!r.left.some((x) => x !== 0)) fail('handover step ' + i + ' is silent')
  afterLoop(set, { auto: true, nextTrack: () => trackFor('next one') })
  afterLoop(set, { auto: true, nextTrack: () => trackFor('next one') })
}
console.log(process.exitCode ? 'smoke: failed' : `smoke: ok (v${plugin})`)
