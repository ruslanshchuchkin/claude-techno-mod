// techno: a small techno app inside Claude Code. Pick a track (or grow one
// from a phrase), click to build it up, and share it with a code or an mp3.
// A coach highlights the next thing to click. Claude can also change the
// track from chat through the mcp__techno__jam tool.
//
// /techno              open the app
// /techno <phrase>     a new track from the phrase (or from a share code)
// /techno stop | save | code
import { trackFor, cleanTrack, parseCode, encodeCode, describe, render, toWav, grid, activeLayers, LAYERS, MOODS, ENERGIES, BPM_MIN, BPM_MAX } from './engine.js'
import { nextMove } from './coach.js'
import { paneView } from './views.js'

const PANE = 'techno'
const TOOL = 'mcp__techno__jam'
const GAIN = 0.7
const LAYER_COLORS = { kick: 'red', bass: 'yellow', hats: 'cyan', clap: 'magenta', perc: 'blue', acid: 'green', stab: 'magenta' }
const STARTERS = ['late night deploy', 'coffee at 3am', 'merge conflict', 'friday deploy', 'null pointer', 'ship it', 'warehouse 4am', 'rooftop sunrise']
const ROOMS = [
  ['basement', 0, 3],
  ['warehouse', 1, 3],
  ['afterhours', 2, 2],
  ['rooftop', 3, 2],
  ['sunrise', 4, 1],
]
const MOVE_LABELS = { play: '▶ play', energy: 'energy up', clap: 'add the clap', acid: 'add the acid', break: 'take the kick out', drop: 'kick back in', dice: 'roll the dice', keep: 'keep it', share: 'share it', next: 'next track' }

// Module state. The track, your kept tracks, and the layout live in $.store too.
const s = {
  track: null,
  history: [],
  playing: false,
  ctrl: null,
  startedAt: 0,
  loopMs: 0,
  stepMs: 0,
  isOpen: false,
  layout: 'C',
  tab: 'tracks',
  screen: 'crate',
  showShare: false,
  saved: [],
  repo: [],
  repoName: '',
  radio: 0,
  done: new Set(),
  flags: { diced: false, kept: false, shared: false },
  lastPrompt: '',
  you: '',
  said: '',
  status: '',
  grids: new Map(),
  isDev: false,
}

const shareLine = (t) => '/techno ' + encodeCode(t)
const item = (label, sub, track = trackFor(label)) => ({ label, sub, code: encodeCode(track) })

function gridFor(t) {
  const key = encodeCode(t)
  if (!s.grids.has(key)) {
    if (s.grids.size > 64) s.grids.clear()
    s.grids.set(key, grid(t, 0))
  }
  return s.grids.get(key)
}

function stations() {
  const seen = new Set()
  const out = []
  const add = (list, from) => {
    for (const it of list) if (!seen.has(it.code)) { seen.add(it.code); out.push({ ...it, from }) }
  }
  add(s.saved, 'your tracks')
  add(s.repo, 'from your repo · ' + s.repoName)
  add(STARTERS.map((p) => item(p, '')), 'starter')
  return out
}

// What changed between two tracks, in a few words: "mood 2→1, acid on"
function diffWords(a, b) {
  if (!a) return 'new track'
  if (a.phrase !== b.phrase) return 'new track: ' + b.phrase
  const out = []
  if (a.bpm !== b.bpm) out.push(`${a.bpm}→${b.bpm} bpm`)
  if (a.mood !== b.mood) out.push(`${MOODS[a.mood]}→${MOODS[b.mood]}`)
  if (a.energy !== b.energy) out.push(`${ENERGIES[a.energy]}→${ENERGIES[b.energy]}`)
  if (a.dice !== b.dice) out.push('new patterns')
  if (a.swing !== b.swing) out.push('swing ' + b.swing)
  if (a.transpose !== b.transpose) out.push('key +' + b.transpose)
  const on1 = activeLayers(a), on2 = activeLayers(b)
  for (const name of LAYERS) if (on1[name] !== on2[name]) out.push(name + (on2[name] ? ' in' : ' out'))
  return out.join(', ') || 'no change'
}

// ---------- audio ----------

async function startAudio($) {
  const audio = render(s.track)
  const loopMs = audio.seconds * 1000
  const now = await $.clock.now()
  // keep the beat: start the new loop at the same point in the bar
  let offsetMs = 0
  if (s.playing && s.loopMs > 0) offsetMs = (((now - s.startedAt) % s.loopMs) / s.loopMs) * loopMs
  const wav = toWav(audio, offsetMs / 1000)
  const old = s.ctrl
  const ctrl = new AbortController()
  s.ctrl = ctrl
  s.playing = true
  s.loopMs = loopMs
  s.stepMs = audio.stepSeconds * 1000
  s.startedAt = now - offsetMs
  $.audio
    .play({ base64: wav.toBase64(), mime: 'audio/wav' }, { shouldLoop: true, signal: ctrl.signal, gain: GAIN })
    .catch((err) => {
      if (s.ctrl !== ctrl) return
      s.playing = false
      s.status = 'audio failed: ' + String(err?.message ?? err)
      $.ui.invalidate('ui.render')
    })
  if (old) old.abort()
  $.ui.invalidate('ui.render')
}

function stopAudio($) {
  if (s.ctrl) s.ctrl.abort()
  s.ctrl = null
  s.playing = false
  $.ui.invalidate('ui.render')
}

// ---------- track changes ----------

async function setTrack($, next, { play } = {}) {
  const clean = cleanTrack(next)
  if (s.track && encodeCode(s.track) === encodeCode(clean)) return clean
  if (!s.track || s.track.phrase !== clean.phrase) {
    s.done = new Set()
    s.flags = { diced: false, kept: false, shared: false }
  }
  if (s.track) s.history = [...s.history.slice(-29), s.track]
  s.track = clean
  s.status = ''
  await $.store.set('track', clean)
  if (play ?? s.playing) await startAudio($)
  $.ui.invalidate('ui.render')
  return clean
}

async function change($, fn) {
  if (!s.track) return
  const t = { ...s.track, layers: { ...s.track.layers } }
  fn(t)
  const from = s.track
  const to = await setTrack($, t)
  s.you = ''
  s.said = diffWords(from, to)
}

async function toggleLayer($, name) {
  await change($, (t) => {
    const want = !activeLayers(t)[name]
    delete t.layers[name]
    if (activeLayers(t)[name] !== want) t.layers[name] = want
  })
}

async function pick($, code) {
  const t = parseCode(code) ?? trackFor(code)
  await setTrack($, t, { play: true })
  s.you = ''
  s.said = 'now playing: ' + t.phrase
  s.screen = 'deck'
  s.showShare = false
  const i = stations().findIndex((st) => st.code === encodeCode(t))
  if (i >= 0) s.radio = i
  $.ui.invalidate('ui.render')
}

async function undo($) {
  const prev = s.history.pop()
  if (!prev) { s.status = 'nothing to undo'; $.ui.invalidate('ui.render'); return }
  const from = s.track
  s.track = prev
  s.said = 'undo: ' + diffWords(from, prev)
  s.you = ''
  await $.store.set('track', prev)
  if (s.playing) await startAudio($)
  $.ui.invalidate('ui.render')
}

async function keep($) {
  const code = encodeCode(s.track)
  if (s.saved.some((it) => it.code === code)) {
    s.saved = s.saved.filter((it) => it.code !== code)
    s.status = 'removed from your tracks'
  } else {
    s.saved = [item(s.track.phrase, describe(s.track), s.track), ...s.saved].slice(0, 20)
    s.flags.kept = true
    s.status = 'kept in your tracks'
  }
  await $.store.set('saved', s.saved)
  $.ui.invalidate('ui.render')
}

async function copyShare($) {
  let ok = false
  try {
    const r = await $.ui.copy({ text: shareLine(s.track) })
    ok = r?.isCopied !== false
  } catch {
    try {
      const r = await $.process.run(['pbcopy'], { stdin: shareLine(s.track), timeoutMs: 5000 })
      ok = r.exitCode === 0
    } catch { /* no clipboard */ }
  }
  s.flags.shared = true
  s.status = ok ? 'play line copied. Paste it to a friend who has the mod.' : 'copy the play line above'
  $.ui.invalidate('ui.render')
}

async function openPane($) {
  s.isOpen = true
  await $.ui.open({ id: PANE, title: 'techno', focus: true, columns: 60 })
  $.ui.invalidate('ui.render')
}

// Reads the session's repo: branch, recent commit subjects, project name.
async function loadRepo($) {
  try {
    const cwd = await $.session.cwd()
    s.repoName = cwd.split('/').filter(Boolean).pop() ?? ''
    const out = [item(s.repoName, 'project')]
    const branch = await $.process.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], { timeoutMs: 5000 })
    if (branch.exitCode === 0 && branch.stdout.trim()) out.push(item(branch.stdout.trim(), 'branch'))
    const log = await $.process.run(['git', 'log', '-3', '--pretty=%s'], { timeoutMs: 5000 })
    if (log.exitCode === 0) for (const line of log.stdout.split('\n').map((l) => l.trim()).filter(Boolean)) out.push(item(line.slice(0, 40), 'commit'))
    s.repo = out.filter((it, i, all) => it.label && all.findIndex((x) => x.code === it.code) === i)
  } catch {
    s.repo = []
  }
}

// Saves one minute (four loops) as an mp3 in ~/Music/techno, or a wav without ffmpeg.
async function save($) {
  const t = s.track
  if (!t) return 'Nothing to save yet. Start with /techno <phrase>.'
  const home = (await $.env.get('HOME')) ?? '.'
  const dir = home + '/Music/techno'
  const name = encodeCode(t).replace(/[@+]/g, '_')
  const tmp = dir + '/.' + name + '.wav'
  const audio = render(t)
  const wav = toWav(audio)
  const fadeAt = (4 * audio.seconds - 4).toFixed(2)
  s.status = 'saving…'
  $.ui.invalidate('ui.render')
  try {
    await $.process.run(['mkdir', '-p', dir])
    const dec = await $.process.run(['sh', '-c', 'base64 --decode > "$1"', 'sh', tmp], { stdin: wav.toBase64(), timeoutMs: 30000 })
    if (dec.exitCode !== 0) throw new Error(dec.stderr.trim() || 'base64 failed')
    const mp3 = dir + '/' + name + '.mp3'
    let out = mp3
    try {
      const ff = await $.process.run(
        ['ffmpeg', '-y', '-loglevel', 'error', '-stream_loop', '3', '-i', tmp, '-af', 'afade=t=in:d=0.5,afade=t=out:st=' + fadeAt + ':d=4', '-b:a', '192k', mp3],
        { timeoutMs: 120000 },
      )
      if (ff.exitCode !== 0) throw new Error(ff.stderr.trim())
      await $.process.run(['rm', '-f', tmp])
    } catch {
      out = dir + '/' + name + '.wav'
      await $.process.run(['mv', tmp, out])
    }
    s.status = 'saved ' + out.replace(home, '~')
    try { await $.process.run(['open', '-R', out], { timeoutMs: 5000 }) } catch { /* not macOS */ }
    return 'Saved ' + out
  } catch (err) {
    s.status = 'save failed: ' + String(err?.message ?? err)
    return s.status
  } finally {
    $.ui.invalidate('ui.render')
  }
}

async function doMove($, id) {
  const t = s.track
  if (id === 'play') return startAudio($)
  if (id === 'energy') return change($, (x) => { x.energy = Math.min(4, x.energy + 1) })
  if (id === 'clap' || id === 'acid' || id === 'break' || id === 'drop') return toggleLayer($, id === 'clap' ? 'clap' : id === 'acid' ? 'acid' : 'kick')
  if (id === 'dice') { s.flags.diced = true; return change($, (x) => { x.dice = (x.dice + 1) % 1000 }) }
  if (id === 'keep') return keep($)
  if (id === 'share') { s.showShare = true; s.tab = 'share'; return copyShare($) }
  const list = stations()
  const i = (Math.max(0, list.findIndex((st) => st.code === encodeCode(t))) + 1) % list.length
  return pick($, list[i].code)
}

// ---------- hooks ----------

export function register(on) {
  on('session.start', async ($, e, next) => {
    s.isDev = !$.plugin.root.includes('/plugins/cache/')
    const saved = await $.store.get('track')
    if (saved && typeof saved === 'object') s.track = cleanTrack(saved)
    const kept = await $.store.get('saved')
    if (Array.isArray(kept)) s.saved = kept.filter((it) => it && typeof it.code === 'string')
    const layout = await $.store.get('layout')
    if (layout === 'A' || layout === 'B' || layout === 'C') s.layout = layout
    if (s.track) s.screen = 'deck'
    await loadRepo($)
    await $.tool.register({
      name: 'jam',
      description:
        "Change the techno loop in the user's techno pane (the techno mod). Use it when the user asks to change the music: darker or brighter, more or less energy, faster or slower, add or drop a layer, new patterns, or a new phrase. Pass only what changes. " +
        'mood: 0 pitch black, 1 dark, 2 deep, 3 warm, 4 bright. energy: 0 minimal, 1 rolling, 2 driving, 3 peak, 4 rave. ' +
        'layers: true forces a layer on, false forces it off, "auto" gives it back to mood and energy. dice: true rolls new patterns. phrase: a new phrase starts a new track. ' +
        'note: a few words for the pane that say what you changed. The result gives the new track and its share line. Reply to the user in one short line.',
      inputSchema: {
        type: 'object',
        properties: {
          phrase: { type: 'string', description: 'A new phrase. It seeds a whole new track; its letters become the riff.' },
          bpm: { type: 'integer', minimum: BPM_MIN, maximum: BPM_MAX },
          mood: { type: 'integer', minimum: 0, maximum: 4 },
          energy: { type: 'integer', minimum: 0, maximum: 4 },
          swing: { type: 'integer', minimum: 0, maximum: 3, description: '0 straight, 3 most shuffle on hats and percussion' },
          transpose: { type: 'integer', minimum: 0, maximum: 11, description: 'Semitones up from the phrase key' },
          dice: { type: 'boolean', description: 'Roll new patterns for the same phrase' },
          layers: {
            type: 'object',
            properties: Object.fromEntries(LAYERS.map((n) => [n, { enum: [true, false, 'auto'] }])),
            additionalProperties: false,
          },
          play: { type: 'boolean', description: 'true starts the loop, false stops it' },
          note: { type: 'string', description: 'A few words for the pane, like "darker, acid on"' },
        },
      },
    })
    await $.command.register({ name: 'techno', description: 'Open the techno app: pick a track and build it up', argumentHint: '[phrase or share code | stop | save | code]', immediate: true })
    return next(e)
  })

  on('command.run', { command: 'techno' }, async ($, e) => {
    const arg = String(e.args ?? '').trim()
    const word = arg.toLowerCase()
    if (word === 'stop') { stopAudio($); return { text: 'Stopped.' } }
    if (word === 'save') return { text: await save($) }
    if (word === 'code') return { text: s.track ? shareLine(s.track) : 'No track yet. Start with /techno <phrase>.' }
    if (word === 'play' && s.track) await startAudio($)
    else if (arg) await pick($, arg)
    await openPane($)
    return {}
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    const from = s.track ?? trackFor(e.phrase || 'techno')
    let t = e.phrase ? trackFor(e.phrase) : { ...from, layers: { ...from.layers } }
    for (const k of ['bpm', 'mood', 'energy', 'swing', 'transpose']) if (e[k] !== undefined) t[k] = e[k]
    if (e.dice) { t.dice = (t.dice + 1) % 1000; s.flags.diced = true }
    for (const [name, v] of Object.entries(e.layers ?? {})) {
      if (!LAYERS.includes(name)) continue
      if (v === 'auto') delete t.layers[name]
      else t.layers[name] = v === true
    }
    t = await setTrack($, t, { play: e.play !== false && (s.playing || e.play === true || !s.track || !!e.phrase) })
    if (e.play === false) stopAudio($)
    s.you = s.lastPrompt
    s.said = (e.note && String(e.note).slice(0, 80)) || diffWords(from, t)
    s.screen = 'deck'
    if (!s.isOpen) await openPane($)
    $.ui.invalidate('ui.render')
    return { result: `Now playing: "${t.phrase}", ${describe(t)}. Changed: ${diffWords(from, t)}. Share line: ${shareLine(t)}` }
  })

  // Remember what the user asked, for the pane. While a loop plays, tell Claude about it.
  on('prompt.submit', async ($, e, next) => {
    s.lastPrompt = String(e.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
    if (!s.playing || !s.track) return next(e)
    const note = `The techno mod is playing a loop in the user's techno pane: "${s.track.phrase}", ${describe(s.track)}. If this prompt is about the music, change it with the ${TOOL} tool and reply in one short line.`
    return next({ ...e, context: [...(e.context ?? []), note] })
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const ui = $.ui.resolve(e)
    const t = s.track
    const now = await $.clock.now()
    const move = nextMove(t, { playing: s.playing, ...s.flags }, s.done)
    const layersOn = t ? activeLayers(t) : {}
    const list = stations()
    const station = list[s.radio % Math.max(1, list.length)]
    const code = t ? encodeCode(t) : ''
    const step = s.playing && s.loopMs ? Math.floor(((((now - s.startedAt) % s.loopMs) + s.loopMs) % s.loopMs) / s.stepMs) : 0
    const rows = t ? Object.entries(gridFor({ ...t, layers: Object.fromEntries(LAYERS.map((n) => [n, true])) })).map(([name, pattern]) => [name, pattern, LAYER_COLORS[name], !!layersOn[name]]) : []
    const vm = {
      surface: e.surface,
      dev: s.isDev,
      layout: s.layout,
      tab: s.tab,
      screen: s.screen,
      showShare: s.showShare,
      track: t,
      code,
      desc: t ? describe(t) : '',
      playing: s.playing,
      on: layersOn,
      move,
      moveLabel: MOVE_LABELS[move.id],
      isKept: s.saved.some((it) => it.code === code),
      shareLine: t ? shareLine(t) : '',
      you: s.you,
      said: s.said,
      status: s.status,
      radio: { index: list.indexOf(station), total: list.length, from: station?.from ?? '' },
      roomOptions: [...(t ? [{ value: code, label: t.phrase }] : []), ...ROOMS.map(([name]) => ({ value: roomCode(name), label: name })), ...s.saved.map((it) => ({ value: it.code, label: '♥ ' + it.label }))].filter((o, i, all) => all.findIndex((x) => x.value === o.value) === i),
      roomValue: code,
      crate: { repo: s.repo, repoName: s.repoName, saved: s.saved, starters: STARTERS.map((p) => item(p, describe(trackFor(p)))) },
      gridEl: t ? ui.Client({ key: 'grid', module: './grid.client.js', props: { rows, step, stepMs: s.stepMs || 115, playing: s.playing, stamp: s.startedAt } }) : ui.Text({ children: [' '] }),
    }
    const redraw = () => $.ui.invalidate('ui.render')
    const act = {
      play: () => startAudio($),
      stop: () => stopAudio($),
      toggle: (name) => toggleLayer($, name),
      energy: (d) => change($, (x) => { x.energy = Math.max(0, Math.min(4, x.energy + d)) }),
      mood: (d) => change($, (x) => { x.mood = Math.max(0, Math.min(4, x.mood + d)) }),
      bpm: (d) => change($, (x) => { x.bpm = Math.max(BPM_MIN, Math.min(BPM_MAX, x.bpm + d)) }),
      dice: () => { s.flags.diced = true; return change($, (x) => { x.dice = (x.dice + 1) % 1000 }) },
      undo: () => undo($),
      keep: () => keep($),
      share: () => { s.showShare = true; return copyShare($) },
      copy: () => copyShare($),
      closeShare: () => { s.showShare = false; s.status = ''; redraw() },
      save: () => save($),
      pick: (c) => pick($, c),
      phrase: (text) => (String(text).trim() ? pick($, text) : undefined),
      radio: (d) => {
        const all = stations()
        if (!all.length) return
        s.radio = (s.radio + d + all.length) % all.length
        return pick($, all[s.radio].code)
      },
      tab: (id) => { s.tab = id; if (id === 'share' && s.track) copyShare($); redraw() },
      screen: (id) => { s.screen = id; redraw() },
      layout: async (id) => { s.layout = id; redraw(); await $.store.set('layout', id) },
      doMove: () => doMove($, move.id),
    }
    return paneView(ui, vm, act)
  })

  // A click on a grid row mutes or unmutes that layer.
  on('ui.message', async ($, e, next) => {
    if (e.element === 'grid' && e.data && typeof e.data.toggle === 'string' && LAYERS.includes(e.data.toggle)) {
      await toggleLayer($, e.data.toggle)
      return {}
    }
    return next(e)
  })

  // While music plays with the pane closed, one dim line above the prompt says so.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!s.playing || s.isOpen || !s.track) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const theirs = await next(e)
    return Box({
      flexDirection: 'column',
      children: [Text({ dimColor: true, wrap: 'truncate-end', children: ['♪ techno · ' + s.track.phrase + ' · ' + s.track.bpm + ' bpm · /techno to open, /techno stop'] }), theirs],
    })
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) {
      s.isOpen = false
      $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (s.ctrl) s.ctrl.abort()
    s.ctrl = null
    s.playing = false
    return next(e)
  })
}

function roomCode(name) {
  const [, mood, energy] = ROOMS.find((r) => r[0] === name)
  return encodeCode(cleanTrack({ ...trackFor(name), mood, energy }))
}
