# Draws the techno deck playing, frame by frame, from the engine's own grid
# data (deck.json), in sync with the rendered audio (demo.wav), and pipes the
# frames to ffmpeg. The layout follows hooks/views.js and grid.client.js.
import json, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

S = sys.argv[1]
OUT = sys.argv[2]
d = json.load(open(f'{S}/deck.json'))
W, H, FPS = 1280, 720, 30
START = 9.6                      # seconds into the riser loop: the drop lands at about 4.8 s
DUR = 19.0
LOOP = 8 * 4 * 60 / d['bpm']     # one loop, 8 bars
BAR = LOOP / 8
STEP = BAR / 16
LOOPS_BEFORE = 9                 # the riser is the 10th loop of the set
TOTAL = sum(d['loops']) * LOOP

BG = (20, 20, 20); PANEL = (24, 24, 24); BORDER = (70, 70, 70)
TEXT = (232, 232, 232); DIM = (128, 128, 128); FAINT = (60, 60, 60)
ACCENT = (217, 119, 87)          # the claude theme key
SUBTLE = (48, 48, 48); HEAD_REST = (90, 110, 140)
COLORS = {'kick': ['#e85a5a', '#c94040'], 'hats': ['#3fb6d9', '#2a93b5'], 'bass': ['#e8b03a', '#c99320'],
          'perc': ['#7b93f0', '#5b77e0'], 'clap': ['#e070c0', '#c0509f']}
ORDER = ['kick', 'hats', 'bass', 'perc', 'clap']

f = lambda n, b=False: ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', n, index=1 if b else 0)
F, FB, FS = f(22), f(22, True), f(18)
CW = F.getlength('M')            # one terminal column
X0, Y0 = 70, 110

def col(c): return X0 + 24 + c * CW
def text(dr, c, row, s, fill=TEXT, font=F): dr.text((col(c), Y0 + 24 + row * 40), s, font=font, fill=fill); return c + len(s)
def mmss(sec): return f'{int(sec // 60)}:{int(sec % 60):02d}'

def button(dr, c, row, label, on):
    x, y = col(c) - 6, Y0 + 24 + row * 40 - 4
    w = len(label) * CW + 12
    if on: dr.rounded_rectangle([x, y, x + w, y + 32], 6, fill=ACCENT)
    dr.text((x + 6, y + 4), label, font=FB if on else F, fill=(255, 255, 255) if on else TEXT)
    return c + len(label) + 2

def skip_icon(dr, c, row, back):
    x, y = col(c), Y0 + 24 + row * 40 + 4
    if back:
        dr.rectangle([x, y, x + 3, y + 18], fill=TEXT); dr.polygon([(x + 18, y), (x + 5, y + 9), (x + 18, y + 18)], fill=TEXT)
    else:
        dr.polygon([(x, y), (x + 13, y + 9), (x, y + 18)], fill=TEXT); dr.rectangle([x + 15, y, x + 18, y + 18], fill=TEXT)
    return c + 3

def speaker(dr, c, row):
    x, y = col(c), Y0 + 24 + row * 40 + 6
    dr.rectangle([x, y + 5, x + 5, y + 12], fill=TEXT)
    dr.polygon([(x + 5, y + 5), (x + 12, y), (x + 12, y + 17), (x + 5, y + 12)], fill=TEXT)
    dr.arc([x + 10, y + 2, x + 20, y + 15], -50, 50, fill=TEXT, width=2)
    return c + 3

def frame(t):
    T = START + t
    k = int(T // LOOP)                      # 0 the riser loop, 1 the drop
    part = 4 if k == 0 else 5
    inloop = T - k * LOOP
    bar = min(7, int(inloop // BAR))
    step = int((inloop - bar * BAR) // STEP) % 16
    g = d['parts'][str(part)][bar]
    im = Image.new('RGB', (W, H), BG)
    dr = ImageDraw.Draw(im)
    dr.rounded_rectangle([X0, Y0, W - X0, Y0 + 430], 14, fill=PANEL, outline=BORDER, width=2)
    # the top line: the transport and the track
    c = skip_icon(dr, 0, 0, True)
    c = button(dr, c + 1, 0, '■ stop', False)
    c = skip_icon(dr, c, 0, False)
    c = text(dr, c + 2, 0, 'late night deploy', TEXT, FB)
    c = text(dr, c + 1, 0, '♡ ↗', TEXT)
    c = text(dr, c + 2, 0, 'vol', DIM)  # the volume: vol − ▂▃▄▆█ +, four bars lit
    c = text(dr, c + 1, 0, '−', TEXT) + 1
    for n, ch in enumerate('▂▃▄▆█'): text(dr, c + n, 0, ch, TEXT if n < 4 else FAINT, F)
    text(dr, c + 6, 0, '+', TEXT)
    right = int((W - 2 * X0 - 48) // CW)
    button(dr, right - 14, 0, '● auto', True)
    text(dr, right - 4, 0, 'hide', DIM)
    # the part bar: one block per loop
    pos = LOOPS_BEFORE + k
    c, start = 0, 0
    for p, n in enumerate(d['loops']):
        for i in range(n):
            cell = start + i
            x, y = col(c) + 2, Y0 + 24 + 40 + 8
            if cell < start or p < part and False: pass
            if start + n <= pos: fill = TEXT
            elif start <= pos < start + n: fill = ACCENT if cell <= pos else (120, 70, 55)
            else: fill = FAINT
            frac = (inloop / LOOP) if cell == pos else 1
            dr.rounded_rectangle([x, y, x + CW - 4, y + 14], 3, fill=FAINT if cell == pos else fill)
            if cell == pos: dr.rounded_rectangle([x, y, x + max(3, (CW - 4) * frac), y + 14], 3, fill=ACCENT)
            c += 1
        start += n
    c = text(dr, c + 2, 1, d['sections'][part], ACCENT, FB)
    text(dr, c + 1, 1, f'· {mmss(pos * LOOP + inloop)} / {mmss(TOTAL)}', DIM)
    # the grid: the ruler, then one row per sound; the next sound dashed
    LABEL = 7
    cellx = lambda i: LABEL + i * 3 + i // 4
    for i in range(16):
        on = i == step
        text(dr, cellx(i), 2, str(i // 4 + 1) if i % 4 == 0 else '·', TEXT if on else DIM, FB if on else F)
    rows = [n for n in ORDER if n in g]
    if part == 4: rows.append('clap')       # the next sound, dashed
    for r, name in enumerate(rows):
        row = 3 + r
        nxt = part == 4 and name == 'clap'
        text(dr, 0, row, name, DIM if nxt else TEXT, F if nxt else FB)
        pat = g.get(name) or d['parts']['5'][0]['clap']
        for i, ch in enumerate(pat):
            x, y = col(cellx(i)), Y0 + 24 + row * 40 + 2
            w = 2 * CW
            if nxt:
                if ch != '.': dr.rectangle([x + 4, y + 10, x + w - 4, y + 18], fill=FAINT)
                else: dr.line([x + 2, y + 14, x + w - 2, y + 14], fill=FAINT, width=2)
                continue
            hit = ch != '.'
            if i == step: fill = TEXT if hit else HEAD_REST
            elif hit: fill = COLORS[name][0 if ch == 'X' else 1]
            else: fill = SUBTLE
            dr.rectangle([x, y, x + w, y + 26], fill=fill)
    # the bottom line
    row = 3 + len(rows) + 0.4
    c = text(dr, 0, row, 'mood', DIM)
    c = button(dr, c + 2, row, 'sad', False)
    c = button(dr, c, row, 'mysterious', False)
    c = button(dr, c, row, 'dark', True)
    text(dr, c, row, '133 bpm', DIM)
    text(dr, right - 24, row, 'edit', TEXT)
    text(dr, right - 17, row, '♥ favorites 4', TEXT)
    # the chat box under the band, for scale
    dr.rounded_rectangle([X0, Y0 + 450, W - X0, Y0 + 510], 12, outline=BORDER, width=2)
    dr.text((X0 + 24, Y0 + 466), '> ', font=F, fill=DIM)
    dr.text((X0 + 24 + 2 * CW, Y0 + 466), 'make it darker', font=F, fill=FAINT)
    dr.text((X0, 50), 'claude-techno-mod', font=FB, fill=TEXT)
    dr.text((X0 + 20 * CW, 50), '/techno late night deploy', font=F, fill=ACCENT)
    return im

ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                       '-ss', str(START), '-t', str(DUR), '-i', f'{S}/demo.wav',
                       '-af', f'afade=t=in:d=0.2,afade=t=out:st={DUR - 1.5}:d=1.5',
                       '-c:v', 'libx264', '-crf', '24', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', OUT],
                      stdin=subprocess.PIPE)
for n in range(int(DUR * FPS)):
    ff.stdin.write(frame(n / FPS).tobytes())
ff.stdin.close(); ff.wait()
if len(sys.argv) > 3:
    for t in map(float, sys.argv[3].split(',')): frame(t).save(f'{S}/frame-{t:.1f}.png')
