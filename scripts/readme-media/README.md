# README media

How `media/late-night-deploy-drop-1.mp3` and the README video were made. The deck video is drawn from the engine's own grid data, frame by frame, in sync with the rendered audio (the session cannot capture the screen).

```bash
D=/tmp/techno-media && mkdir -p $D
node scripts/readme-media/demo-audio.mjs "late night deploy" own $D/demo.wav
node -e "import('./hooks/engine.js').then(E=>{const t=E.trackFor('late night deploy');const o={code:E.encodeCode(t),bpm:t.bpm,loops:E.PLAN.map(p=>p.loops),names:E.PLAN.map(p=>p.name),sections:E.PLAN.map(p=>p.section==='drop'?p.name:p.section),parts:{}};for(const p of [4,5]){const a=E.atPart(t,p);o.parts[p]=Array.from({length:8},(_,b)=>E.grid(a,b))}require('fs').writeFileSync('$D/deck.json',JSON.stringify(o))})"
python3 scripts/readme-media/deck-video.py $D $D/deck-playing.mp4
```

The voice-over ("Claude. Techno. Mod.", said once, by Daniel on the drop) goes on top, and the music ducks under it. The demo audio leaves the engine's own voice layer off: it is texture, too filtered and low to understand, and the line would come twice.

```bash
say -v Daniel -r 125 -o $D/vo-deep.aiff "Claude. Techno. Mod."
ffmpeg -y -ss 9.6 -t 19 -i $D/demo.wav $D/clip.wav
ffmpeg -y -i $D/clip.wav -i $D/vo-deep.aiff -filter_complex "[1:a]aresample=44100,aformat=channel_layouts=stereo,highpass=f=110,volume=2.6,adelay=4750|4750,apad,asplit[vo][key];[0:a][key]sidechaincompress=threshold=0.02:ratio=8:attack=5:release=250[duck];[duck][vo]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.89,afade=t=in:d=0.2,afade=t=out:st=17.5:d=1.5[a]" -map "[a]" $D/clip-vo.wav
python3 scripts/readme-media/deck-video.py $D $D/deck-silent.mp4
ffmpeg -y -i $D/deck-silent.mp4 -i $D/clip-vo.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -shortest $D/deck-playing.mp4
ffmpeg -y -i $D/clip-vo.wav -b:a 192k media/late-night-deploy-drop-1.mp3
```

The demo audio step can take a line as a fourth argument (`... demo.wav "claude techno mod"`), which turns the engine's voice layer on with that line. The README demo does not use it.

GitHub plays a video inline only from an upload on github.com (a `user-attachments` link).
