// The techno player: one background process for every chat. It owns the set
// (the track, its part, auto, the handover), your favorites and the tracks you
// heard, renders the music a bar or two ahead, and feeds the bars to
// TechnoPlayer.app, which plays them without a gap, shows them in Control
// Center and passes the media keys back. Chats are remote controls: they ask
// for the state and send commands over a Unix socket.
//
//   GET  /state          what plays now, for the pane
//   POST /cmd {op, ...}   play, pause, toggle, auto, next, skip, prev, pick,
//                         jam, layer, step, dice, undo, fav, unfav, playlist,
//                         hello, save, quit
//
// It quits when no Claude Code process is left, and with it the music.
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn, execFile, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import * as E from '../hooks/engine.js'
import * as C from '../hooks/conductor.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const VERSION = JSON.parse(fs.readFileSync(path.join(HERE, '../.claude-plugin/plugin.json'), 'utf8')).version
const HOME = os.homedir()
// TECHNO_DIR moves the cache and the state elsewhere (tests)
const CACHE = process.env.TECHNO_DIR ? path.join(process.env.TECHNO_DIR, 'cache') : path.join(HOME, 'Library/Caches/techno')
const SOCK = path.join(CACHE, 'techno.sock')
const BARS = path.join(CACHE, 'bars')
const LOG = path.join(CACHE, 'player.log')
const STATE_FILE = process.env.TECHNO_DIR ? path.join(process.env.TECHNO_DIR, 'state.json') : path.join(HOME, 'Library/Application Support/techno/state.json')
const APP = process.env.TECHNO_DIR ? path.join(process.env.TECHNO_DIR, 'TechnoPlayer.app') : path.join(HOME, 'Library/Caches/techno/TechnoPlayer.app')
const BIN = path.join(APP, 'Contents/MacOS/TechnoPlayer')
const SOURCE = path.join(HERE, 'TechnoPlayer.swift')
const PREBUILT = path.join(HERE, 'bin/TechnoPlayer')
const STARTERS = ['late night deploy', 'coffee at 3am', 'merge conflict', 'friday deploy', 'null pointer', 'ship it', 'warehouse 4am', 'rooftop sunrise']
// how many bars wait in the helper's queue beyond the one playing
const AHEAD = 2

fs.mkdirSync(BARS, { recursive: true })
fs.mkdirSync(path.join(HOME, 'Library/Caches/techno'), { recursive: true })
fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
const log = (line) => fs.appendFileSync(LOG, `${new Date().toTimeString().slice(0, 8)} player ${VERSION}: ${line}\n`)

// ---------- saved state ----------

const saved = (() => { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) } catch { return {} } })()
const st = {
  auto: saved.auto ?? true,
  playing: false,
  playlist: saved.playlist ?? null,
  favorites: Array.isArray(saved.favorites) ? saved.favorites : [],
  history: Array.isArray(saved.history) ? saved.history : [],
  pool: Array.isArray(saved.pool) ? saved.pool : [],
  imported: !!saved.imported,
  said: '',
  rev: 1,
}
const first = (saved.track && E.parseCode(saved.track)) || E.trackFor('late night deploy')
let saveTimer = null
function persist() {
  st.rev++
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const data = { auto: st.auto, playlist: st.playlist, favorites: st.favorites, history: st.history.slice(-30), pool: st.pool.slice(-40), imported: st.imported, track: E.encodeCode(cursor.set.track) }
    fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 1))
  }, 400)
}

// A track's identity, without the part: what a favorite or the history keeps.
const idOf = (t) => E.encodeCode({ ...E.cleanTrack(t), part: null })
const labelOf = (t) => ({ code: idOf(t), label: t.phrase, mood: E.moodName(t), bpm: t.bpm })

// ---------- the helper app ----------

function buildHelper() {
  const sum = crypto.createHash('sha1').update(fs.readFileSync(SOURCE)).digest('hex')
  const stampFile = path.join(APP, 'Contents/source.sha1')
  if (fs.existsSync(BIN) && fs.existsSync(stampFile) && fs.readFileSync(stampFile, 'utf8') === sum) return
  log('building TechnoPlayer.app')
  fs.mkdirSync(path.dirname(BIN), { recursive: true })
  fs.writeFileSync(path.join(APP, 'Contents/Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>com.shch.techno-player</string>
<key>CFBundleName</key><string>techno</string>
<key>CFBundleDisplayName</key><string>techno</string>
<key>CFBundleExecutable</key><string>TechnoPlayer</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>${VERSION}</string>
<key>LSUIElement</key><true/>
</dict></plist>
`)
  // the repo ships a universal build of this source (scripts/build-helper.mjs),
  // so only a changed source needs swiftc
  if (fs.existsSync(PREBUILT) && fs.readFileSync(PREBUILT + '.sha1', 'utf8').trim() === sum) {
    // a new file renamed over the old one: a helper still running keeps its own
    fs.copyFileSync(PREBUILT, BIN + '.new')
    fs.chmodSync(BIN + '.new', 0o755)
    fs.renameSync(BIN + '.new', BIN)
  } else {
    try {
      execFileSync('swiftc', ['-O', SOURCE, '-o', BIN], { stdio: 'pipe', timeout: 180000 })
    } catch (err) {
      log('swiftc failed: ' + String(err.stderr || err.message).trim().split('\n')[0])
      console.error('techno: the helper app needs a build: run xcode-select --install')
      process.exit(1)
    }
  }
  fs.writeFileSync(stampFile, sum)
}

let helper = null
let helperBuf = ''
function send(msg) { if (helper) helper.stdin.write(JSON.stringify(msg) + '\n') }

function startHelper() {
  helper = spawn(BIN, [], { stdio: ['pipe', 'pipe', 'pipe'] })
  helper.stdout.on('data', (d) => {
    helperBuf += d.toString()
    let i
    while ((i = helperBuf.indexOf('\n')) >= 0) {
      const line = helperBuf.slice(0, i)
      helperBuf = helperBuf.slice(i + 1)
      try { onHelper(JSON.parse(line)) } catch { /* not ours */ }
    }
  })
  helper.stderr.on('data', (d) => log('helper: ' + d.toString().trim()))
  helper.on('exit', (code) => { log('helper exited ' + code); helper = null; if (!quitting) process.exit(1) })
}

// ---------- the stream ----------

let cursor = { set: C.newSet(first), bar: 0 } // the next bar to queue
let mix = C.mixer()
const segs = new Map() // id -> { before, view, ms, t }
let nextId = 1, playingId = 0, lastQueued = 0
let cutting = false, pending = []
const renders = new Map()
const voices = new Map() // phrase -> clips | null while recording

const snap = (c) => ({ set: structuredClone(c.set), bar: c.bar })

function voicesFor(phrase) {
  if (!voices.has(phrase)) {
    voices.set(phrase, null)
    recordVoices(phrase).then((clips) => { if (clips) { voices.set(phrase, clips); renders.clear() } }).catch(() => {})
  }
  return voices.get(phrase)
}

function say(voice, rate, text) {
  return new Promise((resolve) => {
    const f = path.join(os.tmpdir(), `techno-voice-${process.pid}-${voice}.wav`)
    execFile('say', ['-v', voice, '-r', String(rate), '-o', f, '--file-format=WAVE', '--data-format=LEI16@22050', '--', text], { timeout: 15000 }, (err) => {
      if (err) return resolve(null)
      try { resolve(E.decodeWav(new Uint8Array(fs.readFileSync(f)))) } catch { resolve(null) }
      fs.rm(f, () => {})
    })
  })
}

async function recordVoices(phrase) {
  const whisper = await say('Whisper', 150, phrase)
  const deep = await say('Daniel', 120, phrase)
  return whisper && deep ? { whisper, deep } : null
}

function renderFor(spec) {
  const v = voicesFor(spec.track.phrase)
  const key = C.specKey(spec) + (v ? '|v' : '')
  if (!renders.has(key)) {
    if (renders.size > 6) renders.delete(renders.keys().next().value)
    renders.set(key, E.renderLoop(spec.track, { rise: spec.rise, impact: spec.impact, build: spec.build, fall: spec.fall, swell: spec.swell, with: spec.with, voices: v }))
  }
  return renders.get(key)
}

// What the pane shows for a bar: the track you hear (the incoming one in a
// handover, with the layers it has so far), the part, and what comes next.
function viewOf(set, bar, spec) {
  const h = set.handover
  const shown = h ? (spec.with ?? E.onlyLayers(set.track, [])) : set.track
  const p = h ? null : E.PLAN[set.track.part]
  const plan = E.planOf(set.track), at = h ? null : C.posOf(set)
  const nextPart = h ? null : E.PLAN[plan[at + 1]]
  return {
    code: E.encodeCode(shown),
    id: idOf(set.track),
    phrase: set.track.phrase,
    mood: E.moodName(set.track),
    bpm: set.track.bpm,
    part: h ? null : set.track.part,
    section: h ? 'handover' : p.section,
    name: h ? 'mixing in' : p.name,
    from: h ? h.from.phrase : null,
    next: h ? { name: h.step < E.HANDOVERS[h.shape ?? 'hats'].steps.length - 1 ? 'more of ' + set.track.phrase : set.track.phrase + ' takes over' } : nextPart ? { name: nextPart.name, adds: nextPart.adds, layer: nextPart.layer } : { name: 'the next track' },
    bar,
    loopsLeft: C.loopsLeft(set),
    at,
    plan,
  }
}

function queueBar() {
  const before = snap(cursor)
  const spec = C.loopSpec(cursor.set, { auto: st.auto })
  const r = renderFor(spec)
  const k = cursor.bar
  const pcm = mix.bar(r, k)
  const id = nextId++
  const file = path.join(BARS, `bar-${id % 64}.f32`)
  fs.writeFileSync(file, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength))
  send({ op: 'queue', id, file })
  segs.set(id, { before, view: viewOf(cursor.set, k, spec), ms: (pcm.length / 2 / 44100) * 1000, t: 0 })
  lastQueued = id
  cursor.bar++
  if (cursor.bar === 8) {
    cursor.bar = 0
    C.afterLoop(cursor.set, { auto: st.auto, nextTrack: takeNext })
  }
  for (const old of segs.keys()) if (old < playingId - 8) segs.delete(old)
  // render the next loop now, so its first bar does not wait
  if (k === 3) setImmediate(() => {
    const ahead = { set: structuredClone(cursor.set), bar: 0 }
    C.afterLoop(ahead.set, { auto: st.auto, nextTrack: peekNext })
    try { renderFor(C.loopSpec(ahead.set, { auto: st.auto })) } catch (err) { log('prerender: ' + err.message) }
  })
}

function feed() {
  if (!st.playing || cutting || !helper) return
  while (lastQueued - playingId < AHEAD) queueBar()
}

function onHelper(m) {
  if (m.ev === 'start') {
    playingId = m.id
    const s = segs.get(m.id)
    if (s) s.t = m.t
    feed()
    const v = s?.view
    if (v && (v.bar === 0)) { sendInfo(v); st.rev++ }
  } else if (m.ev === 'cut') {
    // everything after `keep` is gone: queue again from there, with the edits
    const after = [...segs.keys()].filter((id) => id > m.keep).sort((a, b) => a - b)
    if (after.length) cursor = snap(segs.get(after[0]).before)
    for (const id of after) segs.delete(id)
    lastQueued = Math.max(m.keep, playingId)
    nextId = Math.max(nextId, lastQueued + 1)
    for (const fn of pending) fn(cursor.set)
    pending = []
    cutting = false
    persist()
    feed()
  } else if (m.ev === 'starve') {
    log('starved')
    feed()
  } else if (m.ev === 'key') {
    log('key ' + m.key)
    if (m.key === 'toggle') st.playing ? pause() : play()
    else if (m.key === 'play') play()
    else if (m.key === 'pause') pause()
    else if (m.key === 'next') st.auto ? skip() : edit((set) => C.stepOn(set, takeNext))
    else if (m.key === 'prev') prev()
    st.said = 'key: ' + m.key
    persist()
  }
}

function sendInfo(v = segs.get(playingId)?.view ?? viewOf(cursor.set, 0, C.loopSpec(cursor.set, { auto: st.auto }))) {
  send({ op: 'info', title: v.phrase, artist: `techno · ${v.mood} · ${v.name}` })
}

// A change to the set. While music plays it lands on the next bar: the queued
// bars are dropped and rendered again with the change.
const undos = []
function edit(fn, { undoable = true } = {}) {
  if (undoable) { undos.push(structuredClone(st.playing && !cutting ? (segs.get(playingId + 1)?.before.set ?? cursor.set) : cursor.set)); if (undos.length > 30) undos.shift() }
  if (!st.playing) { fn(cursor.set); persist(); return }
  pending.push(fn)
  if (!cutting) { cutting = true; send({ op: 'cut' }) }
}

function play() {
  if (st.playing) return
  st.playing = true
  mix = C.mixer()
  send({ op: 'play' })
  sendInfo()
  feed()
  persist()
}

function pause() {
  if (!st.playing) return
  // resume from the bar after the one you heard last
  const after = segs.get(playingId + 1)?.before
  if (after) cursor = snap(after)
  st.playing = false
  send({ op: 'pause' })
  segs.clear()
  playingId = lastQueued = nextId - 1
  cutting = false
  pending = []
  persist()
}

// ---------- which track comes next ----------

function candidates() {
  if (st.playlist === 'favorites' && st.favorites.length) return st.favorites.map((f) => f.code)
  const all = [...st.pool.map((p) => idOf(E.trackFor(p))), ...st.favorites.map((f) => f.code), ...STARTERS.map((p) => idOf(E.trackFor(p)))]
  return all.filter((c, i) => all.indexOf(c) === i)
}

function peekNext() {
  const list = candidates()
  const here = cursor.set.track.phrase
  const name = (c) => E.parseCode(c)?.phrase
  const recent = new Set(st.history.slice(-3).map(name))
  let i = list.findIndex((c) => name(c) === here)
  for (let n = 0; n < list.length; n++) {
    i = (i + 1) % list.length
    if (name(list[i]) !== here && (st.playlist === 'favorites' || !recent.has(name(list[i])))) return E.parseCode(list[i])
  }
  return E.trackFor(STARTERS[Math.floor(Math.random() * STARTERS.length)])
}

function remember(t) {
  const id = idOf(t)
  st.history = [...st.history.filter((c) => c !== id), id].slice(-30)
}

function takeNext() {
  remember(cursor.set.track)
  return peekNext()
}

// Jump to a track: it starts from its beginning, on the next bar (Ruslan,
// 2026-10-04: "new track didn't start from the beginning"). Only the auto
// handover after an outro brings the next track in at its build.
function jumpTo(track) {
  edit((set) => {
    remember(set.track)
    Object.assign(set, C.newSet(E.atPart(E.cleanTrack(track), 0)), { handover: null, swapped: null })
  })
}

function skip() {
  edit((set) => {
    const next = set.handover ? set.track : takeNext()
    Object.assign(set, C.newSet(E.atPart(E.cleanTrack(next), 0)), { handover: null, swapped: null })
  })
}

function prev() {
  const here = idOf(cursor.set.track)
  const back = [...st.history].reverse().find((c) => c !== here)
  if (!back) return
  st.history = st.history.filter((c) => c !== back)
  jumpTo(E.parseCode(back))
  st.said = 'back to ' + E.parseCode(back).phrase
}

// ---------- commands ----------

const target = (set) => set.track
function changeTrack(fn) {
  edit((set) => { set.track = E.cleanTrack(fn({ ...target(set), layers: { ...target(set).layers }, steps: { ...target(set).steps } })) })
}

// The song tab: remove a part, add a suggested one, or go back to the plan
// as written. The set keeps its place in the plan.
function planEdit(set, c) {
  let plan = E.planOf(set.track), at = C.posOf(set)
  if (c.kind === 'plan-remove') {
    const k = Number(c.k)
    if (!(k >= 0 && k < plan.length) || plan.length <= 2 || (k === at && !set.handover)) return
    plan = plan.filter((_, i) => i !== k)
    if (k < at) at--
  } else if (c.kind === 'plan-add') {
    const r = E.planAdd(set.track, c.id)
    if (!r.count) return
    plan = r.plan
    if (r.at <= at) at += r.count
  } else if (c.kind === 'plan-reset') {
    plan = E.planOf({})
    at = Math.max(0, plan.indexOf(set.track.part))
  }
  set.track = E.cleanTrack({ ...set.track, plan })
  if (!set.handover) set.at = at
}

// What the pane says after an edit from the card.
function editSaid(c) {
  const n = c.layer === 'acid' ? 'melody' : c.layer
  switch (c.kind) {
    case 'inst': return n + ': ' + (E.INSTRUMENTS[c.layer]?.[c.value] ?? '')
    case 'pattern': return n + ': ' + c.name
    case 'note': return n + ': note moved'
    case 'suggest-notes': return n + ': new notes'
    case 'tone': return n + ': tone'
    case 'master': return 'master'
    case 'plan-remove': return 'part removed'
    case 'plan-add': return 'part added'
    case 'plan-reset': return 'the song as written'
    default: return n + ' as written'
  }
}

function command(c) {
  switch (c.op) {
    case 'play': play(); break
    case 'pause': pause(); break
    case 'toggle': st.playing ? pause() : play(); break
    case 'auto': st.auto = c.on ?? !st.auto; st.said = 'auto ' + (st.auto ? 'on' : 'off'); if (st.auto && !st.playing) play(); break
    case 'next': edit((set) => C.stepOn(set, takeNext)); st.said = 'next part'; break
    case 'skip': skip(); st.said = 'next track'; break
    case 'prev': prev(); break
    case 'pick': {
      const t = E.parseCode(c.code) ?? E.trackFor(c.code)
      if (c.playlist !== undefined) st.playlist = c.playlist
      jumpTo(t)
      st.said = 'now playing: ' + t.phrase
      if (!st.playing) play()
      break
    }
    case 'jam': changeTrack((t) => {
      let x = t
      if (c.mood) x = E.withVibe(x, c.mood)
      for (const k of ['bpm', 'energy', 'swing', 'transpose']) if (c[k] !== undefined) x[k] = c[k]
      if (c.dice) x.dice = (x.dice + 1) % 1000
      for (const [name, v] of Object.entries(c.layers ?? {})) {
        if (!E.LAYERS.includes(name)) continue
        if (v === 'auto') delete x.layers[name]
        else x.layers[name] = v === true
      }
      return x
    }); if (c.note) st.said = String(c.note).slice(0, 80); break
    case 'layer': changeTrack((t) => {
      const want = !E.activeLayers(t)[c.name]
      delete t.layers[c.name]
      if (E.activeLayers(t)[c.name] !== want) t.layers[c.name] = want
      return t
    }); st.said = c.name + ' toggled'; break
    case 'step': changeTrack((t) => E.toggleStep(t, c.layer, c.i)); st.said = c.layer + ' step edited'; break
    case 'edit':
      if (String(c.kind).startsWith('plan')) edit((set) => planEdit(set, c))
      else changeTrack((t) => E.editTrack(t, { ...c, seed: c.seed ?? Date.now() % 100000 }))
      st.said = editSaid(c)
      break
    case 'dice': changeTrack((t) => ({ ...t, dice: (t.dice + 1) % 1000 })); st.said = 'new rhythm'; break
    case 'undo': {
      const back = undos.pop()
      if (back) { edit((set) => Object.assign(set, back), { undoable: false }); st.said = 'undo' }
      break
    }
    case 'fav': {
      const t = c.code ? E.parseCode(c.code) : (segs.get(playingId)?.view ? E.parseCode(segs.get(playingId).view.id) : cursor.set.track)
      if (!t) break
      const id = idOf(t)
      if (st.favorites.some((f) => f.code === id)) { st.favorites = st.favorites.filter((f) => f.code !== id); st.said = 'removed from favorites' }
      else { st.favorites = [labelOf(t), ...st.favorites]; st.said = '♥ ' + t.phrase }
      break
    }
    case 'playlist': st.playlist = c.name ?? null; if (st.playlist === 'favorites' && st.favorites.length) { command({ op: 'pick', code: st.favorites[0].code }); st.auto = true } break
    case 'hello': {
      for (const p of c.repo ?? []) if (typeof p === 'string' && !st.pool.includes(p)) st.pool.push(p)
      // the first chat on 0.8 brings the tracks kept before
      if (!st.imported && Array.isArray(c.saved)) {
        for (const it of c.saved) { const t = E.parseCode(it.code); if (t && !st.favorites.some((f) => f.code === idOf(t))) st.favorites.push(labelOf(t)) }
        if (c.track) { const t = E.parseCode(c.track); if (t) cursor = { set: C.newSet(t), bar: 0 } }
        st.imported = true
      }
      break
    }
    case 'quit': quit('asked by a chat'); break
  }
  persist()
  return stateOut()
}

function stateOut() {
  const s = segs.get(playingId)
  const v = (st.playing && s?.view) || viewOf(cursor.set, cursor.bar % 8, C.loopSpec(cursor.set, { auto: st.auto }))
  const barMs = s?.ms ?? (60 / cursor.set.track.bpm) * 4 * 1000
  const now = Date.now()
  let nextInMs = null
  if (st.playing && st.auto && s?.t) nextInMs = Math.max(0, s.t + barMs - now) + (7 - v.bar) * barMs + (v.loopsLeft - 1) * 8 * barMs
  const fav = st.favorites.some((f) => f.code === v.id)
  const recent = [...st.history].reverse().slice(0, 8).map((c) => { const t = E.parseCode(c); return t ? labelOf(t) : null }).filter(Boolean)
  return { version: VERSION, rev: st.rev, now, playing: st.playing, auto: st.auto, playlist: st.playlist, view: v, barStartedAt: s?.t ?? 0, barMs, stepMs: barMs / 16, nextInMs, fav, favorites: st.favorites, recent, said: st.said, canUndo: undos.length > 0 }
}

// ---------- the socket ----------

const server = http.createServer((req, res) => {
  const reply = (obj) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)) }
  if (req.method === 'GET') return reply(stateOut())
  let body = ''
  req.on('data', (d) => { body += d })
  req.on('end', () => {
    try { reply(command(JSON.parse(body || '{}'))) } catch (err) { log('command failed: ' + err.stack); res.writeHead(500); res.end(JSON.stringify({ error: String(err.message) })) }
  })
})

let quitting = false
function quit(why) {
  if (quitting) return
  quitting = true
  log('quit: ' + why)
  clearTimeout(saveTimer)
  try { fs.writeFileSync(STATE_FILE, JSON.stringify({ auto: st.auto, playlist: st.playlist, favorites: st.favorites, history: st.history.slice(-30), pool: st.pool.slice(-40), imported: st.imported, track: E.encodeCode(cursor.set.track) }, null, 1)) } catch { /* best effort */ }
  send({ op: 'quit' })
  server.close()
  try { fs.unlinkSync(SOCK) } catch { /* gone */ }
  setTimeout(() => process.exit(0), 200)
}

// Another player already answers on the socket: leave it be.
async function alreadyRunning() {
  if (!fs.existsSync(SOCK)) return false
  return new Promise((resolve) => {
    const req = http.get({ socketPath: SOCK, path: '/state', timeout: 1500 }, (res) => { res.resume(); resolve(true) })
    req.on('error', () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
  })
}

if (await alreadyRunning()) { log('another player runs, exiting'); process.exit(0) }
try { fs.unlinkSync(SOCK) } catch { /* none */ }
// the players of 0.7 (ffplay per chat) stop here
try { execFileSync('pkill', ['-f', 'ffplay .*Library/Caches/techno/loop-']) } catch { /* none running */ }
buildHelper()
startHelper()
server.listen(SOCK, () => log('listening, pid ' + process.pid))
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(sig, () => quit(sig))

// No Claude Code left (desktop chats are .../MacOS/claude, the CLI lives in
// .../share/claude/versions/): the music stops with it.
let lonely = 0
setInterval(() => {
  execFile('pgrep', ['-f', '/MacOS/claude|/share/claude/versions/'], (err) => {
    lonely = err ? lonely + 1 : 0
    if (lonely >= 2) quit('no Claude Code left')
  })
}, 5000)
