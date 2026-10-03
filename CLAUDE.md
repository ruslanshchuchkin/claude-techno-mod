# techno (Claude Code mod)

A Claude Code mod. A phrase grows an 8-bar techno loop. The riff plays the
phrase's letters. NEXT builds the track one part at a time, from the kick
alone to the outro; then you replay the whole set, save it as an mp3, remix
it or share it. You can also change the track by talking to Claude, who calls
the `jam` tool. You share it with a `/techno <code>` line or an mp3.

Needs Claude Code v2.1.287 or later (built and checked on v2.1.288).

## Files

| File | What it is |
|---|---|
| `.claude-plugin/plugin.json` | Plugin manifest. Name `techno`. |
| `.claude-plugin/marketplace.json` | Local marketplace `techno-mod`, so the plugin installs as `techno@techno-mod`. |
| `hooks/hooks.json` | Points to the hooks module. |
| `hooks/register.js` | The mod: state, `/techno` command, `jam` tool, audio, save, share, click handlers. Every `$` call lives here (the validator refuses `$` passed to imported files). |
| `hooks/views.js` | The app's screens as pure functions of `(ui, vm, act)`: the crate, the deck, the done card, and the bar shown while the app is hidden. |
| `hooks/coach.js` | The coach: play first, then the NEXT button for the next part of `PLAN`, then the done card. Its `key` names the button drawn as `variant: 'primary'`. |
| `hooks/grid.client.js` | A `Client` surface module: the step sequencer with its own playhead clock. Every step is a fixed-width `Box` with a background, so columns line up in any font. A click on a row name posts `{ toggle: layer }` (mute); a click on a cell posts `{ step, layer }` (add or remove that hit in every bar). |
| `hooks/engine.js` | The synth, `PLAN` (the build), `toggleStep`, `renderSet`. Plain JS with no Node or browser APIs, so it also runs in node and in a page (a future web player). |
| `scripts/render.mjs` | Render a phrase or code to a WAV from the shell: `node scripts/render.mjs "phrase" out.wav [repeats]`. |
| `scripts/smoke.mjs` | Runs `register.js` in node against a fake `$`. Fast check without a session. |
| `tests/techno.test.ts` | Real tests for `claude plugin test`. |
| `previews/v0.3/` | The old sound, the new sound on the same loop, and two full builds as mp3 (gitignored, local only). |

## Decisions

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
- **The deck top is the "radio"** (Ruslan, 2026-10-03: "I like B but I still
  like the grid ... my problem was with stuff above the grid: too much text,
  not clear"). Seeds: A `nWGSepVLrXVhTB1` desk, B `OMGZxLeoTdAXrvr` radio,
  C `O8bwmwV7G6rK4Ua` autopilot. Header: `♪ techno`, the three moods as
  stations (the one on air is a button), hide. Row 1: play, the track, where
  its name comes from (`sourceOf`: a starter track, named after a commit, ...),
  and the build as `section ▰▰▰▱▱▱ n/10`. Row 2: `now` + the sounds in plain
  words (`LAYER_WORDS`), then `next: add the ... ›` and `let it play itself`.
  Row 3: word knobs (slower 130 faster · calmer busier · new rhythm undo ·
  save share · other tracks). The grid is unchanged. "dice" is "new rhythm".
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

`<phrase-with-hyphens>@<bpm>m<mood>e<energy>[d<dice>][s<swing>][t<transpose>][k<scale>][p<part>][+layer|-layer...][*<layer><on hex4><off hex4>...]`

Example: `late-night-deploy@131m1e2d3p4+acid-hats*kick00040000`. `k` is a picked
scale (0..4, see `SCALES`); without it the mood picks. `p` is the part of
the build (0..9); without it the track is the old full track, where mood and
energy decide the layers. `*` is a step edit: a 16-bit mask of steps forced on
and one forced off, the same in every bar (grid layers only, not rumble). Layers: kick, bass, hats,
clap, perc, acid, stab, rumble. A `+`/`-` flag forces a layer; without one,
mood and energy decide. `parseCode` and `encodeCode` in `engine.js` own it.
Do not change the meaning of an existing field: old codes must keep playing the same track.

## Engine notes

- 8 bars, 44.1 kHz stereo, about 15 s. Renders in about 0.3 s in node; a full
  set (`renderSet`, about 80 s of audio) in about 2 s. Each
  drum hit renders once per track (`template` + `stamp`); keep it that way,
  since every click re-renders.
- Reverb and delay tails fold back onto the start, so the loop has no seam.
- `toWav(audio, startSeconds)` rotates the loop. The mod uses it to keep the
  beat when a change lands mid-loop.
- Master: high-pass 25 Hz, peak to 1.25, soft clip, peak at -1 dBFS. About -10
  to -11 LUFS. The mod plays at gain 0.7.

## Checks

- `node scripts/smoke.mjs`: logic, without a session.
- `claude plugin validate .` and `claude plugin test`: the real checks. A test
  that presses NEXT many times needs `{ timeoutMs: 30000 }`: each part renders.
- Listen: `node scripts/render.mjs "phrase" /tmp/x.wav 2 && afplay /tmp/x.wav`.

## Gotchas

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
- `$.fs.write` writes text only. `save()` pipes base64 through
  `base64 --decode` with `$.process.run` stdin to write the WAV.
