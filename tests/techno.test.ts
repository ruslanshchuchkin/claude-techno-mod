import { expect, mock, test } from 'claude-code/testing'
import { atPart, encodeCode, parseCode, toggleStep, trackFor, styleName, withStyle, instOf, leadOf, arrange, scaleName, keyName, noteName as noteNameOf, activeLayers, transitionsOf, editTrack, planOf, planAdd, grid, soundInfo, INSTRUMENTS, PLAN, STYLES, LEADS, EXTRAS, BASS_LINES, extrasOf, HANDOVERS, HANDOVER_LOOPS, BUILDS, FALLS } from '../hooks/engine.js'
import { newSet, loopSpec, afterLoop, stepOn, posOf, sectionLabel, homeOf, GLIDE, freshKey } from '../hooks/conductor.js'
import { partBar, contextLabel } from '../hooks/views.js'
import { keyWords } from '../hooks/words.js'
import { dancerFor, nextDancer, px, DANCERS, DANCER_NAMES } from '../hooks/dancers.js'

const NOTES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']

// What Claude Code passes to the band's ui.render hook, apart from the app
const PANE = {
  plugin: 'techno',
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  viewport: { columns: 140, rows: 40 },
  props: { hasSurvey: false, isWorking: false, maxRows: 30, bodyColumns: 120, scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

// A fake of the background player (player/techno.mjs): the same answers on
// the socket, with the real conductor, and no sound.
function fakePlayer() {
  const p: any = { chats: [{ phrase: 'social media content plan', project: 'yourcolorpalette', at: -3600000 }, { phrase: 'fae court quiz', project: '', at: -2 * 86400000 }], set: newSet(trackFor('late night deploy')), volume: 4, playing: false, auto: true, favorites: [], history: [], rev: 1, said: '', cmds: [] as any[] }
  const id = (t: any) => encodeCode({ ...t, part: null })
  const view = () => {
    const t = p.set.track
    const nx = PLAN[t.part + 1]
    return { code: encodeCode(t), id: id(t), phrase: t.phrase, mood: styleName(t), style: t.style == null ? null : styleName(t), bpm: t.bpm, part: t.part, section: PLAN[t.part].section, name: PLAN[t.part].name, from: null, next: nx ? { name: nx.name, adds: nx.adds, layer: nx.layer } : { name: 'the next track' }, bar: 0, loopsLeft: 1, at: posOf(p.set), plan: planOf(t) }
  }
  const state = () => ({ version: '9.9.9', rev: p.rev, now: 0, playing: p.playing, auto: p.auto, playlist: null, view: view(), barStartedAt: p.playing ? 1 : 0, barMs: 1800, stepMs: 112, nextInMs: p.playing && p.auto ? 23000 : null, fav: p.favorites.some((f: any) => f.code === id(p.set.track)), favorites: p.favorites, recent: p.history.map((c: string) => ({ code: c, label: parseCode(c)!.phrase, mood: 'dark', bpm: 128 })), said: p.said, canUndo: false, volume: p.volume, chats: p.chats })
  p.command = (c: any) => {
    p.cmds.push(c)
    p.rev++
    const t = p.set.track
    if (c.op === 'play') p.playing = true
    if (c.op === 'pause') p.playing = false
    if (c.op === 'auto') p.auto = c.on
    if (c.op === 'volume') p.volume = c.level
    if (c.op === 'next') stepOn(p.set, () => trackFor('ship it'))
    if (c.op === 'pick') { p.history.push(id(t)); p.set = newSet(atPart(parseCode(c.code) ?? trackFor(c.code), 0)); p.playing = true }
    if (c.op === 'prev' && p.history.length) p.set = newSet(atPart(parseCode(p.history.pop())!, 0))
    if (c.op === 'skip') { p.history.push(id(t)); p.set = newSet(atPart(trackFor('ship it'), 0)) }
    if (c.op === 'jam' && c.style) p.set.track = withStyle(t, c.style)
    if (c.op === 'layer') p.set.track = { ...t, layers: { ...t.layers, [c.name]: !activeLayers(t)[c.name] } }
    if (c.op === 'step') p.set.track = toggleStep(t, c.layer, c.i)
    if (c.op === 'edit' && !String(c.kind).startsWith('plan')) p.set.track = editTrack(t, c)
    if (c.op === 'edit' && c.kind === 'plan-remove') p.set.track = { ...t, plan: planOf(t).filter((_: number, i: number) => i !== c.k) }
    if (c.op === 'fav') p.favorites = p.favorites.some((f: any) => f.code === id(t)) ? [] : [{ code: id(t), label: t.phrase, mood: styleName(t), bpm: t.bpm }]
    return state()
  }
  p.state = state
  return p
}

// Answers every call the mod makes that the kit does not answer itself
function stubs(on: any, store: Record<string, unknown> = {}, run?: (argv: string) => unknown, latest = '0.0.1') {
  const player = fakePlayer()
  const clock = mock.clock(on)
  mock.store(on, store)
  mock.env(on, { HOME: '/home/test' })
  on('session.start', () => ({ cwd: '/work/my-app' }))
  on('session.cwd', () => ({ value: '/work/my-app' }))
  on('command.register', () => ({ value: undefined }))
  on('tool.register', () => ({ value: undefined }))
  on('ui.copy', () => ({ value: { isCopied: true } }))
  on('http.fetch', ($: any, e: any) => {
    // the plugin.json on GitHub, for the update notice
    if (String(e.url).startsWith('https://')) return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ name: 'techno', version: latest }) } }
    const body = e.init?.body ? JSON.parse(e.init.body) : null
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify(body ? player.command(body) : player.state()) } }
  })
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
  const usage = { percent: 42 as number | undefined }
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, tokens: usage.percent === undefined ? undefined : usage.percent * 2000, percent: usage.percent }, rateLimits: [] } }))
  return { clock, player, usage }
}

const start = ($: any) => $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work/my-app' })

test('a new chat says hello to the player with the project names and the tracks kept before', async ($, on) => {
  const { player, clock } = stubs(on, { saved: [{ label: 'main', code: 'main@134m3e3d1-bass-hats' }], track: atPart(trackFor('ruslan'), 3) })
  await start($)
  // the hello goes out behind the session start, so the command is there at once
  for (let i = 0; i < 20 && !player.cmds.some((c: any) => c.op === 'hello'); i++) await clock.advance(50)
  const hello = player.cmds.find((c: any) => c.op === 'hello')
  expect(hello.repo).toContain('my-app')
  expect(hello.repo).toContain('feature/login')
  expect(hello.saved[0].code).toBe('main@134m3e3d1-bass-hats')
  expect(hello.track).toMatch(/^ruslan@/)
})

test('the jam tool sends the change to the player and answers with the share line', async ($, on) => {
  const { player } = stubs(on)
  await start($)
  const r = await $.tool.call({ tool: 'mcp__techno__jam', energy: 3, layers: { acid: true, conga: true } })
  expect(player.cmds.some((c: any) => c.op === 'jam' && c.energy === 3 && c.layers.acid === true && c.layers.conga === true)).toBe(true)
  expect(String(r.result)).toContain('style dark')
  expect(String(r.result)).toMatch(/Share line: \/techno late-night-deploy@/)
  await $.tool.call({ tool: 'mcp__techno__jam', track: 'previous' })
  expect(player.cmds.some((c: any) => c.op === 'prev')).toBe(true)
  await $.tool.call({ tool: 'mcp__techno__jam', favorite: true })
  expect(player.cmds.some((c: any) => c.op === 'fav')).toBe(true)
})

test('/techno <phrase> picks a track, /techno stop pauses, /techno code prints the line', async ($, on) => {
  const { player } = stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: 'late night deploy' })
  expect(player.cmds.some((c: any) => c.op === 'pick' && c.code === 'late night deploy')).toBe(true)
  await $.command.run({ command: 'techno', args: 'stop' })
  expect(player.playing).toBe(false)
  expect((await $.command.run({ command: 'techno', args: 'code' })).text).toMatch(/^\/techno late-night-deploy@\d{3}m\de\d(s\d)?k\da0y\d$/)
})

test('the deck: play, the track, previous, favorite, auto; the sound and tempo, next, edit, favorites under the grid', async ($, on) => {
  const { player } = stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: '' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    for (const key of ['play', 'skip', 'fav', 'share', 'vol-mute', 'vol-down', 'vol-up', 'auto', 'where', 'grid', 'edit', 'favorites']) expect(await ui.find({ key })).toBeDefined()
    // only dark: no mood or style buttons, the line says dark and the tempo
    expect(await ui.find({ key: 'mood-sad' })).toBeUndefined()
    expect((await ui.find({ text: /^dark · \d{3} bpm$/ }))?.text).toMatch(/^dark · \d{3} bpm$/)
    // auto is on: the set moves by itself, so there is no next part button
    expect(await ui.find({ key: 'next' })).toBeUndefined()
    expect((await ui.find({ key: 'auto' }))?.props.variant).toBe('primary')
    await ui.unmount()
  }
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'skip' })
  expect(player.cmds.at(-1)).toMatchObject({ op: 'skip' })
  expect(player.set.track.part).toBe(0)
  await ui.press({ key: 'auto' })
  expect(player.auto).toBe(false)
  await ui.press({ key: 'next' })
  expect(player.set.track.part).toBe(1)
  await ui.press({ key: 'edit' })
  // the edit card, not the old row with the acid toggle
  expect(await ui.find({ key: 'edit-tabs' })).toBeDefined()
  expect(await ui.find({ key: 'melody' })).toBeUndefined()
  await ui.press({ key: 'fav' })
  expect((await ui.find({ key: 'fav' }))?.props.label).toBe('♥')
  // share beside the heart copies the play line and says so under the deck
  expect((await ui.find({ key: 'share' }))?.props.label).toBe('share')
  await ui.press({ key: 'share' })
  expect((await ui.find({ text: /✓ copied/ }))?.text).toContain('✓ copied: /techno ' + encodeCode(player.set.track))
  await ui.unmount()
})

test('the volume: vol − 80% +, beside the track; + new song; the tempo under the grid, Claude can turn it down', async ($, on) => {
  const { player } = stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  // the style and the tempo are not in the top line: the tempo sits under the part bar
  expect((await ui.find({ text: /^dark · \d{3} bpm$/ }))?.text).toMatch(/^dark · \d{3} bpm$/)
  expect(await ui.find({ text: /· dark · \d{3} bpm/ })).toBeUndefined()
  // one value in percent, − and + step it, vol mutes; no emoji
  expect((await ui.find({ text: /^80%$/ }))?.text).toBe('80%')
  await ui.press({ key: 'vol-down' })
  await ui.press({ key: 'vol-down' })
  expect(player.volume).toBe(2)
  expect(await ui.find({ text: /^40%$/ })).toBeDefined()
  await ui.press({ key: 'vol-up' })
  expect(player.volume).toBe(3)
  await ui.press({ key: 'vol-mute' })
  expect(player.volume).toBe(0)
  expect(await ui.find({ text: /^off$/ })).toBeDefined()
  await ui.press({ key: 'vol-down' })
  expect(player.volume).toBe(0)
  await ui.press({ key: 'vol-mute' })
  expect(player.volume).toBe(4)
  for (let i = 0; i < 3; i++) await ui.press({ key: 'vol-up' })
  expect(player.volume).toBe(5)
  expect(await ui.find({ text: /^100%$/ })).toBeDefined()
  // + new song opens the new song screen
  await ui.press({ key: 'new-song' })
  expect(await ui.find({ key: 'phrase' })).toBeDefined()
  await ui.unmount()
  const r = await $.tool.call({ tool: 'mcp__techno__jam', volume: 3 })
  expect(player.volume).toBe(3)
  expect(String(r.result)).toContain('volume 3 of 5')
})

test('the part bar names the section, not the part: intro, not kick; a drop keeps its number', async ($, on) => {
  const { player } = stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(player.set.track.part).toBe(0)
  expect(await ui.find({ text: /^intro$/ })).toBeDefined()
  expect(await ui.find({ text: /^kick$/ })).toBeUndefined()
  await ui.unmount()
  expect(PLAN.map((p, i) => sectionLabel({ section: p.section, name: p.name }))).toEqual(['intro', 'intro', 'groove', 'groove', 'build', 'drop 1', 'break', 'drop 2', 'break', 'drop 3', 'outro'])
  expect(sectionLabel({ section: 'handover', name: 'kick' })).toBe('mixing in')
})

test('chat words: a prompt gives its key words to the player, never a path, a key or a music request', async ($, on) => {
  const { player } = stubs(on)
  await start($)
  await $.prompt.submit({ text: 'why does the stripe webhook retry twice on staging', asUser: true })
  expect(player.cmds.filter((c: any) => c.op === 'words').map((c: any) => c.phrase)).toEqual(['stripe webhook staging'])
  // a prompt alone never starts the music
  expect(player.cmds.some((c: any) => c.op === 'play' || c.op === 'pick')).toBe(false)
  expect(keyWords('make it darker')).toBeNull()
  expect(keyWords('/techno late night deploy')).toBeNull()
  expect(keyWords('fix src/auth/login.ts line 42')).toBeNull()
  expect(keyWords('my key is sk-ant-abc123XYZ, mail it to me@example.com')).toBe('key mail')
  expect(keyWords('make the onboarding carousel less noisy')).toBe('onboarding carousel noisy')
})

test('the favorites screen plays a favorite and lists the tracks heard before', async ($, on) => {
  const { player } = stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'fav' })
  await $.command.run({ command: 'techno', args: 'ship it' })
  await ui.press({ key: 'favorites' })
  expect(await ui.find({ key: 'play-all' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /heard before/ })).toBeUndefined()
  const fav = player.favorites[0].code
  await ui.press({ key: 'f-play-' + fav })
  expect(player.cmds.at(-1)).toMatchObject({ op: 'pick', code: fav, playlist: 'favorites' })
  await ui.unmount()
})

test('a click on a grid cell edits a step, and a click on a row name toggles the layer', async ($, on) => {
  const { player } = stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: 'ruslan' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    // row 0 (kick) sits under the beat ruler; step 2 starts at column 8 + 2 * 3
    await ui.pointer({ type: 'down', x: 14, y: 1, button: 'left', in: 'grid' })
    expect(player.cmds.at(-1)).toMatchObject({ op: 'step', layer: 'kick', i: 2 })
    await ui.pointer({ type: 'down', x: 1, y: 1, button: 'left', in: 'grid' })
    expect(player.cmds.at(-1)).toMatchObject({ op: 'layer', name: 'kick' })
    await ui.unmount()
  }
})

test('hidden, the app is a one-line bar with previous, play, next track, favorite, then auto, open and × on the right', async ($, on) => {
  const { player } = stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: 'ruslan' })
  await $.command.run({ command: 'techno', args: 'ship it' })
  await $.command.run({ command: 'techno', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  for (const key of ['mini-play', 'mini-prev', 'mini-skip', 'mini-fav', 'mini-share', 'mini-vol-up', 'mini-auto', 'mini-open']) expect(await ui.find({ key })).toBeDefined()
  // no section word in the bar
  expect(await ui.find({ text: /^(intro|groove|build|drop \d|break|outro)$/ })).toBeUndefined()
  await ui.press({ key: 'mini-prev' })
  expect(player.set.track.phrase).toBe('ruslan')
  await ui.press({ key: 'mini-close' })
  expect(await ui.find({ key: 'mini-play' })).toBeUndefined()
  await ui.unmount()
})

test('the bar follows you into a new chat once you used techno', async ($, on) => {
  stubs(on, { bar: true })
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ key: 'mini-play' })).toBeDefined()
  await ui.unmount()
})

test('the set: three drops, a riser before each, a crash on each, about seven minutes', () => {
  const set = newSet(trackFor('ship it'))
  const parts: string[] = []
  let loops = 0, rises = 0, crashes = 0
  while (!set.handover) {
    const spec = loopSpec(set, { auto: true })
    if (spec.rise) rises++
    if (spec.impact) crashes++
    parts.push(PLAN[set.track.part].name)
    afterLoop(set, { auto: true, nextTrack: () => trackFor('warehouse 4am') })
    loops++
  }
  expect(parts.filter((p) => p.startsWith('drop')).length).toBe(12)
  expect(rises).toBe(3)
  expect(crashes).toBe(3)
  expect(PLAN.some((p) => p.layers.includes('stab'))).toBe(false)
  // about 15 s a loop at 127 bpm
  expect(loops).toBeGreaterThanOrEqual(25)
})

test('the handover takes the old track out layer by layer, and the new song starts from its kick or its hats', () => {
  const set = newSet(atPart(trackFor('ship it'), PLAN.length - 1))
  const bpm = set.track.bpm
  afterLoop(set, { auto: true, nextTrack: () => trackFor('warehouse 4am') })
  expect(set.handover.from.phrase).toBe('ship it')
  expect(set.track.phrase).toBe('warehouse 4am')
  expect(set.track.bpm).toBe(bpm)
  let before = 99
  const shape = HANDOVERS[set.handover.shape]
  expect(transitionsOf(trackFor('ship it')).land).toBe(set.handover.shape)
  for (let i = 0; i < shape.steps.length * HANDOVER_LOOPS; i++) {
    const spec = loopSpec(set, { auto: true })
    if (set.handover.loop === 0) {
      const old = Object.values(activeLayers(spec.track)).filter(Boolean).length
      expect(old).toBeLessThan(before)
      before = old
    }
    afterLoop(set, { auto: true, nextTrack: () => trackFor('null pointer') })
  }
  expect(set.handover).toBe(null)
  expect(set.track.part).toBe(shape.to)
  expect([0, 2]).toContain(set.track.part)
  // across songs, both landings happen
  expect(new Set(Array.from({ length: 40 }, (_, n) => transitionsOf(trackFor('song ' + n)).land))).toEqual(new Set(['kick', 'hats']))
})

test('share codes: a<n> is the part, an old p<n> lands in the same section', () => {
  const t = atPart(trackFor('ruslan'), 7)
  expect(encodeCode(t)).toMatch(/a7(y\d)?$/)
  expect(encodeCode(parseCode(encodeCode(t))!)).toBe(encodeCode(t))
  // old p8 was the drop, old p6 the peak, old p9 the outro
  expect(PLAN[parseCode('ruslan@130m1e2p8')!.part!].section).toBe('drop')
  expect(PLAN[parseCode('ruslan@130m1e2p6')!.part!].section).toBe('drop')
  expect(PLAN[parseCode('ruslan@130m1e2p9')!.part!].section).toBe('outro')
  const on = toggleStep(atPart(trackFor('ruslan'), 0), 'kick', 2)
  expect(encodeCode(on)).toContain('*kick0004')
  expect(encodeCode(toggleStep(on, 'kick', 2))).toBe(encodeCode(atPart(trackFor('ruslan'), 0)))
})

test('/techno and the jam tool exist even when the player cannot start', async ($, on) => {
  mock.clock(on)
  mock.store(on, {})
  mock.env(on, { HOME: '/home/test' })
  on('session.start', () => ({ cwd: '/work/my-app' }))
  on('session.cwd', () => ({ value: '/work/my-app' }))
  const registered: string[] = []
  on('command.register', ($: any, e: any) => { registered.push('/' + e.name); return { value: undefined } })
  on('tool.register', ($: any, e: any) => { registered.push(e.name); return { value: undefined } })
  on('http.fetch', () => { throw new Error('no socket') })
  on('process.run', () => ({ value: { exitCode: 0, stdout: '', stderr: '' } }))
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['drawn by Claude Code'] }))
  await start($)
  expect(registered).toContain('/techno')
  expect(registered).toContain('jam')
  await $.command.run({ command: 'techno', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ key: 'retry' })).toBeDefined()
  await ui.unmount()
})

test('auto picks the transitions from the track: the same every time, never twice in a row, the biggest build for the last drop', () => {
  const rises = PLAN.map((p, i) => (p.rise ? i : -1)).filter((i) => i >= 0)
  const drops = PLAN.map((p, i) => (p.section === 'drop' ? i : -1)).filter((i) => i >= 0)
  const seen = new Set<string>()
  for (let n = 0; n < 200; n++) {
    const t = trackFor('phrase ' + n)
    const fx = transitionsOf(t)
    expect(transitionsOf(t)).toEqual(fx)
    const builds = rises.map((i) => fx.build[i]), falls = drops.map((i) => fx.fall[i])
    for (const b of builds) expect(BUILDS).toContain(b)
    for (const f of falls) expect(FALLS).toContain(f)
    for (let k = 1; k < builds.length; k++) expect(builds[k]).not.toBe(builds[k - 1])
    for (let k = 1; k < falls.length; k++) expect(falls[k]).not.toBe(falls[k - 1])
    expect(['riser', 'filter']).toContain(builds.at(-1))
    expect(fx.swap).not.toBe(builds.at(-1))
    for (const x of [...builds, ...falls, fx.swap]) seen.add(x)
  }
  // across tracks, every pack and every fall plays somewhere
  for (const x of [...BUILDS, ...FALLS]) expect(seen.has(x)).toBe(true)
})

test('only auto plays the transitions; the drop after a build-up gets its boom, the new track after a swap too', () => {
  const t = trackFor('late night deploy')
  const fx = transitionsOf(t)
  const set = newSet(atPart(t, 4))
  set.loop = PLAN[4].loops - 1
  expect(loopSpec(set, { auto: false })).toMatchObject({ rise: false, build: null, fall: null, swell: false })
  expect(loopSpec(set, { auto: true })).toMatchObject({ rise: true, build: fx.build[4] })
  stepOn(set, () => t)
  expect(loopSpec(set, { auto: true })).toMatchObject({ impact: true, build: fx.build[4] })
  set.loop = PLAN[5].loops - 1
  expect(loopSpec(set, { auto: true })).toMatchObject({ fall: fx.fall[5] })
  // the handover: a build-up on its last loop, then the new track lands with a boom
  const h = newSet(atPart(t, PLAN.length - 1))
  const next = trackFor('ship it')
  afterLoop(h, { auto: true, nextTrack: () => next })
  for (let k = 0; k < HANDOVERS[h.handover.shape].steps.length * HANDOVER_LOOPS - 1; k++) afterLoop(h, { auto: true, nextTrack: () => next })
  expect(loopSpec(h, { auto: true })).toMatchObject({ rise: true, build: fx.swap })
  afterLoop(h, { auto: true, nextTrack: () => next })
  expect(h.handover).toBe(null)
  expect(loopSpec(h, { auto: true })).toMatchObject({ impact: true, build: fx.swap })
})

test('the part bar: one block per loop, the part that plays shows what is left of it', () => {
  const parts = PLAN.map((p) => ({ name: p.name, section: p.section, loops: p.loops }))
  const total = parts.reduce((n, p) => n + p.loops, 0)
  expect(partBar(parts, 0).length).toBe(total)
  // 11.4 loops in: the five parts before drop 1 (10 loops) played; drop 1 (4 loops) has 1 played and 3 left
  const mid = partBar(parts, 11.4)
  expect(mid.filter((x: string) => x === 'played').length).toBe(10)
  expect(mid.filter((x: string) => x === 'now-played').length).toBe(1)
  expect(mid.filter((x: string) => x === 'now-left').length).toBe(3)
  expect(partBar(parts, total).every((x: string) => x === 'played')).toBe(true)
})

test('edit opens the card: instruments, patterns, notes and tone for a sound, the master, and the song parts', async ($, on) => {
  const { player } = stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: '' })
  player.set = newSet(atPart(trackFor('late night deploy'), 5))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'edit' })
  // it opens on the bass: its instruments, a pattern to try, its notes, its tone
  expect((await ui.find({ key: 'tab-bass' }))?.props.variant).toBe('primary')
  await ui.press({ key: 'inst-bass-growl' })
  expect(player.cmds.at(-1)).toMatchObject({ op: 'edit', kind: 'inst', layer: 'bass', value: 2 })
  expect(player.set.track.inst.bass).toBe(2)
  await ui.press({ key: 'pat-bass-gallop' })
  expect(grid(player.set.track).bass).toBe('.xxx.xxx.xxx.xxx')
  expect((await ui.find({ key: 'pat-bass-gallop' }))?.props.variant).toBe('primary')
  await ui.press({ key: 'note-bass-1' })
  expect(player.set.track.notes.bass[1]).not.toBe('.')
  await ui.press({ key: 'cut-bass-down' })
  expect(player.set.track.tone.bass).toEqual([-1, 0])
  // the master
  await ui.press({ key: 'tab-master' })
  await ui.press({ key: 'lp-down' })
  expect(player.set.track.master[0]).toBe(-1)
  // the song: a part that does not play can go
  await ui.press({ key: 'tab-song' })
  expect(await ui.find({ key: 'part-x-5' })).toBeUndefined()
  await ui.press({ key: 'part-x-3' })
  expect(planOf(player.set.track)).not.toContain(3)
  // every edit rides in the share code
  const code = encodeCode(player.set.track)
  expect(encodeCode(parseCode(code)!)).toBe(code)
  await ui.unmount()
})

test('the edit actions: a pattern pick, a note up the scale, suggested notes, the share code, old codes unchanged', () => {
  let t = atPart(trackFor('ship it'), 5)
  t = editTrack(t, { kind: 'pattern', layer: 'hats', name: '16ths' })
  expect(grid(t).hats.replace(/X/g, 'x')).toBe('xxxxxxxxxxxxxxxx')
  t = editTrack(t, { kind: 'reset-pattern', layer: 'hats' })
  expect(t.steps.hats).toBeUndefined()
  const before = soundInfo(t, 'bass').notes
  const i = before.findIndex((n: string | null) => n)
  t = editTrack(t, { kind: 'note', layer: 'bass', i })
  // one step up the scale (an octave note wraps to the root, the same name)
  expect(t.notes.bass[i]).not.toBe('.')
  t = editTrack(t, { kind: 'note', layer: 'bass', i })
  expect(soundInfo(t, 'bass').notes[i]).not.toBe(before[i])
  t = editTrack(t, { kind: 'suggest-notes', layer: 'acid', seed: 7 })
  for (const n of soundInfo(t, 'acid').notes.filter(Boolean)) expect(soundInfo(t, 'acid').scale).toContain(n)
  for (const [layer, list] of Object.entries(INSTRUMENTS)) t = editTrack(t, { kind: 'inst', layer, value: list.length - 1 })
  t = editTrack(t, { kind: 'tone', layer: 'kick', cut: 2, grit: 3 })
  t = editTrack(t, { kind: 'master', hp: 1, space: -1 })
  const code = encodeCode(t)
  expect(encodeCode(parseCode(code)!)).toBe(code)
  // a code from before the card still means the same track
  expect(encodeCode(parseCode('late-night-deploy@131m1e2d3a4+acid-hats*kick00040000')!)).toBe('late-night-deploy@131m1e2d3a4-hats+acid*kick00040000')
})

test('a song with its own plan: auto walks it, builds go before every drop, the set keeps its place', () => {
  let t = trackFor('late night deploy')
  t = { ...t, plan: planAdd(t, 'drop').plan }
  const plan = planOf(t)
  expect(plan.filter((i: number) => PLAN[i].section === 'drop').length).toBe(4)
  const fx = transitionsOf(t)
  const drops = plan.map((i: number, k: number) => (PLAN[i].section === 'drop' ? k : -1)).filter((k: number) => k >= 0)
  for (const k of drops) expect(fx.build[k - 1]).toBeDefined()
  const set = newSet(t)
  let walked = 0
  while (!set.handover && walked < 60) { afterLoop(set, { auto: true, nextTrack: () => trackFor('x') }); walked++ }
  expect(walked).toBe(plan.reduce((n: number, i: number) => n + PLAN[i].loops, 0))
})

test('new song: a name box with an example, then your recent chats and classics, numbered; a click or a digit plays one', async ($, on) => {
  const { player } = stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'new-song' })
  expect(await ui.find({ key: 'phrase' })).toBeDefined()
  expect((await ui.find({ text: /type a name, get a song/ }))?.text).toMatch(new RegExp(`plays (${STYLES.map((st) => st.name).join('|')}), \\d{3} bpm`))
  // the chats come first, 1 and 2, with the project and how long ago
  const first = await ui.find({ key: 'chat-social media content plan-play' })
  expect(first?.props.hotkey).toBe('1')
  expect(await ui.find({ text: /yourcolorpalette · 1 h ago/ })).toBeDefined()
  expect((await ui.find({ key: 'chat-fae court quiz-play' }))?.props.hotkey).toBe('2')
  expect(await ui.find({ text: /2 d ago/ })).toBeDefined()
  // then four classics, 3 to 6; ⚄ others shows four more
  const classics = async () => (await ui.findAll({ type: 'Button' })).filter((b: any) => /^classic-.*-play$/.test(b.key ?? b.props.key)).map((b: any) => b.props.label)
  const before = await classics()
  expect(before.length).toBe(4)
  expect((await ui.find({ key: 'classic-' + before[3] + '-play' }))?.props.hotkey).toBe('6')
  await ui.press({ key: 'classics-more' })
  expect((await classics())[0]).not.toBe(before[0])
  await ui.press({ key: 'chat-social media content plan-play' })
  expect(player.cmds.at(-1)).toMatchObject({ op: 'pick', code: 'social media content plan' })
  await ui.unmount()
})

test('a newer version on GitHub: the app says it is ready, update runs the plugin update, then asks for a new chat', async ($, on) => {
  const runs: string[] = []
  stubs(on, {}, (argv) => { if (argv.startsWith('sh -c')) { runs.push(argv); return { exitCode: 0, stdout: 'updated', stderr: '' } } }, '99.0.0')
  await start($)
  await $.command.run({ command: 'techno', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  for (let i = 0; i < 20 && !(await ui.find({ key: 'update' })); i++) await $.clock.sleep(10)
  expect(await ui.find({ text: /techno 99\.0\.0 is ready/ })).toBeDefined()
  await ui.press({ key: 'update' })
  expect(runs[0]).toContain('plugin marketplace update techno-mod')
  expect(runs[0]).toContain('plugin update techno@techno-mod')
  expect(await ui.find({ text: /✓ updated to 99\.0\.0/ })).toBeDefined()
  expect(await ui.find({ text: /open a new chat/ })).toBeDefined()
  await ui.unmount()
})

test('the same version on GitHub: no update notice', async ($, on) => {
  stubs(on, {}, undefined, '0.0.1')
  await start($)
  await $.command.run({ command: 'techno', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ key: 'update-line' })).toBeUndefined()
  expect(await ui.find({ key: 'update' })).toBeUndefined()
  await ui.unmount()
})

test('only dark: every new song has a style, a dark scale and its own tempo; old codes play as before', () => {
  const names = Array.from({ length: 60 }, (_, n) => trackFor('song ' + n))
  for (const t of names) {
    expect(t.style).not.toBeNull()
    const st = STYLES[t.style]
    expect(['minor', 'phrygian', 'harmonic']).toContain(scaleName(t))
    expect(t.mood).toBeLessThanOrEqual(1)
    expect(t.bpm).toBeGreaterThanOrEqual(st.bpm[0])
    expect(t.bpm).toBeLessThanOrEqual(st.bpm[1])
    expect(parseCode(encodeCode(t))).toEqual(t)
  }
  // only dark (Ruslan, 2026-10-12: "ok dark only")
  expect(new Set(names.map(styleName))).toEqual(new Set(['dark']))
  // the soft hypnotic line comes by itself in some songs; no 303 (Ruslan: "i don't like acid ... remove it")
  expect(new Set(names.map(leadOf))).toEqual(new Set([null, 'hypnotic']))
  for (const t of names) expect(['pluck', 'soft']).toContain(INSTRUMENTS.acid[instOf(t).acid])
  expect(soundInfo(names[0], 'acid').insts.map((x: any) => x.name)).toEqual(['pluck', 'soft'])
  expect(soundInfo(names[0], 'bass').insts.map((x: any) => x.name)).not.toContain('acid')
  // an old song keeps every sound in the edit card
  expect(soundInfo(parseCode('late-night-deploy@131m2e2d3a4')!, 'acid').insts.map((x: any) => x.name)).toContain('acid')
  // an old code has no style and keeps its mood
  const old = parseCode('late-night-deploy@131m2e2d3a4')!
  expect(old.style).toBeNull()
  expect(styleName(old)).toBe('sad')
  expect(encodeCode(old)).toBe('late-night-deploy@131m2e2d3a4')
  // a style switch keeps the phrase and moves the tempo into the style
  const min = trackFor('coffee at 3am')
  // the song picks the sounds; an explicit pick of sound 0 stays in the code
  expect(INSTRUMENTS.bass[instOf(min).bass]).toBe('pluck')
  const picked = editTrack(min, { kind: 'inst', layer: 'bass', value: 0 })
  expect(instOf(picked).bass).toBe(0)
  expect(instOf(parseCode(encodeCode(picked))!).bass).toBe(0)
  // a lead plays where its parts say, not in the intro
  for (const t of names.filter((x) => leadOf(x))) {
    const lead = LEADS[leadOf(t)!]
    expect(activeLayers(atPart(t, lead.parts[0])).acid).toBe(true)
    expect(activeLayers(atPart(t, 0)).acid).toBe(false)
  }
})

test('tonality: one key a song, another song another key; auto glides the tempo', () => {
  // Ruslan, 2026-10-12: "i'd prefer the whole song to be in one tonality, but one song in one tonality, another song in another"
  const songs = Array.from({ length: 30 }, (_, n) => trackFor('song ' + n))
  for (const s0 of songs) {
    const set = newSet(s0)
    const home = set.track.transpose
    const scale = new Set(arrange(set.track).scale.map((x: number) => (arrange(set.track).root + x) % 12))
    while (!set.handover) {
      const spec = loopSpec(set, { auto: true })
      expect(spec.track.transpose).toBe(home)
      const a = arrange({ ...spec.track, layers: { acid: true, bass: true } })
      // the bass sits on the root, its octave, or one step under the root
      for (const e of a.events.bass) expect([0, (a.scale[6] + 0) % 12].includes(((e.note - a.root) % 12 + 12) % 12)).toBe(true)
      for (const e of a.events.acid) expect(scale.has(e.note % 12)).toBe(true)
      afterLoop(set, { auto: true, nextTrack: () => s0 })
    }
  }
  // songs differ in key and scale
  expect(new Set(songs.map((t) => keyName(t))).size).toBeGreaterThan(5)
  // a lead line in about one song in four, not in every song
  const leads = Array.from({ length: 80 }, (_, n) => leadOf(trackFor('lead ' + n))).filter(Boolean).length
  expect(leads).toBeGreaterThan(8)
  expect(leads).toBeLessThan(35)
  // a set changes key: the next song never lands in the key of the one before, by auto or by ⏭
  for (let n = 0; n < 40; n++) {
    const a = trackFor('song ' + n), b = { ...trackFor('song ' + (n + 1)), transpose: 0 }
    const same = { ...b, transpose: ((NOTES.indexOf(noteNameOf(a)) - NOTES.indexOf(noteNameOf(b))) + 12) % 12 }
    expect(noteNameOf(same)).toBe(noteNameOf(a))
    const set = newSet(atPart(a, PLAN.length - 1))
    afterLoop(set, { auto: true, nextTrack: () => same })
    expect(noteNameOf(set.track)).not.toBe(noteNameOf(a))
    expect(noteNameOf(freshKey(same, a))).not.toBe(noteNameOf(a))
    expect(['e', 'f', 'f#', 'g', 'a']).toContain(noteNameOf(freshKey(same, a)))
    // a song in another key already keeps it
    if (noteNameOf(b) !== noteNameOf(a)) expect(freshKey(b, a).transpose).toBe(0)
  }
  const t = trackFor('warehouse 4am')
  // the glide: the new song mixes in at the old tempo, then moves GLIDE bpm a loop to its own
  const deep = trackFor('cold sleep')
  const set = newSet(atPart(t, PLAN.length - 1))
  afterLoop(set, { auto: true, nextTrack: () => deep })
  while (set.handover) afterLoop(set, { auto: true, nextTrack: () => deep })
  expect(set.track.bpm).toBe(t.bpm)
  expect(homeOf(set).bpm).toBe(deep.bpm)
  let loops = 0
  while (set.track.bpm !== deep.bpm && loops < 40) {
    const was = set.track.bpm
    afterLoop(set, { auto: true, nextTrack: () => deep })
    expect(Math.abs(set.track.bpm - was)).toBeLessThanOrEqual(GLIDE)
    loops++
  }
  expect(set.track.bpm).toBe(deep.bpm)
  expect(set.bpmTo).toBe(null)
})

test('diverse dark songs: their own bass lines and bass sounds, and extras (congas, shaker, drone) in some songs', () => {
  const songs = Array.from({ length: 60 }, (_, n) => trackFor('song ' + n))
  const bassRow = (t: any, part: number) => {
    const a = arrange(atPart(t, part))
    return a.events.bass.filter((e: any) => e.step < 32).map((e: any) => e.step + ':' + (e.note - a.root)).join(' ')
  }
  // many different groove lines and drop lines, and a song's drop line is not its groove line
  expect(new Set(songs.map((t) => bassRow(t, 3))).size).toBeGreaterThan(8)
  expect(new Set(songs.map((t) => bassRow(t, 5))).size).toBeGreaterThan(8)
  for (const t of songs.slice(0, 20)) expect(bassRow(t, 5)).not.toBe(bassRow(t, 3))
  // every bass line is two bars of 16 steps, written in the line's own letters
  for (const line of BASS_LINES) for (const bar of line) expect(bar).toMatch(/^[.\-0-9ab]{16}$/)
  // a new rhythm gives new bass lines
  expect(songs.slice(0, 20).some((t) => bassRow({ ...t, dice: 1 }, 3) !== bassRow(t, 3))).toBe(true)
  // every bass sound turns up
  expect(new Set(songs.map((t) => instOf(t).bass)).size).toBeGreaterThanOrEqual(5)
  // the extras: each turns up, not in every song, and only in its parts
  for (const name of Object.keys(EXTRAS)) {
    const have = songs.filter((t) => extrasOf(t).includes(name))
    expect(have.length).toBeGreaterThan(10)
    expect(have.length).toBeLessThan(50)
    const t = have[0]
    for (let part = 0; part < PLAN.length; part++) expect(activeLayers(atPart(t, part))[name]).toBe(EXTRAS[name].includes(part))
  }
  // the congas show in the grid and take a click
  const c = atPart(songs.find((t) => extrasOf(t).includes('conga'))!, 5)
  expect(grid(c).conga).toMatch(/^[.xX]{16}$/)
  expect(grid(toggleStep(c, 'conga', 1)).conga).not.toBe(grid(c).conga)
  // an old code brings no extras
  expect(extrasOf(parseCode('late-night-deploy@131m2e2d3a4')!)).toEqual([])
})

test('the context window: a circle that fills by quarters and the percent, the warning color from 70%, nothing before the first answer', () => {
  expect(contextLabel(undefined)).toBe(null)
  expect(contextLabel(null)).toBe(null)
  expect(contextLabel(0)).toEqual({ text: '○ 0%', color: null })
  expect(contextLabel(30)).toEqual({ text: '◔ 30%', color: null })
  expect(contextLabel(50)).toEqual({ text: '◑ 50%', color: null })
  expect(contextLabel(72)).toEqual({ text: '◕ 72%', color: 'warning' })
  expect(contextLabel(95)).toEqual({ text: '● 95%', color: 'error' })
})

test('the deck and the bar show how full the context window is, and follow it', async ($, on) => {
  const { clock, usage } = stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: '' })
  await clock.advance(1100)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ text: '◑ 42%' })).toBeDefined()
  usage.percent = 81
  await clock.advance(1100)
  expect(await ui.find({ text: '◕ 81%' })).toBeDefined()
  // hidden: the bar shows it too
  await $.command.run({ command: 'techno', args: '' })
  expect(await ui.find({ key: 'mini-play' })).toBeDefined()
  expect(await ui.find({ text: '◕ 81%' })).toBeDefined()
  // a fresh chat has no figure yet: nothing is drawn
  usage.percent = undefined
  await clock.advance(1100)
  expect(await ui.find({ key: 'mini-play' })).toBeDefined()
  expect(await ui.find({ text: /^[○◔◑◕●] \d+%$/ })).toBeUndefined()
  await ui.unmount()
})

// The dancer's rows as plain text, from the tree its module drew
function dancerRows(tree: any): string[] {
  const text = (el: any): string => (typeof el === 'string' ? el : (el?.children ?? el?.props?.children ?? []).map(text).join(''))
  const rows = tree.children ?? tree.props?.children ?? []
  return rows.map(text)
}

test('dancers: every dancer has frames of one height; your own frames split on ";"; off is none; a click walks the names', () => {
  for (const name of DANCER_NAMES) {
    const d = dancerFor(name)!
    expect(d.frames.length).toBeGreaterThan(1)
    for (const f of d.frames) expect(f.length).toBe(3)
  }
  expect(dancerFor(undefined)!.name).toBe('clawd')
  expect(dancerFor('NYAN')!.name).toBe('nyan')
  expect(dancerFor('off')).toBe(null)
  expect(dancerFor('(•_•);(⌐■_■)')).toMatchObject({ name: 'own', frames: [['(•_•)'], ['(⌐■_■)']] })
  expect(nextDancer('clawd')).toBe(DANCER_NAMES[1])
  expect(nextDancer(DANCER_NAMES.at(-1))).toBe(DANCER_NAMES[0])
  expect(nextDancer('(•_•)')).toBe(DANCER_NAMES[0])
  expect(Object.keys(DANCERS)).toContain('clawd')
  // clawd is pixel art: three lines of nine cells, as the welcome screen draws it
  for (const f of dancerFor('clawd')!.frames) for (const l of f) expect([...l]).toHaveLength(9)
  expect(DANCER_NAMES).toEqual(['clawd', 'nyan'])
  expect(dancerFor('nyan')).toMatchObject({ rows: 5, wrap: true, trail: { chars: "`*.,*'^" } })
  expect(dancerFor('clawd')!.frames[0]).toEqual([' ▐▛███▜▌ ', '▝▜█████▛▘', '  ▘▘ ▝▝  '])
  expect(px('#.\n.#')).toEqual(['▚'])
})

test('the dancer: over the grid, asleep while stopped, walks and dances to the beat, a click picks the next one', async ($, on) => {
  const { player } = stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: '' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    if (player.playing) await ui.press({ key: 'play' })
    expect(await ui.find({ key: 'dancer' })).toBeDefined()
    await ui.resize({ columns: 60, rows: 4, in: 'dancer' })
    // stopped: it sleeps
    const asleep = dancerRows(await ui.drawn({ in: 'dancer' }))
    expect(asleep).toHaveLength(4)
    expect(asleep[0]).toContain('z Z z')
    expect(asleep.join('\n')).toContain('▐▛███▜▌')
    await ui.press({ key: 'play' })
    // playing: it moves on its own clock
    const first = dancerRows(await ui.drawn({ in: 'dancer' })).join('\n')
    await ui.advance(112 * 16)
    const later = dancerRows(await ui.drawn({ in: 'dancer' })).join('\n')
    expect(later).not.toBe(first)
    expect(later).not.toContain('z Z z')
    await ui.unmount()
  }
  // a click on it: the next dancer
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.resize({ columns: 60, rows: 4, in: 'dancer' })
  await ui.pointer({ type: 'down', x: 2, y: 2, button: 'left', in: 'dancer' })
  expect(dancerRows(await ui.drawn({ in: 'dancer' })).join('\n')).toContain('~|__(o.o)')
  expect((await ui.find({ text: /dancer: nyan/ }))?.text).toContain('/techno dancer off')
  await ui.unmount()
})

test('/techno dancer picks the dancer, off hides it, your own frames dance; Claude picks one with the jam tool', async ($, on) => {
  stubs(on, { dancer: 'nyan' })
  await start($)
  await $.command.run({ command: 'techno', args: '' })
  // the dancer kept from another chat
  expect((await $.command.run({ command: 'techno', args: 'dancer' })).text).toContain('The dancer is nyan. Pick one: clawd, nyan, off')
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.resize({ columns: 60, rows: 4, in: 'dancer' })
  expect(dancerRows(await ui.drawn({ in: 'dancer' })).join('\n')).toContain('~|__(o.o)')
  await $.command.run({ command: 'techno', args: 'dancer off' })
  expect(await ui.find({ key: 'dancer' })).toBeUndefined()
  expect(await ui.find({ key: 'grid' })).toBeDefined()
  await $.command.run({ command: 'techno', args: 'dancer (•_•);(⌐■_■)' })
  expect(dancerRows(await ui.drawn({ in: 'dancer' })).join('\n')).toContain('(•_•)')
  const r = await $.tool.call({ tool: 'mcp__techno__jam', dancer: 'clawd' })
  expect(String(r.result)).toContain('dancer: clawd')
  expect(dancerRows(await ui.drawn({ in: 'dancer' })).join('\n')).toContain('▐▛███▜▌')
  await ui.unmount()
})

test('the dancer in a drop: it jumps on the offbeat, notes trail it, and it says the drop; over the bar only while music plays', async ($, on) => {
  const { player, clock } = stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: 'ruslan' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.resize({ columns: 60, rows: 4, in: 'dancer' })
  player.set = newSet(atPart(trackFor('ruslan'), 5))
  player.rev++
  await clock.advance(1100)
  const seen: string[][] = []
  for (let i = 0; i < 16; i++) { await ui.advance(112); seen.push(dancerRows(await ui.drawn({ in: 'dancer' }))) }
  // up in the top row on some steps (a jump), never asleep
  expect(seen.some((r) => r[0].includes('▐▛███▜▌'))).toBe(true)
  expect(seen.some((r) => r[1].includes('▐▛███▜▌'))).toBe(true)
  expect(seen.some((r) => /[♪♫]/.test(r.join('')))).toBe(true)
  expect(seen.some((r) => /DROP|oonts oonts|ship it|lets gooo/.test(r[0]))).toBe(true)
  // hidden: the bar has no dancer, even while it plays
  await $.command.run({ command: 'techno', args: '' })
  expect(player.playing).toBe(true)
  expect(await ui.find({ key: 'mini-play' })).toBeDefined()
  expect(await ui.find({ key: 'dancer' })).toBeUndefined()
  await ui.unmount()
})

test('nyan: five rows, flies on to the right with a rainbow behind it, out on the right and back in on the left', async ($, on) => {
  stubs(on, { dancer: 'nyan' })
  await start($)
  await $.command.run({ command: 'techno', args: 'ruslan' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.resize({ columns: 40, rows: 5, in: 'dancer' })
  await ui.advance(112)
  const rows = dancerRows(await ui.drawn({ in: 'dancer' }))
  expect(rows).toHaveLength(5)
  const cat = rows[3].indexOf('~|__(o.o)')
  expect(cat).toBeGreaterThan(0)
  // the rainbow fills the row up to the cat, each row above shorter
  expect(rows[3].slice(0, cat - 4)).toMatch(/^[`*.,'^]+$/)
  expect(rows[0].trim().length).toBeLessThan(rows[2].trim().length)
  // it only flies right, and comes back in on the left
  const xs: number[] = []
  for (let i = 0; i < 200; i++) { await ui.advance(112 * 4); xs.push(dancerRows(await ui.drawn({ in: 'dancer' }))[3].indexOf('~|__')) }
  const moves = xs.slice(1).map((x, i) => x - xs[i]).filter((d) => d !== 0)
  expect(moves.some((d) => d > 0)).toBe(true)
  expect(moves.some((d) => d < -20)).toBe(true)
  expect(moves.every((d) => d > 0 || d < -20)).toBe(true)
  await ui.unmount()
})
