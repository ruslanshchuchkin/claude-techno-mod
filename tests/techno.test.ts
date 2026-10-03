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
function stubs(on: any) {
  mock.clock(on)
  mock.store(on, {})
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
    if (argv.startsWith('git rev-parse')) return { value: { exitCode: 0, stdout: 'feature/login\n', stderr: '' } }
    if (argv.startsWith('git log')) return { value: { exitCode: 0, stdout: 'fix the flaky test\nadd dark mode\n', stderr: '' } }
    return { value: { exitCode: 0, stdout: '', stderr: '' } }
  })
  on('prompt.submit', ($: any, e: any) => ({ text: e.text }))
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['drawn by Claude Code'] }))
}

const start = ($: any) => $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work/my-app' })

test('/techno <phrase> starts the build at the kick, and /techno code prints its share line', async ($, on) => {
  stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: 'late night deploy' })
  const code = await $.command.run({ command: 'techno', args: 'code' })
  expect(code.text).toMatch(/^\/techno late-night-deploy@\d{3}m\de0p0$/)
})

test('the jam tool changes mood and layers, and the share line carries them', async ($, on) => {
  stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: 'ruslan' })
  const r = await $.tool.call({ tool: 'mcp__techno__jam', mood: 0, layers: { acid: true, hats: false } })
  expect(String(r.result)).toContain('pitch black')
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
    expect(await ui.find({ type: 'Text', text: /part 1 of/ })).toBeDefined()
    await ui.unmount()
  }
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'tempo-up' })
  await ui.unmount()
  const code = await $.command.run({ command: 'techno', args: 'code' })
  expect(code.text).toMatch(/p0/)
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
  expect((await ui.find({ key: 'do-move' }))?.props.label).toContain('+ hats')
  for (let i = 0; i < PLAN.length; i++) await ui.press({ key: 'do-move' })
  expect(await ui.find({ type: 'Text', text: /Your track is done/ })).toBeDefined()
  expect(await ui.find({ key: 'replay' })).toBeDefined()
  expect(await ui.find({ key: 'save-set' })).toBeDefined()
  await ui.press({ key: 'remix' })
  expect(await ui.find({ type: 'Text', text: /Your track is done/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /part 1 of/ })).toBeDefined()
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
  expect(await ui.find({ key: 'mini-stop' })).toBeDefined()
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
