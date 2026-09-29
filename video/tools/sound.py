"""
CybCell launch film: synthesised soundtrack (numpy only).

python3 tools/sound.py build/sound.wav

Every sound is placed on the film's timeline (see index.html). The mix is
kept soft: no harsh highs, gentle transients, and a final loudness pass in
ffmpeg (EBU R128, -16 LUFS) evens it out for phones and laptops.
"""
import sys
import wave

import numpy as np

SR = 48000
DUR = 30.0
N = int(SR * DUR)
rng = np.random.default_rng(7)

dry = np.zeros((2, N))
send = np.zeros((2, N))  # reverb send


def t_(dur):
    return np.arange(int(dur * SR)) / SR


def place(sig, t0, gain=1.0, pan=0.0, rev=0.0):
    """Equal-power pan; optional reverb send."""
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.vstack([sig * np.cos(a), sig * np.sin(a)])
    i0 = int(t0 * SR)
    if i0 >= N:
        return
    n = min(sig.shape[1], N - i0)
    dry[:, i0:i0 + n] += sig[:, :n] * gain
    if rev:
        send[:, i0:i0 + n] += sig[:, :n] * gain * rev


def fft_filter(x, lo=None, hi=None, slope=1.5):
    """Smooth band-pass in the frequency domain."""
    n = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    g = np.ones_like(f)
    if lo:
        g *= 1 / (1 + (lo / np.maximum(f, 1)) ** (2 * slope))
    if hi:
        g *= 1 / (1 + (f / hi) ** (2 * slope))
    return np.fft.irfft(X * g, n)


def noise(dur, seed=None):
    r = np.random.default_rng(seed) if seed is not None else rng
    return r.standard_normal(int(dur * SR))


def env(n, a, r, curve=3.0):
    """Attack then exponential-ish release, in seconds."""
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4))
    rel = np.clip((t - a) / max(r, 1e-4), 0, 1)
    return e * (1 - rel) ** curve


def tone(freq, dur, partials=((1, 1.0),), phase_seed=0):
    t = t_(dur)
    out = np.zeros_like(t)
    ph = np.random.default_rng(phase_seed).random(len(partials)) * 2 * np.pi
    for (m, a), p in zip(partials, ph):
        out += a * np.sin(2 * np.pi * freq * m * t + p)
    return out


def sweep(f0, f1, dur, expo=True):
    t = t_(dur)
    if expo:
        f = f0 * (f1 / f0) ** (t / dur)
    else:
        f = f0 + (f1 - f0) * t / dur
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


# --------------------------------------------------------------------- music

def pad_note(freq, dur, seed):
    t = t_(dur)
    s = np.zeros_like(t)
    for k, det in enumerate((-0.12, 0.0, 0.13)):
        f = freq * 2 ** (det / 12)
        lfo = 1 + 0.002 * np.sin(2 * np.pi * (0.13 + 0.05 * k) * t + seed)
        ph = 2 * np.pi * np.cumsum(f * lfo) / SR
        s += np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.06 * np.sin(3 * ph)
    return s / 3


CHORDS = [
    (0.0, 6.4, [73.42, 146.83, 220.0, 261.63, 329.63, 349.23]),     # Dm9
    (6.0, 12.4, [58.27, 116.54, 174.61, 220.0, 293.66, 349.23]),     # Bbmaj7
    (12.0, 18.4, [49.0, 98.0, 146.83, 174.61, 220.0, 233.08]),       # Gm9
    (18.0, 23.4, [55.0, 110.0, 174.61, 261.63, 329.63, 440.0]),      # F/A
    (23.0, 26.8, [65.41, 130.81, 196.0, 293.66, 392.0]),             # Csus2
    (26.4, 30.0, [73.42, 146.83, 220.0, 329.63, 440.0, 587.33]),     # D(add9), open
]

pad = np.zeros((2, N))
for ci, (a, b, notes) in enumerate(CHORDS):
    dur = b - a
    for k, f in enumerate(notes):
        sig = pad_note(f, dur, ci * 10 + k)
        e = np.minimum(1, t_(dur) / 1.4) * np.clip((dur - t_(dur)) / 1.2, 0, 1)
        sig *= e * (0.55 if k == 0 else 0.3)
        pan = (k / max(1, len(notes) - 1) - 0.5) * 0.7
        ang = (pan + 1) * np.pi / 4
        i0 = int(a * SR)
        n = min(len(sig), N - i0)
        pad[0, i0:i0 + n] += sig[:n] * np.cos(ang)
        pad[1, i0:i0 + n] += sig[:n] * np.sin(ang)
# Soften: low-pass the pad and let it breathe with the opening fade.
pad = np.vstack([fft_filter(pad[0], 40, 2600), fft_filter(pad[1], 40, 2600)])
tt = np.arange(N) / SR
pad *= np.clip(tt / 2.5, 0, 1) ** 1.5
pad *= 1 - 0.15 * ((tt > 23) & (tt < 26.4)) * np.clip((tt - 23) / 0.5, 0, 1)  # make room for the riser
dry += pad * 0.16
send += pad * 0.05

# Air: a very quiet filtered noise bed.
air = np.vstack([fft_filter(noise(DUR, 1), 2500, 9000), fft_filter(noise(DUR, 2), 2500, 9000)])
air *= 0.006 * (0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * tt))
dry += air

# Pulse: a soft heartbeat-like kick and ticks, 100 BPM, from 6 s to 23 s.
beat = 60 / 100
for k in range(int((23 - 6) / beat) + 1):
    t0 = 6.0 + k * beat
    if t0 > 22.9:
        break
    kd = 0.35
    f = 95 * (40 / 95) ** (t_(kd) / 0.08).clip(0, 1)
    kick = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(int(kd * SR), 0.003, kd, 4)
    place(kick, t0, 0.22)
    for half in (0, 0.5):
        tick = fft_filter(noise(0.03, 100 + k * 2 + int(half * 2)), 5000, 11000) * env(int(0.03 * SR), 0.001, 0.03, 6)
        place(tick, t0 + half * beat, 0.035 if half else 0.02, pan=0.25 if half else -0.2)

# --------------------------------------------------------------------- sound effects


def whoosh(t0, dur, gain=0.18, up=True, pan0=-0.6, pan1=0.6, seed=0):
    n = int(dur * SR)
    base = noise(dur, 500 + seed)
    bands = np.geomspace(180, 5500, 12)
    t = np.arange(n) / n
    center = np.log(bands[0]) + (np.log(bands[-1]) - np.log(bands[0])) * (t if up else 1 - t)
    center = 0.25 * center + 0.75 * (np.log(400) + (np.log(3500) - np.log(400)) * (np.sin(np.pi * t) if up else np.sin(np.pi * t)))
    out = np.zeros(n)
    for fb in bands:
        band = fft_filter(base, fb / 1.4, fb * 1.4, 2)
        w = np.exp(-((np.log(fb) - center) ** 2) / 0.35)
        out += band * w
    out *= np.sin(np.pi * t) ** 1.6
    out /= np.max(np.abs(out)) + 1e-9
    pan = pan0 + (pan1 - pan0) * t
    a = (pan + 1) * np.pi / 4
    place(np.vstack([out * np.cos(a), out * np.sin(a)]), t0, gain, rev=0.25)


def sub_hit(t0, gain=0.35, f0=85, f1=38, dur=0.9):
    f = f0 * (f1 / f0) ** (np.clip(t_(dur) / 0.25, 0, 1))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(int(dur * SR), 0.004, dur, 3)
    place(s, t0, gain)


def pluck(freq, t0, gain=0.1, pan=0.0, dur=1.2):
    t = t_(dur)
    s = np.zeros_like(t)
    for m in range(1, 7):
        s += (0.6 ** (m - 1)) * np.sin(2 * np.pi * freq * m * t) * np.exp(-t * (3 + m * 2.2))
    s *= np.minimum(1, t / 0.004)
    place(s, t0, gain, pan, rev=0.5)


def chime(freq, t0, gain=0.08, pan=0.0, dur=1.6):
    t = t_(dur)
    s = sum(a * np.sin(2 * np.pi * freq * m * t) * np.exp(-t * d) for m, a, d in ((1, 1, 2.5), (2.76, 0.4, 5), (5.4, 0.18, 9)))
    s *= np.minimum(1, t / 0.006)
    place(s, t0, gain, pan, rev=0.6)


def click(t0, gain=0.07, pan=0.0):
    s = fft_filter(noise(0.012, int(t0 * 1000)), 1500, 7000) * env(int(0.012 * SR), 0.0005, 0.012, 5)
    s += 0.4 * tone(2200, 0.012) * env(int(0.012 * SR), 0.0005, 0.012, 5)
    place(s, t0, gain, pan)


def blip(freq, t0, gain=0.04, pan=0.0):
    d = 0.07
    s = tone(freq, d, ((1, 1), (2, 0.15))) * env(int(d * SR), 0.004, d, 3)
    place(s, t0, gain, pan, rev=0.4)


def swell(t0, dur, f0, f1, gain):
    s = sweep(f0, f1, dur) * np.sin(np.pi * t_(dur) / dur) ** 2
    place(s, t0, gain, rev=0.4)


# Opening: particles gather into the first cell.
whoosh(0.7, 1.9, 0.14, True, -0.3, 0.3, 1)
swell(0.6, 2.0, 110, 220, 0.03)
chime(587.33, 2.35, 0.07)
chime(880.0, 2.42, 0.035, 0.3)

# Division: four soft plucks, rising.
for k, f in enumerate([587.33, 698.46, 880.0, 1174.66]):
    pluck(f, 3.3 + k * 0.6 + 0.12, 0.07, pan=(-1) ** k * 0.3)
    whoosh(3.3 + k * 0.6 - 0.02, 0.45, 0.04, True, 0, 0, 20 + k)

# Scene transitions.
for k, (t0, dur, g) in enumerate([(5.85, 0.9, 0.16), (7.6, 0.6, 0.08), (8.85, 0.85, 0.15), (11.85, 0.85, 0.15), (15.35, 0.85, 0.15), (18.85, 0.8, 0.14), (20.85, 0.75, 0.13)]):
    whoosh(t0, dur, g, k % 2 == 0, -0.6 if k % 2 == 0 else 0.6, 0.6 if k % 2 == 0 else -0.6, 40 + k)
for t0 in (6.0, 9.0, 12.0, 15.5, 19.0, 21.0):
    sub_hit(t0 + 0.05, 0.26)

# 01 website + app.
click(7.35, 0.06, -0.2)
chime(1318.5, 8.18, 0.035, 0.25, 1.0)
chime(1760.0, 8.3, 0.025, 0.3, 1.0)

# 02 AI: sparse digital blips from a pentatonic set.
pent = [880, 987.77, 1174.66, 1318.5, 1567.98, 1760]
r2 = np.random.default_rng(11)
for k in range(12):
    blip(pent[r2.integers(len(pent))], 9.6 + k * 0.19 + r2.random() * 0.05, 0.03, pan=r2.random() * 1.2 - 0.6)

# 03 3D: floors click into place, then a floor opens.
for f in range(15):
    click(12.35 + (f / 14) * 1.25, 0.03, pan=0.3 * np.sin(f))
swell(13.8, 0.7, 180, 360, 0.03)
swell(15.0, 0.5, 300, 160, 0.02)

# 04 marketing: bars rise as an ascending scale; the line glides up.
for k, f in enumerate([293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25]):
    pluck(f, 16.3 + k * 0.1, 0.055, pan=-0.5 + k / 6)
swell(16.95, 0.7, 440, 990, 0.025)
chime(1318.5, 17.62, 0.04)

# 05 kiosk: contactless beep, printer, success.
for k, f in enumerate([1245.0, 1661.0]):
    d = 0.09
    s = tone(f, d) * env(int(d * SR), 0.004, d, 2)
    place(s, 19.82 + k * 0.1, 0.03, 0.2)
pr = fft_filter(noise(0.45, 77), 1800, 5000) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 38 * t_(0.45)))) * env(int(0.45 * SR), 0.02, 0.45, 1)
place(pr, 20.2, 0.02, 0.1)
chime(1046.5, 20.32, 0.035)
chime(1568.0, 20.42, 0.025)

# 06 support: a sonar ping, then soft impacts on the shield.
ping = tone(1480, 1.2) * np.exp(-t_(1.2) * 4) * np.minimum(1, t_(1.2) / 0.005)
place(ping, 21.2, 0.03, 0, rev=0.8)
for k in range(6):
    ta = 21.35 + k * 0.24 + 0.62
    sub_hit(ta, 0.12, 140, 60, 0.35)
    thud = fft_filter(noise(0.12, 300 + k), 200, 1800) * env(int(0.12 * SR), 0.002, 0.12, 4)
    place(thud, ta, 0.05, pan=np.cos(k * 1.047 + 0.5) * 0.6)

# Ecosystem: a long swirl and a riser into the name.
whoosh(22.9, 1.6, 0.1, True, -0.7, 0.7, 60)
rise_d = 3.4
rt = t_(rise_d)
riser = fft_filter(noise(rise_d, 61), 300, 4500) * (rt / rise_d) ** 2.2 * 0.5
riser += sweep(160, 880, rise_d) * (rt / rise_d) ** 2 * 0.35
riser *= 0.5 + 0.5 * np.sin(2 * np.pi * (2 + 10 * rt / rise_d) * rt) ** 2
place(riser, 23.05, 0.17, rev=0.3)

# The name: impact and shimmer.
sub_hit(26.45, 0.36, 70, 32, 2.2)
imp = fft_filter(noise(1.2, 90), 60, 900) * env(int(1.2 * SR), 0.002, 1.2, 5)
place(imp, 26.45, 0.14, rev=0.9)
for k, f in enumerate([1174.66, 1760.0, 2349.3, 2637.0]):
    chime(f, 26.55 + k * 0.05, 0.025, (-1) ** k * 0.4, 3.0)
chime(587.33, 27.4, 0.05, 0, 2.6)

# --------------------------------------------------------------------- reverb and master

ir_len = int(2.6 * SR)
it = np.arange(ir_len) / SR
ir = np.vstack([fft_filter(noise(2.6, 901), 200, 6000), fft_filter(noise(2.6, 902), 200, 6000)]) * np.exp(-it / 0.55)
ir /= np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))
wet = np.zeros((2, N))
for c in range(2):
    L = N + ir_len
    size = 1 << (L - 1).bit_length()
    wet[c] = np.fft.irfft(np.fft.rfft(send[c], size) * np.fft.rfft(ir[c], size), size)[:N]
mix = dry + wet * 0.55

# Gentle tone shaping: nothing below 28 Hz, soft top.
mix = np.vstack([fft_filter(mix[0], 28, 12000, 1), fft_filter(mix[1], 28, 12000, 1)])
# Fade in/out to match the picture.
mix *= np.clip(tt / 0.4, 0, 1) * np.clip((DUR - tt) / 1.2, 0, 1)
# Soft saturation instead of hard limiting.
peak = np.max(np.abs(mix)) + 1e-9
mix = np.tanh(mix / peak * 1.2) / np.tanh(1.2) * 0.89

out = sys.argv[1] if len(sys.argv) > 1 else 'sound.wav'
pcm = (np.clip(mix.T, -1, 1) * 32767).astype('<i2')
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', out, f'{DUR}s')
