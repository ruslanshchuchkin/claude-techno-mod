// techno: a small techno app inside Claude Code. Pick a track (or grow one
// from a phrase), press NEXT to build it up one part at a time, and when it
// is done replay the whole set, save it as an mp3, remix it or share it.
// Claude can also change the track from chat through the mcp__techno__jam tool.
//
// /techno              open the app
// /techno <phrase>     a new track from the phrase (or from a share code)
// /techno stop | save | code
import { normalizePhrase, trackFor, atPart, cleanTrack, parseCode, encodeCode, describe, keyName, noteName, scaleName, SCALES, render, renderSet, toWav, grid, toggleStep, activeLayers, LAYERS, GRID_LAYERS, PLAN, MOODS, ENERGIES, BPM_MIN, BPM_MAX } from './engine.js'
import { nextMove } from './coach.js'
import { appView, miniView } from './views.js'

const TOOL = 'mcp__techno__jam'
const GAIN = 0.7
// [accent, normal] fill of a hit in the step grid
const LAYER_COLORS = {
  kick: ['#ff6b6b', '#d64545'],
  hats: ['#7fe3ff', '#3fb6d9'],
  bass: ['#ffd166', '#e0a92e'],
  perc: ['#8fa8ff', '#5b77e0'],
  clap: ['#ff8fd8', '#d65bb0'],
  acid: ['#a6ff6b', '#6fd13a'],
  stab: ['#d0a6ff', '#a274e0'],
}
const STARTERS = ['late night deploy', 'coffee at 3am', 'merge conflict', 'friday deploy', 'null pointer', 'ship it', 'warehouse 4am', 'rooftop sunrise']

// Module state. The track and your kept tracks live in $.store too.
const s = {
  track: null,
  history: [],
  playing: false,
  replaying: false,
  ctrl: null,
  startedAt: 0,
  loopMs: 0,
  stepMs: 0,
  isOpen: false,
  screen: 'crate',
  showShare: false,
  saved: [],
  repo: [],
  repoName: '',
  // the build: the state you left each part in, the layers heard so far, and whether it is done
  set: new Map(),
  seen: new Set(),
  finished: false,
  // auto: NEXT presses itself at the end of each loop, then moves to the next track
  auto: false,
  autoTimer: null,
  autoLoops: 0,
  // the bar above the chat box while the app is hidden: shown once you used techno, until its ×
  used: false,
  barClosed: false,
  barStored: false,
  lastPrompt: '',
  you: '',
  said: '',
  status: '',
  grids: new Map(),
}

const shareLine = (t) => '/techno ' + encodeCode(t)
const startOf = (phrase) => atPart(trackFor(phrase), 0)
const item = (label, sub, track = startOf(label)) => ({ label, sub, code: encodeCode(track) })
const isBuilding = (t) => t && t.part !== null && t.part !== undefined
// How many loops auto plays a part for: the groove, the peak and the drop get two.
const AUTO_LOOPS = { groove: 2, peak: 2, drop: 2 }
const loopsFor = (t) => (isBuilding(t) ? AUTO_LOOPS[PLAN[t.part].section] ?? 1 : 2)

function gridFor(t) {
  const key = encodeCode(t)
  if (!s.grids.has(key)) {
    if (s.grids.size > 64) s.grids.clear()
    s.grids.set(key, grid(t, 0))
  }
  return s.grids.get(key)
}

// What changed between two tracks, in a few words: "mood 2→1, acid on"
function diffWords(a, b) {
  if (!a) return 'new track'
  if (a.phrase !== b.phrase) return 'new track: ' + b.phrase
  const out = []
  if (a.part !== b.part && isBuilding(b)) out.push(PLAN[b.part].section + ': part ' + (b.part + 1))
  if (a.bpm !== b.bpm) out.push(`${a.bpm}→${b.bpm} bpm`)
  if (a.mood !== b.mood) out.push(`${MOODS[a.mood]}→${MOODS[b.mood]}`)
  if (a.energy !== b.energy) out.push(`${ENERGIES[a.energy]}→${ENERGIES[b.energy]}`)
  if (a.dice !== b.dice) out.push('new patterns')
  if (a.swing !== b.swing) out.push('swing ' + b.swing)
  if (a.transpose !== b.transpose) out.push('key ' + keyName(b))
  else if (a.scale !== b.scale || (a.mood !== b.mood && scaleName(a) !== scaleName(b))) out.push(scaleName(b) + ' scale')
  if (JSON.stringify(a.steps) !== JSON.stringify(b.steps)) out.push('steps edited')
  const on1 = activeLayers(a), on2 = activeLayers(b)
  for (const name of LAYERS) if (on1[name] !== on2[name]) out.push(name + (on2[name] ? ' in' : ' out'))
  return out.join(', ') || 'no change'
}

const setLength = () => {
  const n = s.set.size
  const loop = s.track ? (128 * 60) / s.track.bpm / 4 : 0
  const secs = Math.round(Math.max(0, n - 1) * loop / 2 + loop)
  return Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0')
}

// ---------- audio ----------

async function startAudio($) {
  const audio = render(s.track)
  const loopMs = audio.seconds * 1000
  const now = await $.clock.now()
  // keep the beat: start the new loop at the same point in the bar
  let offsetMs = 0
  if (s.playing && !s.replaying && s.loopMs > 0) offsetMs = (((now - s.startedAt) % s.loopMs) / s.loopMs) * loopMs
  const wav = toWav(audio, offsetMs / 1000)
  const old = s.ctrl
  const ctrl = new AbortController()
  s.ctrl = ctrl
  s.playing = true
  s.replaying = false
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
  await scheduleAuto($)
  $.ui.invalidate('ui.render')
}

function stopAudio($) {
  if (s.ctrl) s.ctrl.abort()
  s.ctrl = null
  s.playing = false
  s.replaying = false
  cancelAuto()
  $.ui.invalidate('ui.render')
}

// ---------- auto ----------

function cancelAuto() {
  if (s.autoTimer) s.autoTimer.cancel()
  s.autoTimer = null
}

// Wakes at the next loop boundary, so every change lands on the one.
async function scheduleAuto($) {
  cancelAuto()
  if (!s.auto || !s.playing || s.replaying || !s.loopMs) return
  const now = await $.clock.now()
  const pos = (((now - s.startedAt) % s.loopMs) + s.loopMs) % s.loopMs
  let wait = s.loopMs - pos
  if (wait < 250) wait += s.loopMs
  s.autoTimer = $.clock.after(wait, () => { autoTick($).catch(() => {}) })
}

async function autoTick($) {
  s.autoTimer = null
  if (!s.auto || !s.playing || s.replaying || !s.track) return
  s.autoLoops++
  if (s.autoLoops < loopsFor(s.track)) return scheduleAuto($)
  s.autoLoops = 0
  const t = s.track
  if (s.finished || !isBuilding(t) || t.part === PLAN.length - 1) {
    if (isBuilding(t)) s.set.set(t.part, t)
    return nextTrack($)
  }
  await advance($)
  s.said = 'auto · ' + s.said
}

async function setAuto($, on) {
  s.auto = on
  s.autoLoops = 0
  if (on && !s.playing) await startAudio($)
  else if (on) await scheduleAuto($)
  else cancelAuto()
  $.ui.invalidate('ui.render')
}

const normalizeLabel = (label) => normalizePhrase(label) || 'techno'

// The next name in your list (this project, kept, starters), built from the
// kick. In auto it keeps the tempo, so the beat carries straight on.
async function nextTrack($) {
  const list = [...s.repo, ...s.saved, ...STARTERS.map((p) => item(p, ''))].filter((it, i, all) => all.findIndex((x) => x.label === it.label) === i)
  if (!list.length) return
  const i = list.findIndex((it) => s.track && normalizeLabel(it.label) === s.track.phrase)
  const nxt = list[(i + 1) % list.length]
  let t = parseCode(nxt.code) ?? startOf(nxt.label)
  if (!isBuilding(t)) t = atPart(t, 0)
  if (s.auto && s.track) t = { ...t, bpm: s.track.bpm }
  await pick($, encodeCode(cleanTrack(t)))
  s.said = (s.auto ? 'auto · ' : '') + 'next track: ' + t.phrase
}

// The tracks of the finished set, in build order.
const setTracks = () => [...s.set.keys()].sort((a, b) => a - b).map((k) => s.set.get(k))

// Plays the whole build once, from the first kick to the outro.
async function replay($) {
  if (!s.set.size) return
  s.status = 'rendering the set…'
  $.ui.invalidate('ui.render')
  const audio = renderSet(setTracks())
  const wav = toWav(audio)
  if (s.ctrl) s.ctrl.abort()
  const ctrl = new AbortController()
  s.ctrl = ctrl
  s.playing = true
  s.replaying = true
  s.status = ''
  $.ui.invalidate('ui.render')
  try {
    await $.audio.play({ base64: wav.toBase64(), mime: 'audio/wav' }, { signal: ctrl.signal, gain: GAIN })
  } catch (err) {
    if (s.ctrl === ctrl) s.status = 'audio failed: ' + String(err?.message ?? err)
  }
  if (s.ctrl === ctrl) {
    s.ctrl = null
    s.playing = false
    s.replaying = false
    $.ui.invalidate('ui.render')
  }
}

// ---------- track changes ----------

function noteLayers(t) {
  const on = activeLayers(t)
  for (const name of GRID_LAYERS) if (on[name]) s.seen.add(name)
}

// A new build: the set, the layers heard and the done card start over.
function freshSet() {
  s.set = new Map()
  s.seen = new Set()
  s.finished = false
}

async function setTrack($, next, { play } = {}) {
  const clean = cleanTrack(next)
  if (s.track && encodeCode(s.track) === encodeCode(clean)) return clean
  if (!s.track || s.track.phrase !== clean.phrase) freshSet()
  if (!s.track || s.track.phrase !== clean.phrase || s.track.part !== clean.part) s.autoLoops = 0
  markUsed($)
  if (s.track) s.history = [...s.history.slice(-29), s.track]
  s.track = clean
  s.status = ''
  noteLayers(clean)
  await $.store.set('track', clean)
  if (play ?? (s.playing && !s.replaying)) await startAudio($)
  $.ui.invalidate('ui.render')
  return clean
}

async function change($, fn) {
  if (!s.track) return
  const t = { ...s.track, layers: { ...s.track.layers }, steps: { ...s.track.steps } }
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

async function editStep($, layer, i) {
  const from = s.track
  const to = await setTrack($, toggleStep(s.track, layer, i))
  s.you = ''
  s.said = diffWords(from, to)
}

// NEXT: remember the part you are leaving, then move to the next one.
// After the outro, NEXT finishes the track and the done card appears.
async function advance($) {
  const t = s.track
  if (!t) return
  if (!isBuilding(t)) {
    freshSet()
    await setTrack($, atPart(t, 0), { play: true })
    s.said = 'from the top: just the kick'
    return
  }
  s.set.set(t.part, t)
  if (t.part === PLAN.length - 1) {
    s.finished = true
    s.said = 'track done'
    $.ui.invalidate('ui.render')
    return
  }
  const to = await setTrack($, atPart(t, t.part + 1), { play: true })
  s.you = ''
  s.said = PLAN[to.part].section + ' · ' + PLAN[to.part].go
}

async function remix($) {
  const t = s.track
  freshSet()
  await setTrack($, atPart({ ...t, dice: (t.dice + 1) % 1000, steps: {} }, 0), { play: true })
  s.said = 'remix: new patterns, from the kick'
}

async function pick($, code) {
  const t = parseCode(code) ?? startOf(code)
  freshSet()
  s.track = null
  await setTrack($, t, { play: true })
  s.you = ''
  s.said = 'now playing: ' + t.phrase
  s.screen = 'deck'
  s.showShare = false
  $.ui.invalidate('ui.render')
}

async function undo($) {
  const prev = s.history.pop()
  if (!prev) { s.status = 'nothing to undo'; $.ui.invalidate('ui.render'); return }
  const from = s.track
  s.track = prev
  s.finished = false
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
  s.status = ok ? 'play line copied. Paste it to a friend who has the mod.' : 'copy the play line above'
  if (!s.isOpen) $.ui.toast(ok ? 'Play line copied: ' + shareLine(s.track) : shareLine(s.track))
  $.ui.invalidate('ui.render')
}

// The app lives in the band above the chat box; these show and hide it.
function openApp($) {
  s.isOpen = true
  markUsed($)
  $.ui.invalidate('ui.render')
}

// The bar follows you into every chat: once you used techno, a new session
// shows it too (paused, on the same track) until you close it with its ×.
function markUsed($) {
  s.used = true
  s.barClosed = false
  if (!s.barStored) { s.barStored = true; $.store.set('bar', true) }
}

function closeBar($) {
  s.barClosed = true
  s.barStored = false
  $.store.set('bar', false)
  $.ui.invalidate('ui.render')
}

function hideApp($) {
  s.isOpen = false
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

// Writes audio to ~/Music/techno as an mp3 (or a wav without ffmpeg).
// `loops` repeats a loop that many times; the set is written as it is.
async function writeAudio($, audio, name, loops) {
  const home = (await $.env.get('HOME')) ?? '.'
  const dir = home + '/Music/techno'
  const tmp = dir + '/.' + name + '.wav'
  const wav = toWav(audio)
  const length = audio.seconds * loops
  const fades = 'afade=t=in:d=0.5' + (loops > 1 ? ',afade=t=out:st=' + (length - 4).toFixed(2) + ':d=4' : '')
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
        ['ffmpeg', '-y', '-loglevel', 'error', '-stream_loop', String(loops - 1), '-i', tmp, '-af', fades, '-b:a', '192k', mp3],
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

const fileName = (t) => encodeCode(t).replace(/[@+*]/g, '_')

// One minute (four loops) of the current state.
async function save($) {
  const t = s.track
  if (!t) return 'Nothing to save yet. Start with /techno <phrase>.'
  return writeAudio($, render(t), fileName(t), 4)
}

// The whole build, from the first kick to the outro.
async function saveSet($) {
  if (!s.set.size) return save($)
  s.status = 'rendering the set…'
  $.ui.invalidate('ui.render')
  return writeAudio($, renderSet(setTracks()), fileName(s.track) + '_set', 1)
}

async function doMove($, id) {
  if (id === 'play') return startAudio($)
  if (id === 'build' || id === 'advance' || id === 'finish') return advance($)
  if (id === 'done') return replay($)
}

// ---------- hooks ----------

export function register(on) {
  on('session.start', async ($, e, next) => {
    const saved = await $.store.get('track')
    if (saved && typeof saved === 'object') { s.track = cleanTrack(saved); noteLayers(s.track) }
    const kept = await $.store.get('saved')
    if (Array.isArray(kept)) s.saved = kept.filter((it) => it && typeof it.code === 'string')
    if (s.track) s.screen = 'deck'
    if (s.track && (await $.store.get('bar')) === true) { s.used = true; s.barStored = true }
    await loadRepo($)
    await $.tool.register({
      name: 'jam',
      description:
        "Change the techno loop in the user's techno pane (the techno mod). Use it when the user asks to change the music: darker or brighter, more or less energy, faster or slower, add or drop a layer, new patterns, the next part of the build, or a new phrase. Pass only what changes. " +
        'mood: 0 pitch black, 1 dark, 2 deep, 3 warm, 4 bright. scale: the scale of the key, by name. energy: 0 minimal, 1 rolling, 2 driving, 3 peak, 4 rave. ' +
        'A track is built in parts (intro, groove, build, peak, break, drop, outro); next: true moves to the next part, as the NEXT button does. ' +
        'layers: true forces a layer on, false forces it off, "auto" gives it back to the build. dice: true rolls new patterns. phrase: a new phrase starts a new track from the kick. ' +
        'note: a few words for the pane that say what you changed. The result gives the new track and its share line. Reply to the user in one short line.',
      inputSchema: {
        type: 'object',
        properties: {
          phrase: { type: 'string', description: 'A new phrase. It seeds a whole new track; its letters become the riff.' },
          next: { type: 'boolean', description: 'Move the build to its next part (or finish it after the outro)' },
          bpm: { type: 'integer', minimum: BPM_MIN, maximum: BPM_MAX },
          mood: { type: 'integer', minimum: 0, maximum: 4 },
          energy: { type: 'integer', minimum: 0, maximum: 4 },
          swing: { type: 'integer', minimum: 0, maximum: 3, description: '0 straight, 3 most shuffle on hats and percussion' },
          transpose: { type: 'integer', minimum: 0, maximum: 11, description: 'Semitones up from the phrase key' },
          scale: { enum: [...SCALES.map((sc) => sc.name), 'auto'], description: 'minor (sad, the classic), dorian (cool), phrygian (dark, tense), hijaz (arabic), harmonic (dramatic). auto lets the mood pick' },
          dice: { type: 'boolean', description: 'Roll new patterns for the same phrase' },
          layers: {
            type: 'object',
            properties: Object.fromEntries(LAYERS.map((n) => [n, { enum: [true, false, 'auto'] }])),
            additionalProperties: false,
          },
          play: { type: 'boolean', description: 'true starts the loop, false stops it' },
          auto: { type: 'boolean', description: 'true lets the mod build and mix by itself (a part per loop, then the next track); false stops that' },
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
    else if (s.isOpen) { hideApp($); return {} }
    openApp($)
    return {}
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    if (typeof e.auto === 'boolean' && s.track) await setAuto($, e.auto)
    if (e.auto !== undefined && Object.keys(e).every((k) => ['tool', 'tool_use_id', 'auto', 'note', 'agentId'].includes(k))) {
      s.said = e.note ? String(e.note).slice(0, 80) : 'auto ' + (s.auto ? 'on' : 'off')
      return { result: `Auto is ${s.auto ? 'on: the mod builds a part per loop, then mixes into the next track' : 'off'}. Now playing: "${s.track?.phrase ?? 'nothing'}".` }
    }
    if (e.next && s.track && !e.phrase) {
      const from = s.track
      await advance($)
      if (e.play === false) stopAudio($)
      s.you = s.lastPrompt
      if (e.note) s.said = String(e.note).slice(0, 80)
      s.screen = 'deck'
      openApp($)
      const where = s.finished ? 'the track is done' : `now at ${PLAN[s.track.part].section}, part ${s.track.part + 1} of ${PLAN.length}`
      return { result: `Moved on: ${where}. Changed: ${diffWords(from, s.track)}. Share line: ${shareLine(s.track)}` }
    }
    const from = s.track ?? startOf(e.phrase || 'techno')
    let t = e.phrase ? startOf(e.phrase) : { ...from, layers: { ...from.layers } }
    if (e.phrase) freshSet()
    for (const k of ['bpm', 'mood', 'energy', 'swing', 'transpose']) if (e[k] !== undefined) t[k] = e[k]
    if (e.scale === 'auto') t.scale = null
    else if (e.scale !== undefined) { const i = SCALES.findIndex((sc) => sc.name === e.scale); if (i >= 0) t.scale = i }
    if (e.dice) t.dice = (t.dice + 1) % 1000
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
    openApp($)
    return { result: `Now playing: "${t.phrase}", ${describe(t)}. Changed: ${diffWords(from, t)}. Share line: ${shareLine(t)}` }
  })

  // Remember what the user asked, for the pane. While a loop plays, tell Claude about it.
  on('prompt.submit', async ($, e, next) => {
    s.lastPrompt = String(e.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
    if (!s.playing || !s.track) return next(e)
    const where = isBuilding(s.track) ? `, ${PLAN[s.track.part].section} (part ${s.track.part + 1} of ${PLAN.length})` : ''
    const note = `The techno mod is playing a loop in the user's techno pane: "${s.track.phrase}", ${describe(s.track)}${where}. If this prompt is about the music, change it with the ${TOOL} tool and reply in one short line.`
    return next({ ...e, context: [...(e.context ?? []), note] })
  })

  // The app, drawn in the band above the chat box. Hidden: a one-line player
  // while music plays, otherwise nothing.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!s.isOpen && !(s.track && s.used && !s.barClosed)) return next(e)
    const ui = $.ui.resolve(e)
    const t = s.track
    const now = await $.clock.now()
    const coach = nextMove(t, { playing: s.playing && !s.replaying, finished: s.finished })
    // in auto the mod presses NEXT itself, so nothing else is lit and the tip says when
    const move = s.auto && s.playing && coach.key === 'do-move' ? { ...coach, key: 'auto', tip: coach.tip + ' Auto moves on at the end of the loop.' } : coach
    const code = t ? encodeCode(t) : ''
    const layersOn = t ? activeLayers(t) : {}
    const looping = s.playing && !s.replaying && s.loopMs
    const step = looping ? Math.floor(((((now - s.startedAt) % s.loopMs) + s.loopMs) % s.loopMs) / s.stepMs) : 0
    // the grid shows the layers this build has used so far, in a fixed order
    const all = t ? gridFor({ ...t, layers: Object.fromEntries(LAYERS.map((n) => [n, true])) }) : {}
    const rows = GRID_LAYERS.filter((n) => s.seen.has(n) || layersOn[n]).map((n) => [n, all[n], LAYER_COLORS[n], !!layersOn[n], t.layers[n] === false])
    const vm = {
      surface: e.surface,
      screen: s.screen,
      showShare: s.showShare,
      track: t,
      code,
      desc: t ? describe(t) : '',
      key: t ? keyName(t) : '',
      note: t ? noteName(t) : '',
      scale: t ? scaleName(t) : '',
      playing: s.playing,
      replaying: s.replaying,
      auto: s.auto,
      finished: s.finished,
      set: { parts: s.set.size, length: setLength() },
      move,
      isKept: s.saved.some((it) => it.code === code),
      shareLine: t ? shareLine(t) : '',
      you: s.you,
      said: s.said,
      status: s.status,
      crate: { repo: s.repo, saved: s.saved, starters: STARTERS.map((p) => item(p, '')) },
      gridEl: t && rows.length ? ui.Client({ key: 'grid', module: './grid.client.js', props: { rows, step, stepMs: s.stepMs || 115, playing: !!looping, stamp: s.startedAt } }) : null,
    }
    const redraw = () => $.ui.invalidate('ui.render')
    const act = {
      play: () => startAudio($),
      stop: () => stopAudio($),
      energy: (d) => change($, (x) => { x.energy = Math.max(0, Math.min(4, x.energy + d)) }),
      mood: (d) => change($, (x) => { x.mood = Math.max(0, Math.min(4, x.mood + d)) }),
      bpm: (d) => change($, (x) => { x.bpm = Math.max(BPM_MIN, Math.min(BPM_MAX, x.bpm + d)) }),
      key: (d) => change($, (x) => { x.transpose = (x.transpose + d + 12) % 12 }),
      scale: (d) => change($, (x) => { x.scale = (SCALES.findIndex((sc) => sc.name === scaleName(x)) + d + SCALES.length) % SCALES.length }),
      dice: () => change($, (x) => { x.dice = (x.dice + 1) % 1000 }),
      undo: () => undo($),
      keep: () => keep($),
      share: () => { s.showShare = true; return copyShare($) },
      copy: () => copyShare($),
      closeShare: () => { s.showShare = false; s.status = ''; redraw() },
      save: () => save($),
      saveSet: () => saveSet($),
      replay: () => replay($),
      remix: () => remix($),
      pick: (c) => pick($, c),
      phrase: (text) => (String(text).trim() ? pick($, text) : undefined),
      screen: (id) => { s.screen = id; redraw() },
      doMove: () => { s.autoLoops = 0; return doMove($, move.id) },
      open: () => openApp($),
      close: () => hideApp($),
      auto: () => setAuto($, !s.auto),
      nextTrack: () => nextTrack($),
      closeBar: () => closeBar($),
    }
    const theirs = await next(e)
    return ui.Box({ flexDirection: 'column', children: [s.isOpen ? appView(ui, vm, act) : miniView(ui, vm, act), theirs] })
  })

  // The grid posts { toggle: layer } for a click on a row name, and
  // { step, layer } for a click on a cell.
  on('ui.message', async ($, e, next) => {
    const d = e.element === 'grid' ? e.data : null
    if (d && typeof d.toggle === 'string' && LAYERS.includes(d.toggle)) {
      await toggleLayer($, d.toggle)
      return {}
    }
    if (d && typeof d.layer === 'string' && GRID_LAYERS.includes(d.layer) && Number.isInteger(d.step)) {
      await editStep($, d.layer, d.step)
      return {}
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
