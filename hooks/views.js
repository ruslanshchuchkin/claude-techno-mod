// The app's screens, drawn in the band above the chat box. Pure functions:
// they get the element table (`ui`), a view model (`vm`) and the click
// handlers (`act`), and return a tree. No mods API here; register.js owns
// state and the calls.
//
// Two screens: the crate (pick a track) and the deck (build it up). When the
// build is finished, the deck shows the done card.
import { PLAN, VIBES } from './engine.js'

// A button that the coach can highlight: the suggested one is the primary
// button, with a marker in the terminal where primary is only a color.
function btn(ui, vm, key, label, onPress, extra = {}) {
  const lit = vm.move?.key === key
  return ui.Button({
    key,
    label: lit && vm.surface === 'terminal' ? '▸ ' + label : label,
    onPress,
    ...(lit ? { variant: 'primary' } : {}),
    ...extra,
  })
}

const row = (ui, children, extra = {}) => ui.Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: 1, alignItems: 'center', children: children.filter(Boolean), ...extra })
const col = (ui, children, extra = {}) => ui.Box({ flexDirection: 'column', children: children.filter(Boolean), ...extra })
const dim = (ui, text, extra = {}) => ui.Text({ dimColor: true, children: [text], ...extra })

function header(ui, vm, act, middle) {
  return ui.Box({
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    children: [
      row(ui, [ui.Text({ bold: true, children: ['♪ techno'] }), ...(middle ?? [])], { columnGap: 2 }),
      ui.Button({ key: 'close', label: 'hide', role: 'dismiss', plain: true, dimColor: true, onPress: () => act.close() }),
    ],
  })
}

// The three moods as stations: the one on air is a button, the others plain words.
function stations(ui, vm, act) {
  return row(ui, VIBES.map((v) => ui.Button({ key: 'mood-' + v.name, label: v.name, ...(v.name === vm.mood ? {} : { plain: true, dimColor: true }), onPress: () => act.setMood(v.name) })), { columnGap: 2 })
}

// Row 1: play, the track, where its name comes from; how far the build is, on the right.
function nowPlaying(ui, vm, act) {
  const part = vm.track.part
  const building = part !== null && part !== undefined
  const done = building ? part + 1 : 0
  return ui.Box({
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    children: [
      row(ui, [
        btn(ui, vm, 'play', vm.playing ? '■ stop' : '▶ play', () => (vm.playing ? act.stop() : act.play()), { hotkey: 'p' }),
        ui.Text({ bold: true, wrap: 'truncate-end', children: [vm.track.phrase] }),
        dim(ui, '· ' + vm.source, { wrap: 'truncate-end' }),
      ]),
      building
        ? row(ui, [dim(ui, PLAN[part].section), ui.Box({ flexDirection: 'row', children: [ui.Text({ children: ['▰'.repeat(done)] }), dim(ui, '▱'.repeat(PLAN.length - done))] }), dim(ui, `${done}/${PLAN.length}`)])
        : dim(ui, 'full track'),
    ],
  })
}

// Row 2: what you hear now, in plain words; the next step and auto on the right.
function nextLine(ui, vm, act) {
  return ui.Box({
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    children: [
      row(ui, [dim(ui, vm.playing ? 'now' : 'paused'), ui.Text({ wrap: 'truncate-end', children: [vm.hearing] })]),
      row(ui, [
        vm.move.label ? btn(ui, vm, 'do-move', vm.move.label + ' ›', () => act.doMove(), { hotkey: 'n' }) : null,
        btn(ui, vm, 'auto', vm.auto ? '● playing by itself' : 'let it play itself', () => act.auto()),
      ]),
    ],
  })
}

// Row 3: the small knobs, as words that say what they do.
function knobs(ui, vm, act) {
  const t = vm.track
  const word = (key, label, onPress) => ui.Button({ key, label, plain: true, dimColor: vm.move?.key !== key, onPress })
  const sep = (k) => dim(ui, '·', { key: 'sep-' + k })
  return row(ui, [
    word('tempo-down', 'slower', () => act.bpm(-2)), ui.Text({ children: [String(t.bpm)] }), word('tempo-up', 'faster', () => act.bpm(2)), sep(1),
    word('energy-down', 'calmer', () => act.energy(-1)), word('energy-up', 'busier', () => act.energy(1)), sep(2),
    word('dice', 'new rhythm', () => act.dice()), word('undo', 'undo', () => act.undo()), sep(3),
    word('keep', vm.isKept ? '♥ saved' : '♡ save', () => act.keep()), word('share', 'share', () => act.share()), sep(4),
    word('back', 'other tracks', () => act.screen('crate')),
  ], { columnGap: 1 })
}

function talkLine(ui, vm) {
  if (vm.said) return row(ui, [vm.you ? dim(ui, 'you: ' + vm.you, { wrap: 'truncate-end' }) : null, ui.Text({ wrap: 'truncate-end', children: ['claude › ' + vm.said] })], { columnGap: 2 })
  return dim(ui, 'or ask Claude in chat: "darker", "mysterious", "faster", "next part"', { wrap: 'truncate-end' })
}

function shareBlock(ui, vm, act) {
  return ui.Box({
    flexDirection: 'column',
    borderStyle: 'round',
    paddingX: 1,
    children: [
      row(ui, [ui.Text({ bold: true, children: [vm.track.phrase.toUpperCase()] }), dim(ui, '· ' + vm.desc)]),
      row(ui, [dim(ui, 'play it in Claude Code:'), ui.Text({ color: 'green', wrap: 'wrap', children: [vm.shareLine] })]),
      row(ui, [
        ui.Button({ key: 'copy', label: 'copy play line', variant: 'primary', onPress: () => act.copy() }),
        ui.Button({ key: 'save', label: '↓ save mp3', onPress: () => act.save() }),
        ui.Button({ key: 'share-close', label: 'done', plain: true, dimColor: true, onPress: () => act.closeShare() }),
      ]),
    ],
  })
}

// The finished track: listen to the whole build again, save it, or remix it.
function doneCard(ui, vm, act) {
  return ui.Box({
    key: 'done',
    flexDirection: 'column',
    borderStyle: 'round',
    paddingX: 1,
    children: [
      row(ui, [ui.Text({ bold: true, color: 'green', children: ['✓ Your track is done'] }), dim(ui, `· ${vm.track.phrase} · ${vm.set.parts} parts · ${vm.set.length}`)]),
      dim(ui, 'The set plays every part you built, in order, from the first kick to the outro.'),
      row(ui, [
        btn(ui, vm, 'replay', vm.replaying ? '■ stop the replay' : '▶ replay the set', () => (vm.replaying ? act.stop() : act.replay())),
        btn(ui, vm, 'save-set', '↓ save the set as mp3', () => act.saveSet()),
        btn(ui, vm, 'remix', '⚄ remix it', () => act.remix()),
        btn(ui, vm, 'keep', vm.isKept ? '♥ kept' : '♡ keep', () => act.keep()),
        btn(ui, vm, 'share', '↗ share', () => act.share()),
        ui.Button({ key: 'new', label: 'new track', plain: true, dimColor: true, onPress: () => act.screen('crate') }),
      ]),
    ],
  })
}

function crateRow(ui, vm, act, name, items) {
  if (!items.length) return null
  return row(ui, [dim(ui, name.padEnd(13)), ...items.map((it) => ui.Button({ key: 'pick-' + it.code, label: (vm.code === it.code ? '▶ ' : '') + it.label, plain: true, dimColor: vm.code !== it.code, onPress: () => act.pick(it.code) }))], { columnGap: 2 })
}

function crate(ui, vm, act) {
  return [
    header(ui, vm, act, [dim(ui, 'pick a track')]),
    dim(ui, 'Every track grows from a name: its letters pick the key, the patterns and the riff. These names come from this session.'),
    crateRow(ui, vm, act, 'this project', vm.crate.repo),
    crateRow(ui, vm, act, 'kept', vm.crate.saved),
    crateRow(ui, vm, act, 'starters', vm.crate.starters),
    ui.Input({ key: 'phrase', label: 'or type any phrase', placeholder: 'late night deploy', value: '', submitLabel: 'play', onSubmit: (v) => act.phrase(v) }),
  ]
}

function deck(ui, vm, act) {
  return [
    header(ui, vm, act, [stations(ui, vm, act)]),
    nowPlaying(ui, vm, act),
    vm.finished ? doneCard(ui, vm, act) : nextLine(ui, vm, act),
    knobs(ui, vm, act),
    vm.gridEl,
    vm.showShare ? shareBlock(ui, vm, act) : talkLine(ui, vm),
  ]
}

export function appView(ui, vm, act) {
  const body = vm.screen === 'crate' || !vm.track ? crate(ui, vm, act) : deck(ui, vm, act)
  return col(ui, [...body, vm.status ? dim(ui, vm.status, { key: 'status', wrap: 'truncate-end' }) : null], { borderStyle: 'round', paddingX: 1 })
}

// The bar above the chat box while the app is hidden: play or stop, the
// track and where it is, auto, next track, share, open, and × to close it.
export function miniView(ui, vm, act) {
  const part = vm.track.part
  const where = vm.replaying ? 'replaying the set' : part === null || part === undefined ? vm.track.bpm + ' bpm' : `${PLAN[part].section} ${part + 1}/${PLAN.length}`
  return row(ui, [
    ui.Text({ bold: true, children: ['♪'] }),
    ui.Button({ key: 'mini-play', label: vm.playing ? '■ stop' : '▶ play', ...(vm.playing ? {} : { variant: 'primary' }), onPress: () => (vm.playing ? act.stop() : act.play()) }),
    ui.Text({ bold: true, wrap: 'truncate-end', children: [vm.track.phrase] }),
    dim(ui, where),
    ui.Button({ key: 'mini-auto', label: vm.auto ? '● auto' : '○ auto', ...(vm.auto ? { variant: 'primary' } : {}), onPress: () => act.auto() }),
    ui.Button({ key: 'mini-next', label: '⏭ next track', onPress: () => act.nextTrack() }),
    ui.Button({ key: 'mini-share', label: '↗ share', onPress: () => act.copy() }),
    ui.Button({ key: 'mini-open', label: 'open', plain: true, dimColor: true, onPress: () => act.open() }),
    ui.Button({ key: 'mini-close', label: '×', plain: true, dimColor: true, onPress: () => act.closeBar() }),
  ], { columnGap: 2 })
}
