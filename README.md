# 😈 claude-techno-mod

[![GitHub stars](https://img.shields.io/github/stars/ruslanshchuchkin/claude-techno-mod?style=flat&logo=github&label=stars)](https://github.com/ruslanshchuchkin/claude-techno-mod/stargazers)
![macOS](https://img.shields.io/badge/macOS-12%2B-black?logo=apple)
![Claude Code](https://img.shields.io/badge/Claude%20Code-2.1.286%2B-d97757)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)

**Type a phrase. Get a seven-minute techno set. Keep coding.**

https://github.com/user-attachments/assets/187aec4d-abd6-409c-b0b2-9e16d6883df0

<sub>🔊 Sound on: the riser into drop 1 of `/techno late night deploy`. No video player? [Play the mp3](https://cdn.jsdelivr.net/gh/ruslanshchuchkin/claude-techno-mod@main/media/late-night-deploy-drop-1.mp3) (⌘-click opens it in a new tab).</sub>

A [Claude Code](https://claude.com/claude-code) mod that grows a real techno track out of any words you give it, plays it in a band above your chat box, and mixes itself into the next track when it ends. Kick first. Bass rolls in. Hats. Three drops with breakdowns between them. Then it hands the beat to a new song, layer by layer, without ever stopping.

And Claude is the DJ. Say *"darker"*, *"drop the acid"*, *"next track"*, and it turns the knobs.

No samples. No AI audio. No account. Every sound is synthesized on your machine, and the letters of your phrase become the riff. Every track has a share code, and the same code plays the same track on any Mac, every time.

⭐ **If it made your next build sound better, star the repo.** Stars are how other Claude Code users find it, and they tell me what to build next.

## Install

You need a **Mac** (macOS 12 or later), **Claude Code 2.1.286 or later**, and **Node 20 or later** (`brew install node` if `node -v` says nothing).

Run these two commands in Terminal, one at a time. This works for both the CLI and the desktop app, because they share the same plugins.

```bash
claude plugin marketplace add ruslanshchuchkin/claude-techno-mod
```

```bash
claude plugin install techno@techno-mod
```

Then open a **new** chat (in the terminal, or in the Code tab of the Claude desktop app) and type:

```
/techno
```

Press play. That's it.

Already inside a `claude` session in the terminal? You can paste the same two steps there instead, one at a time:

```
/plugin marketplace add ruslanshchuchkin/claude-techno-mod
```

```
/plugin install techno@techno-mod
```

## What you see

```
⏮ ■ stop ⏭  late night deploy ♡ ↗ · dark · 133 bpm              ● auto  hide
▰▰▰▰▰▰▰▰▰▰▰▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱  drop 1  2:38 / 6:29
       1  ·  ·  ·   2  ·  ·  ·   3  ·  ·  ·   4  ·  ·  ·
kick   ██ ░░ ░░ ░░  ██ ░░ ░░ ░░  ██ ░░ ░░ ░░  ██ ░░ ░░ ░░
hats   ██ ██ ██ ██  ██ ██ ██ ██  ██ ██ ██ ██  ██ ██ ██ ██
bass   ░░ ░░ ██ ██  ░░ ░░ ██ ██  ░░ ░░ ██ ██  ░░ ░░ ██ ██
perc   ░░ ██ ░░ ██  ░░ ░░ ░░ ██  ░░ ██ ░░ ░░  ░░ ██ ░░ ░░
clap   ░░ ░░ ░░ ░░  ██ ░░ ░░ ░░  ░░ ░░ ░░ ░░  ██ ░░ ░░ ░░
mood  sad  mysterious  [dark]   edit   ♥ favorites 4
```

The top line is the transport and the track (♡ keeps it, ↗ copies its share line). The bar under it is the whole song, one block per 15 seconds. The grid is the loop that plays now: click a cell to add or remove a hit, click a sound's name to mute it.

## Play

| You do | It does |
|---|---|
| `/techno` | Show or hide the deck above the chat box |
| `/techno coffee at 3am` | Grow a brand new track from that phrase (or paste a share code) |
| ask Claude | *"make it darker"*, *"more swing"*, *"add the acid"*, *"share this track"*, *"go back to the last track, that was a banger"* |
| ⏯ ⏭ ⏮ keys | The Mac media keys play, stop and skip, in the terminal and in the desktop app. The track shows in Control Center |

**Auto** (on by default) plays the whole set by itself: intro, groove, a build-up into each drop, a fall out of each drop, then a handover into the next track at the same tempo. Turn auto off to sit on one part and dig in.

**Edit** opens the studio: swap the instrument of any sound (a punchy kick, a growl bass, dusty hats), pick a pattern or click the grid, move bass and melody notes up the scale or let it suggest a line, add grit or a filter per sound, change the master filter, the space and the tempo, and rearrange the song itself (add a breakdown and a drop, a longer build).

**Three moods**, the three that techno does: **sad**, **mysterious**, **dark**. A mood picks the scale, the tempo and the energy together.

**Your work is the playlist.** When a track ends, auto picks the next one from what you do: the project folder, the git branch, your last commit messages, and the key words of your prompts, from every chat. Ask Claude *"why does the stripe webhook retry twice on staging"* and a track called **stripe webhook staging** joins the queue. Only plain words get in: never paths, links, emails, numbers or anything that looks like a key.

**♡** keeps a track in your favorites. Play them one after another, or copy a line to send to a friend.

## Share a track

A whole track, with your edits, fits in one line:

```
/techno late-night-deploy@133m0e4k2a5
```

Press **↗** next to the ♡ and the line is on your clipboard. A friend pastes it into their chat and hears exactly the same track, because the code *is* the track. Want the audio too? **edit → ↓ mp3** saves a one-minute mp3 to `~/Music/techno`.

## How the sound is made

Every sound is math in plain JavaScript (`hooks/engine.js`): the kick is a sine wave that falls in pitch with a click on top, the bass is a sine sub under two detuned saws through a filter, the hats are filtered noise, and the pads are dark minor chords. Nothing is sampled or downloaded.

And then there are the voices. The free macOS voices say the name of the track: *Whisper* in the second breakdown, *Daniel* in the last drop, pitched down and drowned in reverb and echo. Hearing a robot whisper your commit message over a riser at 133 bpm never gets old.

It is mixed for long sessions, not for one loud minute: about −14 LUFS (the level Spotify plays at), no clipping, and the harsh 2 to 5 kHz range sits about 20 dB under the bass. Hours of it should not give you a headache. Turn your volume down anyway.

## One player for every chat

The music does not belong to one chat. A small background player makes it, and every Claude Code chat is a remote control for it: terminal chats and desktop app chats alike. Open a chat in the terminal and two in the desktop app: one track, three remotes. When you quit the last Claude Code (CLI or desktop), the music stops with it.

```
chat ─┐
chat ─┼─ socket ──▶ techno player (node) ──▶ TechnoPlayer.app ──▶ 🔊
chat ─┘                renders bars ahead       gapless audio,
                                                Control Center, media keys
```

It runs one node process and one small helper app, and both quit when Claude Code quits. Nothing goes over the network. The helper app ships prebuilt (one universal binary, Apple silicon and Intel), so you do not need Xcode.

## Update and uninstall

```
/plugin marketplace update techno-mod
/plugin update techno@techno-mod
```

To remove it: `/plugin uninstall techno@techno-mod`. Your favorites live in `~/Library/Application Support/techno`, and the player's cache lives in `~/Library/Caches/techno`. Delete both folders to remove every trace.

## Something is off

- **No sound, and the band says the player did not start.** Run `node -v`. If it is older than 20 or missing, install Node and press play again.
- **`/techno` does not exist.** Start a new chat: a chat that was open before the install keeps its old plugins.
- **It says hooks modules are turned off.** Run `claude` in a terminal once, run `/login` there, then start a new chat.
- **The media keys control Spotify.** macOS gives the keys to the app that played last. Press play in the deck once.
- **Still stuck?** The player writes what it does to `~/Library/Caches/techno/player.log`. Open an issue with the last lines.

## Hack on it

Clone it and load it straight from the folder (it reloads when you save):

```bash
git clone https://github.com/ruslanshchuchkin/claude-techno-mod && cd claude-techno-mod
```

```bash
claude --plugin-dir .
```

| File | What it is |
|---|---|
| `hooks/engine.js` | The synth: drums, bass, acid, pads, the set plan, transitions, share codes. Plain JavaScript, no Node or browser APIs |
| `hooks/conductor.js` | What each loop of the set plays, and how auto moves on |
| `hooks/register.js` | The chat side: `/techno`, the `jam` tool Claude uses, the remote control |
| `hooks/views.js` | The deck, the edit card, favorites |
| `player/techno.mjs` | The background player |
| `player/TechnoPlayer.swift` | The helper app. After a change, run `node scripts/build-helper.mjs` |

Listen without Claude Code at all:

```bash
node scripts/set.mjs "ship it" "warehouse 4am" set.wav && afplay set.wav
```

Checks: `node scripts/smoke.mjs`, `claude plugin validate .`, `claude plugin test`.

## License

MIT. Make some noise, and ⭐ [star it](https://github.com/ruslanshchuchkin/claude-techno-mod) if it played you through a long night.
