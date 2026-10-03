// The step sequencer, drawn on the surface's own frame clock so the playhead
// moves without a redraw of the whole pane. Every step is a Box of the same
// width, so the columns line up in any font.
//
// A click on a row name posts { toggle: layer } (mute). A click on a cell
// posts { step: i, layer } (add or remove that hit in every bar).
//
// props: { rows: [[name, pattern, color, isOn, isMuted, isNext]], step, stepMs, playing, stamp }
// stamp is when the current bar started; a new stamp resyncs the playhead.
// A layer the build has not brought in (or took out) is dim; one you muted is struck through.
// The next sound of the build is a dashed row: where it will play, not yet clickable.
const LABEL = 8
const TOP = 2 // the header line and the beat ruler
const cellX = (i) => LABEL + i * 3 + Math.floor(i / 4)

// Theme keys, not raw colors, so the grid reads in the light and the dark
// theme alike: an empty step is the theme's subtle grey, the playhead its text color.
const REST = 'subtle'
const REST_BEAT = 'subtle'
const MUTED = 'inactive'
const HEAD_REST = 'suggestion'
const HEAD_HIT = 'text'
const HOVER = 'inactive'

function cellAt(x) {
  for (let i = 0; i < 16; i++) if (x >= cellX(i) && x <= cellX(i) + 2) return i
  return -1
}

export default function Grid(props, surface) {
  const { Box, Text } = surface.elements
  const prev = surface.state
  let st = prev ?? { step: props.step, stamp: props.stamp, ref: { props }, stop: null, stepMs: 0, hover: null }
  if (!prev) {
    surface.onPointer((ev) => {
      const cur = surface.state ?? st
      const rows = cur.ref.props.rows
      const r = ev.y - TOP
      const row = ev.type === 'leave' ? null : rows[r]
      const i = row ? (ev.x < LABEL ? -1 : cellAt(ev.x)) : null
      if (ev.type === 'down' && row && !row[5]) {
        if (i === -1) surface.post({ toggle: row[0] })
        else if (i !== null && i >= 0) surface.post({ step: i, layer: row[0] })
      }
      const hover = row && i !== null ? { r, i } : null
      const same = (hover && cur.hover && hover.r === cur.hover.r && hover.i === cur.hover.i) || (!hover && !cur.hover)
      if (!same) surface.setState({ ...cur, hover })
    })
  }
  st.ref.props = props

  // resync to the pane's clock whenever the pane hands a new stamp
  let changed = !prev
  if (props.stamp !== st.stamp) {
    st = { ...st, step: props.step, stamp: props.stamp }
    changed = true
  }
  const wantMs = props.playing ? props.stepMs : 0
  if (wantMs !== st.stepMs) {
    if (st.stop) st.stop()
    const tick = () => {
      const s = surface.state
      surface.setState({ ...s, step: (s.step + 1) % 128 })
    }
    st = { ...st, stepMs: wantMs, stop: wantMs ? surface.every(wantMs, tick) : null }
    changed = true
  }
  if (changed) surface.setState(st)

  const col = props.playing ? st.step % 16 : -1
  const bar = Math.floor(st.step / 16) + 1
  const hover = st.hover
  const gap = (i) => (i % 4 === 3 ? 2 : 1)

  const header = Box({
    key: 'gh',
    flexDirection: 'row',
    children: [
      Text({ dimColor: true, children: [props.playing ? `bar ${bar}/8` : 'stopped'] }),
    ],
  })
  const ruler = Box({
    key: 'gr',
    flexDirection: 'row',
    children: [
      Box({ key: 'rl', width: LABEL, children: [Text({ children: [' '] })] }),
      ...Array.from({ length: 16 }, (_, i) =>
        Box({ key: 'r' + i, width: 2, marginRight: gap(i), children: [Text({ dimColor: i !== col, bold: i === col, children: [i % 4 === 0 ? String(i / 4 + 1) : '·'] })] }),
      ),
    ],
  })
  const rows = props.rows.map(([name, pattern, color, isOn, isMuted, isNext], r) => {
    if (isNext) {
      const cells = [...pattern].map((c, i) => Box({ key: name + i, width: 2, height: 1, marginRight: gap(i), children: [Text({ dimColor: true, children: [c !== '.' ? '▪▪' : '╌╌'] })] }))
      return Box({ key: 'g-' + name, flexDirection: 'row', children: [Box({ key: 'l-' + name, width: LABEL, children: [Text({ dimColor: true, italic: true, children: [name] })] }), ...cells] })
    }
    const label = Text({
      bold: isOn,
      dimColor: !isOn,
      strikethrough: !!isMuted,
      underline: hover?.r === r && hover.i === -1,
      children: [name],
    })
    const cells = [...pattern].map((c, i) => {
      const hit = c !== '.'
      let bg
      if (i === col) bg = hit && isOn ? HEAD_HIT : HEAD_REST
      else if (hover?.r === r && hover.i === i) bg = HOVER
      else if (!hit) bg = i % 4 === 0 ? REST_BEAT : REST
      else bg = isOn ? color[c === 'X' ? 0 : 1] : MUTED
      return Box({ key: name + i, width: 2, height: 1, marginRight: gap(i), backgroundColor: bg, children: [Text({ children: [' '] })] })
    })
    return Box({
      key: 'g-' + name,
      flexDirection: 'row',
      children: [Box({ key: 'l-' + name, width: LABEL, children: [label] }), ...cells],
    })
  })
  return Box({ flexDirection: 'column', children: [header, ruler, ...rows] })
}
