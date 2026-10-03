import { expect, mock, test } from 'claude-code/testing'
import { encodeCode, trackFor } from '../hooks/engine.js'

// What Claude Code passes to the pane's ui.render hook, apart from the app
const PANE = {
  plugin: 'techno',
  component: 'Pane',
  requestId: 'techno',
  viewport: { columns: 140, rows: 40 },
  props: { title: 'techno', isFocused: true, bodyColumns: 58, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
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

test('/techno <phrase> starts a track and /techno code prints its share line', async ($, on) => {
  stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: 'late night deploy' })
  const code = await $.command.run({ command: 'techno', args: 'code' })
  expect(code.text).toMatch(/^\/techno late-night-deploy@\d{3}m\de\d$/)
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

test('a share code plays the same track', async ($, on) => {
  stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: 'ruslan@140m4e4d2s1+stab' })
  const code = await $.command.run({ command: 'techno', args: 'code' })
  expect(code.text).toBe('/techno ruslan@140m4e4d2s1+stab')
})

test('the crate lists tracks from the repo, and a click opens the deck', async ($, on) => {
  stubs(on)
  await start($)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: 'layout-C' })
    expect(await ui.find({ type: 'Text', text: /from your repo · my-app/ })).toBeDefined()
    const key = 'pick-' + encodeCode(trackFor('feature/login'))
    expect(await ui.find({ key })).toBeDefined()
    await ui.press({ key })
    expect(await ui.find({ key: 'back' })).toBeDefined()
    await ui.press({ key: 'back' })
    await ui.unmount()
  }
})

test('the coach lights play first, then the next move after play', async ($, on) => {
  stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: 'late night deploy' })
  await $.command.run({ command: 'techno', args: 'stop' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'layout-C' })
  expect((await ui.find({ key: 'play' }))?.props.variant).toBe('primary')
  await ui.press({ key: 'play' })
  expect((await ui.find({ key: 'play' }))?.props.variant).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^next › / })).toBeDefined()
  await ui.unmount()
})

test('layout A draws in both apps, with working controls', async ($, on) => {
  stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: 'late night deploy' })
  await $.command.run({ command: 'techno', args: 'stop' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: 'layout-A' })
    await ui.press({ key: 'tab-mix' })
    expect(await ui.find({ key: 'grid' })).toBeDefined()
    expect(await ui.find({ key: 'layer-kick' })).toBeDefined()
    await ui.unmount()
  }
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'energy-up' })
  await ui.press({ key: 'layer-perc' })
  await ui.unmount()
  const code = await $.command.run({ command: 'techno', args: 'code' })
  expect(code.text).toMatch(/e3/)
})

test('layout B draws in both apps, with working controls', async ($, on) => {
  stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: 'late night deploy' })
  await $.command.run({ command: 'techno', args: 'stop' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: 'layout-B' })
    expect(await ui.find({ key: 'grid' })).toBeDefined()
    expect(await ui.find({ key: 'layer-kick' })).toBeDefined()
    await ui.unmount()
  }
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'energy-up' })
  await ui.press({ key: 'layer-perc' })
  await ui.unmount()
  const code = await $.command.run({ command: 'techno', args: 'code' })
  expect(code.text).toMatch(/e3/)
})

test('layout C draws in both apps, with working controls', async ($, on) => {
  stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: 'late night deploy' })
  await $.command.run({ command: 'techno', args: 'stop' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: 'layout-C' })
    expect(await ui.find({ key: 'grid' })).toBeDefined()
    expect(await ui.find({ key: 'layer-kick' })).toBeDefined()
    await ui.unmount()
  }
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'energy-up' })
  await ui.press({ key: 'layer-perc' })
  await ui.unmount()
  const code = await $.command.run({ command: 'techno', args: 'code' })
  expect(code.text).toMatch(/e3/)
})

test('the share card shows the play line and copies it', async ($, on) => {
  stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: 'ruslan' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'layout-B' })
  await ui.press({ key: 'share' })
  expect(await ui.find({ type: 'Text', text: /^\/techno ruslan@/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /copied/ })).toBeDefined()
  await ui.unmount()
})
