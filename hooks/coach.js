// The coach: one suggested next move at a time, following the shape of a
// techno set (intro, build, break, drop). Pure functions, no mods API.
import { activeLayers } from './engine.js'

export const PARTS = ['intro', 'build', 'break', 'drop']

// Each move names the control to highlight (`key`) and when it counts as done.
// `skip` is true when the track already does what the move asks.
const MOVES = [
  { id: 'play', part: 'intro', key: 'play', tip: 'Press play to hear your track', done: (t, m) => m.playing },
  { id: 'energy', part: 'build', key: 'energy-up', tip: 'Build it up: turn the energy up', skip: (t) => t.energy >= 3, done: (t) => t.energy >= 3 },
  { id: 'clap', part: 'build', key: 'layer-clap', tip: 'Add the clap on beats 2 and 4', skip: (t) => activeLayers(t).clap, done: (t) => activeLayers(t).clap },
  { id: 'acid', part: 'build', key: 'layer-acid', tip: 'Bring in the acid line. It plays your phrase.', skip: (t) => activeLayers(t).acid, done: (t) => activeLayers(t).acid },
  { id: 'break', part: 'break', key: 'layer-kick', tip: 'Breakdown: take the kick out', done: (t) => !activeLayers(t).kick },
  { id: 'drop', part: 'drop', key: 'layer-kick', tip: 'The drop: bring the kick back in', done: (t) => activeLayers(t).kick },
  { id: 'dice', part: 'drop', key: 'dice', tip: 'Roll the dice for fresh patterns', done: (t, m) => m.diced },
  { id: 'keep', part: 'drop', key: 'keep', tip: 'Like it? Keep it in your tracks', done: (t, m) => m.kept },
  { id: 'share', part: 'drop', key: 'share', tip: 'Send it to a friend: copy the play line', done: (t, m) => m.shared },
]

// Walks the moves in order and returns the first one still open.
// `doneIds` is a Set the caller keeps per track; this marks moves in it.
export function nextMove(track, flags, doneIds) {
  if (!track) return { id: 'pick', part: 'intro', key: 'pick', tip: 'Pick a track to start' }
  for (const m of MOVES) {
    if (doneIds.has(m.id)) continue
    // the order matters: 'drop' is only reached once 'break' took the kick out
    if ((m.skip && m.skip(track, flags)) || m.done(track, flags)) { doneIds.add(m.id); continue }
    return m
  }
  return { id: 'next', part: 'drop', key: 'next', tip: 'Your set is done. Try another track.' }
}
