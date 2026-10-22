// The dancer over the grid: who dances, as frames of text. Pure: register.js
// picks the dancer and hands its frames to dancer.client.js, which moves it
// to the beat.
//
// A dancer is one word in $.store ('dancer'): a name below, `off`, or your
// own frames separated by `;` ("(•_•);( •_•)>⌐■-■;(⌐■_■)"), one line each.
// A frame is a list of lines, all frames of one dancer as tall as each other.

// clawd (the creature of the Claude Code welcome screen) is pixel art: 18
// pixels wide, 6 tall, `#` on, `.` off. `px` turns two by two pixels into
// one quadrant block (▘▝▀▖▌▞▛▗▚▐▜▄▙▟█), so a frame is three lines of nine
// cells. Eyes sit on the bottom half of a line (the notch in ▛ ▜ ▙ ▟).
const QUAD = ' ▘▝▀▖▌▞▛▗▚▐▜▄▙▟█'
export function px(art) {
  const rows = art.trim().split('\n').map((r) => r.trim())
  const on = (y, x) => (rows[y]?.[x] === '#' ? 1 : 0)
  const out = []
  for (let y = 0; y < rows.length; y += 2) {
    let line = ''
    for (let x = 0; x < rows[0].length; x += 2) line += QUAD[on(y, x) | (on(y, x + 1) << 1) | (on(y + 1, x) << 2) | (on(y + 1, x + 1) << 3)]
    out.push(line)
  }
  return out
}

// Each: { color (a theme key or a hex), bold, frames, and for a flyer:
// rows (how tall its region is), wrap (it flies out on the right and comes
// back on the left, never turns), trail (a rainbow behind it: the
// characters, one color per row, and how much shorter each row above is) }.
// Frame 0 is the rest pose; the dance walks the others.
export const DANCERS = {
  // rest, both arms up, eyes up, one arm up
  clawd: { color: 'claude', frames: [`
    ...############...
    ...##.######.##...
    .################.
    ...############...
    ....#.#....#.#....
    ..................`, `
    #..############..#
    .#.##.######.##.#.
    ..##############..
    ...############...
    ...#.#......#.#...
    ..................`, `
    ...##.######.##...
    ...############...
    .################.
    ...############...
    .....#.#..#.#.....
    ..................`, `
    #..############...
    .#.##.######.##...
    ..###############.
    ...############...
    ....#.#....#.#....
    ..................`].map(px) },
  // after djui/nyancat (github.com/djui/nyancat): the cat, its legs in two
  // frames, and the slanted rainbow of `*.,*'^ that shimmers behind it
  nyan: {
    color: 'text',
    bold: true,
    frames: [
      [' ,---/V\\ ', '~|__(o.o)', ' U U U U '],
      [' ,---/V\\ ', '~|__(o.o)', '  UU  UU '],
    ],
    rows: 5,
    wrap: true,
    trail: { chars: "`*.,*'^", colors: ['#ff4b4b', '#ffd23f', '#3ccf5a', '#3f9bff', '#b46bff'], angle: 4 },
  },
}
export const DANCER_NAMES = Object.keys(DANCERS)
export const DEFAULT_DANCER = 'clawd'

// What the band hands the dancer for a word, or null for off. An unknown
// word is your own dancer: its frames split on `;` (one frame bounces).
export function dancerFor(word) {
  const w = String(word ?? DEFAULT_DANCER).trim()
  if (!w) return dancerFor(DEFAULT_DANCER)
  if (w.toLowerCase() === 'off') return null
  const known = DANCERS[w.toLowerCase()]
  if (known) return { name: w.toLowerCase(), ...known }
  const frames = w.split(';').map((f) => f.trim()).filter(Boolean).slice(0, 8).map((f) => [f.slice(0, 24)])
  return frames.length ? { name: 'own', color: 'claude', frames } : dancerFor(DEFAULT_DANCER)
}

// The dancer after this one, for a click on it: the names in turn, then off,
// then the first again. Your own dancer goes to the first name.
export function nextDancer(word) {
  const w = String(word ?? DEFAULT_DANCER).trim().toLowerCase()
  const i = DANCER_NAMES.indexOf(w)
  return i === -1 ? DANCER_NAMES[0] : DANCER_NAMES[(i + 1) % DANCER_NAMES.length]
}

// What the dancer does in each section: how many steps between two poses,
// how many steps between two columns of its walk (0 stands still), whether
// it jumps on the offbeat, and notes around it. A handover moonwalks.
export const MOVES = {
  intro: { pose: 8, walk: 8, jump: false, notes: false },
  outro: { pose: 8, walk: 8, jump: false, notes: false },
  groove: { pose: 4, walk: 4, jump: false, notes: false },
  break: { pose: 8, walk: 0, jump: false, notes: false },
  build: { pose: 2, walk: 2, jump: false, notes: false },
  drop: { pose: 2, walk: 2, jump: true, notes: true },
  handover: { pose: 4, walk: -4, jump: false, notes: false },
}

// What it says when a section starts, for two beats.
export const SAYS = {
  build: ['wait for it', 'here it comes', 'hold on'],
  drop: ['DROP', 'oonts oonts', 'ship it', 'lets gooo'],
  break: ['…breathe', 'ahh', 'mm'],
  outro: ['gg', 'one more?'],
  handover: ['next!', 'mixing…'],
}
