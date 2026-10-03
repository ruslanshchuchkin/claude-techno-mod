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

// The one line above the grid (layout C+): play, the track and its kind, how
// far the build is, what comes next and when; skip and auto on the right.
function topLine(ui, vm, act) {
  const t = vm.track
  const part = t.part
  const building = part !== null && part !== undefined
  const done = building ? part + 1 : 0
  const nx = vm.next
  const when = nx?.inMs !== undefined ? Math.max(0, Math.ceil(nx.inMs / 1000)) : null
  const clock = when === null ? '' : Math.floor(when / 60) + ':' + String(when % 60).padStart(2, '0')
  const skip = nx ? (vm.auto ? 'skip to ' : nx.adds ? 'add ' : 'go to ') + nx.name + ' ›' : ''
  return ui.Box({
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    children: [
      row(ui, [
        btn(ui, vm, 'play', vm.playing ? '■ stop' : '▶ play', () => (vm.playing ? act.stop() : act.play()), { hotkey: 'p' }),
        ui.Text({ bold: true, wrap: 'truncate-end', children: [t.phrase] }),
        dim(ui, `· ${vm.mood} · ${t.bpm} bpm`),
        building ? ui.Box({ flexDirection: 'row', marginLeft: 1, children: [ui.Text({ children: ['▰'.repeat(done)] }), dim(ui, '▱'.repeat(PLAN.length - done))] }) : dim(ui, 'full track'),
        building ? dim(ui, `${done}/${PLAN.length}`) : null,
        nx ? dim(ui, '→') : null,
        nx ? ui.Text({ children: [nx.name + (clock ? ' in' : ' next')] }) : null,
        clock ? ui.Text({ bold: true, children: [clock] }) : null,
      ]),
      row(ui, [
        nx && !vm.finished ? btn(ui, vm, 'do-move', skip, () => act.doMove(), { hotkey: 'n' }) : null,
        btn(ui, vm, 'auto', vm.auto ? '● building by itself' : '○ build by itself', () => act.auto()),
        ui.Button({ key: 'close', label: 'hide', role: 'dismiss', plain: true, dimColor: true, onPress: () => act.close() }),
      ]),
    ],
  })
}

// Under the grid: the three moods (each sets the scale, the tempo and the
// energy), then the few things you do once in a while.
function footer(ui, vm, act) {
  const word = (key, label, onPress, lit = false) => ui.Button({ key, label, plain: true, dimColor: !lit, onPress })
  return row(ui, [
    dim(ui, 'mood:'),
    ...VIBES.map((v) => word('mood-' + v.name, v.name, () => act.setMood(v.name), v.name === vm.mood)),
    dim(ui, '·', { key: 'sep-1' }),
    word('back', 'other tracks', () => act.screen('crate')),
    word('dice', 'new rhythm', () => act.dice()),
    word('share', 'share mp3', () => act.share()),
  ], { columnGap: 2 })
}

const talkLine = (ui, vm) => (vm.said ? row(ui, [vm.you ? dim(ui, 'you: ' + vm.you, { wrap: 'truncate-end' }) : null, ui.Text({ wrap: 'truncate-end', children: ['claude › ' + vm.said] })], { columnGap: 2 }) : null)

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
    vm.finished ? header(ui, vm, act, [dim(ui, vm.track.phrase)]) : topLine(ui, vm, act),
    vm.finished ? doneCard(ui, vm, act) : null,
    vm.gridEl,
    footer(ui, vm, act),
    talkLine(ui, vm),
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
