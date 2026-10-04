// The app's screens, drawn in the band above the chat box. Pure functions:
// they get the element table (`ui`), a view model (`vm`) and the click
// handlers (`act`), and return a tree. No mods API here; register.js owns
// the calls to the player.
//
// Layout A with the skyline (Ruslan, 2026-10-04): one line on top (previous,
// play and next track side by side, the track, favorite, mood and tempo; auto
// and hide on the right), the skyline of the set, the grid, one line under it
// (mood, next part, edit, favorites), and the edit line when edit is open.
// Three screens: the deck, the favorites (with the tracks you heard), and new
// tracks.
//
// A selected thing (the mood, auto on) is a filled primary button, not
// brighter text: dim against normal text cannot be read in the light theme.

const row = (ui, children, extra = {}) => ui.Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: 1, alignItems: 'center', children: children.filter(Boolean), ...extra })
const col = (ui, children, extra = {}) => ui.Box({ flexDirection: 'column', children: children.filter(Boolean), ...extra })
const dim = (ui, text, extra = {}) => ui.Text({ dimColor: true, children: [text], ...extra })
const spread = (ui, left, right, key) => ui.Box({ key, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', columnGap: 2, children: [row(ui, left), row(ui, right)] })

// A button that is on or off: on is the filled primary button.
const toggle = (ui, key, label, isOn, onPress, extra = {}) => ui.Button({ key, label, onPress, ...(isOn ? { variant: 'primary' } : {}), ...extra })
const link = (ui, key, label, onPress) => ui.Button({ key, label, plain: true, dimColor: true, onPress })
const clock = (ms) => { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') }

// The transport, shared by the deck and the bar: previous, play or stop,
// next track, then the track, its heart, mood and tempo.
function transport(ui, vm, act, prefix) {
  const v = vm.view
  return [
    vm.recent.length ? ui.Button({ key: prefix + 'prev', label: '⏮', onPress: () => act.prev() }) : null,
    toggle(ui, prefix + 'play', vm.playing ? '■ stop' : '▶ play', !vm.playing, () => (vm.playing ? act.stop() : act.play()), prefix ? {} : { hotkey: 'p' }),
    ui.Button({ key: prefix + 'skip', label: '⏭', onPress: () => act.skip() }),
    ui.Text({ bold: true, wrap: 'truncate-end', children: [v.phrase] }),
    ui.Button({ key: prefix + 'fav', label: vm.fav ? '♥' : '♡', plain: true, onPress: () => act.fav() }),
    dim(ui, '· ' + v.mood + ' · ' + v.bpm + ' bpm'),
  ]
}

function topLine(ui, vm, act) {
  return spread(ui, transport(ui, vm, act, ''), [
    toggle(ui, 'auto', vm.auto ? '● auto' : '○ auto', vm.auto, () => act.auto(), { hotkey: 'a' }),
    ui.Button({ key: 'close', label: 'hide', role: 'dismiss', plain: true, dimColor: true, onPress: () => act.close() }),
  ], 'top')
}

// The skyline: the shape of the set, a low block calm and a tall one a drop.
// What played is in the text color, the cell that plays now in the accent,
// the rest dim. It never wraps: it has as many cells as the band has room for
// (two a loop when there is room, fewer in a narrow window, each the loop
// at its middle). The part and the time sit beside it, or under it when
// they do not fit.
const BLOCKS = ['▁', '▂', '▄', '█']
export function skyline(loops, pos, room) {
  const n = Math.max(11, Math.min(loops.length * 2, room))
  const per = loops.length / n
  const cells = Array.from({ length: n }, (_, i) => BLOCKS[Math.min(3, loops[Math.floor((i + 0.5) * per)] ?? 0)])
  return { cells, at: Math.min(n, Math.floor((pos / loops.length) * n)) }
}

function whereLine(ui, vm) {
  const v = vm.view, w = vm.where
  if (!w) return null
  const room = Math.max(11, (vm.columns ?? 100) - 4)
  const label = (v.section === 'handover' ? 'mixing in' : v.name) + ' · ' + clock(w.elapsed) + ' / ' + clock(w.total) + (v.from ? ' ← from ' + v.from : '')
  const beside = room >= w.loops.length * 2 + 2 + label.length
  const { cells, at } = skyline(w.loops, w.pos, beside ? w.loops.length * 2 : room)
  const sky = ui.Box({ key: 'sky', flexDirection: 'row', flexShrink: 0, children: [
    at > 0 ? ui.Text({ wrap: 'truncate', children: [cells.slice(0, at).join('')] }) : null,
    at < cells.length ? ui.Text({ color: 'claude', bold: true, children: [cells[at]] }) : null,
    at + 1 < cells.length ? dim(ui, cells.slice(at + 1).join(''), { wrap: 'truncate' }) : null,
  ].filter(Boolean) })
  const text = row(ui, [
    ui.Text({ color: 'claude', bold: true, children: [v.section === 'handover' ? 'mixing in' : v.name] }),
    dim(ui, '· ' + clock(w.elapsed) + ' / ' + clock(w.total)),
    v.from ? dim(ui, '← from ' + v.from, { wrap: 'truncate-end' }) : null,
  ], { key: 'where-text', columnGap: 1 })
  return beside ? ui.Box({ key: 'where', flexDirection: 'row', columnGap: 2, alignItems: 'center', children: [sky, text] }) : col(ui, [sky, text], { key: 'where' })
}

function bottomLine(ui, vm, act) {
  return spread(ui, [
    dim(ui, 'mood'),
    ...['sad', 'mysterious', 'dark'].map((name) => toggle(ui, 'mood-' + name, name, vm.view.mood === name, () => act.mood(name))),
  ], [
    vm.auto ? null : ui.Button({ key: 'next', label: 'next part ›', onPress: () => act.next(), hotkey: 'n' }),
    toggle(ui, 'edit', 'edit', vm.editOpen, () => act.edit(), { hotkey: 'e' }),
    ui.Button({ key: 'favorites', label: '♥ favorites ' + vm.favorites.length, onPress: () => act.screen('favorites') }),
  ], 'bottom')
}

// Edit: change the rhythm, the melody and the tempo; undo; share.
function editLine(ui, vm, act) {
  return row(ui, [
    dim(ui, 'edit'),
    ui.Button({ key: 'dice', label: '⚄ new rhythm', onPress: () => act.dice(), hotkey: 'd' }),
    toggle(ui, 'melody', '♪ melody', vm.acidOn, () => act.melody()),
    ui.Button({ key: 'slower', label: '−', onPress: () => act.bpm(-2) }),
    dim(ui, vm.view.bpm + ' bpm'),
    ui.Button({ key: 'faster', label: '+', onPress: () => act.bpm(2) }),
    vm.canUndo ? ui.Button({ key: 'undo', label: '↶ undo', onPress: () => act.undo(), hotkey: 'u' }) : null,
    ui.Button({ key: 'share', label: '↗ share mp3', onPress: () => act.share() }),
    dim(ui, 'click a sound name to mute it, a cell to add or remove a hit'),
  ], { key: 'edit-line', columnGap: 2 })
}

const talkLine = (ui, vm) => (vm.said || vm.you ? row(ui, [vm.you ? dim(ui, 'you: ' + vm.you, { wrap: 'truncate-end' }) : null, vm.said ? ui.Text({ wrap: 'truncate-end', children: ['› ' + vm.said] }) : null], { key: 'talk', columnGap: 2 }) : null)

function deck(ui, vm, act) {
  return [
    topLine(ui, vm, act),
    whereLine(ui, vm),
    vm.gridEl,
    bottomLine(ui, vm, act),
    vm.editOpen ? editLine(ui, vm, act) : null,
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
      link(ui, 'to-crate', 'new track', () => act.screen('crate')),
      link(ui, 'back', '‹ back', () => act.screen('deck')),
    ], 'fav-top'),
    vm.favorites.length ? null : dim(ui, 'Press ♡ while a track plays to keep it here.'),
    ...vm.favorites.map((it) => trackRow(ui, vm, act, it, { isFav: true, prefix: 'f-' })),
    recent.length ? dim(ui, 'heard before', { key: 'heard' }) : null,
    ...recent.map((it) => trackRow(ui, vm, act, it, { isFav: false, prefix: 'h-' })),
  ]
}

function crate(ui, vm, act) {
  const names = (list, prefix) => list.map((p) => link(ui, prefix + p, p, () => act.pick(p)))
  return [
    spread(ui, [ui.Text({ bold: true, children: ['new track'] }), dim(ui, 'every track grows from a name: its letters pick the key, the patterns and the riff')], [link(ui, 'back', '‹ back', () => act.screen('deck'))], 'crate-top'),
    vm.crate.repo.length ? row(ui, [dim(ui, 'this project'), ...names(vm.crate.repo, 'r-')], { key: 'repo', columnGap: 2 }) : null,
    row(ui, [dim(ui, 'starters'), ...names(vm.crate.starters, 's-')], { key: 'starters', columnGap: 2 }),
    ui.Input({ key: 'phrase', label: 'or type any phrase', placeholder: 'late night deploy', value: '', submitLabel: 'play', onSubmit: (v) => act.phrase(v) }),
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

export function appView(ui, vm, act) {
  const body = !vm.view ? down(ui, vm, act) : vm.screen === 'favorites' ? favorites(ui, vm, act) : vm.screen === 'crate' ? crate(ui, vm, act) : deck(ui, vm, act)
  return col(ui, [...body, vm.status ? dim(ui, vm.status, { key: 'status', wrap: 'truncate-end' }) : null], { borderStyle: 'round', paddingX: 1 })
}

// The bar above the chat box while the app is hidden: the same transport as
// the deck, the part, then auto, open and × on the right.
export function miniView(ui, vm, act) {
  if (!vm.view) return spread(ui, [ui.Text({ bold: true, children: ['♪'] }), dim(ui, vm.down || 'starting the player…')], [link(ui, 'mini-close', '×', () => act.closeBar())], 'mini')
  const v = vm.view
  return spread(ui, [
    ui.Text({ bold: true, children: ['♪'] }),
    ...transport(ui, vm, act, 'mini-'),
    ui.Text({ color: 'claude', children: [v.section === 'handover' ? 'mixing in' : v.name] }),
  ], [
    toggle(ui, 'mini-auto', vm.auto ? '● auto' : '○ auto', vm.auto, () => act.auto()),
    link(ui, 'mini-open', 'open', () => act.open()),
    link(ui, 'mini-close', '×', () => act.closeBar()),
  ], 'mini')
}
