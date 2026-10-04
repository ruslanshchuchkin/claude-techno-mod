// techno: a long techno set that plays while you work with Claude. One
// background player (player/techno.mjs) makes the music for every chat; this
// module is a remote control for it: the band above the chat box, the
// /techno command, and the mcp__techno__jam tool Claude uses to change the
// music. The Mac's play, next and previous keys work too (the player's
// TechnoPlayer.app is in Control Center as "Now Playing").
//
// /techno              show or hide the app
// /techno <phrase>     a new track from the phrase (or from a share code)
// /techno stop | save | code
import { parseCode, encodeCode, describe, render, toWav, grid, activeLayers, cleanTrack, LAYERS, GRID_LAYERS, PLAN, VIBES, BPM_MIN, BPM_MAX } from './engine.js'
import { appView, miniView } from './views.js'

const TOOL = 'mcp__techno__jam'
// The plugin version: in the jam tool's answer, and the player of an older
// version is replaced by this one. Keep it equal to plugin.json (a test checks).
const VERSION = '0.8.5'
// [accent, normal] fill of a hit in the step grid
const LAYER_COLORS = {
  kick: ['#e85a5a', '#c94040'],
  hats: ['#3fb6d9', '#2a93b5'],
  bass: ['#e8b03a', '#c99320'],
  perc: ['#7b93f0', '#5b77e0'],
  clap: ['#e070c0', '#c0509f'],
  ride: ['#4cc4a0', '#2fa583'],
  acid: ['#8fdc50', '#6fbf30'],
  stab: ['#b88ae8', '#9a6ad0'],
}
const STARTERS = ['late night deploy', 'coffee at 3am', 'merge conflict', 'friday deploy', 'null pointer', 'ship it', 'warehouse 4am', 'rooftop sunrise']

// Module state. The player holds the music state; this is the chat's view of it.
const s = {
  home: '',
  sock: '',
  ps: null, // the player's last answer to GET /state
  down: '', // why the player is not there, for the pane
  starting: null,
  isOpen: false,
  screen: 'deck', // deck | favorites | crate
  editOpen: false,
  used: false,
  barClosed: false,
  repo: [],
  lastPrompt: '',
  you: '',
  status: '',
  pollTimer: null,
  grids: new Map(),
}

const shareLine = (code) => '/techno ' + code
const versionAtLeast = (a, b) => {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0)
  return true
}

// ---------- the player ----------

async function ask($, body) {
  const r = await $.http.fetch('http://techno' + (body ? '/cmd' : '/state'), body ? { method: 'POST', body: JSON.stringify(body), socketPath: s.sock } : { socketPath: s.sock })
  if (!r.ok) throw new Error('player answered ' + r.status)
  return JSON.parse(r.text)
}

// Starts the player when no player (or an older one) answers. It runs in its
// own process group, so it outlives this chat; it quits when no Claude Code
// process is left.
async function ensurePlayer($) {
  if (s.starting) return s.starting
  s.starting = (async () => {
    try {
      const ps = await ask($).catch(() => null)
      if (ps && versionAtLeast(ps.version, VERSION)) { s.ps = ps; s.down = ''; return true }
      if (ps) { await ask($, { op: 'quit' }).catch(() => {}); await $.clock.sleep(400) }
      // Homebrew's node first, then the one the login shell finds (18 or later)
      const node = await $.process.run(['sh', '-lc', 'for n in /opt/homebrew/bin/node "$(command -v node)" /usr/local/bin/node; do [ -x "$n" ] && echo "$n" && break; done'], { timeoutMs: 10000 })
      const bin = node.stdout.trim().split('\n')[0]
      if (!bin) { s.down = 'techno needs node (brew install node)'; return false }
      const log = s.home + '/Library/Caches/techno/daemon.out'
      await $.process.run(['sh', '-c', 'mkdir -p "$(dirname "$3")"; perl -MPOSIX -e "POSIX::setsid(); exec @ARGV" "$1" "$2" </dev/null >>"$3" 2>&1 &', 'sh', bin, $.plugin.root + '/player/techno.mjs', log], { timeoutMs: 10000 })
      // the first start compiles TechnoPlayer.app (swiftc), which takes a while
      for (let i = 0; i < 120; i++) {
        await $.clock.sleep(500)
        const up = await ask($).catch(() => null)
        if (up) { s.ps = up; s.down = ''; return true }
      }
      s.down = 'the player did not start: see ~/Library/Caches/techno/daemon.out'
      return false
    } finally {
      s.starting = null
    }
  })()
  return s.starting
}

// Sends a command; starts the player first when it is not there.
async function cmd($, body) {
  try {
    s.ps = await ask($, body)
  } catch {
    if (!(await ensurePlayer($))) { $.ui.invalidate('ui.render'); return null }
    s.ps = await ask($, body).catch(() => s.ps)
  }
  markUsed($)
  $.ui.invalidate('ui.render')
  return s.ps
}

async function poll($) {
  const before = s.ps?.rev
  try {
    s.ps = await ask($)
    s.down = ''
  } catch {
    if (s.ps) { s.ps = null; s.down = 'the player stopped' }
  }
  if (s.ps?.rev !== before || s.ps?.playing) $.ui.invalidate('ui.render')
}

// ---------- saving ----------

// Writes one minute (four loops) of a track to ~/Music/techno as an mp3
// (or a wav without ffmpeg), shows it in Finder.
async function save($, code) {
  const t = parseCode(code)
  if (!t) return 'Nothing to save yet.'
  const dir = s.home + '/Music/techno'
  const name = code.replace(/[@+*]/g, '_')
  const tmp = dir + '/.' + name + '.wav'
  s.status = 'saving…'
  $.ui.invalidate('ui.render')
  try {
    const audio = render(t)
    await $.process.run(['mkdir', '-p', dir])
    const dec = await $.process.run(['sh', '-c', 'base64 --decode > "$1"', 'sh', tmp], { stdin: toWav(audio).toBase64(), timeoutMs: 30000 })
    if (dec.exitCode !== 0) throw new Error(dec.stderr.trim() || 'base64 failed')
    let out = dir + '/' + name + '.mp3'
    const ff = await $.process.run(['ffmpeg', '-y', '-loglevel', 'error', '-stream_loop', '3', '-i', tmp, '-af', 'afade=t=in:d=0.5,afade=t=out:st=' + (audio.seconds * 4 - 4).toFixed(2) + ':d=4', '-b:a', '192k', out], { timeoutMs: 120000 }).catch(() => ({ exitCode: 1 }))
    if (ff.exitCode === 0) await $.process.run(['rm', '-f', tmp])
    else { out = dir + '/' + name + '.wav'; await $.process.run(['mv', tmp, out]) }
    await $.process.run(['open', '-R', out], { timeoutMs: 5000 }).catch(() => {})
    s.status = 'saved ' + out.replace(s.home, '~')
    return 'Saved ' + out
  } catch (err) {
    s.status = 'save failed: ' + String(err?.message ?? err)
    return s.status
  } finally {
    $.ui.invalidate('ui.render')
  }
}

async function copyLine($, code) {
  let ok = false
  try { ok = (await $.ui.copy({ text: shareLine(code) }))?.isCopied !== false } catch {
    try { ok = (await $.process.run(['pbcopy'], { stdin: shareLine(code), timeoutMs: 5000 })).exitCode === 0 } catch { /* no clipboard */ }
  }
  s.status = ok ? 'play line copied: ' + shareLine(code) : shareLine(code)
  if (!s.isOpen) $.ui.toast(s.status)
  $.ui.invalidate('ui.render')
}

// Share: one minute as an mp3, shown in Finder, and the play line copied.
async function share($, code) {
  await save($, code)
  const where = s.status
  await copyLine($, code)
  if (where.startsWith('saved')) s.status = where + ' · play line copied'
  $.ui.invalidate('ui.render')
}

// ---------- the app ----------

function markUsed($) {
  if (s.used && !s.barClosed) return
  s.used = true
  s.barClosed = false
  $.store.set('bar', true)
}

function gridFor(code) {
  if (!s.grids.has(code)) {
    if (s.grids.size > 64) s.grids.clear()
    const t = parseCode(code)
    s.grids.set(code, t ? grid({ ...t, layers: Object.fromEntries(LAYERS.map((n) => [n, true])) }, 0) : {})
  }
  return s.grids.get(code)
}

// Reads the session's repo: the project, its branch and recent commits. The
// player mixes these names into the tracks auto picks.
async function loadRepo($) {
  try {
    const cwd = await $.session.cwd()
    const out = [cwd.split('/').filter(Boolean).pop() ?? '']
    const branch = await $.process.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], { timeoutMs: 5000 })
    if (branch.exitCode === 0 && branch.stdout.trim()) out.push(branch.stdout.trim())
    const log = await $.process.run(['git', 'log', '-3', '--pretty=%s'], { timeoutMs: 5000 })
    if (log.exitCode === 0) for (const line of log.stdout.split('\n').map((l) => l.trim()).filter(Boolean)) out.push(line.slice(0, 40))
    s.repo = out.filter((x, i, all) => x && !x.startsWith('scratch') && all.indexOf(x) === i)
  } catch {
    s.repo = []
  }
}

function describeNow() {
  const v = s.ps?.view
  if (!v) return 'nothing'
  const t = parseCode(v.code)
  return `"${v.phrase}", ${t ? describe(t) : v.mood}, ${v.section === 'handover' ? 'mixing in from ' + v.from : v.name + ` (part ${v.part + 1} of ${PLAN.length})`}`
}

// ---------- hooks ----------

export function register(on) {
  on('session.start', async ($, e, next) => {
    s.home = (await $.env.get('HOME')) ?? ''
    s.sock = s.home + '/Library/Caches/techno/techno.sock'
    if ((await $.store.get('bar')) === true) s.used = true
    await $.tool.register({
      name: 'jam',
      description:
        "Change the techno music in the user's techno pane (the techno mod). Use it when the user asks to change the music: darker or brighter, more or less energy, faster or slower, add or drop a layer, new patterns, the next part, the next or previous track, a new phrase, auto on or off, play or stop. Pass only what changes. " +
        'mood: sad (minor), mysterious (hijaz, arabic) or dark (phrygian); it sets the sound, the scale and the tempo together. energy: 0 minimal, 1 rolling, 2 driving, 3 peak, 4 rave. ' +
        'A track is a long set: intro, groove, build, three drops with breakdowns between them, an outro that mixes into the next track. next: true moves to the next part. track: "next" mixes into the next track now, "previous" goes back to the one before. ' +
        'layers (kick, bass, hats, clap, perc, ride, pad, rumble, acid, voice, stab): true forces a layer on, false off, "auto" gives it back to the arrangement. dice: true rolls new patterns. phrase: a new phrase starts a new track. favorite: true adds the track to the favorites. ' +
        'note: a few words for the pane that say what you changed. Reply to the user in one short line.',
      inputSchema: {
        type: 'object',
        properties: {
          phrase: { type: 'string', description: 'A new phrase. It seeds a whole new track; its letters become the riff.' },
          next: { type: 'boolean', description: 'Move to the next part of the track' },
          track: { enum: ['next', 'previous'], description: 'Mix into the next track now, or go back to the previous one' },
          bpm: { type: 'integer', minimum: BPM_MIN, maximum: BPM_MAX },
          mood: { enum: VIBES.map((v) => v.name) },
          energy: { type: 'integer', minimum: 0, maximum: 4 },
          swing: { type: 'integer', minimum: 0, maximum: 3, description: '0 straight, 3 most shuffle on hats and percussion' },
          transpose: { type: 'integer', minimum: 0, maximum: 11, description: 'Semitones up from the phrase key' },
          dice: { type: 'boolean', description: 'Roll new patterns for the same phrase' },
          layers: { type: 'object', properties: Object.fromEntries(LAYERS.map((n) => [n, { enum: [true, false, 'auto'] }])), additionalProperties: false },
          favorite: { type: 'boolean', description: 'true adds the playing track to the favorites, false removes it' },
          play: { type: 'boolean', description: 'true starts the music, false stops it' },
          auto: { type: 'boolean', description: 'true lets the set play by itself (parts, drops, then the next track); false stays on a part until next' },
          note: { type: 'string', description: 'A few words for the pane, like "darker, acid on"' },
        },
      },
    })
    await $.command.register({ name: 'techno', description: 'Show or hide the techno app', argumentHint: '[phrase or share code | stop | save | code]', immediate: true })
    // The player may take a while (its first start compiles the helper app):
    // the command and the tool are there at once, the player comes up behind.
    void (async () => {
      await loadRepo($)
      // the first chat on 0.8 hands the kept tracks and the last track to the player
      const kept = await $.store.get('saved')
      const track = await $.store.get('track')
      if (await ensurePlayer($)) await cmd($, { op: 'hello', repo: s.repo, saved: Array.isArray(kept) ? kept : [], track: track && typeof track === 'object' ? encodeCode(cleanTrack(track)) : null })
      if (!s.pollTimer) s.pollTimer = $.clock.every(1000, () => { poll($).catch(() => {}) })
      $.ui.invalidate('ui.render')
    })().catch(() => {})
    return next(e)
  })

  on('command.run', { command: 'techno' }, async ($, e) => {
    const arg = String(e.args ?? '').trim()
    const word = arg.toLowerCase()
    if (word === 'stop') { await cmd($, { op: 'pause' }); return { text: 'Stopped.' } }
    if (word === 'save') return { text: s.ps ? await save($, s.ps.view.code) : 'Nothing plays yet.' }
    if (word === 'code') return { text: s.ps ? shareLine(s.ps.view.code) : 'No track yet. Start with /techno <phrase>.' }
    if (word === 'play') await cmd($, { op: 'play' })
    else if (arg) { await cmd($, { op: 'pick', code: arg }); s.screen = 'deck' }
    else if (s.isOpen) { s.isOpen = false; $.ui.invalidate('ui.render'); return {} }
    s.isOpen = true
    markUsed($)
    $.ui.invalidate('ui.render')
    return {}
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    const done = []
    if (e.phrase) { await cmd($, { op: 'pick', code: e.phrase }); done.push('new track ' + e.phrase) }
    if (e.track === 'next') { await cmd($, { op: 'skip' }); done.push('mixing into the next track') }
    if (e.track === 'previous') { await cmd($, { op: 'prev' }); done.push('back to the previous track') }
    if (e.next) { await cmd($, { op: 'next' }); done.push('next part') }
    const jam = { op: 'jam', note: e.note }
    for (const k of ['mood', 'bpm', 'energy', 'swing', 'transpose', 'dice', 'layers']) if (e[k] !== undefined) jam[k] = e[k]
    if (Object.keys(jam).length > 2) { await cmd($, jam); done.push('changed ' + Object.keys(jam).filter((k) => k !== 'op' && k !== 'note').join(', ')) }
    if (typeof e.auto === 'boolean') { await cmd($, { op: 'auto', on: e.auto }); done.push('auto ' + (e.auto ? 'on' : 'off')) }
    if (typeof e.favorite === 'boolean' && s.ps && s.ps.fav !== e.favorite) { await cmd($, { op: 'fav' }); done.push(e.favorite ? 'added to favorites' : 'removed from favorites') }
    if (e.play === true) await cmd($, { op: 'play' })
    if (e.play === false) await cmd($, { op: 'pause' })
    else if (!s.ps?.playing && (e.phrase || e.track)) await cmd($, { op: 'play' })
    if (!s.ps) return { result: 'The techno player is not running: ' + (s.down || 'unknown reason') }
    s.you = s.lastPrompt
    s.isOpen = true
    s.screen = 'deck'
    $.ui.invalidate('ui.render')
    return { result: `${done.join('; ') || 'no change'}. Now: ${describeNow()}. Auto ${s.ps.auto ? 'on' : 'off'}, ${s.ps.playing ? 'playing' : 'stopped'}. Share line: ${shareLine(s.ps.view.code)} (techno v${VERSION})` }
  })

  // Remember what the user asked, for the pane. While music plays, tell Claude about it.
  on('prompt.submit', async ($, e, next) => {
    s.lastPrompt = String(e.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
    if (!s.ps?.playing) return next(e)
    const note = `The techno mod is playing in the user's techno pane: ${describeNow()}, auto ${s.ps.auto ? 'on' : 'off'}. If this prompt is about the music, change it with the ${TOOL} tool and reply in one short line.`
    return next({ ...e, context: [...(e.context ?? []), note] })
  })

  // The app, drawn in the band above the chat box. Hidden: a one-line bar,
  // once techno was used, until its ×.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!s.isOpen && !(s.used && !s.barClosed && (s.ps || s.down))) return next(e)
    const ui = $.ui.resolve(e)
    const ps = s.ps
    const v = ps?.view
    const t = v ? parseCode(v.code) : null
    const now = await $.clock.now()
    const heard = t ? activeLayers(t) : {}
    const all = v ? gridFor(v.code) : {}
    // the rows: every layer that plays, plus the next one as a dashed row
    const rows = t ? GRID_LAYERS.filter((n) => heard[n] || t.layers[n] === false).map((n) => [n, all[n] ?? '.'.repeat(16), LAYER_COLORS[n], !!heard[n], t.layers[n] === false]) : []
    if (v?.next?.layer && GRID_LAYERS.includes(v.next.layer) && !rows.some((r) => r[0] === v.next.layer)) rows.push([v.next.layer, all[v.next.layer] ?? '.'.repeat(16), LAYER_COLORS[v.next.layer], false, false, true])
    const looping = !!(ps?.playing && ps.barStartedAt)
    const sinceBar = looping ? Math.max(0, now - ps.barStartedAt) : 0
    const step = looping ? (v.bar * 16 + Math.min(15, Math.floor(sinceBar / ps.stepMs))) % 128 : 0
    const nextIn = ps?.nextInMs !== null && ps?.nextInMs !== undefined ? Math.max(0, ps.nextInMs - (now - ps.now)) : null
    // where the set is, for the skyline: the energy of every loop of the
    // set, and how far in it plays (in loops)
    let where = null
    if (v) {
      const barMs = ps.barMs || 1800
      const totalLoops = PLAN.reduce((n, p) => n + p.loops, 0)
      const before = v.part === null ? totalLoops : PLAN.slice(0, v.part).reduce((n, p) => n + p.loops, 0)
      const inPart = v.part === null ? 0 : Math.max(0, PLAN[v.part].loops - v.loopsLeft)
      const pos = Math.min(totalLoops, before + inPart + (v.part === null ? 0 : (v.bar + Math.min(1, sinceBar / barMs)) / 8))
      where = { loops: PLAN.flatMap((p) => Array(p.loops).fill(p.energy)), pos, elapsed: pos * 8 * barMs, total: totalLoops * 8 * barMs }
    }
    const vm = {
      surface: e.surface,
      columns: e.viewport?.columns ?? 100,
      screen: s.screen,
      down: s.down,
      ps,
      view: v,
      playing: !!ps?.playing,
      auto: !!ps?.auto,
      fav: !!ps?.fav,
      nextIn,
      where,
      editOpen: s.editOpen,
      acidOn: !!heard.acid,
      favorites: ps?.favorites ?? [],
      recent: ps?.recent ?? [],
      playlist: ps?.playlist ?? null,
      canUndo: !!ps?.canUndo,
      said: ps?.said ?? '',
      you: s.you,
      status: s.status,
      crate: { repo: s.repo, starters: STARTERS },
      gridEl: rows.length ? ui.Client({ key: 'grid', module: './grid.client.js', props: { rows, step, stepMs: ps?.stepMs || 115, playing: looping, stamp: ps?.barStartedAt ?? 0 } }) : null,
    }
    const go = (body) => () => cmd($, body)
    const act = {
      play: go({ op: 'play' }),
      stop: go({ op: 'pause' }),
      auto: go({ op: 'auto', on: !ps?.auto }),
      next: go({ op: 'next' }),
      skip: go({ op: 'skip' }),
      prev: go({ op: 'prev' }),
      fav: go({ op: 'fav' }),
      toggleFav: (code) => cmd($, { op: 'fav', code }),
      mood: (name) => cmd($, { op: 'jam', mood: name }),
      dice: go({ op: 'dice' }),
      melody: go({ op: 'layer', name: 'acid' }),
      undo: go({ op: 'undo' }),
      bpm: (d) => cmd($, { op: 'jam', bpm: Math.max(BPM_MIN, Math.min(BPM_MAX, (v?.bpm ?? 128) + d)) }),
      pick: (code) => { s.screen = 'deck'; return cmd($, { op: 'pick', code, playlist: null }) },
      playFavorite: (code) => { s.screen = 'deck'; return cmd($, { op: 'pick', code, playlist: 'favorites' }) },
      playFavorites: () => { s.screen = 'deck'; return cmd($, { op: 'playlist', name: 'favorites' }) },
      phrase: (text) => (String(text).trim() ? act.pick(String(text).trim()) : undefined),
      share: (code) => share($, code ?? v.code),
      copy: (code) => copyLine($, code ?? v.code),
      screen: (id) => { s.screen = id; $.ui.invalidate('ui.render') },
      edit: () => { s.editOpen = !s.editOpen; $.ui.invalidate('ui.render') },
      open: () => { s.isOpen = true; s.screen = 'deck'; $.ui.invalidate('ui.render') },
      close: () => { s.isOpen = false; $.ui.invalidate('ui.render') },
      closeBar: () => { s.barClosed = true; $.store.set('bar', false); $.ui.invalidate('ui.render') },
      retry: () => ensurePlayer($).then(() => $.ui.invalidate('ui.render')),
    }
    const theirs = await next(e)
    return ui.Box({ flexDirection: 'column', children: [s.isOpen ? appView(ui, vm, act) : miniView(ui, vm, act), theirs] })
  })

  // The grid posts { toggle: layer } for a click on a row name, and
  // { step, layer } for a click on a cell.
  on('ui.message', async ($, e, next) => {
    const d = e.element === 'grid' ? e.data : null
    if (d && typeof d.toggle === 'string' && LAYERS.includes(d.toggle)) { await cmd($, { op: 'layer', name: d.toggle }); return {} }
    if (d && typeof d.layer === 'string' && GRID_LAYERS.includes(d.layer) && Number.isInteger(d.step)) { await cmd($, { op: 'step', layer: d.layer, i: d.step }); return {} }
    return next(e)
  })

  // The player plays on for the other chats; it stops when the last Claude
  // Code process ends.
  on('session.end', async ($, e, next) => {
    if (s.pollTimer) s.pollTimer.cancel()
    s.pollTimer = null
    return next(e)
  })
}
