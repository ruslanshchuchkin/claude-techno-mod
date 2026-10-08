# The launch video (option A, "say darker"): a square 45 s cut. The deck
# plays the riser in "sad", you type "darker", Claude turns the mood, drop 1
# lands, four typed claims ride the drop (4 bars each), then the GitHub star.
#   python3 scripts/readme-media/launch-video.py <dir with launch.wav, launch.json> out.mp4 [t,t,...]
# The deck layout follows hooks/views.js, as deck-video.py does.
import json, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

S, OUT = sys.argv[1], sys.argv[2]
d = json.load(open(f'{S}/launch.json'))
BARS = d['bars']
W = H = 1080
FPS, DUR = 30, 45.0
CHANGE = next(b['t'] for b in BARS if b['mood'] == 'dark')
DROP = next(b['t'] for b in BARS if b['section'] != 'build')
B0 = BARS[0]; L0 = 8 * 4 * 60 / B0['bpm']
CLOCK0 = B0['pos'] * L0 + B0['bar'] * L0 / 8   # the set's clock runs on, a tempo change does not move it back
STAR = DROP + 16 * BARS[-1]['dur']          # four claims of 4 bars, then the star
CLAIMS = [['Type a word.', 'Claude turns the knobs.'],
          ['The phrase "late night deploy"', 'grew this whole set.'],
          ['Three drops. Then it', 'mixes into the next track.'],
          ['No samples. No AI audio.', 'Synthesized on your Mac.']]

BG = (20, 20, 20); PANEL = (24, 24, 24); BORDER = (70, 70, 70)
TEXT = (232, 232, 232); DIM = (128, 128, 128); FAINT = (60, 60, 60)
ACCENT = (217, 119, 87); SUBTLE = (48, 48, 48); HEAD_REST = (90, 110, 140); USER_BG = (40, 40, 40)
COLORS = {'kick': ['#e85a5a', '#c94040'], 'hats': ['#3fb6d9', '#2a93b5'], 'bass': ['#e8b03a', '#c99320'],
          'perc': ['#7b93f0', '#5b77e0'], 'clap': ['#e070c0', '#c0509f']}
ORDER = ['kick', 'hats', 'bass', 'perc', 'clap']

f = lambda n, b=False: ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', n, index=1 if b else 0)
F, FB = f(19), f(19, True)
CW = F.getlength('M')
X0, Y0, RH = 40, 440, 36                     # the deck panel, one row = 36 px
right = int((W - 2 * X0 - 48) // CW)

def col(c): return X0 + 24 + c * CW
def rowy(r): return Y0 + 20 + r * RH
def text(dr, c, r, s, fill=TEXT, font=F): dr.text((col(c), rowy(r)), s, font=font, fill=fill); return c + len(s)
def mmss(sec): return f'{int(sec // 60)}:{int(sec % 60):02d}'
def lerp(a, b, x): return tuple(int(a[i] + (b[i] - a[i]) * x) for i in range(3))

def button(dr, c, r, label, on, ring=0.0):
    x, y = col(c) - 6, rowy(r) - 4
    w = len(label) * CW + 12
    if on: dr.rounded_rectangle([x, y, x + w, y + 30], 6, fill=ACCENT)
    if ring > 0: dr.rounded_rectangle([x - 5, y - 5, x + w + 5, y + 35], 9, outline=lerp(BG, ACCENT, ring), width=3)
    dr.text((x + 6, y + 4), label, font=FB if on else F, fill=(255, 255, 255) if on else TEXT)
    return c + len(label) + 2

def skip_icon(dr, c, r, back):
    x, y = col(c), rowy(r) + 3
    if back:
        dr.rectangle([x, y, x + 3, y + 16], fill=TEXT); dr.polygon([(x + 16, y), (x + 5, y + 8), (x + 16, y + 16)], fill=TEXT)
    else:
        dr.polygon([(x, y), (x + 11, y + 8), (x, y + 16)], fill=TEXT); dr.rectangle([x + 13, y, x + 16, y + 16], fill=TEXT)
    return c + 3

def at(t):
    for b in reversed(BARS):
        if b['t'] <= t: return b
    return BARS[0]

def deck(dr, t):
    b = at(t)
    inbar = (t - b['t']) / b['dur']
    step = min(15, int(inbar * 16))
    loop = 8 * 4 * 60 / b['bpm']
    drop = b['section'] != 'build'
    flash = max(0.0, 1 - (t - DROP) / 0.6) if t >= DROP else 0.0
    dr.rounded_rectangle([X0, Y0, W - X0, Y0 + 400], 14, fill=PANEL, outline=lerp(BORDER, ACCENT, flash), width=2 + int(2 * flash))
    # the top line: the transport, the track, share, the volume; auto and hide on the right
    c = skip_icon(dr, 0, 0, True)
    c = button(dr, c + 1, 0, '■ stop', False)
    c = skip_icon(dr, c, 0, False)
    c = text(dr, c + 2, 0, d['phrase'], TEXT, FB)
    c = text(dr, c + 1, 0, '♡', TEXT)
    x, y = col(c + 2) - 8, rowy(0) - 4
    dr.rounded_rectangle([x, y, x + 5 * CW + 16, y + 30], 6, outline=DIM, width=2)
    c = text(dr, c + 2, 0, 'share', TEXT) + 1
    c = text(dr, c + 2, 0, 'vol', DIM)
    c = text(dr, c + 1, 0, '−', TEXT)
    c = text(dr, c + 1, 0, '80%', TEXT, FB)
    text(dr, c + 1, 0, '+', TEXT)
    button(dr, right - 12, 0, '● auto', True)
    text(dr, right - 3, 0, 'hide', DIM)
    # the part bar: one block per loop, then the section and the clock
    pos, frac = b['pos'], (b['bar'] + inbar) / 8
    c, cell = 0, 0
    for n in d['loops']:
        for i in range(n):
            x, y = col(c) + 2, rowy(1) + 6
            fill = TEXT if cell < pos else (FAINT if cell > pos else FAINT)
            dr.rounded_rectangle([x, y, x + CW - 4, y + 13], 3, fill=fill)
            if cell == pos: dr.rounded_rectangle([x, y, x + max(3, (CW - 4) * frac), y + 13], 3, fill=ACCENT)
            c += 1; cell += 1
    c = text(dr, c + 2, 1, b['section'], ACCENT, FB)
    text(dr, c + 1, 1, f'· {mmss(CLOCK0 + t)} / {mmss(sum(d["loops"]) * loop)}', DIM)
    # the mood buttons and the tempo; the new mood rings when it lands
    ring = max(0.0, 1 - (t - CHANGE) / 0.8) if t >= CHANGE else 0.0
    c = text(dr, 0, 2, 'mood', DIM)
    c = button(dr, c + 2, 2, 'sad', b['mood'] == 'sad')
    c = button(dr, c, 2, 'mysterious', b['mood'] == 'mysterious')
    c = button(dr, c, 2, 'dark', b['mood'] == 'dark', ring)
    text(dr, c, 2, f'{b["bpm"]} bpm', ACCENT if ring > 0 else DIM, FB if ring > 0 else F)
    # the grid: the ruler, then one row per sound; the clap is dashed until the drop
    cellx = lambda i: 7 + i * 3 + i // 4
    for i in range(16):
        on = i == step
        text(dr, cellx(i), 3, str(i // 4 + 1) if i % 4 == 0 else '·', TEXT if on else DIM, FB if on else F)
    g = b['grid']
    clap = g.get('clap') or next(x['grid']['clap'] for x in BARS if 'clap' in x['grid'])
    for r, name in enumerate(ORDER):
        row = 4 + r
        nxt = name not in g
        text(dr, 0, row, name, DIM if nxt else TEXT, F if nxt else FB)
        pat = g.get(name) or clap
        for i, ch in enumerate(pat):
            x, y = col(cellx(i)), rowy(row) + 1
            w = 2 * CW
            if nxt:
                if ch != '.': dr.rectangle([x + 4, y + 10, x + w - 4, y + 16], fill=FAINT)
                else: dr.line([x + 2, y + 13, x + w - 2, y + 13], fill=FAINT, width=2)
                continue
            hit = ch != '.'
            if i == step: fill = TEXT if hit else HEAD_REST
            elif hit: fill = COLORS[name][0 if ch == 'X' else 1]
            else: fill = SUBTLE
            dr.rectangle([x, y, x + w, y + 24], fill=fill)
    text(dr, 0, 9.4, '+ new song', TEXT)
    text(dr, right - 22, 9.4, 'edit', TEXT)
    text(dr, right - 15, 9.4, '♥ favorites 4', TEXT)

def chatbox(dr, t):
    y = Y0 + 420
    dr.rounded_rectangle([X0, y, W - X0, y + 60], 12, outline=BORDER, width=2)
    typed = 'darker'[:max(0, int((t - 0.4) / 0.17))] if t < 2.0 else ''
    dr.text((X0 + 24, y + 17), '> ', font=F, fill=DIM)
    x = X0 + 24 + 2 * CW
    if typed or t < 2.0:
        dr.text((x, y + 17), typed, font=F, fill=TEXT)
        if int(t * 2.5) % 2 == 0 or (0.4 < t < 1.6): dr.rectangle([x + len(typed) * CW + 2, y + 16, x + len(typed) * CW + 12, y + 40], fill=ACCENT)
    else:
        dr.text((x, y + 17), 'ask Claude, or say what the music should do', font=F, fill=FAINT)

T1 = f(26); T1B = f(26, True)
def transcript(dr, t):
    y0 = 128
    if t >= 2.0:
        dr.rounded_rectangle([X0, y0, X0 + 8 * 15.7 + 40, y0 + 46], 8, fill=USER_BG)
        dr.text((X0 + 18, y0 + 8), '> darker', font=T1, fill=TEXT)
    if t >= 2.5:
        dr.ellipse([X0 + 4, y0 + 82, X0 + 18, y0 + 96], fill=ACCENT)
        dr.text((X0 + 34, y0 + 72), 'techno', font=T1B, fill=TEXT)
        dr.text((X0 + 34 + 7 * T1.getlength('M'), y0 + 72), '· jam  mood: dark', font=T1, fill=DIM)
    if t >= 3.0:
        dr.text((X0 + 34, y0 + 112), '└  lands on the next bar', font=T1, fill=DIM)
    if t >= CHANGE + 0.5:
        dr.ellipse([X0 + 4, y0 + 172, X0 + 18, y0 + 186], fill=TEXT)
        line = 'Darker. Dark mood, 132 bpm.'[:int((t - CHANGE - 0.5) * 40)]
        dr.text((X0 + 34, y0 + 162), line, font=T1, fill=TEXT)

CAP = f(50, True)
def caption(dr, t, lines):
    n = int(t * 32)
    y = 150
    for ln in lines:
        s = ln[:max(0, n)]
        dr.text((X0, y), s, font=CAP, fill=TEXT)
        if 0 <= n <= len(ln) or (n > sum(map(len, lines)) and ln is lines[-1] and int(t * 2.5) % 2 == 0):
            x = X0 + CAP.getlength(s) + 6
            dr.rectangle([x, y + 6, x + 26, y + 60], fill=ACCENT)
        n -= len(ln)
        y += 92

BIG, MID, SMALL = f(64, True), f(30), f(24)
def star(im, t):
    x = min(1.0, (t - STAR) / 0.5)
    im = Image.blend(im, Image.new('RGB', (W, H), BG), 0.9 * x)
    dr = ImageDraw.Draw(im)
    a = lambda c: lerp(BG, c, x)
    def center(y, s, font, fill):
        dr.text(((W - font.getlength(s)) / 2, y), s, font=font, fill=a(fill))
    center(370, '★', f(90, True), ACCENT)
    center(490, 'Star it on GitHub', BIG, TEXT)
    center(600, 'ruslanshchuchkin/claude-techno-mod', MID, ACCENT)
    center(670, 'free · MIT · macOS · Claude Code', SMALL, DIM)
    return im

def frame(t):
    im = Image.new('RGB', (W, H), BG)
    dr = ImageDraw.Draw(im)
    dr.text((X0, 52), 'claude-techno-mod', font=f(24, True), fill=TEXT)
    sub = 'a Claude Code mod · sound on'
    dr.text((W - X0 - f(22).getlength(sub), 54), sub, font=f(22), fill=DIM)
    url = 'github.com/ruslanshchuchkin/claude-techno-mod'
    dr.text(((W - f(22).getlength(url)) / 2, 1000), url, font=f(22), fill=DIM)
    deck(dr, t)
    chatbox(dr, t)
    if t < DROP: transcript(dr, t)
    elif t < STAR:
        i = int((t - DROP) // (4 * BARS[-1]['dur']))
        caption(dr, t - DROP - i * 4 * BARS[-1]['dur'], CLAIMS[min(i, 3)])
    if t >= STAR: im = star(im, t)
    return im

if __name__ == '__main__':
    shots = list(map(float, sys.argv[3].split(','))) if len(sys.argv) > 3 else []
    for s in shots: frame(s).save(f'{S}/launch-{s:05.2f}.png')
    if OUT != '-':
        ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                               '-t', str(DUR), '-i', f'{S}/launch.wav',
                               '-af', f'volume=0.7,afade=t=in:d=0.15,afade=t=out:st={DUR - 1.8}:d=1.8',
                               '-c:v', 'libx264', '-crf', '22', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
                               '-movflags', '+faststart', '-shortest', OUT], stdin=subprocess.PIPE)
        for n in range(int(DUR * FPS)):
            ff.stdin.write(frame(n / FPS).tobytes())
        ff.stdin.close(); ff.wait()
