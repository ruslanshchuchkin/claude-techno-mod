// The dancer: a little character that walks across the deck and dances to
// the beat, on the surface's own frame clock (like the grid), so it moves
// without a redraw of the whole band. Four rows (or the dancer's `rows`):
// the top one for its jumps, notes and what it says, the dancer at the bottom.
//
// props: { frames, color, bold, rows, wrap, trail, move, says, section,
// playing, step, stepMs, stamp }. Everything up to trail comes from
// dancers.js (dancerFor), move is MOVES[section], says the lines for the
// section it plays. A click on it posts { dancer: 'next' }: the next dancer.
//
// It walks one column every |move.walk| steps (back the other way when it is
// negative, a moonwalk), bounces off the edges, takes the next pose every
// move.pose steps, and with move.jump hops on the offbeat. Stopped, it sleeps.
// A dancer with `wrap` flies on to the right instead, out of the right edge
// and back in on the left, its `trail` (a rainbow) behind it from the left edge.
const len = (s) => [...s].length

export default function Dancer(props, surface) {
  const { Box, Text } = surface.elements
  const prev = surface.state
  let st = prev ?? { t: 0, step: props.step, stamp: props.stamp, x: null, dir: 1, section: props.section, bubble: null, ref: { props }, stop: null, stepMs: 0 }
  if (!prev) surface.onPointer((ev) => { if (ev.type === 'down') surface.post({ dancer: 'next' }) })
  st.ref.props = props

  let changed = !prev
  if (props.stamp !== st.stamp) { st = { ...st, step: props.step, stamp: props.stamp }; changed = true }
  // a new section: it says so for two beats
  if (props.section !== st.section) {
    const says = props.playing && props.says?.length ? props.says[st.t % props.says.length] : null
    st = { ...st, section: props.section, bubble: says ? { text: says, until: st.t + 8 } : null }
    changed = true
  }
  const wantMs = props.playing ? props.stepMs : 0
  if (wantMs !== st.stepMs) {
    if (st.stop) st.stop()
    const tick = () => {
      const s = surface.state
      const p = s.ref.props
      const t = s.t + 1
      const W = surface.columns || 60
      const room = p.wrap ? W - 1 : Math.max(0, W - width(p.frames))
      let x = Math.min(startX(s.x, p, W), room), dir = s.dir
      const walk = p.move?.walk ?? 0
      if (walk && t % Math.abs(walk) === 0) {
        if (p.wrap) x = x >= room ? 0 : x + 1
        else {
          x += dir * Math.sign(walk)
          if (x < 0 || x > room) { dir = -dir; x = Math.max(0, Math.min(room, x + 2 * dir * Math.sign(walk))) }
        }
      }
      surface.setState({ ...s, t, step: (s.step + 1) % 128, x, dir, bubble: s.bubble && t < s.bubble.until ? s.bubble : null })
    }
    st = { ...st, stepMs: wantMs, stop: wantMs ? surface.every(wantMs, tick) : null }
    changed = true
  }
  if (changed) surface.setState(st)

  const W = surface.columns || 60
  const frames = props.frames?.length ? props.frames : [['?']]
  const sw = width(frames)
  const move = props.move ?? {}
  const playing = !!props.playing
  // a flyer may slip out on the right while it flies; standing, it is whole
  const x = Math.max(0, Math.min(startX(st.x, props, W), props.wrap && playing ? W - 1 : W - sw))
  const frame = playing ? frames[Math.floor(st.t / Math.max(1, move.pose ?? 4)) % frames.length] : frames[0]
  const ROWS = Math.max(4, props.rows ?? 4, frame.length + 1)
  const base = ROWS - frame.length
  const lift = playing && move.jump && st.step % 4 === 2 ? base - 1 : base
  const rows = Array.from({ length: ROWS }, () => [])
  frame.forEach((line, i) => rows[i + lift]?.push({ x, text: line, color: props.color, bold: !!props.bold }))
  // the rainbow: one color a row, each row above `angle` shorter, its
  // characters moving on every step, so it shimmers; it hops with the dancer
  const trail = playing ? props.trail : null
  if (trail) {
    const n = trail.chars.length
    for (let r = base - lift; r < ROWS; r++) {
      const end = x - (trail.angle ?? 0) * (ROWS - 1 - r)
      if (end > 0) rows[r - (base - lift)].push({ x: 0, text: Array.from({ length: end }, (_, c) => trail.chars[(c + n - (r % n) + st.t) % n]).join(''), color: trail.colors[r % trail.colors.length], bold: true })
    }
  }
  // notes trail behind it in a drop, rising
  if (playing && move.notes && !trail) {
    for (let i = 0; i < 2; i++) {
      const nx = x + (st.dir > 0 ? -3 - i * 3 : sw + 2 + i * 3)
      const ny = 3 - ((Math.floor(st.t / 2) + i * 2) % 4)
      if (ny !== 0 || lift === base) rows[base - 1 + ny]?.push({ x: nx, text: i ? '♫' : '♪', dim: true })
    }
  }
  const bubble = !playing ? 'z Z z' : st.bubble?.text
  if (bubble) {
    const right = x + sw + 1
    rows[0].push({ x: right + len(bubble) <= W ? right : Math.max(0, x - len(bubble) - 1), text: bubble, dim: !playing, bold: playing })
  }

  return Box({
    flexDirection: 'column',
    children: rows.map((items, r) => Box({ key: 'd' + r, flexDirection: 'row', height: 1, children: line(Text, items, W, r) })),
  })
}

// where it is; before its first step a flyer starts a third of the way in,
// so its rainbow shows at once
const startX = (x, props, W) => x ?? (props.wrap ? Math.floor(W / 3) : 0)

function width(frames) {
  let w = 1
  for (const f of frames ?? []) for (const l of f) w = Math.max(w, len(l))
  return w
}

// One row: the items in order, the gaps as spaces, nothing past the edge.
function line(Text, items, W, r) {
  const out = []
  let at = 0
  for (const it of items.filter((i) => i.x >= 0).sort((a, b) => a.x - b.x)) {
    if (it.x < at) continue
    const text = [...it.text].slice(0, Math.max(0, W - it.x)).join('')
    if (!text) continue
    if (it.x > at) out.push(Text({ key: 'g' + r + '-' + at, children: [' '.repeat(it.x - at)] }))
    out.push(Text({ key: 'i' + r + '-' + it.x, ...(it.color ? { color: it.color } : {}), ...(it.dim ? { dimColor: true } : {}), ...(it.bold ? { bold: true } : {}), children: [text] }))
    at = it.x + len(text)
  }
  return out.length ? out : [Text({ key: 'e' + r, children: [' '] })]
}
