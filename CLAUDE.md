# techno (Claude Code mod)

A Claude Code mod. A phrase grows an 8-bar techno loop. The riff plays the
phrase's letters. You change the track by talking to Claude, who calls the
`jam` tool. You share it with a `/techno <code>` line or an mp3.

Needs Claude Code v2.1.287 or later (built and checked on v2.1.288).

## Files

| File | What it is |
|---|---|
| `.claude-plugin/plugin.json` | Plugin manifest. Name `techno`. |
| `hooks/hooks.json` | Points to the hooks module. |
| `hooks/register.js` | The mod: state, `/techno` command, `jam` tool, audio, save, share, click handlers. Every `$` call lives here (the validator refuses `$` passed to imported files). |
| `hooks/views.js` | The pane's screens as pure functions of `(ui, vm, act)`: layouts A radio, B rooms, C crate. |
| `hooks/coach.js` | The coach: one suggested next move (play, build, break, drop, dice, keep, share). Its `key` names the button that is drawn as `variant: 'primary'`. |
| `hooks/grid.client.js` | A `Client` surface module: the step grid with its own playhead clock. A click on a row posts `{ toggle: layer }` to `ui.message`. |
| `hooks/engine.js` | The synth. Plain JS with no Node or browser APIs, so it also runs in node and in a page (a future web player). |
| `scripts/render.mjs` | Render a phrase or code to a WAV from the shell: `node scripts/render.mjs "phrase" out.wav [repeats]`. |
| `scripts/smoke.mjs` | Runs `register.js` in node against a fake `$`. Fast check without a session. |
| `tests/techno.test.ts` | Real tests for `claude plugin test`. |

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
  select track, highlight what to click"). Three layouts behind a dev-only
  switcher (shown when the plugin is not loaded from `~/.claude/plugins/cache/`):
  A radio (tabs, station dial, next-move card), B rooms (room dropdown, mixer
  strip, set timeline), C crate (tracks from the session's repo, then a deck).
  Seeds: A `kYrmU3f8zfymhTS`, B `Y0ptSxD7G5UC9Fk`, C `3KCbYODsGTY3uHP`.
  **Pending: Ruslan picks one.** Then delete the other two and the switcher.

## Share code format

`<phrase-with-hyphens>@<bpm>m<mood>e<energy>[d<dice>][s<swing>][t<transpose>][+layer|-layer...]`

Example: `late-night-deploy@131m1e2d3+acid-hats`. Layers: kick, bass, hats,
clap, perc, acid, stab, rumble. A `+`/`-` flag forces a layer; without one,
mood and energy decide. `parseCode` and `encodeCode` in `engine.js` own it.
Do not change the meaning of an existing field: old codes must keep playing the same track.

## Engine notes

- 8 bars, 44.1 kHz stereo, about 15 s. Renders in about 0.2 s in node. Each
  drum hit renders once per track (`template` + `stamp`); keep it that way,
  since every click re-renders.
- Reverb and delay tails fold back onto the start, so the loop has no seam.
- `toWav(audio, startSeconds)` rotates the loop. The mod uses it to keep the
  beat when a change lands mid-loop.
- Master: high-pass 25 Hz, peak to 1.25, soft clip, peak at -1 dBFS. About -10
  to -11 LUFS. The mod plays at gain 0.7.

## Checks

- `node scripts/smoke.mjs`: logic, without a session.
- `claude plugin validate .` and `claude plugin test`: the real checks.
- Listen: `node scripts/render.mjs "phrase" /tmp/x.wav 2 && afplay /tmp/x.wav`.

## Gotchas

- `~/.claude/settings.json` has `env.CLAUDE_CODE_PLUGIN_DIRS` pointing here
  (added 2026-10-03, backup at `settings.json.bak-techno`). Every new session
  loads this mod, including the desktop Code tab once its bundled Claude Code
  is v2.1.287 or later.
- "hooks modules are turned off ... rollout switch was saved off" means the
  CLI has not started once while signed in. Run `claude`, then `/login`.
- Desktop Code tab runs its own bundled Claude Code (2.1.286 on 2026-10-03).
  Mods load there too; the tests pass on that binary:
  `~/Library/Application Support/Claude/claude-code/<version>/<hash>/claude.app/Contents/MacOS/claude plugin test`.
- `screencapture` from a session shows only the wallpaper (no Screen Recording
  permission), so the desktop pane can't be captured from here. Ask Ruslan.
- `$.fs.write` writes text only. `save()` pipes base64 through
  `base64 --decode` with `$.process.run` stdin to write the WAV.
