# Task: the README demo with the usual voice

Ruslan (2026-10-05): "the voice is not how it appears usually, make it like it
appears usually and update the md".

## The goal

The README demo video (and the mp3 under it) must use the voice as the app
plays it: the engine's own `voice` layer, which says the line once, deep, on
the first bar of the drop. It must not use a clear voice-over on top.

Today the demo has a clear voice-over: `say -v Daniel` mixed on top with
ffmpeg, the music ducked under it (`scripts/readme-media/README.md`). Remove
that step.

## How the app plays the voice

- The player records the line with the free macOS voices (`say()` and
  `recordVoices()` in `player/techno.mjs`): Whisper at rate 150, Daniel at
  rate 120, 22050 Hz WAV.
- The engine places one clip per loop (`renderVoice` in `hooks/engine.js`,
  near "the voice says the name once a loop"): Daniel (deep) on bar 1 of a
  drop, Whisper on bar 3 of other parts. The clip is pitched down,
  band-passed, driven, and sent into the reverb and the ping-pong delay.
- The line is the track's name in the app. In the demo, the line is
  "claude techno mod".

## The steps

1. Render the demo audio with the line. The fourth argument records it with
   the app's voices and rates and turns the `voice` layer on:

   ```bash
   D=/tmp/techno-media && mkdir -p $D
   node scripts/readme-media/demo-audio.mjs "late night deploy" own $D/demo.wav "claude techno mod"
   ```

   The clip starts 9.6 s into the riser loop, so the Whisper on bar 3 of
   the riser (5.4 s) is cut off. The line comes once: Daniel on the drop, at
   about 0:05 in the clip.

2. Export the grid data, then draw the video. `deck-video.py` reads
   `$D/demo.wav` itself (from 9.6 s, 19 s long, with fades). Do not mux any
   other audio:

   ```bash
   node -e "import('./hooks/engine.js').then(E=>{const t=E.trackFor('late night deploy');const o={code:E.encodeCode(t),bpm:t.bpm,loops:E.PLAN.map(p=>p.loops),names:E.PLAN.map(p=>p.name),sections:E.PLAN.map(p=>p.section==='drop'?p.name:p.section),parts:{}};for(const p of [4,5]){const a=E.atPart(t,p);o.parts[p]=Array.from({length:8},(_,b)=>E.grid(a,b))}require('fs').writeFileSync('$D/deck.json',JSON.stringify(o))})"
   python3 scripts/readme-media/deck-video.py $D $D/deck-playing.mp4 6.0
   ```

   Open `$D/frame-6.0.png` and check that it shows the current deck
   (`share` beside the heart, `vol − 80% +`, the mood row over the grid).

3. Make the mp3 from the same audio:

   ```bash
   ffmpeg -y -ss 9.6 -t 19 -i $D/demo.wav -af "afade=t=in:d=0.2,afade=t=out:st=17.5:d=1.5" -b:a 192k media/late-night-deploy-drop-1.mp3
   ```

4. Upload the video to GitHub. GitHub plays a video inline only from an
   upload on github.com (a `user-attachments` link). Use Ruslan's Chrome,
   which is signed in. Post nothing:
   1. Copy the mp4 into the project's ignored `.claude/` folder (the upload
      tool reads only files in the project).
   2. Open `https://github.com/ruslanshchuchkin/claude-techno-mod/issues/new`.
   3. Run this in the page, so the file input stays on the page and no
      system file picker opens:

      ```js
      const orig = HTMLInputElement.prototype.click
      HTMLInputElement.prototype.click = function () { if (this.type === 'file') { this.style.cssText = 'display:block;position:fixed;top:0;left:0;z-index:99999'; if (!this.isConnected) document.body.appendChild(this); return } return orig.call(this) }
      ;[...document.querySelectorAll('button')].find((b) => /Paste, drop, or click to add files/.test(b.textContent))?.click()
      ```

   4. Find the file input (`find`), then upload the mp4 to it
      (`file_upload`).
   5. Read the description textarea until it holds
      `https://github.com/user-attachments/assets/<id>`. Keep that URL.
   6. Clear the textarea (click it, cmd+a, Backspace). Close the tab. Do not
      press Create.
   7. Delete the mp4 from `.claude/`.

5. Update the files:
   - `README.md`: replace the old `user-attachments/assets/...` line with
     the new URL. Keep the caption under it, and say that the drop says its
     name.
   - `CLAUDE.md`: in the decision "The README media, drawn", replace the
     asset id and say that the demo uses the engine's own voice.
   - `scripts/readme-media/README.md`: remove the voice-over step. The usual
     route is steps 1 to 3 above.

6. Commit only those files and the mp3, by name (never `git add -A`). The
   repo's git email is already the GitHub noreply address. Push to `main`.
   End the commit message with:
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

7. Check:

   ```bash
   curl -s https://purge.jsdelivr.net/gh/ruslanshchuchkin/claude-techno-mod@main/media/late-night-deploy-drop-1.mp3
   curl -s https://github.com/ruslanshchuchkin/claude-techno-mod | rg -o "<new id>\.mp4"
   ```

   The page must show the new video id. Send Ruslan the mp4 so that he can
   listen: `node ~/Documents/video-studio/scripts/tg-send.mjs $D/deck-playing.mp4 "README demo, usual voice"`.

## Notes

- A speech-to-text check (Whisper) hears nothing in the usual voice, because
  it sits low under the drop. That is how the app sounds, and it is what
  Ruslan asked for. Do not make it louder or clearer.
- Write to Ruslan in Simplified Technical English, with no em-dashes.
