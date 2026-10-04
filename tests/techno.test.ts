import { expect, mock, test } from 'claude-code/testing'
import { atPart, encodeCode, parseCode, toggleStep, trackFor, moodName, withVibe, activeLayers, transitionsOf, PLAN, HANDOVER, HANDOVER_LOOPS, HANDOVER_TO, BUILDS, FALLS } from '../hooks/engine.js'
import { newSet, loopSpec, afterLoop, stepOn } from '../hooks/conductor.js'

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
  const p: any = { set: newSet(trackFor('late night deploy')), playing: false, auto: true, favorites: [], history: [], rev: 1, said: '', cmds: [] as any[] }
  const id = (t: any) => encodeCode({ ...t, part: null })
  const view = () => {
    const t = p.set.track
    const nx = PLAN[t.part + 1]
    return { code: encodeCode(t), id: id(t), phrase: t.phrase, mood: moodName(t), bpm: t.bpm, part: t.part, section: PLAN[t.part].section, name: PLAN[t.part].name, from: null, next: nx ? { name: nx.name, adds: nx.adds, layer: nx.layer } : { name: 'the next track' }, bar: 0, loopsLeft: 1 }
  }
  const state = () => ({ version: '9.9.9', rev: p.rev, now: 0, playing: p.playing, auto: p.auto, playlist: null, view: view(), barStartedAt: 0, barMs: 1800, stepMs: 112, nextInMs: p.playing && p.auto ? 23000 : null, fav: p.favorites.some((f: any) => f.code === id(p.set.track)), favorites: p.favorites, recent: p.history.map((c: string) => ({ code: c, label: parseCode(c)!.phrase, mood: 'dark', bpm: 128 })), said: p.said, canUndo: false })
  p.command = (c: any) => {
    p.cmds.push(c)
    p.rev++
    const t = p.set.track
    if (c.op === 'play') p.playing = true
    if (c.op === 'pause') p.playing = false
    if (c.op === 'auto') p.auto = c.on
    if (c.op === 'next') stepOn(p.set, () => trackFor('ship it'))
    if (c.op === 'pick') { p.history.push(id(t)); p.set = newSet(atPart(parseCode(c.code) ?? trackFor(c.code), 0)); p.playing = true }
    if (c.op === 'prev' && p.history.length) p.set = newSet(atPart(parseCode(p.history.pop())!, HANDOVER_TO))
    if (c.op === 'jam' && c.mood) p.set.track = withVibe(t, c.mood)
    if (c.op === 'layer') p.set.track = { ...t, layers: { ...t.layers, [c.name]: !activeLayers(t)[c.name] } }
    if (c.op === 'step') p.set.track = toggleStep(t, c.layer, c.i)
    if (c.op === 'fav') p.favorites = p.favorites.some((f: any) => f.code === id(t)) ? [] : [{ code: id(t), label: t.phrase, mood: moodName(t), bpm: t.bpm }]
    return state()
  }
  p.state = state
  return p
}

// Answers every call the mod makes that the kit does not answer itself
function stubs(on: any, store: Record<string, unknown> = {}, run?: (argv: string) => unknown) {
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
  return { clock, player }
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
  const r = await $.tool.call({ tool: 'mcp__techno__jam', mood: 'dark', layers: { acid: true } })
  expect(player.cmds.some((c: any) => c.op === 'jam' && c.mood === 'dark' && c.layers.acid === true)).toBe(true)
  expect(String(r.result)).toContain('mood dark')
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
  expect((await $.command.run({ command: 'techno', args: 'code' })).text).toMatch(/^\/techno late-night-deploy@\d{3}m\de\dk\da0$/)
})

test('the deck: play, the track and its mood, previous, favorite, auto; mood, next, edit, favorites under the grid', async ($, on) => {
  const { player } = stubs(on)
  await start($)
  await $.command.run({ command: 'techno', args: '' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    for (const key of ['play', 'skip', 'fav', 'auto', 'where', 'grid', 'mood-sad', 'mood-mysterious', 'mood-dark', 'edit', 'favorites']) expect(await ui.find({ key })).toBeDefined()
    // auto is on: the set moves by itself, so there is no next part button
    expect(await ui.find({ key: 'next' })).toBeUndefined()
    expect((await ui.find({ key: 'auto' }))?.props.variant).toBe('primary')
    // the mood that plays is the filled button, the others are not
    const mood = moodName(player.set.track)
    expect((await ui.find({ key: 'mood-' + mood }))?.props.variant).toBe('primary')
    expect((await ui.find({ key: 'mood-' + ['sad', 'mysterious', 'dark'].find((m) => m !== mood) }))?.props.variant).toBeUndefined()
    await ui.unmount()
  }
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'skip' })
  expect(player.cmds.at(-1)).toMatchObject({ op: 'skip' })
  await ui.press({ key: 'auto' })
  expect(player.auto).toBe(false)
  await ui.press({ key: 'next' })
  expect(player.set.track.part).toBe(1)
  await ui.press({ key: 'edit' })
  expect(await ui.find({ key: 'dice' })).toBeDefined()
  expect(await ui.find({ key: 'melody' })).toBeDefined()
  await ui.press({ key: 'fav' })
  expect((await ui.find({ key: 'fav' }))?.props.label).toBe('♥')
  await ui.unmount()
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
    // row 0 (kick) sits under the header and the beat ruler; step 2 starts at column 8 + 2 * 3
    await ui.pointer({ type: 'down', x: 14, y: 2, button: 'left', in: 'grid' })
    expect(player.cmds.at(-1)).toMatchObject({ op: 'step', layer: 'kick', i: 2 })
    await ui.pointer({ type: 'down', x: 1, y: 2, button: 'left', in: 'grid' })
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
  for (const key of ['mini-play', 'mini-prev', 'mini-skip', 'mini-fav', 'mini-auto', 'mini-open']) expect(await ui.find({ key })).toBeDefined()
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

test('the handover takes the old track out layer by layer, and the new one goes on from its build', () => {
  const set = newSet(atPart(trackFor('ship it'), PLAN.length - 1))
  const bpm = set.track.bpm
  afterLoop(set, { auto: true, nextTrack: () => trackFor('warehouse 4am') })
  expect(set.handover.from.phrase).toBe('ship it')
  expect(set.track.phrase).toBe('warehouse 4am')
  expect(set.track.bpm).toBe(bpm)
  let before = 99
  for (let i = 0; i < HANDOVER.length * HANDOVER_LOOPS; i++) {
    const spec = loopSpec(set, { auto: true })
    if (set.handover.loop === 0) {
      const old = Object.values(activeLayers(spec.track)).filter(Boolean).length
      expect(old).toBeLessThan(before)
      before = old
    }
    afterLoop(set, { auto: true, nextTrack: () => trackFor('null pointer') })
  }
  expect(set.handover).toBe(null)
  expect(set.track.part).toBe(HANDOVER_TO)
})

test('share codes: a<n> is the part, an old p<n> lands in the same section', () => {
  const t = atPart(trackFor('ruslan'), 7)
  expect(encodeCode(t)).toMatch(/a7$/)
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
  for (let k = 0; k < HANDOVER.length * HANDOVER_LOOPS - 1; k++) afterLoop(h, { auto: true, nextTrack: () => next })
  expect(loopSpec(h, { auto: true })).toMatchObject({ rise: true, build: fx.swap })
  afterLoop(h, { auto: true, nextTrack: () => next })
  expect(h.handover).toBe(null)
  expect(loopSpec(h, { auto: true })).toMatchObject({ impact: true, build: fx.swap })
})
