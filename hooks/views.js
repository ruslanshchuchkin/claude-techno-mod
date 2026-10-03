// The pane's screens. Pure functions: they get the element table (`ui`), a
// view model (`vm`) and the click handlers (`act`), and return a tree. No mods
// API here; register.js owns state and the calls.
import { PARTS } from './coach.js'
import { LAYERS, MOODS, ENERGIES } from './engine.js'

const SP = (ui) => ui.Text({ children: [' '] })

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

const row = (ui, children, extra = {}) => ui.Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: 1, rowGap: 0, children, ...extra })

function switcher(ui, vm, act) {
  if (!vm.dev) return null
  const opt = (id, name) => ui.Button({ key: 'layout-' + id, label: id + ' ' + name, plain: true, dimColor: vm.layout !== id, onPress: () => act.layout(id) })
  return ui.Box({
    flexDirection: 'row',
    columnGap: 2,
    marginBottom: 1,
    children: [ui.Text({ dimColor: true, children: ['layout'] }), opt('A', 'radio'), opt('B', 'rooms'), opt('C', 'crate')],
  })
}

function title(ui, vm) {
  if (!vm.track) return ui.Text({ dimColor: true, children: ['no track yet'] })
  return ui.Box({
    flexDirection: 'column',
    children: [
      ui.Text({ bold: true, wrap: 'wrap', children: [vm.track.phrase] }),
      ui.Text({ dimColor: true, wrap: 'wrap', children: [vm.desc] }),
    ],
  })
}

function playButton(ui, vm, act, big = false) {
  const label = vm.playing ? '■ stop' : big ? '▶  play' : '▶ play'
  return btn(ui, vm, 'play', label, () => (vm.playing ? act.stop() : act.play()), { hotkey: 'p' })
}

function stepper(ui, vm, act, name, value, down, up) {
  return row(ui, [
    ui.Text({ dimColor: true, children: [name.padEnd(7)] }),
    btn(ui, vm, name + '-down', '−', down),
    ui.Text({ children: [String(value).padEnd(9)] }),
    btn(ui, vm, name + '-up', '+', up),
  ], { alignItems: 'center' })
}

function controls(ui, vm, act) {
  const t = vm.track
  return ui.Box({
    flexDirection: 'column',
    children: [
      stepper(ui, vm, act, 'energy', ENERGIES[t.energy], () => act.energy(-1), () => act.energy(1)),
      stepper(ui, vm, act, 'mood', MOODS[t.mood], () => act.mood(-1), () => act.mood(1)),
      stepper(ui, vm, act, 'tempo', t.bpm + ' bpm', () => act.bpm(-2), () => act.bpm(2)),
    ],
  })
}

function layerChips(ui, vm, act) {
  return row(ui, LAYERS.map((name) => btn(ui, vm, 'layer-' + name, (vm.on[name] ? '● ' : '○ ') + name, () => act.toggle(name), vm.on[name] ? {} : { dimColor: true })))
}

function timeline(ui, vm) {
  const cur = PARTS.indexOf(vm.move?.part ?? 'intro')
  const parts = []
  PARTS.forEach((p, i) => {
    if (i) parts.push(ui.Text({ key: 'sep' + i, dimColor: true, children: [' ─ '] }))
    parts.push(ui.Text({ key: 'part-' + p, bold: i === cur, inverse: i === cur, dimColor: i > cur, children: [i === cur ? ' ' + p + ' ' : p] }))
  })
  return ui.Box({ flexDirection: 'row', children: parts })
}

function tip(ui, vm) {
  return ui.Text({ wrap: 'wrap', children: ['next › ' + vm.move.tip] })
}

function moveCard(ui, vm, act) {
  return ui.Box({
    flexDirection: 'column',
    borderStyle: 'round',
    paddingX: 1,
    children: [
      ui.Text({ dimColor: true, children: ['next move · ' + (vm.move.part ?? '')] }),
      ui.Text({ bold: true, wrap: 'wrap', children: [vm.move.tip] }),
      ...(vm.moveLabel ? [ui.Button({ key: 'do-move', label: vm.moveLabel, variant: 'primary', onPress: () => act.doMove() })] : []),
    ],
  })
}

function talk(ui, vm) {
  const out = []
  if (vm.you) out.push(ui.Text({ key: 'you', dimColor: true, wrap: 'truncate-end', children: ['you    › ' + vm.you] }))
  if (vm.said) out.push(ui.Text({ key: 'said', wrap: 'truncate-end', children: ['claude › ' + vm.said] }))
  if (!out.length) out.push(ui.Text({ key: 'hint', dimColor: true, wrap: 'wrap', children: ['You can also ask Claude in chat: "darker", "faster", "more acid".'] }))
  return ui.Box({ flexDirection: 'column', children: out })
}

function status(ui, vm) {
  return vm.status ? ui.Text({ key: 'status', dimColor: true, wrap: 'wrap', children: [vm.status] }) : null
}

function actions(ui, vm, act) {
  return row(ui, [
    btn(ui, vm, 'dice', '⚄ dice', () => act.dice(), { hotkey: 'd' }),
    btn(ui, vm, 'undo', '↶ undo', () => act.undo(), { hotkey: 'u' }),
    btn(ui, vm, 'keep', vm.isKept ? '♥ kept' : '♡ keep', () => act.keep(), { hotkey: 'k' }),
    btn(ui, vm, 'share', '↗ share', () => act.share(), { hotkey: 's' }),
  ])
}

function shareCard(ui, vm, act) {
  return ui.Box({
    flexDirection: 'column',
    children: [
      ui.Box({
        flexDirection: 'column',
        borderStyle: 'double',
        paddingX: 1,
        children: [
          ui.Text({ bold: true, wrap: 'wrap', children: [vm.track.phrase.toUpperCase()] }),
          ui.Text({ wrap: 'wrap', children: [vm.desc.toUpperCase()] }),
          SP(ui),
          ui.Text({ dimColor: true, children: ['play it in Claude Code:'] }),
          ui.Text({ color: 'green', wrap: 'wrap', children: [vm.shareLine] }),
        ],
      }),
      row(ui, [
        ui.Button({ key: 'copy', label: 'copy play line', variant: 'primary', onPress: () => act.copy() }),
        ui.Button({ key: 'save', label: '↓ save mp3', onPress: () => act.save() }),
        ...(vm.layout !== 'A' ? [ui.Button({ key: 'share-close', label: 'close', plain: true, dimColor: true, onPress: () => act.closeShare() })] : []),
      ], { marginTop: 1 }),
    ],
  })
}

function trackButton(ui, vm, act, item) {
  const isCurrent = vm.track && vm.code === item.code
  return ui.Box({
    key: 'tr-' + item.code,
    flexDirection: 'row',
    columnGap: 1,
    children: [
      ui.Button({ key: 'pick-' + item.code, label: (isCurrent ? '▶ ' : '  ') + item.label, plain: true, dimColor: !isCurrent, onPress: () => act.pick(item.code) }),
      ui.Text({ dimColor: true, wrap: 'truncate-end', children: [item.sub] }),
    ],
  })
}

function section(ui, name, children) {
  return ui.Box({ flexDirection: 'column', marginBottom: 1, children: [ui.Text({ dimColor: true, children: [name] }), ...children] })
}

// ---------- A · radio: tabs, a station dial, a next-move card ----------

function layoutA(ui, vm, act) {
  const tab = (id, label) => ui.Button({ key: 'tab-' + id, label, plain: true, dimColor: vm.tab !== id, onPress: () => act.tab(id) })
  let body
  if (!vm.track || vm.tab === 'tracks') {
    body = [
      row(ui, [
        ui.Button({ key: 'radio-prev', label: '◀', onPress: () => act.radio(-1) }),
        ui.Text({ dimColor: true, children: [` station ${vm.radio.index + 1}/${vm.radio.total} `] }),
        ui.Button({ key: 'radio-next', label: '▶', onPress: () => act.radio(1) }),
      ], { alignItems: 'center' }),
      ui.Text({ dimColor: true, children: [vm.radio.from] }),
      SP(ui),
      title(ui, vm),
      SP(ui),
      ...(vm.track ? [row(ui, [playButton(ui, vm, act, true), btn(ui, vm, 'keep', vm.isKept ? '♥ kept' : '♡ keep', () => act.keep())]), SP(ui), vm.gridEl, SP(ui), moveCard(ui, vm, act)] : []),
    ]
  } else if (vm.tab === 'mix') {
    body = [title(ui, vm), SP(ui), row(ui, [playButton(ui, vm, act), btn(ui, vm, 'dice', '⚄ dice', () => act.dice()), btn(ui, vm, 'undo', '↶ undo', () => act.undo())]), SP(ui), controls(ui, vm, act), SP(ui), layerChips(ui, vm, act), SP(ui), vm.gridEl, SP(ui), moveCard(ui, vm, act)]
  } else {
    body = [shareCard(ui, vm, act)]
  }
  return [
    ui.Box({ flexDirection: 'row', columnGap: 3, marginBottom: 1, children: [tab('tracks', '1 tracks'), tab('mix', '2 mix'), tab('share', '3 share')] }),
    ...body,
    SP(ui),
    talk(ui, vm),
  ]
}

// ---------- B · rooms: player first, a room picker, a mixer strip, a set timeline ----------

function layoutB(ui, vm, act) {
  const picker = ui.Select({ key: 'room', label: 'room', options: vm.roomOptions, value: vm.roomValue, onSelect: (v) => act.pick(v) })
  if (!vm.track) return [picker, SP(ui), ui.Text({ dimColor: true, children: ['Pick a room to start.'] })]
  return [
    picker,
    SP(ui),
    title(ui, vm),
    SP(ui),
    row(ui, [playButton(ui, vm, act), btn(ui, vm, 'dice', '⚄ dice', () => act.dice()), btn(ui, vm, 'undo', '↶ undo', () => act.undo()), btn(ui, vm, 'keep', vm.isKept ? '♥ kept' : '♡ keep', () => act.keep()), btn(ui, vm, 'share', '↗ share', () => act.share())]),
    SP(ui),
    timeline(ui, vm),
    tip(ui, vm),
    SP(ui),
    ui.Text({ dimColor: true, children: ['mixer'] }),
    layerChips(ui, vm, act),
    SP(ui),
    controls(ui, vm, act),
    SP(ui),
    vm.gridEl,
    ...(vm.showShare ? [SP(ui), shareCard(ui, vm, act)] : []),
    SP(ui),
    talk(ui, vm),
  ]
}

// ---------- C · crate: tracks from your repo, then a deck ----------

function layoutC(ui, vm, act) {
  if (vm.screen === 'crate' || !vm.track) {
    return [
      ui.Text({ bold: true, children: ['pick a track'] }),
      SP(ui),
      ...(vm.crate.repo.length ? [section(ui, 'from your repo · ' + vm.crate.repoName, vm.crate.repo.map((it) => trackButton(ui, vm, act, it)))] : []),
      ...(vm.crate.saved.length ? [section(ui, 'your tracks', vm.crate.saved.map((it) => trackButton(ui, vm, act, it)))] : []),
      section(ui, 'starters', vm.crate.starters.map((it) => trackButton(ui, vm, act, it))),
      ui.Input({ key: 'phrase', label: 'or type a phrase', placeholder: 'late night deploy', value: '', submitLabel: 'play', onSubmit: (v) => act.phrase(v) }),
    ]
  }
  return [
    ui.Button({ key: 'back', label: '◂ crate', plain: true, dimColor: true, onPress: () => act.screen('crate') }),
    SP(ui),
    ui.Box({
      flexDirection: 'column',
      borderStyle: 'round',
      paddingX: 1,
      children: [title(ui, vm), SP(ui), playButton(ui, vm, act, true)],
    }),
    SP(ui),
    timeline(ui, vm),
    tip(ui, vm),
    SP(ui),
    layerChips(ui, vm, act),
    SP(ui),
    controls(ui, vm, act),
    SP(ui),
    vm.gridEl,
    SP(ui),
    actions(ui, vm, act),
    ...(vm.showShare ? [SP(ui), shareCard(ui, vm, act)] : []),
    SP(ui),
    talk(ui, vm),
  ]
}

export function paneView(ui, vm, act) {
  const body = vm.layout === 'A' ? layoutA(ui, vm, act) : vm.layout === 'B' ? layoutB(ui, vm, act) : layoutC(ui, vm, act)
  return ui.Box({ flexDirection: 'column', children: [switcher(ui, vm, act), ...body, status(ui, vm)].filter(Boolean) })
}
