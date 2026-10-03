// The step grid, drawn on the surface's own frame clock so the playhead moves
// without a redraw of the whole pane. A click on a row posts { toggle: layer }.
//
// props: { rows: [[name, pattern, color, isOn]], step, stepMs, playing, stamp }
export default function Grid(props, surface) {
  const { Box, Text } = surface.elements
  const prev = surface.state
  let st = prev ?? { step: props.step, stamp: props.stamp, ref: { props }, stop: null, stepMs: 0 }
  if (!prev) {
    surface.onPointer((ev) => {
      if (ev.type !== 'down') return
      const row = st.ref.props.rows[ev.y - 1]
      if (row) surface.post({ toggle: row[0] })
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
  const header = Text({ dimColor: true, children: [props.playing ? `bar ${bar}/8 · click a row to mute it` : 'click a row to mute it'] })
  const rows = props.rows.map(([name, pattern, color, isOn]) =>
    Box({
      key: 'g-' + name,
      flexDirection: 'row',
      children: [
        Text({ dimColor: !isOn, strikethrough: !isOn, children: [name.padEnd(7)] }),
        ...[...pattern].map((c, i) =>
          Text({
            key: name + i,
            color: isOn && c !== '.' ? color : undefined,
            dimColor: !isOn || c === '.',
            bold: c === 'X',
            inverse: i === col,
            children: [c === '.' ? '·' : '■'],
          }),
        ),
      ],
    }),
  )
  return Box({ flexDirection: 'column', children: [header, ...rows] })
}
