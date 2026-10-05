# techno (Claude Code mod)

A Claude Code mod. A phrase grows a techno track: a long set of about seven
minutes (intro, groove, build, three drops with breakdowns between them, an
outro) that mixes by itself into the next track, layer by layer. One
background player makes the music for every chat; the band above the chat box
is a remote control, and so are the Mac's play, next and previous keys. You
keep tracks you love in favorites, and Claude changes the music from chat with
the `jam` tool.

Needs Claude Code v2.1.286 or later (plays in the desktop Code tab on
2.1.286, built and checked in the CLI on v2.1.288), macOS 12 or later, and
node 20 or later. Public at https://github.com/ruslanshchuchkin/claude-techno-mod
(MIT); `README.md` is the front page for strangers.

## Files

| File | What it is |
|---|---|
| `.claude-plugin/plugin.json` | Plugin manifest. Name `techno`. |
| `.claude-plugin/marketplace.json` | Local marketplace `techno-mod`, so the plugin installs as `techno@techno-mod`. |
| `hooks/hooks.json` | Points to the hooks module. |
| `hooks/package.json` | `"type": "module"`, so node 20 runs the player (it imports `engine.js`). |
| `hooks/register.js` | The chat side: a remote control for the player. Starts the player when none (or an older one) answers, polls its state every second, `/techno` command, `jam` tool, save and share. Every `$` call lives here (the validator refuses `$` passed to imported files). |
| `hooks/views.js` | The app's screens as pure functions of `(ui, vm, act)`: the deck (layout A with the skyline), the edit card (layout B), favorites (with the tracks heard before), new track, and the bar shown while the app is hidden. |
| `hooks/words.js` | Pure: `keyWords(prompt)`, the 2 or 3 plain words of a prompt that become a track auto may pick. |
| `hooks/grid.client.js` | A `Client` surface module: the step sequencer with its own playhead clock. Colors of empty cells and the playhead are theme keys (`subtle`, `text`), so it reads in light and dark. A click on a row name posts `{ toggle: layer }`; a click on a cell posts `{ step, layer }`. |
| `hooks/engine.js` | The synth, `PLAN` (the set), `HANDOVER`, `render` (a folded loop, for mp3s), `renderLoop` (a loop with its tail, for the stream, optionally mixed with a second track). Plain JS with no Node or browser APIs. |
| `hooks/conductor.js` | Pure: what each loop of a set plays (`loopSpec`), how auto moves on (`afterLoop`, `stepOn`), and the `mixer` that cuts loops into bars and carries the tails. Shared by the player and the scripts. |
| `player/techno.mjs` | The background player (node). Owns the set, auto, favorites, history and undo; renders a loop ahead and feeds bars to the helper; answers chats on a Unix socket (`GET /state`, `POST /cmd`). |
| `player/TechnoPlayer.swift` | The helper app: plays the bars gaplessly (AVAudioSourceNode), shows "Now Playing" in Control Center, passes the media keys back. The player compiles it with `swiftc` into `~/Library/Caches/techno/TechnoPlayer.app` when the source changes. |
| `scripts/set.mjs` | Render a whole auto set with the handover to a WAV, and print each loop with its transitions: `node scripts/set.mjs "ship it" "warehouse 4am" out.wav`. |
| `scripts/render.mjs` | Render one loop to a WAV: `node scripts/render.mjs "phrase" out.wav [repeats]`. |
| `scripts/buildups.mjs` | Render the build into drop 1 once per build-up pack (`0-now`, `1-riser`, `2-filter`, `3-echo`) to compare them: `node scripts/buildups.mjs "late night deploy" previews/buildups`. |
| `scripts/smoke.mjs` | Fast node checks: version match, every part renders, the handover renders, every build, fall and the swell render. |
| `tests/techno.test.ts` | Real tests for `claude plugin test`, against a fake player on the socket. |
| `player/bin/TechnoPlayer` | The prebuilt helper: one universal binary (arm64 and x86_64, ad-hoc signed), so a new user needs no Xcode tools. `TechnoPlayer.sha1` beside it is the sha1 of the Swift source it came from. |
| `scripts/build-helper.mjs` | Builds `player/bin/` from `TechnoPlayer.swift`. Run it after every change to the Swift file; smoke fails until you do. |
| `README.md`, `LICENSE` | The public front page (its own voice, not STE) and the MIT license. |
| `media/late-night-deploy-drop-1.mp3` | The 29 s demo the README links: the riser into drop 1 of `late-night-deploy@133m0e2k2`. |

## Decisions

### 0.9.3 packaging (Ruslan, 2026-10-05)

- **Public repo, plugin marketplace install, option B** (picked from A as
  it is, B prebuilt helper, C no node: the Swift helper runs the engine in
  JavaScriptCore). The repo is `ruslanshchuchkin/claude-techno-mod`; the
  marketplace inside it keeps the name `techno-mod`, so the install id stays
  `techno@techno-mod` for everyone, Ruslan's local install too. Install:
  `/plugin marketplace add ruslanshchuchkin/claude-techno-mod`, then
  `/plugin install techno@techno-mod`, then a new chat.
- **The helper ships prebuilt.** `buildHelper()` in the player copies
  `player/bin/TechnoPlayer` into `TechnoPlayer.app` when its sha1 matches the
  Swift source (a new file renamed over the old, so a running helper keeps
  its own). Only a changed source calls `swiftc`. Without `swiftc` the player
  prints `techno: ... run xcode-select --install` and exits; the chat reads
  that line from `daemon.out` and shows it in the band. `git clone` sets no
  quarantine flag, so Gatekeeper lets the binary run. Option C waits until
  people ask for it.
- **0.9.4: ↗ beside ♡ copies the play line** (picked from A in the bottom
  line, B beside the heart, C a click on the name; Ruslan: "i can't see share
  button on a track"). It sits in `transport()`, so the bar has it too. The
  edit card's old "↗ share" is now "↓ mp3" (it saves the mp3 and copies the
  line): one word for one meaning. `/techno stop | save | code` still work but
  are out of the README and the command hint.
- **0.9.4: chat words** (Ruslan picked "key words, on"). `keyWords()` in
  `hooks/words.js` takes the 2 or 3 longest plain words of a prompt (no common
  or music words, paths, links, emails, digits, SHOUTED keys; fewer than 2
  words gives nothing). `prompt.submit` sends `{ op: 'words', phrase }` with
  `ask` only, so a prompt never starts the player. The player keeps them in
  `pool` (the last 40, shared by every chat) beside the repo names.
- **The master, measured** (2026-10-05, Ruslan: "does auto apply mastering
  as well? ... not disturbing"). A whole auto set as the helper plays it
  (gain 0.7): -14.4 LUFS integrated, LRA 2.8 LU, true peak -2.9 dBFS,
  crest about 10.7 dB; the 2.5 kHz band sits 21 dB under the sub. No change
  needed; the README says it. Measure again with `ffmpeg -i set.wav -af
  "volume=0.7,ebur128=peak=true" -f null -` after a change to the master.
- **README voice**: its own voice (playful, not STE), a stars badge, one star
  line under the pitch and one in the footer.
- **The web page with a player is parked** ("for now let's focus not on web
  page but on packaging"). A proof in `web/` (not committed) plays the same
  engine and conductor in a browser worker; a loop renders in 0.2 to 0.5 s.
- **The README demo**: the mp3 link now, through jsDelivr (GitHub sends a raw mp3 as a download; jsDelivr sends `audio/mpeg`, so it plays in the tab). A 1280x720 mp4 with a waveform
  (about 5 MB) waits for Ruslan to drag it into the README on github.com,
  the only way GitHub plays a video inline. A screen recording of the deck
  would be better; the session cannot capture the screen.

### 0.9 (Ruslan, 2026-10-04), these win over older notes below

- **The part bar, option A** (0.9.2, Ruslan: "make it A · inline bar ... too
  many words and i don't like to see bar 1/8"). It replaces the section
  words: one block per loop (about 15 s, so the bar agrees with the clock),
  played ▰, the part that plays in the accent (▰ played of it, ▱ left of
  it), the rest ▱ dim; then the part's name and `2:52 / 6:47`. `partBar()`
  in views.js. The grid has no "bar n/8" line any more (grid.client.js,
  `TOP` = 1).
- **Clarity review** (2026-10-04): an Opus agent, playing a first-time user,
  read screenshots of the deck, the edit card and the bar. Its worst points:
  "auto" with a dot, the techno words (drop, breakdown, build, groove), the
  grid that reads as stripes, one word for two things, "main" as a song name.
  Fixes wait for Ruslan's picks.
- (replaced by the part bar) **The song as words, option C** (0.9.1, Ruslan: "named sections, every
  part has its word, the current one underlined"). It replaces the skyline
  under the top line: `intro groove build drop 1 break drop 2 break drop 3
  outro`, from the track's plan (`sections()` in views.js; parts of one
  section side by side are one word, a drop keeps its number). Played in the
  text color, the one that plays now underlined in the accent, the rest dim.
  On the right, with auto, `break in 0:37 ·` (when the next section starts),
  then `2:43 / 6:26`. The words wrap in a narrow window. `where.parts` in the
  view model.

- **The edit card, layout B "focus card"** (picked from A mixer, B focus
  card, C say it; seeds `UQqiWLx8P0E6wCP`, `mLUEzDaS8jRVC4G`,
  `yTXMi3ec7bCLbmE`). "edit" opens a card under the grid: tabs for the
  sounds that play, `+ sound`, `song`, `master`; on the right undo, share,
  done. The old edit row (new rhythm, the acid toggle "melody", tempo) is
  gone ("i don't like that melody just adds acid"). Per sound:
  - sound: `INSTRUMENTS` (kick deep/punchy/boom/hard, bass
    rolling/sub/growl/acid, hats tight/long/metal/dusty, clap
    room/snap/snare, perc rim/tom/bell, melody acid/square/pluck/soft).
    Index 0 is the phrase's own sound. Share code `%<layer><n>`.
  - pattern: `PATTERNS` to try, written as step edits (`setPattern`), plus
    the grid clicks; "as written" clears them.
  - notes (bass, melody): one button per hit, a tap moves it up the scale
    (8 degrees, then back to the root); "suggest" writes a new line that fits
    the scale (`suggestNotes`). Share code `~<layer><16 chars>`, a scale
    degree 0-9a-e per step or `.`.
  - tone: cut (muffled .. thin, a low-pass or a high-pass on the sound) and
    grit (clean .. crushed). Share code `^<layer><cut+3><grit>`.
  - master: filter (a low-pass), low cut (a high-pass), space (the reverb),
    tempo. Share code `!<lp+3><hp><space+2>`.
  - song: the parts in order with × (not the one that plays), "+ breakdown
    and a drop", "+ longer groove", "+ longer build", "+ a breakdown" (★ on
    the recommended one, `planAdds`), new rhythm. The track keeps its own
    `plan` (PLAN indexes; share code `/` + hex). The set walks it by
    position (`set.at`, `posOf`); a build-up goes on the part before every
    drop, a fall on every drop, wherever they sit.
  Every action is `editTrack(track, { kind, layer, ... })` in engine.js; the
  player takes `{ op: 'edit', ... }` (plan kinds go to `planEdit`, which
  keeps the set's place).
- **The auto handover starts the next song from its kick or its hats**
  ("yes start the next song from the kick or hihats"). `HANDOVERS`: `kick`
  (the old song thins to kick and hats, the new one starts at part 0) or
  `hats` (the new hats come in over the old low end, then it lands at part
  2). `transitionsOf(old).land` picks it by mood. Two steps of two loops,
  then the swap build-up and a crash and boom on the landing.

### 0.8.3 to 0.8.5 (Ruslan, 2026-10-04)

- **Auto makes everything; manual is where you make it** ("i want auto to
  make everything for me"). Auto picks the parts, the transitions, and later
  the filters and the master filters by itself. Manual (a button, not yet
  built) holds the song on its part and lets you change: the sample (the
  instrument), the pattern, the notes (with suggested ones from the scale of
  the mood), the plan itself (remove a part such as groove, add a part you
  pick, with a recommended one), and filters per sound plus master filters.
  Step by step: auto first, manual after.
- **The deck top line**: ⏮ ■ ⏭ side by side on the left (⏭ is always the
  next track, `skip`), then the track, ♡, `· mood · bpm`. On the right: auto,
  hide. The "drop 3 → outro" line is gone.
- **The skyline, option B** (0.9.1 replaced it with option C, see above;
  picked from A inline bar, B skyline, C named sections). One line under the top: the shape of the set, two cells a loop
  (`▁` calm .. `█` drop), played cells in the text color, the cell that
  plays now in the accent (`claude` theme key), the rest dim, then the part
  name and `4:15 / 6:45`. `where` in the view model (register.js) holds the
  energy of every loop, the position in loops and the times; `skyline()` and
  `whereLine` in views.js draw it. It never wraps (0.8.5, "doesn't work when
  window is shorter"): it takes `viewport.columns - 4` cells at most (two a
  loop when there is room), and the part and time move under it when they
  do not fit beside it. In the desktop a block cell is one column wide.
- **⏭, ⏮ and a pick start the song from its beginning** (0.8.5, "new track
  didn't start from the beginning but from stage 3"), on the next bar. Only
  the auto handover after an outro still brings the next song in at its
  build (0.9: it starts the next song from its kick or its hats too).
- **The bar uses the same transport** (`transport()` in views.js): ♪ ⏮ ■ ⏭,
  the track, ♡, mood and bpm, the part; auto, open and × stick to the right.
- **Transitions, picked by the song** (0.8.4, Ruslan: "i love all 3! add
  them and more ... do it randomly ... but so that it always fits the
  song"). `transitionsOf(track)` in engine.js, seeded by phrase and dice, so
  a share code always plays the same ones. Auto only (`loopSpec`):
  - build, the last loop before each drop (`BUILDS`): `riser` (8-bar riser,
    a clap roll that speeds up), `filter` (resonant low-pass closes, one beat
    of silence), `echo` (bass fades, one clap thrown into a long echo, a
    reversed crash), `stutter` (4-bar riser, the last bar repeats its first
    beat in 1/8, 1/16, 1/32 slices through an opening high-pass). The drop
    after it gets a crash and a boom.
  - fall, the last loop of each drop (`FALLS`): `tapestop` (the last two
    beats slow to a stop), `washout` (the last bar fades into a big reverb
    and echo), `downlifter` (falling noise into the next part).
  - swell: a one-beat reversed cymbal before a new sound in the intro and
    groove (each about 60% of the time).
  - swap: a build-up on the last handover loop; the new track lands with a
    crash and a boom (`set.swapped`).
  The fit rules: the mood weights the packs (`BUILD_WEIGHTS`, `FALL_WEIGHTS`:
  sad leans riser and filter, dark leans filter, echo, stutter; dark falls
  lean tapestop), never the same build or fall twice in a row, the last drop
  gets riser or filter, the swap differs from the last build.
  Listen: `node scripts/set.mjs "late night deploy" "warehouse 4am" out.wav 2`
  prints every transition it plays.

### 0.8 (Ruslan, 2026-10-03), these win over older notes below

- **A long set with ups and downs** ("the track shouldn't be 1:20 ... a few
  drops"). `PLAN` has 11 parts with `loops` for auto: kick, + deep bass,
  + hats, + rumble, + percussion (riser), drop 1 (+ clap), breakdown (pad,
  riser), drop 2 (+ ride), breakdown 2 (pad, whisper, riser), drop 3 (+ the
  deep voice), outro. About 6:50 a track, then 1:45 of handover. A riser and a
  clap roll lead into each drop (`rise`, auto only); a crash opens each drop.
- **No stabs** ("they make the track less serious"). The dub chord is out of
  the plan and out of the old full-track default. A ride (drops 2 and 3) and a
  dark pad (breakdowns, one swell per loop) take its place. Chords (the pad,
  and a stab Claude brings in) are never bright: a minor triad plus octave
  where the scale has a minor third, root-fifth-octave on hijaz (mysterious).
  The old picked-scale chord was 1-3-5-7 of the scale, a dominant seventh on
  hijaz ("on mysterious they destroy the vibe, something is off", 2026-10-04). `stab` still
  exists for old codes and Claude.
- **Handover A** (picked from three drawn options; 0.9 replaced its shape, see above). After the outro the old
  track takes one layer out per step while the new one brings one in, then
  the whole low end swaps at once (`HANDOVER`, 3 steps of 2 loops). The new
  track goes on from its build (`HANDOVER_TO` = 4), at the old tempo. Nothing
  resets to 1/10.
- **Player architecture A** ("I hear auto playing somewhere but I cannot find
  it ... stop with a play button on my mac keyboard"). One node process owns
  the music; chats only ask and command. Two chats can no longer start two
  players. TechnoPlayer.app shows the track in Control Center and takes the
  play/pause, next and previous keys (next: the next part with auto off, the
  next track with auto on). It quits when no Claude Code process is left.
  A chat with a newer version replaces an older player (state is kept).
- **No pause before a change** ("right before the next thing ... a little
  delay"). The player streams bars, not 15 s loops: it renders the next loop
  at bar 4 of the current one, keeps two bars queued, and an edit drops the
  queued bars and lands on the next bar.
- **The deck, layout A** (0.8.3 changed its top line, see above; must-haves from Ruslan: play/stop, the track and its
  mood, auto, next when auto is off, mood, the grid stays "it makes the app
  alive", edit as a separate button, favorites, previous track). Top: ⏮, play,
  name · mood, ♡, auto, hide. Then the part and what is next (a
  countdown with auto). Grid. ⏮ sits right before play/stop, in the app and
  in the bar (Ruslan, 2026-10-04: "previous and stop should be next to each other"). Under it: mood sad/mysterious/dark, next part ›
  (auto off only), edit, ♥ favorites n. Edit opens: new rhythm, melody (the
  acid riff), tempo −/+, undo, share mp3. "auto", not "build by itself".
  Mockups A, B, C were drawn; A is built until Ruslan picks.
- **Selected = a filled primary button** ("in light theme I cannot see what's
  selected"). Never dim against normal text for on/off.
- **Favorites and previous** ("save it to my favorites ... play them one
  after another or see/share them", "go to previous track ... it was a
  banger"). ♡ keeps the track (identity code, no part). The favorites screen
  plays one, plays them in turn (auto picks from favorites), copies a line,
  removes; under it "heard before" lists the last tracks with ♡ keep. ⏮ jumps
  back to the last track heard, at its build. The kept list of 0.7 moves into
  favorites on the first 0.8 chat (`hello`).
- **Fixed master level**. The master no longer normalizes each loop, so a
  breakdown sits about 6 dB under a drop. `MASTER_GAIN` in engine.js.

### Before 0.8

- **Direction C, "Co-producer", plus the dice key from A** (Ruslan, 2026-10-03).
  Seeds: A `dDPD87C1foVGqfO`, B `95m1Yb3BvWQT8m6`, C `yF7R6DOHFF5qhGZ`.
  Few controls in the pane (`p` play/stop, `d` dice, `u` undo, `f` flyer, `s` save mp3).
  The real control surface is chat: Claude turns the knobs with `mcp__techno__jam`.
- **Personal**: the phrase seeds key, patterns, and sound. Each phrase
  character is one step of the acid riff (space = rest, vowel = accent).
- **Shareable**: the share code holds the whole track, so the same code gives
  the same audio on any machine. `s` saves one minute as mp3 to `~/Music/techno/`
  (ffmpeg), or a wav when ffmpeg is missing.

- **App, not a command** (Ruslan, 2026-10-03: "more like an APP, click around,
  select track, highlight what to click").
- **Layout C, "crate", is the one** (Ruslan, 2026-10-03). Layouts A and B and
  the dev layout switcher are deleted. The crate lists names from this session
  (project, branch, last commits), kept tracks and starters; a pick opens the deck.
- **No layer chips** (Ruslan, 2026-10-03). Energy, mood and tempo stay. Layers
  come and go through the build, a click on a grid row name, or Claude.
- **The build is slow, one part per NEXT** (Ruslan, 2026-10-03). The timeline
  shows the seven sections and "part n of 10".
- **Minimal, for focus** (Ruslan, 2026-10-03: "more minimal and more
  focus-driven - it's for using claude", "keep the bass with all drums for
  longer before we add clap"). `PLAN` in engine.js: kick, + sub bass, + hats,
  + rumble, + percussion, + clap, peak (+ dub chord), breakdown, drop, outro.
  The acid riff is not in the plan and not in the full track by default; Claude
  or a grid click still brings it in. Rumble plays when the mood is deep or
  darker. Max energy in the plan is 3. Auto plays the groove parts twice too.
  The sections keep their old indexes, so an old `p<n>` code lands in the same
  section, with the new layers.
- **Heavier low end** (same request: "I want the bass to feel heavy"). The sub
  root sits at e1..d#2 (was c2..b2), a driven sine; the saw growl plays an
  octave up so laptop speakers still hear it. A bass note holds until the next
  one (at most two steps). The kick's tail is tuned to the key root (39..56 Hz).
  Hats, clap and percussion are quieter and darker; master low-pass at 12 kHz.
  About 1.8 dB more below 100 Hz than v0.4.0.
- **Pick the scale** (same request). `scale` in a track: null lets the mood
  pick (old behaviour), or an index into `SCALES`: minor, dorian, phrygian,
  hijaz (arabic), harmonic. A picked scale stacks its own dub chord. The deck
  has `key` (transpose) and `scale` steppers; the jam tool takes `scale` by name.
- **Three moods, mood = scale** (Ruslan, 2026-10-03: "mood and scale should
  kinda be the same ... only 3 that techno does - not funny, but sad and dark
  and mysterious"). `VIBES` in engine.js: sad (mood 2, minor), mysterious
  (mood 1, hijaz), dark (mood 0, phrygian). The mood stepper and the jam tool's
  `mood` pick one by name and set `mood` and `scale` together. No key or scale
  stepper. A new phrase picks a random vibe. Old codes keep their m and k.
- **A mood sets tempo and energy too** (Ruslan, 2026-10-03: "adjust tempo and
  energy based on what I select"). `VIBES` carry `bpm` (sad 122, mysterious
  127, dark 132) and `lift` (-1, 0, +1) on the energy of every part (`atPart`,
  `withVibe`).
- **Low keys** (same request: "make it lower ... deeper and heavier"). The
  phrase picks e, f, f#, g or a, so the sub root is e1..a1 (41..55 Hz). The
  dub chord sits two octaves over the root (e3..a3).
- **The bar in every chat** (Ruslan, 2026-10-03: "make the techno plugin
  persistent over different chats"). `$.store` is global, so the track and the
  kept list were already shared. Now `bar: true` in the store makes a new
  session show the bar (same track) until its ×. With the background player
  the music itself carries on too (see below).
- **Layout C+, one line above the grid** (Ruslan, 2026-10-03: "make it simpler
  ... super obvious what's happening now, what's next, what kind of track").
  Seeds: A `SLJwcmmvR7nex8X` grid first, B `TTyxAw9bjDcC94X` big section,
  C `LliniTBWK1Znj5T` now → next. The Opus critic scored A 6, B 5, C 7 and
  said: build C, take the dashed "next" row from A. Mockups and screenshots:
  `previews/design/` (gitignored). The line: play/stop, the track,
  `· mood · bpm`, `▰▰▰▱▱▱▱▱▱▱ 3/10`, `→ rumble next` (or `rumble in 0:12`
  with auto, a live countdown), then `add rumble ›` / `skip to rumble ›`,
  `○ build by itself`, hide. The next sound is a dashed row in the grid
  (`isNext`, not clickable). Under the grid: `mood: sad mysterious dark ·
  other tracks · new rhythm · share mp3`. No tempo or energy knobs: the mood
  sets them, and Claude can still change them.
- **Share = an mp3** (Ruslan, 2026-10-03, share A). `share mp3` saves one
  minute to `~/Music/techno`, shows it in Finder, and copies the play line.
- **Voice lines, free macOS voices only** (Ruslan, 2026-10-03: "don't generate
  anything with TTS, just use free macOS voices"). `say` records the track's
  name once per phrase (Whisper and Daniel, 22 kHz WAV, read back as base64,
  `decodeWav` in the engine). The `voice` layer is in the peak and the
  breakdown (Whisper, bar 3, three semitones down) and the drop (Daniel, bar 1,
  four semitones down), band-passed, driven, into the reverb and the
  ping-pong delay. No `say`: no voice, the rest plays.
- **One background player for every chat** (Ruslan, 2026-10-03: "persistent
  between chats ... can we stop it if Claude Code is stopped as well?"). With
  `ffplay` and `perl` on the machine, `PLAYER_SH` runs ffplay in its own
  process group (perl setsid) from `~/Library/Caches/techno/`, so it outlives
  the chat. Its watcher kills ffplay when no Claude Code process is left
  (`pgrep -f '/MacOS/claude|/share/claude/versions/'`). `$.store.player` holds
  the pid and the clock; every chat syncs from it every 2 s, so all bars show
  and control the same music. A change starts the new loop 150 ms ahead, then
  kills the old group. Without ffplay, each chat plays through `$.audio.play`.
- **The done card** (Ruslan, 2026-10-03): replay the set, save the set as mp3,
  remix it (dice + 1, step edits cleared, back to the kick), keep, share, new
  track. The set is the state you left each part in, so tweaks and step edits
  are in the replay. `renderSet` plays 4 bars of each part and 8 of the last.
- **Step edits** (Ruslan, 2026-10-03): a click on a grid cell adds or removes
  that hit in every bar. An edit that matches the pattern again is dropped.
- **Heavier sound** (Ruslan, 2026-10-03: "feels a bit too much pixel-art'y").
  Kick: lower, longer, a driven sine with a noise click. Bass: a sine sub under
  two detuned saws through a 4-pole low-pass, saturated. Hats: high-passed
  noise with a little metal, two alternating takes. Stabs: three voices per
  note, darker. Master: a 14 kHz low-pass before the clipper. About 3 dB more
  below 120 Hz than v0.2.
- **Above the chat box, not a panel** (Ruslan, 2026-10-03). The app draws in the
  `AbovePrompt` band. `/techno` shows or hides it.
- **The bar** (Ruslan, 2026-10-03: "a little bar that has play, stop, share and
  auto ... maybe also a next track"). While the app is hidden, the band shows one
  row: play/stop, the track and its part, auto, next track, share, open, ×. It
  shows once techno was used in the session, until its ×; `/techno` brings the
  app back. Share from the bar copies the play line and shows a toast.
- **Auto** (same request: "it should just mix it nicely itself"). At each loop
  boundary auto presses NEXT; the peak and the drop play two loops
  (`AUTO_LOOPS`). After the outro it goes to the next track (this project, kept,
  starters) at the SAME tempo, so the beat carries on. Timers use the `$` of the
  call that set them: storing `$` in module state is refused at load. The jam
  tool takes `auto: true|false`.

## Share code format

`<phrase-with-hyphens>@<bpm>m<mood>e<energy>[d<dice>][s<swing>][t<transpose>][k<scale>][p<old part>|a<part>][+layer|-layer...][*<layer><on hex4><off hex4>...][%<layer><instrument>...][~<layer><16 degrees>...][^<layer><cut+3><grit>...][!<lp+3><hp><space+2>][/<plan in hex>]`

The fields after `*` are 0.9 (the edit card); see Decisions 0.9.

Example: `late-night-deploy@131m1e2d3a4+acid-hats*kick00040000`. `k` is a picked
scale (0..4, see `SCALES`); without it the mood picks. `a` is the part of
the set (0..10, 0.8 on); `p` (0..9) is a part of the old ten-part build, and
`OLD_PARTS` moves it to the same section. Without either, the track is the old
full track, where mood and energy decide the layers. `*` is a step edit: a 16-bit mask of steps forced on
and one forced off, the same in every bar (grid layers only, not rumble). Layers: kick, bass, hats,
clap, perc, acid, stab, rumble, voice, ride, pad. A `+`/`-` flag forces a layer; without one,
mood and energy decide. `parseCode` and `encodeCode` in `engine.js` own it.
Do not change the meaning of an existing field: old codes must keep playing the same track.

## Engine notes

- 8 bars, 44.1 kHz stereo, about 15 s. Renders in about 0.3 s in node (a
  handover loop, two tracks, about 0.6 s). Each
  drum hit renders once per track (`template` + `stamp`); keep it that way,
  since every click re-renders.
- `render` folds the reverb and delay tails back onto the start (a loop file
  with no seam). `renderLoop` keeps the tail; the `mixer` adds it onto the
  next bars, with a soft knee over 0.9.
- `toWav(audio, startSeconds)` rotates the loop. The mod uses it to keep the
  beat when a change lands mid-loop.
- Master: high-pass 25 Hz, 12 kHz low-pass, fixed gain into a soft clip, at
  most -1 dBFS. Drops about -10 dB RMS, breakdowns about -15. The helper plays
  at gain 0.7.

## Checks

- `node scripts/smoke.mjs`: version, every part and the handover render, the
  prebuilt helper matches the Swift source.
- Listen to a whole set: `node scripts/set.mjs "ship it" "warehouse 4am" /tmp/set.wav`.
- Run the player without sound and away from the real state:
  `TECHNO_DIR=/tmp/tt TECHNO_GAIN=0 node player/techno.mjs`. Stop it by its
  pid only: `pkill -f player/techno.mjs` also kills the real player. Then
  `curl --unix-socket /tmp/tt/cache/techno.sock -X POST localhost/cmd -d '{"op":"play"}'`.
- `claude plugin validate .` and `claude plugin test`: the real checks. A test
  that presses NEXT many times needs `{ timeoutMs: 30000 }`: each part renders.
- Listen: `node scripts/render.mjs "phrase" /tmp/x.wav 2 && afplay /tmp/x.wav`.

## Gotchas

- **Test a new user without touching the real install**: a clean config
  folder, `CLAUDE_CONFIG_DIR=/tmp/cc-new claude plugin marketplace add
  ruslanshchuchkin/claude-techno-mod`, then `... plugin install
  techno@techno-mod`. A unix socket path must stay under 104 characters:
  use `/tmp/<short>` for `TECHNO_DIR`, never the scratchpad.
- `TECHNO_DIR` moves the helper app too (`$TECHNO_DIR/TechnoPlayer.app`), so a
  test player never replaces the real helper.
- **Installed as `techno@techno-mod`** (user scope, local directory
  marketplace). The desktop Code tab ignores `CLAUDE_CODE_PLUGIN_DIRS` from
  settings, so that env was removed again on 2026-10-03. An installed plugin
  is cached by version: after a change, bump `version` in plugin.json, run
  `claude plugin marketplace update techno-mod && claude plugin update techno@techno-mod`,
  then `/reload-plugins` in the session. For fast dev in a terminal, use
  `claude --plugin-dir ~/Documents/techno-mod` (hot reload).
- "hooks modules are turned off ... rollout switch was saved off" means the
  CLI has not started once while signed in. Run `claude`, then `/login`.
- Desktop Code tab runs its own bundled Claude Code (2.1.286 on 2026-10-03).
  Mods load there too; the tests pass on that binary:
  `~/Library/Application Support/Claude/claude-code/<version>/<hash>/claude.app/Contents/MacOS/claude plugin test`.
- `screencapture` from a session shows only the wallpaper (no Screen Recording
  permission), so the desktop pane can't be captured from here. Ask Ruslan.
- **Old chats keep old code.** Every desktop chat is its own `claude` process
  and keeps the mod version it loaded; `/reload-plugins --force` did not swap
  the jam tool in a chat started before the update. The jam answer ends with
  `(techno vX.Y.Z)` (`VERSION` in register.js, checked against plugin.json by
  `scripts/smoke.mjs`), so a stale chat shows itself. Test a new version in a
  NEW chat. The background player logs every start, stop and its cause to
  `~/Library/Caches/techno/player.log`.
- **The player's files**: socket `~/Library/Caches/techno/techno.sock`, log
  `~/Library/Caches/techno/player.log` (and `daemon.out` for crashes), the
  helper app beside them, the state (favorites, history, auto, the track) in
  `~/Library/Application Support/techno/state.json`.
- Chats still on 0.7 run their own ffplay player. The 0.8 player kills those
  at its start, but a 0.7 chat on auto starts them again: close old chats.
- **`hooks/package.json` says `"type": "module"`.** Node 20 (the login
  shell's `/usr/local/bin/node` here) does not read `engine.js` as a module
  without it, and the player crashed at start on 0.8.0. The chat prefers
  `/opt/homebrew/bin/node`. A crash at start lands in `daemon.out`.
- **session.start registers `/techno` and `jam` first**, then brings the
  player up in the background. On 0.8.0 it waited for the player first; when
  the player crashed, a new chat had no `/techno` at all.
- macOS gives the media keys to the app that played last: after Spotify or
  Music, press play in the pane once.
- `$.fs.write` writes text only. `save()` pipes base64 through
  `base64 --decode` with `$.process.run` stdin to write the WAV.
