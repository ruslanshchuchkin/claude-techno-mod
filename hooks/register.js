// techno: grow a techno loop from a phrase, then change it by talking to Claude.
//
// /techno <phrase>     a new track from the phrase (or from a share code)
// /techno              open the pane
// /techno stop | save | code
// In chat: "darker", "add acid", "faster" -> Claude calls mcp__techno__jam.
import { trackFor, cleanTrack, parseCode, encodeCode, describe, render, toWav, grid, LAYERS, MOODS, ENERGIES, BARS, BPM_MIN, BPM_MAX } from './engine.js'

const PANE = 'techno'
const TOOL = 'mcp__techno__jam'
const GAIN = 0.7
const LAYER_COLORS = { kick: 'red', bass: 'yellow', hats: 'cyan', clap: 'magenta', perc: 'blue', acid: 'green', stab: 'magenta' }

// Module state. The track itself is also kept in $.store between sessions.
const s = {
  track: null,
  history: [],
  playing: false,
  ctrl: null,
  startedAt: 0,
  loopMs: 0,
  stepMs: 0,
  ticker: null,
  isOpen: false,
  view: 'main',
  lastPrompt: '',
  you: '',
  said: '',
  status: '',
  grids: new Map(),
}

const shareLine = (t) => '/techno ' + encodeCode(t)

function gridFor(t, bar) {
  const key = encodeCode(t) + '#' + bar
  if (!s.grids.has(key)) {
    if (s.grids.size > 64) s.grids.clear()
    s.grids.set(key, grid(t, bar))
  }
  return s.grids.get(key)
}

// What changed between two tracks, in a few words: "mood 2→1, acid on"
function diffWords(a, b) {
  if (!a) return 'new track'
  const out = []
  if (a.phrase !== b.phrase) return 'new phrase'
  if (a.bpm !== b.bpm) out.push(`${a.bpm}→${b.bpm} bpm`)
  if (a.mood !== b.mood) out.push(`${MOODS[a.mood]}→${MOODS[b.mood]}`)
  if (a.energy !== b.energy) out.push(`${ENERGIES[a.energy]}→${ENERGIES[b.energy]}`)
  if (a.dice !== b.dice) out.push('new patterns')
  if (a.swing !== b.swing) out.push('swing ' + b.swing)
  if (a.transpose !== b.transpose) out.push('key +' + b.transpose)
  for (const name of LAYERS) {
    if (a.layers[name] !== b.layers[name]) out.push(name + (b.layers[name] === undefined ? ' auto' : b.layers[name] ? ' on' : ' off'))
  }
  return out.join(', ') || 'no change'
}

// ---------- audio ----------

async function startAudio($) {
  const t = s.track
  const audio = render(t)
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
  startTicker($)
}

function stopAudio($) {
  if (s.ctrl) s.ctrl.abort()
  s.ctrl = null
  s.playing = false
  stopTicker()
  $.ui.invalidate('ui.render')
}

// Redraw once per step while the pane shows a playing loop, so the playhead moves.
function startTicker($) {
  stopTicker()
  if (!s.playing || !s.isOpen) return
  s.ticker = $.clock.every(Math.max(60, Math.round(s.stepMs)), () => $.ui.invalidate('ui.render'))
}

function stopTicker() {
  if (s.ticker) s.ticker.cancel()
  s.ticker = null
}

// ---------- track changes ----------

async function setTrack($, next, { play = true } = {}) {
  const clean = cleanTrack(next)
  if (s.track && encodeCode(s.track) === encodeCode(clean)) return clean
  if (s.track) s.history = [...s.history.slice(-29), s.track]
  s.track = clean
  s.status = ''
  await $.store.set('track', clean)
  if (play || s.playing) await startAudio($)
  $.ui.invalidate('ui.render')
  return clean
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

async function openPane($) {
  s.isOpen = true
  await $.ui.open({ id: PANE, title: 'techno', focus: true, columns: 46 })
  startTicker($)
  $.ui.invalidate('ui.render')
}

async function copyText($, text) {
  try {
    await $.ui.copy(text)
    return true
  } catch {
    try {
      const r = await $.process.run(['pbcopy'], { stdin: text, timeoutMs: 5000 })
      return r.exitCode === 0
    } catch {
      return false
    }
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

// ---------- drawing ----------

function bars(n) {
  return '▮'.repeat(n + 1) + '▯'.repeat(4 - n)
}

function mainView($, e, ui, now) {
  const { Box, Text, Button } = ui
  const t = s.track
  if (!t) {
    return Box({
      flexDirection: 'column',
      children: [
        Text({ bold: true, children: ['techno'] }),
        Text({ dimColor: true, children: ['Type a phrase. It becomes your track: the riff plays its letters.'] }),
        ui.Input({
          key: 'phrase',
          label: 'phrase',
          placeholder: 'late night deploy in bucharest',
          value: '',
          submitLabel: 'play',
          autoFocus: true,
          onSubmit: async (value) => {
            if (!value.trim()) return
            await setTrack($, parseCode(value) ?? trackFor(value))
          },
        }),
      ],
    })
  }

  const step = s.playing && s.loopMs ? Math.floor((((now - s.startedAt) % s.loopMs) + s.loopMs) % s.loopMs / s.stepMs) : -1
  const bar = step >= 0 ? Math.floor(step / 16) % BARS : 0
  const col = step >= 0 ? step % 16 : -1
  const rows = Object.entries(gridFor(t, bar)).map(([name, pattern]) =>
    Box({
      key: 'row-' + name,
      flexDirection: 'row',
      children: [
        Text({ dimColor: true, children: [name.padEnd(6)] }),
        ...[...pattern].map((c, i) =>
          Text({
            key: name + i,
            color: c === '.' ? undefined : LAYER_COLORS[name],
            bold: c === 'X',
            dimColor: c === '.',
            inverse: i === col,
            children: [c === '.' ? '·' : '■'],
          }),
        ),
      ],
    }),
  )

  const talk = []
  if (s.you) talk.push(Text({ key: 'you', dimColor: true, wrap: 'truncate-end', children: ['you    › ' + s.you] }))
  if (s.said) talk.push(Text({ key: 'said', wrap: 'truncate-end', children: ['claude › ' + s.said] }))
  if (!talk.length) talk.push(Text({ key: 'hint', dimColor: true, wrap: 'wrap', children: ['Tell Claude what you want: "darker", "add acid", "faster", "drop the hats".'] }))

  return Box({
    flexDirection: 'column',
    children: [
      Box({
        flexDirection: 'row',
        justifyContent: 'space-between',
        children: [
          Text({ bold: true, children: [s.playing ? '▶ techno' : '■ techno'] }),
          Text({ dimColor: true, children: [s.playing ? 'bar ' + (bar + 1) + '/' + BARS : 'stopped'] }),
        ],
      }),
      Text({ bold: true, wrap: 'wrap', children: ['"' + t.phrase + '"'] }),
      Text({ dimColor: true, wrap: 'wrap', children: [describe(t)] }),
      Text({ dimColor: true, children: ['mood ' + bars(t.mood) + '  energy ' + bars(t.energy)] }),
      Text({ children: [' '] }),
      ...rows,
      Text({ children: [' '] }),
      ...talk,
      Text({ children: [' '] }),
      Box({
        flexDirection: 'row',
        flexWrap: 'wrap',
        columnGap: 2,
        children: [
          Button({ key: 'play', label: s.playing ? 'stop' : 'play', hotkey: 'p', plain: true, autoFocus: true, onPress: () => (s.playing ? stopAudio($) : startAudio($)) }),
          Button({ key: 'dice', label: 'dice', hotkey: 'd', plain: true, onPress: () => setTrack($, { ...s.track, dice: (s.track.dice + 1) % 1000 }).then(() => { s.you = ''; s.said = 'dice: new patterns' }) }),
          Button({ key: 'undo', label: 'undo', hotkey: 'u', plain: true, onPress: () => undo($) }),
          Button({ key: 'flyer', label: 'flyer', hotkey: 'f', plain: true, onPress: () => showFlyer($) }),
          Button({ key: 'save', label: 'save mp3', hotkey: 's', plain: true, onPress: () => save($) }),
        ],
      }),
      ...(s.status ? [Text({ key: 'status', dimColor: true, wrap: 'wrap', children: [s.status] })] : []),
    ],
  })
}

async function showFlyer($) {
  s.view = 'flyer'
  const ok = await copyText($, shareLine(s.track))
  s.status = ok ? 'play line copied. Paste it anywhere.' : 'copy the line above to share it'
  $.ui.invalidate('ui.render')
}

function flyerView($, e, ui) {
  const { Box, Text, Button } = ui
  const t = s.track
  return Box({
    flexDirection: 'column',
    children: [
      Box({
        flexDirection: 'column',
        borderStyle: 'double',
        paddingX: 1,
        children: [
          Text({ bold: true, wrap: 'wrap', children: [t.phrase.toUpperCase()] }),
          Text({ children: [' '] }),
          Text({ wrap: 'wrap', children: [describe(t).toUpperCase()] }),
          Text({ dimColor: true, wrap: 'wrap', children: ['a techno loop grown from a phrase'] }),
          Text({ children: [' '] }),
          Text({ dimColor: true, children: ['play it in claude code:'] }),
          Text({ color: 'green', wrap: 'wrap', children: [shareLine(t)] }),
        ],
      }),
      Box({
        flexDirection: 'row',
        columnGap: 2,
        children: [
          Button({ key: 'back', label: 'back', hotkey: 'b', plain: true, autoFocus: true, onPress: () => { s.view = 'main'; s.status = ''; $.ui.invalidate('ui.render') } }),
          Button({ key: 'save2', label: 'save mp3', hotkey: 's', plain: true, onPress: () => save($) }),
        ],
      }),
      ...(s.status ? [Text({ key: 'status', dimColor: true, wrap: 'wrap', children: [s.status] })] : []),
    ],
  })
}

// ---------- hooks ----------

export function register(on) {
  on('session.start', async ($, e, next) => {
    const saved = await $.store.get('track')
    if (saved && typeof saved === 'object') s.track = cleanTrack(saved)
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
    await $.command.register({ name: 'techno', description: 'Grow a techno loop from a phrase', argumentHint: '[phrase or share code | stop | save | code]', immediate: true })
    return next(e)
  })

  on('command.run', { command: 'techno' }, async ($, e) => {
    const arg = String(e.args ?? '').trim()
    const word = arg.toLowerCase()
    if (word === 'stop') { stopAudio($); return { text: 'Stopped.' } }
    if (word === 'save') return { text: await save($) }
    if (word === 'code') return { text: s.track ? shareLine(s.track) : 'No track yet. Start with /techno <phrase>.' }
    if (word === 'play' && s.track) { await startAudio($); await openPane($); return {} }
    if (arg) {
      const from = s.track
      const t = await setTrack($, parseCode(arg) ?? trackFor(arg))
      s.you = ''
      s.said = from && from.phrase === t.phrase ? diffWords(from, t) : 'new track: ' + describe(t)
    }
    await openPane($)
    return {}
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    const from = s.track ?? trackFor(e.phrase || 'techno')
    let t = e.phrase ? trackFor(e.phrase) : { ...from, layers: { ...from.layers } }
    for (const k of ['bpm', 'mood', 'energy', 'swing', 'transpose']) if (e[k] !== undefined) t[k] = e[k]
    if (e.dice) t.dice = (t.dice + 1) % 1000
    for (const [name, v] of Object.entries(e.layers ?? {})) {
      if (!LAYERS.includes(name)) continue
      if (v === 'auto') delete t.layers[name]
      else t.layers[name] = v === true
    }
    const wasPlaying = s.playing
    t = await setTrack($, t, { play: e.play !== false && (wasPlaying || e.play === true || !s.track || !!e.phrase) })
    if (e.play === false) stopAudio($)
    s.you = s.lastPrompt
    s.said = (e.note && String(e.note).slice(0, 80)) || diffWords(from, t)
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
    if (s.view === 'flyer' && s.track) return flyerView($, e, ui)
    const now = await $.clock.now()
    return mainView($, e, ui, now)
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
      s.view = 'main'
      stopTicker()
      $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (s.ctrl) s.ctrl.abort()
    s.ctrl = null
    s.playing = false
    stopTicker()
    return next(e)
  })
}
