// The app's screens, drawn in the band above the chat box. Pure functions:
// they get the element table (`ui`), a view model (`vm`) and the click
// handlers (`act`), and return a tree. No mods API here; register.js owns
// state and the calls.
import { PARTS } from './coach.js'
import { LAYERS, MOODS, ENERGIES } from './engine.js'

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
  const opt = (id, name) => ui.Button({ key: 'layout-' + id, label: id + ' ' + name, plain: true, dimColor: vm.layout !== id, onPress: () => act.layout(id) })
  return ui.Box({
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    children: [
      row(ui, [ui.Text({ bold: true, children: ['♪ techno'] }), ...(middle ?? [])], { columnGap: 2 }),
      row(ui, [...(vm.dev ? [dim(ui, 'layout'), opt('A', 'radio'), opt('B', 'rooms'), opt('C', 'crate')] : []), ui.Button({ key: 'close', label: 'hide', role: 'dismiss', plain: true, dimColor: true, onPress: () => act.close() })], { columnGap: 2 }),
    ],
  })
}

function nowPlaying(ui, vm) {
  if (!vm.track) return dim(ui, 'no track yet')
  return row(ui, [ui.Text({ bold: true, wrap: 'truncate-end', children: [vm.track.phrase] }), dim(ui, '· ' + vm.desc, { wrap: 'truncate-end' })])
}

function playButton(ui, vm, act) {
  return btn(ui, vm, 'play', vm.playing ? '■ stop' : '▶ play', () => (vm.playing ? act.stop() : act.play()), { hotkey: 'p' })
}

function stepper(ui, vm, name, value, down, up) {
  return row(ui, [dim(ui, name), btn(ui, vm, name + '-down', '−', down), ui.Text({ children: [value] }), btn(ui, vm, name + '-up', '+', up)])
}

function controls(ui, vm, act) {
  const t = vm.track
  return row(ui, [
    stepper(ui, vm, 'energy', ENERGIES[t.energy], () => act.energy(-1), () => act.energy(1)),
    stepper(ui, vm, 'mood', MOODS[t.mood], () => act.mood(-1), () => act.mood(1)),
    stepper(ui, vm, 'tempo', String(t.bpm), () => act.bpm(-2), () => act.bpm(2)),
  ], { columnGap: 3 })
}

function layerChips(ui, vm, act) {
  return row(ui, LAYERS.map((name) => btn(ui, vm, 'layer-' + name, (vm.on[name] ? '● ' : '○ ') + name, () => act.toggle(name), vm.on[name] ? {} : { dimColor: true })))
}

function timeline(ui, vm) {
  const cur = PARTS.indexOf(vm.move?.part ?? 'intro')
  const parts = []
  PARTS.forEach((p, i) => {
    if (i) parts.push(ui.Text({ key: 'sep' + i, dimColor: true, children: ['─'] }))
    parts.push(ui.Text({ key: 'part-' + p, bold: i === cur, inverse: i === cur, dimColor: i > cur, children: [i === cur ? ' ' + p + ' ' : p] }))
  })
  return ui.Box({ flexDirection: 'row', columnGap: 1, children: parts })
}

// The coach's line: what to do next, and a button that does it.
function nextLine(ui, vm, act) {
  return row(ui, [
    dim(ui, 'next ›'),
    ui.Text({ wrap: 'truncate-end', children: [vm.move.tip] }),
    vm.moveLabel ? ui.Button({ key: 'do-move', label: vm.moveLabel, variant: 'primary', onPress: () => act.doMove() }) : null,
  ])
}

function actions(ui, vm, act) {
  return row(ui, [
    btn(ui, vm, 'dice', '⚄ dice', () => act.dice(), { hotkey: 'd' }),
    btn(ui, vm, 'undo', '↶ undo', () => act.undo(), { hotkey: 'u' }),
    btn(ui, vm, 'keep', vm.isKept ? '♥ kept' : '♡ keep', () => act.keep(), { hotkey: 'k' }),
    btn(ui, vm, 'share', '↗ share', () => act.share(), { hotkey: 's' }),
  ])
}

function talkLine(ui, vm) {
  if (vm.said) return row(ui, [vm.you ? dim(ui, 'you: ' + vm.you, { wrap: 'truncate-end' }) : null, ui.Text({ wrap: 'truncate-end', children: ['claude › ' + vm.said] })], { columnGap: 2 })
  return dim(ui, 'or ask Claude in chat: "darker", "faster", "more acid"', { wrap: 'truncate-end' })
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

function trackPicker(ui, vm, act, label) {
  return ui.Select({ key: 'track', label, options: vm.pickOptions, value: vm.code || vm.pickOptions[0].value, onSelect: (v) => act.pick(v) })
}

function statusLine(ui, vm) {
  return vm.status ? dim(ui, vm.status, { key: 'status', wrap: 'truncate-end' }) : null
}

// ---------- A · radio: tabs, a station dial, the next move ----------

function layoutA(ui, vm, act) {
  const tab = (id, label) => ui.Button({ key: 'tab-' + id, label, plain: true, dimColor: vm.tab !== id, onPress: () => act.tab(id) })
  const tabs = [tab('tracks', 'tracks'), tab('mix', 'mix'), tab('share', 'share')]
  let body
  if (!vm.track || vm.tab === 'tracks') {
    body = [
      row(ui, [
        ui.Button({ key: 'radio-prev', label: '◀', onPress: () => act.radio(-1) }),
        dim(ui, `station ${vm.radio.index + 1}/${vm.radio.total}`),
        ui.Button({ key: 'radio-next', label: '▶', onPress: () => act.radio(1) }),
        dim(ui, vm.radio.from),
      ]),
      vm.track ? row(ui, [playButton(ui, vm, act), nowPlaying(ui, vm)]) : null,
      vm.track ? vm.gridEl : null,
    ]
  } else if (vm.tab === 'mix') {
    body = [row(ui, [playButton(ui, vm, act), nowPlaying(ui, vm)]), layerChips(ui, vm, act), controls(ui, vm, act), vm.gridEl]
  } else {
    body = [shareBlock(ui, vm, act)]
  }
  return [header(ui, vm, act, tabs), ...body, vm.track ? nextLine(ui, vm, act) : null]
}

// ---------- B · rooms: room picker, mixer strip, set timeline ----------

function layoutB(ui, vm, act) {
  if (!vm.track) return [header(ui, vm, act), trackPicker(ui, vm, act, 'room')]
  return [
    header(ui, vm, act, [trackPicker(ui, vm, act, 'room')]),
    row(ui, [playButton(ui, vm, act), nowPlaying(ui, vm)]),
    row(ui, [timeline(ui, vm), dim(ui, '›'), ui.Text({ wrap: 'truncate-end', children: [vm.move.tip] })], { columnGap: 2 }),
    layerChips(ui, vm, act),
    row(ui, [controls(ui, vm, act), actions(ui, vm, act)], { columnGap: 3 }),
    vm.gridEl,
    vm.showShare ? shareBlock(ui, vm, act) : talkLine(ui, vm),
  ]
}

// ---------- C · crate: tracks from your repo, then a deck ----------

function crateRow(ui, vm, act, name, items) {
  if (!items.length) return null
  return row(ui, [dim(ui, name.padEnd(12)), ...items.map((it) => ui.Button({ key: 'pick-' + it.code, label: (vm.code === it.code ? '▶ ' : '') + it.label, plain: true, dimColor: vm.code !== it.code, onPress: () => act.pick(it.code) }))], { columnGap: 2 })
}

function layoutC(ui, vm, act) {
  if (vm.screen === 'crate' || !vm.track) {
    return [
      header(ui, vm, act, [dim(ui, 'pick a track')]),
      crateRow(ui, vm, act, 'your repo', vm.crate.repo),
      crateRow(ui, vm, act, 'kept', vm.crate.saved),
      crateRow(ui, vm, act, 'starters', vm.crate.starters),
      ui.Input({ key: 'phrase', label: 'or type a phrase', placeholder: 'late night deploy', value: '', submitLabel: 'play', onSubmit: (v) => act.phrase(v) }),
    ]
  }
  return [
    header(ui, vm, act, [ui.Button({ key: 'back', label: '◂ crate', plain: true, dimColor: true, onPress: () => act.screen('crate') })]),
    row(ui, [playButton(ui, vm, act), nowPlaying(ui, vm)]),
    row(ui, [timeline(ui, vm)], { columnGap: 2 }),
    nextLine(ui, vm, act),
    layerChips(ui, vm, act),
    row(ui, [controls(ui, vm, act), actions(ui, vm, act)], { columnGap: 3 }),
    vm.gridEl,
    vm.showShare ? shareBlock(ui, vm, act) : talkLine(ui, vm),
  ]
}

export function appView(ui, vm, act) {
  const body = vm.layout === 'A' ? layoutA(ui, vm, act) : vm.layout === 'B' ? layoutB(ui, vm, act) : layoutC(ui, vm, act)
  return col(ui, [...body, statusLine(ui, vm)], { borderStyle: 'round', paddingX: 1 })
}

// One line above the chat box while music plays and the app is hidden.
export function miniView(ui, vm, act) {
  return row(ui, [
    ui.Text({ bold: true, children: ['♪'] }),
    ui.Button({ key: 'mini-stop', label: '■ stop', plain: true, onPress: () => act.stop() }),
    ui.Text({ wrap: 'truncate-end', children: [vm.track.phrase] }),
    dim(ui, vm.track.bpm + ' bpm'),
    ui.Button({ key: 'mini-open', label: 'open techno', plain: true, dimColor: true, onPress: () => act.open() }),
  ], { columnGap: 2 })
}
