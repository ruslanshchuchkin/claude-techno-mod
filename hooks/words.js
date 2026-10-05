// Chat words: the two or three most unusual words of a prompt become a
// phrase that auto can pick as a track (Ruslan, 2026-10-05: "use the data
// from chats to randomize the track"). The phrase is the track's name and
// sits in its share code, so only plain words pass: no paths, links, emails,
// numbers, or anything that looks like a key. Pure, so the tests call it.

const COMMON = new Set(`
a about above after again against all also always am an and any are aren around as ask at back be because been before
being below between both but by can cannot could did didn do does doesn doing don done down during each else even
ever every few find first for from further get gets getting give go goes going gone good got had has hasn have having
he her here hers herself him himself his how however i if in into is isn it its itself just keep know last let like
look looks make makes making many may maybe me might more most much must my myself need needs never new next no nor
not now of off ok okay on once one only or other our ours out over own please put quite rather really right said same
say see seem seems shall she should show so some something still such sure take than thank thanks that the their
theirs them themselves then there these they thing things think this those though through thus to too try trying
twice under until up upon us use used using very want wants was wasn way we well were weren what when where whether
which while who whom why will with without won would wouldn yes yet you your yours yourself
again best less lets thats whats
add added change changes changed check code create delete doesnt dont error file files fix fixed help hey hi im
issue line lines move remove rename run running set start stop test tests update write wrong work works working
claude
techno track tracks music song songs beat beats bass kick hats clap drop drops acid swing tempo bpm mood sad dark
mysterious louder quieter darker lighter faster slower play playing pause skip previous favorite favorites
`.split(/\s+/).filter(Boolean))

// A word that can carry a track name: letters only, 3 to 14 of them.
const plain = (w) => /^[a-z]{3,14}$/.test(w) && !COMMON.has(w)

// The phrase for a prompt, or null when it has fewer than two such words.
export function keyWords(text) {
  const clean = String(text ?? '')
    .replace(/<[^>]*>/g, ' ') // tags
    .replace(/\S*[/\\@:=_`$#{}[\]<>|~]\S*/g, ' ') // paths, links, emails, code
    .replace(/\S*\d\S*/g, ' ') // anything with a digit
    .replace(/\b[A-Z][A-Z0-9]{3,}\b/g, ' ') // SHOUTED names and keys
  if (/^\s*\//.test(String(text ?? ''))) return null // a slash command
  const words = clean.toLowerCase().split(/[^a-z']+/).map((w) => w.replace(/'.*$/, ''))
  const seen = new Set()
  const picked = words
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => plain(w) && !seen.has(w) && seen.add(w))
  if (picked.length < 2) return null
  // the longest words are the rarest; keep them in the order they were said
  return picked
    .sort((a, b) => b.w.length - a.w.length || a.i - b.i)
    .slice(0, 3)
    .sort((a, b) => a.i - b.i)
    .map(({ w }) => w)
    .join(' ')
}
