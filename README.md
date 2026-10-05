<div align="center">

# 😈 claude-techno-mod

### Type a phrase. Get a seven-minute techno set. Keep coding.

[![GitHub stars](https://img.shields.io/github/stars/ruslanshchuchkin/claude-techno-mod?style=flat&logo=github&label=stars)](https://github.com/ruslanshchuchkin/claude-techno-mod/stargazers)
![macOS](https://img.shields.io/badge/macOS-12%2B-black?logo=apple)
![Claude Code](https://img.shields.io/badge/Claude%20Code-2.1.286%2B-d97757)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)

</div>

https://github.com/user-attachments/assets/905503cd-ac63-473b-ab5c-01c348f5efa4

<p align="center"><sub>🔊 <b>Now with sound.</b> The riser, then drop 1 lands at 0:05 · no player? <a href="https://cdn.jsdelivr.net/gh/ruslanshchuchkin/claude-techno-mod@main/media/late-night-deploy-drop-1.mp3">play the mp3</a></sub></p>

A [Claude Code](https://claude.com/claude-code) mod that plays a real techno set in a band above your chat box.

- 🎛️ **One phrase, a whole set.** Kick, then bass, then hats. Three drops, breakdowns between them, about seven minutes.
- 🤖 **Claude is the DJ.** Say *"darker"*, *"drop the acid"*, *"next track"* and it turns the knobs.
- 🌀 **It never stops.** When a track ends, it mixes into the next one, layer by layer, at the same tempo.
- 🖤 **No samples. No AI audio. No account.** Every sound is synthesized on your Mac.

## ⚡ Install

> [!IMPORTANT]
> You need a **Mac** (macOS 12+), **Claude Code 2.1.286+** and **Node 20+** (`brew install node`).

**1.** Add the marketplace, in Terminal:

```bash
claude plugin marketplace add ruslanshchuchkin/claude-techno-mod
```

**2.** Install the mod:

```bash
claude plugin install techno@techno-mod
```

**3.** Open a **new** chat (terminal or the desktop app's Code tab) and grow your first track. Any phrase works:

```
/techno late night deploy
```

Press play. 🔊

> [!TIP]
> Both apps share the same plugins, so one install covers the CLI and the desktop app. Already inside a `claude` session? Type `/plugin marketplace add ruslanshchuchkin/claude-techno-mod`, then `/plugin install techno@techno-mod`.

## 🎚️ The deck

The band in the video above, part by part:

| On the deck | What it does |
|---|---|
| **♡ / ↗** | Keep the track in favorites / copy its share line |
| **🔉 ▮▮▮▮▯** | The volume. Click a block to set it, the speaker to mute. Or ask Claude: *"quieter"* |
| **▰▰▱▱** | The whole song, one block per 15 seconds |
| **the grid** | The loop that plays now. Click a cell to add a hit, click a name to mute it |
| **auto** | On: it plays the whole set and moves on by itself. Off: it stays on one part |
| **mood** | **sad**, **mysterious** or **dark**: the scale, the tempo and the energy in one click. The bpm sits beside it |
| **edit** | The studio: instruments, patterns, notes, grit, filters, tempo, and the song's parts |
| <kbd>⏯</kbd> <kbd>⏭</kbd> <kbd>⏮</kbd> | The Mac media keys work too, and the track shows in Control Center |

## 🗣️ It talks

> The free macOS voices say the name of the track: **Whisper** in the second breakdown, **Daniel** in the last drop, pitched down and drowned in reverb.
>
> A robot whispering *"fix flaky login test"* over a riser at 133 bpm never gets old.

## 🧬 Your work is the playlist

When a track ends, auto picks the next one from what you do: the project folder, the git branch, your last commit messages, and the key words of your prompts, from every chat.

```
you ask:   "why does the stripe webhook retry twice on staging"
up next:   stripe webhook staging
```

Only plain words get in. Never paths, links, emails, numbers, or anything that looks like a key.

## 🔗 Share a track

A whole track, with your edits, is one line. Press **↗** and it's on your clipboard:

```
/techno late-night-deploy@133m0e4k2a5
```

A friend pastes it into their chat and hears the same track, because the code *is* the track. Want audio? **edit → ↓ mp3** saves a minute to `~/Music/techno`.

<p align="center">⭐ <b>Liking it? <a href="https://github.com/ruslanshchuchkin/claude-techno-mod">Star the repo</a>.</b> It's how other Claude Code users find it.</p>

## 🔊 How the sound is made

Every sound is math in plain JavaScript ([`hooks/engine.js`](hooks/engine.js)). Nothing is sampled or downloaded.

| Sound | How it's made |
|---|---|
| **kick** | A sine wave that falls in pitch, with a click on top |
| **bass** | A sine sub under two detuned saws, through a filter |
| **hats** | Filtered noise |
| **pads** | Dark minor chords, never bright ones |

> [!NOTE]
> 🎧 **Mixed for long sessions, not one loud minute.** About −14 LUFS (the level Spotify plays at), no clipping, and the harsh 2 to 5 kHz range sits about 20 dB under the bass.

<details>
<summary><b>🖥️ One player for every chat</b></summary>

<br>

The music does not belong to one chat. A small background player makes it, and every Claude Code chat is a remote control for it, terminal and desktop alike. Three chats: one track, three remotes. Quit the last Claude Code and the music stops with it.

```
chat ─┐
chat ─┼─ socket ──▶ techno player (node) ──▶ TechnoPlayer.app ──▶ 🔊
chat ─┘                renders bars ahead       gapless audio,
                                                Control Center, media keys
```

Nothing goes over the network. The helper app ships prebuilt (one universal binary for Apple silicon and Intel), so you do not need Xcode.

</details>

<details>
<summary><b>🔄 Update or uninstall</b></summary>

<br>

```bash
claude plugin marketplace update techno-mod
```

```bash
claude plugin update techno@techno-mod
```

To remove it: `claude plugin uninstall techno@techno-mod`. Then delete `~/Library/Application Support/techno` (your favorites) and `~/Library/Caches/techno` (the player's cache).

</details>

<details>
<summary><b>🩹 Something is off</b></summary>

<br>

| You see | Do this |
|---|---|
| The band says the player did not start | Run `node -v`. If it's missing or older than 20, install Node and press play again |
| `/techno` does not exist | Open a new chat. A chat that was open before the install keeps its old plugins |
| "hooks modules are turned off" | Run `claude` in a terminal once, run `/login`, then open a new chat |
| The media keys control Spotify | macOS gives them to the app that played last. Press play in the deck once |
| Still stuck | Open an issue with the last lines of `~/Library/Caches/techno/player.log` |

</details>

<details>
<summary><b>🛠️ Hack on it</b></summary>

<br>

```bash
git clone https://github.com/ruslanshchuchkin/claude-techno-mod && cd claude-techno-mod
```

```bash
claude --plugin-dir .
```

It reloads when you save. Listen without Claude Code at all:

```bash
node scripts/set.mjs "ship it" "warehouse 4am" set.wav && afplay set.wav
```

| File | What it is |
|---|---|
| `hooks/engine.js` | The synth, the set plan, transitions, share codes |
| `hooks/conductor.js` | What each loop plays, and how auto moves on |
| `hooks/register.js` | The chat side: `/techno`, the `jam` tool, the remote control |
| `hooks/views.js` | The deck, the edit card, favorites |
| `hooks/words.js` | Which words of a prompt become a track |
| `player/techno.mjs` | The background player |
| `player/TechnoPlayer.swift` | The helper app. After a change, run `node scripts/build-helper.mjs` |

Checks: `node scripts/smoke.mjs`, `claude plugin validate .`, `claude plugin test`.

</details>

---

<div align="center">

**MIT.** Make some noise. 🖤

⭐ [Star it](https://github.com/ruslanshchuchkin/claude-techno-mod) if it played you through a long night.

</div>
