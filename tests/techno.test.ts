import { expect, mock, test } from 'claude-code/testing'

// What Claude Code passes to the pane's ui.render hook, apart from the app
const PANE = {
  plugin: 'techno',
  component: 'Pane',
  requestId: 'techno',
  viewport: { columns: 140, rows: 40 },
  props: { title: 'techno', isFocused: true, bodyColumns: 46, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

// Answers every call the mod makes that the kit does not answer itself
function stubs(on: any) {
  mock.clock(on)
  mock.store(on, {})
  mock.env(on, { HOME: '/home/test' })
  on('session.start', () => ({ cwd: '/work' }))
  on('command.register', () => ({ value: undefined }))
  on('tool.register', () => ({ value: undefined }))
  on('audio.play', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.copy', () => ({ value: { isCopied: true } }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: '', stderr: '' } }))
  on('prompt.submit', ($: any, e: any) => ({ text: e.text }))
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['drawn by Claude Code'] }))
}

test('/techno <phrase> starts a track and /techno code prints its share line', async ($, on) => {
  stubs(on)
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await $.command.run({ command: 'techno', args: 'late night deploy' })
  const code = await $.command.run({ command: 'techno', args: 'code' })
  expect(code.text).toMatch(/^\/techno late-night-deploy@\d{3}m\de\d$/)
})

test('the jam tool changes mood and layers, and the share line carries them', async ($, on) => {
  stubs(on)
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await $.command.run({ command: 'techno', args: 'ruslan' })
  const r = await $.tool.call({ tool: 'mcp__techno__jam', mood: 0, layers: { acid: true, hats: false } })
  expect(String(r.result)).toContain('pitch black')
  expect(String(r.result)).toContain('+acid')
  expect(String(r.result)).toContain('-hats')
})

test('a share code plays the same track', async ($, on) => {
  stubs(on)
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await $.command.run({ command: 'techno', args: 'ruslan@140m4e4d2s1+stab' })
  const code = await $.command.run({ command: 'techno', args: 'code' })
  expect(code.text).toBe('/techno ruslan@140m4e4d2s1+stab')
})

test('the pane draws the grid and its controls in both apps, and dice changes the track', async ($, on) => {
  stubs(on)
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await $.command.run({ command: 'techno', args: 'late night deploy' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ key: 'play' })).toBeDefined()
    expect(await ui.find({ key: 'row-kick' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '"late night deploy"' })).toBeDefined()
    await ui.press({ key: 'dice' })
    await ui.unmount()
  }
  const code = await $.command.run({ command: 'techno', args: 'code' })
  expect(code.text).toMatch(/d2$/)
})

test('the flyer shows the share line and copies it', async ($, on) => {
  stubs(on)
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await $.command.run({ command: 'techno', args: 'ruslan' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'flyer' })
  expect(await ui.find({ type: 'Text', text: /^\/techno ruslan@/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /copied/ })).toBeDefined()
  await ui.unmount()
})
