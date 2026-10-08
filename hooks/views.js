// The app's screens, drawn in the band above the chat box. Pure functions:
// they get the element table (`ui`), a view model (`vm`) and the click
// handlers (`act`), and return a tree. No mods API here; register.js owns
// the calls to the player.
//
// Layout A with the part bar (Ruslan, 2026-10-04): one line on top (previous,
// play and next track side by side, the track, favorite, share, the volume;
// auto and hide on the right), the part bar with the section, the mood and
// the tempo, the grid, one line under it (mood, tempo, next part, edit, favorites), and the edit card
// when edit is open.
// Three screens: the deck, the favorites (with the tracks you heard), and new
// tracks.
//
// A selected thing (the mood, auto on) is a filled primary button, not
// brighter text: dim against normal text cannot be read in the light theme.

import { sectionLabel } from './conductor.js'

const row = (ui, children, extra = {}) => ui.Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: 1, alignItems: 'center', children: children.filter(Boolean), ...extra })
const col = (ui, children, extra = {}) => ui.Box({ flexDirection: 'column', children: children.filter(Boolean), ...extra })
const dim = (ui, text, extra = {}) => ui.Text({ dimColor: true, children: [text], ...extra })
const spread = (ui, left, right, key) => ui.Box({ key, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', columnGap: 2, children: [row(ui, left), row(ui, right)] })

// A button that is on or off: on is the filled primary button.
const toggle = (ui, key, label, isOn, onPress, extra = {}) => ui.Button({ key, label, onPress, ...(isOn ? { variant: 'primary' } : {}), ...extra })
const link = (ui, key, label, onPress) => ui.Button({ key, label, plain: true, dimColor: true, onPress })
const clock = (ms) => { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') }

// The transport, shared by the deck and the bar: previous, play or stop,
// next track, then the track, its heart and share, and the volume (Ruslan,
// 2026-10-05, option B: "remove dark and 132 bpm ... move it down"; the mood
// and the tempo sit in the bottom line now).
function transport(ui, vm, act, prefix) {
  const v = vm.view
  return [
    vm.recent.length ? ui.Button({ key: prefix + 'prev', label: '⏮', onPress: () => act.prev() }) : null,
    toggle(ui, prefix + 'play', vm.playing ? '■ stop' : '▶ play', !vm.playing, () => (vm.playing ? act.stop() : act.play()), prefix ? {} : { hotkey: 'p' }),
    ui.Button({ key: prefix + 'skip', label: '⏭', onPress: () => act.skip() }),
    ui.Text({ bold: true, wrap: 'truncate-end', children: [v.phrase] }),
    ui.Button({ key: prefix + 'fav', label: vm.fav ? '♥' : '♡', plain: true, onPress: () => act.fav() }),
    // the word, not an arrow (Ruslan, 2026-10-05, option B of arrow / word / under the grid)
    ui.Button({ key: prefix + 'share', label: 'share', onPress: () => act.copy() }),
    volume(ui, vm, act, prefix),
  ]
}

// The volume as one value (Ruslan, 2026-10-05, option B of digit, percent,
// one bar: "let's keep volume as %"): `vol − 80% +`, 0 to 100 in steps of 20.
// − and + step it; muted reads `off`; a click on `vol` mutes and brings back
// the default.
function volume(ui, vm, act, prefix) {
  const level = vm.volume ?? 4
  return ui.Box({ key: prefix + 'volume', flexDirection: 'row', flexShrink: 0, columnGap: 1, children: [
    ui.Button({ key: prefix + 'vol-mute', label: 'vol', plain: true, dimColor: true, onPress: () => act.volume(level ? 0 : 4) }),
    ui.Button({ key: prefix + 'vol-down', label: '−', plain: true, dimColor: !level, onPress: () => act.volume(Math.max(0, level - 1)) }),
    ui.Text({ key: prefix + 'vol-value', bold: !!level, dimColor: !level, children: [level ? level * 20 + '%' : 'off'] }),
    ui.Button({ key: prefix + 'vol-up', label: '+', plain: true, dimColor: level === 5, onPress: () => act.volume(Math.min(5, level + 1)) }),
  ] })
}

function topLine(ui, vm, act) {
  return spread(ui, transport(ui, vm, act, ''), [
    toggle(ui, 'auto', vm.auto ? '● auto' : '○ auto', vm.auto, () => act.auto(), { hotkey: 'a' }),
    ui.Button({ key: 'close', label: 'hide', role: 'dismiss', plain: true, dimColor: true, onPress: () => act.close() }),
  ], 'top')
}

// Where the song is, option A (Ruslan, 2026-10-04: "inline bar, one line,
// the part name after the bar"; the section words were "too many words"):
// one block per loop (about 15 s), so a block is the same time everywhere and
// the bar agrees with the clock. The part that plays is in the accent, ▰ for
// what of it played and ▱ for what is left of it (how long until the next
// part); played parts ▰, the rest ▱ dim. Then the part's name and the time.
export function partBar(parts, pos) {
  let from = 0
  return parts.flatMap((p) => {
    const cells = Array.from({ length: p.loops }, (_, i) => {
      const part = pos >= from + p.loops ? 'played' : pos >= from ? 'now' : 'next'
      return part === 'now' ? (pos >= from + i + 1 ? 'now-played' : 'now-left') : part
    })
    from += p.loops
    return cells
  })
}

function whereLine(ui, vm) {
  const v = vm.view, w = vm.where
  if (!w) return null
  const cells = partBar(w.parts, w.pos)
  const runs = []
  for (const c of cells) { const last = runs[runs.length - 1]; if (last && last.c === c) last.n++; else runs.push({ c, n: 1 }) }
  const look = {
    played: (n) => ui.Text({ children: ['▰'.repeat(n)] }),
    'now-played': (n) => ui.Text({ color: 'claude', bold: true, children: ['▰'.repeat(n)] }),
    'now-left': (n) => ui.Text({ color: 'claude', children: ['▱'.repeat(n)] }),
    next: (n) => dim(ui, '▱'.repeat(n)),
  }
  return row(ui, [
    ui.Box({ key: 'bar', flexDirection: 'row', flexShrink: 0, children: runs.map((r, i) => ({ ...look[r.c](r.n), key: 'run-' + i })) }),
    ui.Text({ color: 'claude', bold: true, children: [sectionLabel(v)] }),
    v.from ? dim(ui, '← from ' + v.from, { wrap: 'truncate-end' }) : null,
    dim(ui, '· ' + clock(w.elapsed) + ' / ' + clock(w.total)),
  ], { key: 'where', columnGap: 1 })
}

// The mood and the tempo, under the song's progress and over the grid
// (Ruslan, 2026-10-05: "progress of the song ... under it the mood, then
// the grid").
function moodLine(ui, vm, act) {
  return row(ui, [
    dim(ui, 'mood'),
    ...['sad', 'mysterious', 'dark'].map((name) => toggle(ui, 'mood-' + name, name, vm.view.mood === name, () => act.mood(name))),
    dim(ui, vm.view.bpm + ' bpm', { key: 'bpm' }),
  ], { key: 'mood' })
}

function bottomLine(ui, vm, act) {
  return spread(ui, [
    ui.Button({ key: 'new-song', label: '+ new song', onPress: () => act.screen('crate') }),
  ], [
    vm.auto ? null : ui.Button({ key: 'next', label: 'next part ›', onPress: () => act.next(), hotkey: 'n' }),
    toggle(ui, 'edit', 'edit', vm.editOpen, () => act.edit(), { hotkey: 'e' }),
    ui.Button({ key: 'favorites', label: '♥ favorites ' + vm.favorites.length, onPress: () => act.screen('favorites') }),
  ], 'bottom')
}

// The edit card, layout B (Ruslan, 2026-10-04): tabs for the sounds that
// play, + sound, song and master; one short card for the tab you are on.
// Every change goes to the player as { op: 'edit', kind, ... } (editTrack).
const SOUND_TABS = ['kick', 'bass', 'hats', 'rumble', 'clap', 'perc', 'ride', 'pad', 'acid']
const tabName = (n) => (n === 'acid' ? 'melody' : n)
const CUT_WORDS = ['muffled', 'dark', 'warm', 'as is', 'clear', 'bright', 'thin']
const GRIT_WORDS = ['clean', 'warm', 'driven', 'crushed']
const LP_WORDS = ['closed', 'dark', 'soft', 'open']
const HP_WORDS = ['full', 'lighter', 'thin', 'tiny']
const SPACE_WORDS = ['dry', 'tight', 'as is', 'wide', 'huge']
const label = (ui, text) => ui.Box({ width: 8, flexShrink: 0, children: [dim(ui, text)] })
const line = (ui, key, name, children) => ui.Box({ key, flexDirection: 'row', alignItems: 'center', columnGap: 1, children: [label(ui, name), row(ui, children)] })
const stepper = (ui, key, words, i, onMinus, onPlus) => [
  ui.Button({ key: key + '-down', label: '−', onPress: onMinus }),
  ui.Box({ width: Math.max(...words.map((w) => w.length)), justifyContent: 'center', children: [ui.Text({ bold: true, children: [words[i]] })] }),
  ui.Button({ key: key + '-up', label: '+', onPress: onPlus }),
]

function editTabs(ui, vm, act) {
  const tabs = SOUND_TABS.filter((n) => vm.heard[n] || n === vm.editTab)
  return spread(ui, [
    ...tabs.map((n) => toggle(ui, 'tab-' + n, tabName(n), vm.editTab === n, () => act.editTab(n))),
    toggle(ui, 'tab-add', '+ sound', vm.editTab === 'add', () => act.editTab('add')),
    dim(ui, '│'),
    toggle(ui, 'tab-song', 'song', vm.editTab === 'song', () => act.editTab('song')),
    toggle(ui, 'tab-master', 'master', vm.editTab === 'master', () => act.editTab('master')),
  ], [
    vm.canUndo ? ui.Button({ key: 'undo', label: '↶ undo', onPress: () => act.undo(), hotkey: 'u' }) : null,
    ui.Button({ key: 'save-mp3', label: '↓ mp3', onPress: () => act.share() }),
    ui.Button({ key: 'edit-done', label: 'done', onPress: () => act.edit() }),
  ], 'edit-tabs')
}

function soundCard(ui, vm, act) {
  const x = vm.info, L = x.layer
  const tweak = (e) => () => act.tweak({ layer: L, ...e })
  const rows = []
  rows.push(line(ui, 'ed-sound', 'sound', x.insts.length
    ? x.insts.map((it) => toggle(ui, 'inst-' + L + '-' + it.name, it.name, it.name === x.inst, tweak({ kind: 'inst', value: it.value })))
    : [dim(ui, L === 'rumble' ? 'the kick through a long dark room' : L === 'pad' ? 'a dark chord, one swell a loop' : 'one sound')]))
  rows.push(line(ui, 'ed-pattern', 'pattern', x.presets.length
    ? [dim(ui, 'try:'), ...x.presets.map((p) => toggle(ui, 'pat-' + L + '-' + p.name, p.name, p.on, tweak({ kind: 'pattern', name: p.name }))), x.edited ? link(ui, 'pat-reset-' + L, 'as written', tweak({ kind: 'reset-pattern' })) : null, dim(ui, '· or click the grid')]
    : [dim(ui, L === 'rumble' ? 'follows the kick' : 'one long swell')]))
  if (x.notes) {
    rows.push(line(ui, 'ed-notes', 'notes', [
      ...x.notes.map((n, i) => (n ? ui.Button({ key: 'note-' + L + '-' + i, label: n, onPress: tweak({ kind: 'note', i }) }) : dim(ui, '·', { key: 'rest-' + L + '-' + i }))),
      ui.Button({ key: 'notes-suggest-' + L, label: '⚄ suggest', onPress: tweak({ kind: 'suggest-notes' }) }),
      x.notesEdited ? link(ui, 'notes-reset-' + L, 'as written', tweak({ kind: 'reset-notes' })) : null,
    ]))
    rows.push(line(ui, 'ed-scale', '', [dim(ui, 'scale ' + x.scale.join(' ') + ' · tap a note to move it up the scale')]))
  }
  if (x.hasTone) rows.push(line(ui, 'ed-tone', 'tone', [
    ...stepper(ui, 'cut-' + L, CUT_WORDS, x.tone[0] + 3, tweak({ kind: 'tone', cut: -1 }), tweak({ kind: 'tone', cut: 1 })),
    dim(ui, '·'), dim(ui, 'grit'),
    ...stepper(ui, 'grit-' + L, GRIT_WORDS, x.tone[1], tweak({ kind: 'tone', grit: -1 }), tweak({ kind: 'tone', grit: 1 })),
    dim(ui, '·'),
    ui.Button({ key: 'mute-' + L, label: vm.heard[L] ? 'mute' : 'play it', onPress: () => act.layer(L) }),
  ]))
  return rows
}

function masterCard(ui, vm, act) {
  const m = vm.master
  const tw = (e) => () => act.tweak({ kind: 'master', ...e })
  return [
    line(ui, 'ed-lp', 'filter', [...stepper(ui, 'lp', LP_WORDS, m[0] + 3, tw({ lp: -1 }), tw({ lp: 1 })), dim(ui, '· close it for a muffled, far away sound')]),
    line(ui, 'ed-hp', 'low cut', [...stepper(ui, 'hp', HP_WORDS, m[1], tw({ hp: -1 }), tw({ hp: 1 })), dim(ui, '· take the low end out')]),
    line(ui, 'ed-space', 'space', [...stepper(ui, 'space', SPACE_WORDS, m[2] + 2, tw({ space: -1 }), tw({ space: 1 })), dim(ui, '· the room around it')]),
    line(ui, 'ed-tempo', 'tempo', [ui.Button({ key: 'slower', label: '−', onPress: () => act.bpm(-2) }), ui.Text({ bold: true, children: [vm.view.bpm + ' bpm'] }), ui.Button({ key: 'faster', label: '+', onPress: () => act.bpm(2) }), m[0] || m[1] || m[2] ? link(ui, 'master-reset', 'as written', tw({ reset: true })) : null]),
  ]
}

function addCard(ui, vm, act) {
  const absent = SOUND_TABS.filter((n) => !vm.heard[n])
  return [line(ui, 'ed-add', 'add', absent.length ? absent.map((n) => ui.Button({ key: 'add-' + n, label: '+ ' + tabName(n), onPress: () => { act.layer(n); act.editTab(n) } })) : [dim(ui, 'every sound plays')])]
}

// The song: its parts in order (× takes one out; not the one that plays),
// the parts to add (★ the recommended one), and a new rhythm.
function songCard(ui, vm, act) {
  const tw = (e) => () => act.tweak(e)
  return [
    line(ui, 'ed-parts', 'parts', vm.plan.flatMap((p) => [
      p.now ? ui.Text({ key: 'part-' + p.k, color: 'claude', bold: true, children: [p.name] }) : ui.Text({ key: 'part-' + p.k, children: [p.name] }),
      p.now || vm.plan.length <= 2 ? null : link(ui, 'part-x-' + p.k, '×', tw({ kind: 'plan-remove', k: p.k })),
    ].filter(Boolean))),
    line(ui, 'ed-add-part', 'add', [
      ...vm.planAdds.map((a) => ui.Button({ key: 'part-add-' + a.id, label: '+ ' + a.label + (a.best ? ' ★' : ''), onPress: tw({ kind: 'plan-add', id: a.id }) })),
      vm.planEdited ? link(ui, 'plan-reset', 'as written', tw({ kind: 'plan-reset' })) : null,
    ]),
    line(ui, 'ed-rhythm', 'rhythm', [ui.Button({ key: 'dice', label: '⚄ new rhythm', onPress: () => act.dice(), hotkey: 'd' }), dim(ui, '· new patterns from the same name')]),
  ]
}

function editCard(ui, vm, act) {
  const body = vm.editTab === 'master' ? masterCard(ui, vm, act) : vm.editTab === 'song' ? songCard(ui, vm, act) : vm.editTab === 'add' ? addCard(ui, vm, act) : vm.info ? soundCard(ui, vm, act) : []
  return col(ui, [editTabs(ui, vm, act), ...body], { key: 'edit-card', borderStyle: 'single', borderDimColor: true, paddingX: 1 })
}

const talkLine = (ui, vm) => (vm.said || vm.you ? row(ui, [vm.you ? dim(ui, 'you: ' + vm.you, { wrap: 'truncate-end' }) : null, vm.said ? ui.Text({ wrap: 'truncate-end', children: ['› ' + vm.said] }) : null], { key: 'talk', columnGap: 2 }) : null)

function deck(ui, vm, act) {
  return [
    topLine(ui, vm, act),
    whereLine(ui, vm),
    moodLine(ui, vm, act),
    vm.gridEl,
    bottomLine(ui, vm, act),
    vm.editOpen ? editCard(ui, vm, act) : null,
    talkLine(ui, vm),
  ]
}

// The favorites, the tracks you heard (to find a lost one), and a way back.
function trackRow(ui, vm, act, it, { isFav, prefix }) {
  const here = vm.view?.id === it.code
  return row(ui, [
    toggle(ui, prefix + 'play-' + it.code, here ? '▶ ' + it.label : it.label, here, () => (isFav ? act.playFavorite(it.code) : act.pick(it.code))),
    dim(ui, it.mood + ' · ' + it.bpm),
    isFav ? link(ui, prefix + 'share-' + it.code, 'copy line', () => act.copy(it.code)) : null,
    isFav ? link(ui, prefix + 'rm-' + it.code, 'remove', () => act.toggleFav(it.code)) : link(ui, prefix + 'fav-' + it.code, '♡ keep', () => act.toggleFav(it.code)),
  ], { key: prefix + it.code, columnGap: 2 })
}

function favorites(ui, vm, act) {
  const favCodes = new Set(vm.favorites.map((f) => f.code))
  const recent = vm.recent.filter((r) => !favCodes.has(r.code))
  return [
    spread(ui, [ui.Text({ bold: true, children: ['♥ favorites'] }), dim(ui, vm.favorites.length + ' tracks')], [
      vm.favorites.length ? toggle(ui, 'play-all', vm.playlist === 'favorites' ? '● playing them in turn' : '▶ play them in turn', vm.playlist === 'favorites', () => act.playFavorites()) : null,
      link(ui, 'to-crate', 'new song', () => act.screen('crate')),
      link(ui, 'back', '‹ back', () => act.screen('deck')),
    ], 'fav-top'),
    vm.favorites.length ? null : dim(ui, 'Press ♡ while a track plays to keep it here.'),
    ...vm.favorites.map((it) => trackRow(ui, vm, act, it, { isFav: true, prefix: 'f-' })),
    recent.length ? dim(ui, 'heard before', { key: 'heard' }) : null,
    ...recent.map((it) => trackRow(ui, vm, act, it, { isFav: false, prefix: 'h-' })),
  ]
}

// New song, option B (Ruslan, 2026-10-08: "B is the best but user can just
// click on 1 2 3 etc or type themselves"): the name box first, with one
// example of what a name gives; under it your recent chats and a few
// classics, numbered. A click or the digit (in an empty chat box) plays one.
const ago = (ms) => {
  const m = Math.max(1, Math.round(ms / 60000))
  if (m < 60) return m + ' min ago'
  const h = Math.round(m / 60)
  if (h < 24) return h + ' h ago'
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : d + ' d ago'
}

function numbered(ui, act, key, n, phrase, meta) {
  return ui.Box({ key, flexDirection: 'row', columnGap: 2, children: [
    ui.Box({ flexShrink: 1, children: [ui.Button({ key: key + '-play', label: phrase, plain: true, hotkey: String(n), onPress: () => act.pick(phrase) })] }),
    meta ? dim(ui, meta, { key: key + '-meta', wrap: 'truncate-end' }) : null,
  ].filter(Boolean) })
}

function crate(ui, vm, act) {
  const { chats, classics, example, now } = vm.crate
  let n = 0
  const chatRows = chats.map((c) => numbered(ui, act, 'chat-' + c.phrase, ++n, c.phrase, [c.project, ago(now - c.at)].filter(Boolean).join(' · ')))
  const classicRows = classics.map((p) => numbered(ui, act, 'classic-' + p, ++n, p, ''))
  return [
    spread(ui, [ui.Text({ bold: true, children: ['new song'] }), dim(ui, `· type a name, get a song: "${example.phrase}" plays ${example.mood}, ${example.bpm} bpm`, { wrap: 'truncate-end' })], [link(ui, 'back', '‹ back', () => act.screen('deck'))], 'crate-top'),
    ui.Input({ key: 'phrase', label: 'name', placeholder: 'type any name…', value: '', submitLabel: 'play', onSubmit: (v) => act.phrase(v) }),
    ui.Box({ key: 'lists', flexDirection: 'row', flexWrap: 'wrap', columnGap: 4, marginTop: 1, children: [
      chats.length ? col(ui, [dim(ui, 'or press a number · your recent chats', { key: 'chats-head' }), ...chatRows], { key: 'chats', width: '58%', minWidth: 34, flexGrow: 1 }) : null,
      col(ui, [
        ui.Box({ key: 'classics-head', flexDirection: 'row', columnGap: 2, children: [dim(ui, chats.length ? 'classics' : 'or press a number · classics'), link(ui, 'classics-more', '⚄ others', () => act.moreClassics())] }),
        ...classicRows,
      ], { key: 'classics', minWidth: 26, flexGrow: 1 }),
    ].filter(Boolean) }),
  ]
}

function down(ui, vm, act) {
  return [
    spread(ui, [ui.Text({ bold: true, children: ['♪ techno'] }), dim(ui, vm.down || 'starting the player…')], [
      ui.Button({ key: 'retry', label: 'try again', onPress: () => act.retry() }),
      ui.Button({ key: 'close', label: 'hide', role: 'dismiss', plain: true, dimColor: true, onPress: () => act.close() }),
    ], 'down'),
  ]
}

// A new version on GitHub: one line with an update button (Ruslan,
// 2026-10-08: "just give an update ready ... maybe we build a button").
function updateLine(ui, vm, act) {
  const u = vm.update
  if (!u) return null
  const say = {
    ready: [ui.Text({ color: 'claude', bold: true, children: ['techno ' + u.latest + ' is ready'] }), ui.Button({ key: 'update', label: 'update', variant: 'primary', onPress: () => act.update() })],
    working: [dim(ui, 'updating to ' + u.latest + '…')],
    done: [ui.Text({ color: 'claude', bold: true, children: ['✓ updated to ' + u.latest] }), dim(ui, '· open a new chat to use it')],
    failed: [ui.Text({ children: ['the update failed: ' + (u.why || 'unknown')] }), ui.Button({ key: 'update', label: 'try again', onPress: () => act.update() })],
  }[u.state]
  return row(ui, say, { key: 'update-line' })
}

export function appView(ui, vm, act) {
  const body = !vm.view ? down(ui, vm, act) : vm.screen === 'favorites' ? favorites(ui, vm, act) : vm.screen === 'crate' ? crate(ui, vm, act) : deck(ui, vm, act)
  return col(ui, [...body, updateLine(ui, vm, act), vm.status ? dim(ui, vm.status, { key: 'status', wrap: 'truncate-end' }) : null], { borderStyle: 'round', paddingX: 1 })
}

// The bar above the chat box while the app is hidden: the same transport as
// the deck (no section word: "i don't want to see these intro drop 1 at all
// here"), then auto, open and × on the right.
export function miniView(ui, vm, act) {
  if (!vm.view) return spread(ui, [ui.Text({ bold: true, children: ['♪'] }), dim(ui, vm.down || 'starting the player…')], [link(ui, 'mini-close', '×', () => act.closeBar())], 'mini')
  const v = vm.view
  return spread(ui, [
    ui.Text({ bold: true, children: ['♪'] }),
    ...transport(ui, vm, act, 'mini-'),
  ], [
    vm.update?.state === 'ready' ? ui.Button({ key: 'mini-update', label: '↑ update', variant: 'primary', onPress: () => act.update() }) : null,
    vm.update?.state === 'done' ? dim(ui, '✓ updated · new chat') : null,
    toggle(ui, 'mini-auto', vm.auto ? '● auto' : '○ auto', vm.auto, () => act.auto()),
    link(ui, 'mini-open', 'open', () => act.open()),
    link(ui, 'mini-close', '×', () => act.closeBar()),
  ], 'mini')
}
