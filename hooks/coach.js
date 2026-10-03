// The coach: the one thing to press next, following the build in PLAN
// (intro, groove, build, peak, break, drop, outro). Pure functions, no mods API.
import { PLAN } from './engine.js'

// `key` names the button drawn as `variant: 'primary'`. `tip` says what you
// hear now; `label` says what the NEXT button does.
export function nextMove(track, { playing, finished }) {
  if (!track) return { id: 'pick', key: 'pick', tip: 'Pick a track to start' }
  if (finished) return { id: 'done', key: 'replay', tip: 'Your track is done.' }
  const part = track.part
  if (part === null || part === undefined) {
    return { id: 'build', key: playing ? 'do-move' : 'play', label: 'build it from the kick', tip: 'This is the whole track at once. Build it up one part at a time.' }
  }
  const here = PLAN[part]
  const last = part === PLAN.length - 1
  return {
    id: last ? 'finish' : 'advance',
    key: playing ? 'do-move' : 'play',
    label: last ? 'finish the track' : 'next: ' + PLAN[part + 1].go,
    tip: playing ? here.tip : 'press play to hear it',
  }
}
