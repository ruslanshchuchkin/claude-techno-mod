# README media

How `media/deck.gif`, `media/late-night-deploy-drop-1.mp3` and the README videos were made. The deck video is drawn from the engine's own grid data, frame by frame, in sync with the rendered audio (the session cannot capture the screen).

```bash
D=/tmp/techno-media && mkdir -p $D
node scripts/readme-media/demo-audio.mjs "late night deploy" own $D/demo.wav
node -e "import('./hooks/engine.js').then(E=>{const t=E.trackFor('late night deploy');const o={code:E.encodeCode(t),bpm:t.bpm,loops:E.PLAN.map(p=>p.loops),names:E.PLAN.map(p=>p.name),parts:{}};for(const p of [4,5]){const a=E.atPart(t,p);o.parts[p]=Array.from({length:8},(_,b)=>E.grid(a,b))}require('fs').writeFileSync('$D/deck.json',JSON.stringify(o))})"
python3 scripts/readme-media/deck-video.py $D $D/deck-playing.mp4
```

The GIF is 4 bars of drop 1 cut from that video (ffmpeg, 15 fps, 900 px, 64 colors). GitHub plays a video inline only from an upload on github.com (a `user-attachments` link).
