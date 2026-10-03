// Runs the hooks module in node against a fake mods API, to catch logic
// errors without a Claude Code session. `claude plugin test` is the real test.
import { register } from '../hooks/register.js'

if (!Uint8Array.prototype.toBase64) {
  Uint8Array.prototype.toBase64 = function () { return Buffer.from(this).toString('base64') }
}

const hooks = []
const on = (event, a, b) => hooks.push({ event, matcher: b ? a : null, fn: b ?? a })
register(on)

const calls = []
const store = new Map()
let t = 1000
const el = (type) => (props) => ({ type, props })
const $ = {
  audio: { play: (clip, opt) => { calls.push(['audio.play', clip.base64.length, opt.gain]); return new Promise((res) => opt.signal.addEventListener('abort', res)) } },
  clock: { now: async () => (t += 137), every: (ms) => { calls.push(['clock.every', ms]); return { cancel() {} } } },
  command: { register: async (spec) => calls.push(['command.register', spec.name]) },
  tool: { register: async (spec) => calls.push(['tool.register', spec.name]) },
  env: { get: async () => '/tmp/claude-501/techno-home' },
  process: { run: async (argv) => { calls.push(['process.run', argv[0]]); return { exitCode: 0, stdout: '', stderr: '' } } },
  store: { get: async (k) => store.get(k), set: async (k, v) => store.set(k, v) },
  ui: {
    copy: async (text) => calls.push(['ui.copy', text]),
    invalidate: () => {},
    open: async (p) => calls.push(['ui.open', p.id]),
    resolve: () => ({ Box: el('Box'), Text: el('Text'), Button: el('Button'), Input: el('Input') }),
  },
}

async function fire(event, e, fields = {}) {
  const hs = hooks.filter((h) => h.event === event && Object.entries(h.matcher ?? {}).every(([k, v]) => e[k] === v || fields[k] === v))
  let i = 0
  const next = async (ev) => (i < hs.length ? hs[i++].fn($, ev, next) : { type: 'engine' })
  return next(e)
}

// Flattens a tree to lines: a row Box becomes one line
const line = (node) => (node?.type === 'Text' ? node.props.children.join('') : (node?.props?.children ?? []).map(line).join(node?.props?.flexDirection === 'row' ? ' ' : '\n'))
const texts = (node) => line(node).split('\n')

await fire('session.start', {})
console.log('start:', calls.splice(0).map((c) => c.join(' ')).join(' | '))

let r = await fire('command.run', { command: 'techno', args: 'late night deploy in bucharest' })
console.log('/techno phrase ->', JSON.stringify(r), calls.splice(0).map((c) => c.join(' ')).join(' | '))

let pane = await fire('ui.render', { component: 'Pane', requestId: 'techno', props: {}, surface: 'terminal' })
console.log(texts(pane).join('\n'))

await fire('prompt.submit', { text: 'make it darker and add some acid' })
r = await fire('tool.call', { tool: 'mcp__techno__jam', mood: 1, layers: { acid: true }, note: 'darker, acid on' })
console.log('\njam ->', r.result)
pane = await fire('ui.render', { component: 'Pane', requestId: 'techno', props: {}, surface: 'terminal' })
console.log(texts(pane).slice(-3).join('\n'))

r = await fire('command.run', { command: 'techno', args: 'code' })
console.log('\n/techno code ->', r.text)
r = await fire('command.run', { command: 'techno', args: r.text })
console.log('/techno <code> -> same track again:', store.get('track').mood === 1 && store.get('track').layers.acid === true)

r = await fire('command.run', { command: 'techno', args: 'save' })
console.log('/techno save ->', r.text, calls.filter((c) => c[0] === 'process.run').map((c) => c[1]).join(','))
r = await fire('command.run', { command: 'techno', args: 'stop' })
console.log('/techno stop ->', r.text)
