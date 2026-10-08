// The classics: names that are good songs on their own. The new song screen
// shows a few of them, and auto plays one after every three of your chats
// (Ruslan, 2026-10-08: "let's generate more classics as well! maybe we
// sometimes wire them in"). Pure data, shared by the chat and the player.
// The first eight are the old starters; keep them, old favorites point at them.
export const CLASSICS = [
  'late night deploy', 'coffee at 3am', 'merge conflict', 'friday deploy', 'null pointer', 'ship it', 'warehouse 4am', 'rooftop sunrise',
  // the city at night, 5am
  'empty tram at 5am', 'neon on wet asphalt', 'last train home', 'streetlights going out', 'still awake at 5am', 'sodium lights', 'underpass echo', 'the city exhales',
  // space, 3am
  'drifting past the moon', 'orbit at 3am', 'signal from deep space', 'falling through stars', 'cold sleep', 'launch window', 'chasing the comet', 'mission control at 3am',
  // the errors you meet on a sunday
  'segfault on sunday', 'connection refused', 'kernel panic', 'permission denied', 'race condition', 'deadlock', 'cache miss', 'timeout exceeded', 'out of memory', 'sunday hotfix', 'rollback at midnight', 'build failed again',
]

// A small stable hash, so a pick from the classics is the same in every call.
export function pickIndex(text, n) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return (h >>> 0) % n
}
