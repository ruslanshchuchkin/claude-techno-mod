# README media

How `media/late-night-deploy-drop-1.mp3` and the README video were made. The deck video is drawn from the engine's own grid data, frame by frame, in sync with the rendered audio (the session cannot capture the screen).

The demo uses the voice as the app plays it: the engine's own `voice` layer says the line ("claude techno mod") once, deep (Daniel), on bar 1 of drop 1, low under the music. The fourth argument of `demo-audio.mjs` records the line with the app's voices and rates and turns the layer on. Do not put a clear voice-over on top, and do not make the voice louder.

```bash
D=/tmp/techno-media && mkdir -p $D
node scripts/readme-media/demo-audio.mjs "late night deploy" own $D/demo.wav "claude techno mod"
node -e "import('./hooks/engine.js').then(E=>{const t=E.trackFor('late night deploy');const o={code:E.encodeCode(t),bpm:t.bpm,loops:E.PLAN.map(p=>p.loops),names:E.PLAN.map(p=>p.name),sections:E.PLAN.map(p=>p.section==='drop'?p.name:p.section),parts:{}};for(const p of [4,5]){const a=E.atPart(t,p);o.parts[p]=Array.from({length:8},(_,b)=>E.grid(a,b))}require('fs').writeFileSync('$D/deck.json',JSON.stringify(o))})"
python3 scripts/readme-media/deck-video.py $D $D/deck-playing.mp4 6.0
ffmpeg -y -ss 9.6 -t 19 -i $D/demo.wav -af "afade=t=in:d=0.2,afade=t=out:st=17.5:d=1.5" -b:a 192k media/late-night-deploy-drop-1.mp3
```

`deck-video.py` reads `$D/demo.wav` itself (from 9.6 s, 19 s long, with fades) and muxes it. The clip starts 9.6 s into the riser loop, so the Whisper on bar 3 of the riser is cut off, and the line comes once, at about 0:05. The last argument (6.0) saves `$D/frame-6.0.png`: check that it shows the current deck.

GitHub plays a video inline only from an upload on github.com (a `user-attachments` link). Upload the mp4 through the new-issue box (post nothing, clear the draft), then replace the link in the top `README.md`. The steps are in `docs/tasks/readme-demo-usual-voice.md`.

## The launch video

A square 45 s cut (option A, "say darker"): the riser plays in "sad", you type "darker", Claude turns the mood, it lands on the next bar (the player renders the loop again and plays the same bar of it), drop 1 lands at 0:09, four typed claims ride the drop (4 bars each), then "Star it on GitHub". The audio plays at the helper's gain (0.7): about -14 LUFS, true peak about -3 dBFS.

```bash
D=/tmp/techno-launch && mkdir -p $D
node scripts/readme-media/launch-audio.mjs "late night deploy" $D
python3 scripts/readme-media/launch-video.py $D $D/techno-mod-launch.mp4 3.0,9.6,30,43
```

The third argument saves stills (`$D/launch-<t>.png`). Pass `-` as the output to draw only the stills. The claims are `CLAIMS` in `launch-video.py`.

## The launch film

The launch film replaced the cut above. It is a Remotion composition in `~/Documents/video-studio` (`TechnoLaunch` square, `TechnoLaunchWide` 16:9). This repo makes its audio and its bar data:

```bash
D=/tmp/techno-film && mkdir -p $D
node scripts/readme-media/film-audio.mjs "deep focus" "fix login bug" $D
cp $D/film.wav ~/Documents/video-studio/public/techno/
cp $D/film.json ~/Documents/video-studio/src/profiles/techno/
cd ~/Documents/video-studio && npx remotion render src/index.ts TechnoLaunchWide out/techno/TechnoLaunchWide.mp4
```
