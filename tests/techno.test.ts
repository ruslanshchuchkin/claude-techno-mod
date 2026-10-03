import { expect, mock, test } from 'claude-code/testing'
import { atPart, encodeCode, parseCode, toggleStep, trackFor, PLAN } from '../hooks/engine.js'

// What Claude Code passes to the band's ui.render hook, apart from the app
const PANE = {
  plugin: 'techno',
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  viewport: { columns: 140, rows: 40 },
  props: { hasSurvey: false, isWorking: false, maxRows: 30, bodyColumns: 120, scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

// Answers every call the mod makes that the kit does not answer itself
function stubs(on: any, store: Record<string, unknown> = {}, run?: (argv: string) => unknown) {
  const clock = mock.clock(on)
  mock.store(on, store)
  mock.env(on, { HOME: '/home/test' })
  on('session.start', () => ({ cwd: '/work/my-app' }))
  on('session.cwd', () => ({ value: '/work/my-app' }))
  on('command.register', () => ({ value: undefined }))
  on('tool.register', () => ({ value: undefined }))
  on('audio.play', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.copy', () => ({ value: { isCopied: true } }))
  on('fs.read', () => ({ value: JSON.stringify({ name: 'techno', version: '0.2.0-dev' }) }))
  on('process.run', ($: any, e: any) => {
    const argv = e.argv.join(' ')
    const own = run?.(argv)
    if (own) return { value: own }
    if (argv.startsWith('git rev-parse')) return { value: { exitCode: 0, stdout: 'feature/login\n', stderr: '' } }
    if (argv.startsWith('git log')) return { value: { exitCode: 0, stdout: 'fix the flaky test\nadd dark mode\n', stderr: '' } }
    return { value: { exitCode: 0, stdout: '', stderr: '' } }
  })
  on('prompt.submit', ($: any, e: any) => ({ text: e.text }))
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['drawn by Claude Code'] }))
  return clock
}

const start = ($: any) => $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work/my-app' })

test('/techno <phrase> starts the build at the kick, and /techno code prints its share line', async ($, on) => {
  stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: 'late night deploy' })
  const code = await $.command.run({ command: 'techno', args: 'code' })
  expect(code.text).toMatch(/^\/techno late-night-deploy@\d{3}m\de\dk\dp0$/)
})

test('the jam tool changes mood and layers, and the share line carries them', async ($, on) => {
  stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: 'ruslan' })
  const r = await $.tool.call({ tool: 'mcp__techno__jam', mood: 'dark', layers: { acid: true, hats: false } })
  expect(String(r.result)).toContain('mood dark')
  expect(String(r.result)).toContain('+acid')
  expect(String(r.result)).toContain('-hats')
})

test('the jam tool moves the build to its next part', async ($, on) => {
  stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: 'ruslan' })
  const r = await $.tool.call({ tool: 'mcp__techno__jam', next: true })
  expect(String(r.result)).toContain('part 2 of')
  expect(String(r.result)).toMatch(/p1/)
})

test('a share code plays the same track, old codes included', async ($, on) => {
  stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: 'ruslan@140m4e4d2s1+stab' })
  let code = await $.command.run({ command: 'techno', args: 'code' })
  expect(code.text).toBe('/techno ruslan@140m4e4d2s1+stab')
  await $.command.run({ command: 'techno', args: 'ruslan@140m4e4p5-kick*kick00040000' })
  code = await $.command.run({ command: 'techno', args: 'code' })
  expect(code.text).toBe('/techno ruslan@140m4e4p5-kick*kick00040000')
})

test('a step toggles on and off again, and the code round-trips', () => {
  const t = atPart(trackFor('ruslan'), 0)
  const on = toggleStep(t, 'kick', 2)
  expect(encodeCode(on)).toContain('*kick0004')
  expect(encodeCode(parseCode(encodeCode(on))!)).toBe(encodeCode(on))
  expect(encodeCode(toggleStep(on, 'kick', 2))).toBe(encodeCode(t))
})

test('the crate lists tracks from the repo, and a click opens the deck', async ($, on) => {
  stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: '' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /this project/ })).toBeDefined()
    const key = 'pick-' + encodeCode(atPart(trackFor('feature/login'), 0))
    expect(await ui.find({ key })).toBeDefined()
    await ui.press({ key })
    expect(await ui.find({ key: 'back' })).toBeDefined()
    await ui.press({ key: 'back' })
    await ui.unmount()
  }
})

test('the deck has energy, mood and tempo, a grid, and no layer chips', async ($, on) => {
  stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: 'late night deploy' })
  await $.command.run({ command: 'techno', args: 'stop' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ key: 'grid' })).toBeDefined()
    expect(await ui.find({ key: 'energy-up' })).toBeDefined()
    expect(await ui.find({ key: 'layer-kick' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /^1\/10$/ })).toBeDefined()
    await ui.unmount()
  }
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'tempo-up' })
  expect(await ui.find({ key: 'key-up' })).toBeUndefined()
  expect(await ui.find({ key: 'scale-up' })).toBeUndefined()
  await ui.unmount()
  const code = await $.command.run({ command: 'techno', args: 'code' })
  expect(code.text).toMatch(/k\dp0/)
})

test('play is lit first, then NEXT builds the track part by part to the done card', { timeoutMs: 30000 }, async ($, on) => {
  stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: 'late night deploy' })
  await $.command.run({ command: 'techno', args: 'stop' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ key: 'play' }))?.props.variant).toBe('primary')
  await ui.press({ key: 'play' })
  expect((await ui.find({ key: 'do-move' }))?.props.variant).toBe('primary')
  expect((await ui.find({ key: 'do-move' }))?.props.label).toContain('next: add the deep bass')
  for (let i = 0; i < PLAN.length; i++) await ui.press({ key: 'do-move' })
  expect(await ui.find({ type: 'Text', text: /Your track is done/ })).toBeDefined()
  expect(await ui.find({ key: 'replay' })).toBeDefined()
  expect(await ui.find({ key: 'save-set' })).toBeDefined()
  await ui.press({ key: 'remix' })
  expect(await ui.find({ type: 'Text', text: /Your track is done/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^1\/10$/ })).toBeDefined()
  await ui.unmount()
})

test('the share card shows the play line and copies it', async ($, on) => {
  stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: 'ruslan' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'share' })
  expect(await ui.find({ type: 'Text', text: /^\/techno ruslan@/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /copied/ })).toBeDefined()
  await ui.unmount()
})

test('/techno hides the app, and a playing track shows a one-line player', async ($, on) => {
  stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: 'ruslan' })
  await $.command.run({ command: 'techno', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ key: 'mini-play' })).toBeDefined()
  expect(await ui.find({ key: 'mini-auto' })).toBeDefined()
  expect(await ui.find({ key: 'mini-next' })).toBeDefined()
  expect(await ui.find({ key: 'mini-share' })).toBeDefined()
  expect(await ui.find({ key: 'energy-up' })).toBeUndefined()
  await ui.press({ key: 'mini-open' })
  expect(await ui.find({ key: 'energy-up' })).toBeDefined()
  await ui.unmount()
})

test('a click on a grid cell adds a hit, and a click on a row name mutes the layer', { timeoutMs: 30000 }, async ($, on) => {
  stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: 'ruslan' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    // row 0 (kick) sits under the header and the beat ruler; step 2 starts at column 8 + 2 * 3
    await ui.pointer({ type: 'down', x: 14, y: 2, button: 'left', in: 'grid' })
    expect((await $.command.run({ command: 'techno', args: 'code' })).text).toContain('*kick0004')
    await ui.pointer({ type: 'down', x: 14, y: 2, button: 'left', in: 'grid' })
    await ui.pointer({ type: 'down', x: 1, y: 2, button: 'left', in: 'grid' })
    expect((await $.command.run({ command: 'techno', args: 'code' })).text).toContain('-kick')
    await ui.pointer({ type: 'down', x: 1, y: 2, button: 'left', in: 'grid' })
    await ui.unmount()
  }
})

test('auto builds a part per loop, then mixes into the next track at the same tempo', { timeoutMs: 60000 }, async ($, on) => {
  const clock = stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: 'late night deploy' })
  const bpm = (await $.command.run({ command: 'techno', args: 'code' })).text.match(/@(\d+)/)[1]
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'auto' })
  const loopMs = (128 * 60000) / Number(bpm) / 4
  await clock.advance(loopMs + 50)
  expect((await $.command.run({ command: 'techno', args: 'code' })).text).toMatch(/p1$/)
  // 10 parts, the two groove parts, the peak and the drop twice: 14 loops in all, then the next track
  for (let i = 0; i < 13; i++) await clock.advance(loopMs)
  const code = (await $.command.run({ command: 'techno', args: 'code' })).text
  expect(code).not.toContain('late-night-deploy')
  expect(code).toContain('@' + bpm + 'm')
  expect(code).toMatch(/p0$/)
  await ui.unmount()
})

test('the bar closes with × and /techno brings the app back', async ($, on) => {
  stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: 'ruslan' })
  await $.command.run({ command: 'techno', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'mini-play' })
  await ui.press({ key: 'mini-close' })
  expect(await ui.find({ key: 'mini-play' })).toBeUndefined()
  await $.command.run({ command: 'techno', args: '' })
  expect(await ui.find({ key: 'energy-up' })).toBeDefined()
  await ui.unmount()
})

test('three moods, and each one sets the scale with it', async ($, on) => {
  stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: 'ruslan' })
  const r = await $.tool.call({ tool: 'mcp__techno__jam', mood: 'mysterious' })
  expect(String(r.result)).toContain('hijaz')
  expect(String(r.result)).toContain('mood mysterious')
  expect(String(r.result)).toMatch(/m1e\dk3p0/)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'mood-dark' })
  expect((await ui.find({ key: 'mood-dark' }))?.props.plain).toBeUndefined()
  expect((await ui.find({ key: 'mood-sad' }))?.props.plain).toBe(true)
  await ui.unmount()
  expect((await $.command.run({ command: 'techno', args: 'code' })).text).toMatch(/m0e\dk2p0/)
  // an old code keeps its own mood and scale
  expect(encodeCode(parseCode('ruslan@130m3e2p4')!)).toBe('ruslan@130m3e2p4')
})

test('the bar follows you into a new chat once you used techno', async ($, on) => {
  stubs(on, { track: atPart(trackFor('ruslan'), 3), bar: true })
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ key: 'mini-play' })).toBeDefined()
  await ui.unmount()
})

test('the top says what plays, where the name comes from, and what comes next', async ($, on) => {
  stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: 'late night deploy' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.drawn()
    expect(await ui.find({ type: 'Text', text: /a starter track/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^kick$/ })).toBeDefined()
    expect(await ui.find({ key: 'mood-mysterious' })).toBeDefined()
    expect((await ui.find({ key: 'do-move' }))?.props.label).toMatch(/^(▸ )?next: add the deep bass ›$/)
    expect((await ui.find({ key: 'dice' }))?.props.label).toBe('new rhythm')
    await ui.unmount()
  }
})

test('with ffplay, one background player plays for every chat, and stop kills its group', async ($, on) => {
  const calls: string[] = []
  const clock = stubs(on, {}, (argv) => {
    calls.push(argv)
    if (argv.includes('command -v ffplay')) return { exitCode: 0, stdout: '/opt/homebrew/bin/ffplay\n/usr/bin/perl\n', stderr: '' }
    if (argv.includes('POSIX::setsid')) return { exitCode: 0, stdout: '4242\n', stderr: '' }
    return undefined
  })
  await start($)
  await $.command.run({ command: 'techno', args: 'ruslan' })
  expect(calls.some((c) => c.includes('POSIX::setsid') && c.includes('player.sh') && c.includes('loop'))).toBe(true)
  expect(calls.some((c) => c.startsWith('audio'))).toBe(false)
  await $.command.run({ command: 'techno', args: 'stop' })
  await clock.advance(10)
  expect(calls.some((c) => c.includes('kill -TERM') && c.includes('4242'))).toBe(true)
})

test('a mood sets the tempo and the energy too', async ($, on) => {
  stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: 'ruslan' })
  const sad = String((await $.tool.call({ tool: 'mcp__techno__jam', mood: 'sad' })).result)
  expect(sad).toContain('122 bpm')
  expect(sad).toContain('energy minimal')
  const dark = String((await $.tool.call({ tool: 'mcp__techno__jam', mood: 'dark' })).result)
  expect(dark).toContain('132 bpm')
  expect(dark).toContain('energy rolling')
  expect(dark).toMatch(/techno v\d+\.\d+\.\d+/)
})
