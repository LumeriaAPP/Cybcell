"""
CybCell launch film: synthesised trailer soundtrack (numpy only).

python3 tools/sound.py build/sound.wav

Every sound is placed on the film's timeline (timeline.json, shared with
index.html). The design follows a modern game-trailer grammar: a dark
B-minor sub drone, a digital boot sequence, silence right before each big
hit, braam + boom + metal impacts, a tense ostinato under the montage, a
near-silent breath, an implosion and a final impact on the name.

The master is limited and gain-matched to -16 LUFS integrated with true
peaks under -1.5 dBTP (measured with ffmpeg's ebur128), so it sits at the
same level as other videos on social platforms without tiring the ear.
"""
import json
import os
import re
import subprocess
import sys
import wave

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

HERE = os.path.dirname(os.path.abspath(__file__))
TL = json.load(open(os.path.join(HERE, '..', 'timeline.json')))

SR = 48000
DUR = float(TL['duration'])
N = int(SR * DUR)
tt = np.arange(N) / SR

dry = np.zeros((2, N))    # effects
mus = np.zeros((2, N))    # drone, pads, ostinato
send = np.zeros((2, N))   # reverb send

NOTE = {n: i for i, n in enumerate(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])}


def hz(name):
    """'B1' -> 61.74 Hz."""
    m = re.fullmatch(r'([A-G]#?)(-?\d)', name)
    k = NOTE[m.group(1)] + 12 * (int(m.group(2)) + 1)
    return 440.0 * 2 ** ((k - 69) / 12)


def t_(dur):
    return np.arange(int(dur * SR)) / SR


def to_stereo(sig, pan):
    if sig.ndim == 2:
        return sig
    a = (pan + 1) * np.pi / 4
    return np.vstack([sig * np.cos(a), sig * np.sin(a)])


def place(sig, t0, gain=1.0, pan=0.0, rev=0.0, bus=None):
    bus = dry if bus is None else bus
    sig = to_stereo(sig, pan)
    i0 = int(round(t0 * SR))
    if i0 >= N:
        return
    if i0 < 0:
        sig = sig[:, -i0:]
        i0 = 0
    n = min(sig.shape[1], N - i0)
    bus[:, i0:i0 + n] += sig[:, :n] * gain
    if rev:
        send[:, i0:i0 + n] += sig[:, :n] * gain * rev


def place_end(sig, t_end, *a, **k):
    """Place a sound so that it ends exactly at t_end."""
    place(sig, t_end - sig.shape[-1] / SR, *a, **k)


def fft_filter(x, lo=None, hi=None, slope=1.5):
    """Smooth band-pass in the frequency domain."""
    n = x.shape[-1]
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    g = np.ones_like(f)
    if lo:
        g *= 1 / (1 + (lo / np.maximum(f, 1)) ** (2 * slope))
    if hi:
        g *= 1 / (1 + (f / hi) ** (2 * slope))
    return np.fft.irfft(X * g, n)


def noise(dur, seed):
    return np.random.default_rng(seed).standard_normal(int(dur * SR))


def env(n, a, r, curve=3.0):
    """Attack then a curved release, both in seconds."""
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4))
    rel = np.clip((t - a) / max(r, 1e-4), 0, 1)
    return e * (1 - rel) ** curve


def expdecay(dur, tau, attack=0.002):
    t = t_(dur)
    return np.minimum(1, t / attack) * np.exp(-t / tau)


def osc(freq, dur, phase=0.0):
    """Sine with a constant or per-sample frequency."""
    if np.isscalar(freq):
        return np.sin(2 * np.pi * freq * t_(dur) + phase)
    return np.sin(2 * np.pi * np.cumsum(freq) / SR + phase)


def glide(f0, f1, dur, k=1.0):
    """Exponential pitch curve from f0 to f1 over dur seconds, then flat."""
    t = t_(dur)
    return f0 * (f1 / f0) ** np.clip(t / k, 0, 1)


def saturate(x, drive):
    return np.tanh(x * drive) / np.tanh(drive)


def automation(points):
    xs, ys = zip(*points)
    return np.interp(tt, xs, ys)


# --------------------------------------------------------------------- instruments


def boom(t0, gain, f0=90.0, f1=31.0, tau=1.3, drop=0.35, rev=0.25):
    """Sub impact: a fast pitch drop into the fundamental, with harmonics
    added by saturation so phones and laptops still feel it."""
    dur = tau * 5
    s = osc(glide(f0, f1, dur, drop), dur) * expdecay(dur, tau, 0.003)
    harm = fft_filter(saturate(s * 1.5, 3.0), 70, 420) * 0.45
    place(s + harm, t0, gain, rev=rev)


def braam(t0, gain, notes, dur=3.6, bright=2600.0, tau=1.5, rev=0.35, seed=0):
    """Brass-like low synth stack: band-limited detuned saws whose filter
    snaps open on the attack and closes as the note rings out."""
    t = t_(dur)
    n = len(t)
    fc = 170 + (bright - 170) * np.exp(-t / 0.32)
    amp = np.minimum(1, t / 0.025) * (0.35 + 0.65 * np.exp(-t / tau)) * np.clip((dur - t) / 0.8, 0, 1)
    growl = 1 + 0.12 * np.sin(2 * np.pi * 29 * t) * np.exp(-t / 0.6)
    rng = np.random.default_rng(seed)
    out = np.zeros((2, n))
    for note, g in notes:
        f = hz(note) if isinstance(note, str) else note
        for v, cents in enumerate((-11, -3, 4, 12)):
            ff = f * 2 ** (cents / 1200) * (1 + 0.012 * np.exp(-t / 0.05))
            ph = 2 * np.pi * np.cumsum(ff) / SR
            voice = np.zeros(n)
            for h in range(1, int(min(bright * 1.3, 7000) / f) + 1):
                voice += (1 / h) / (1 + (h * f / fc) ** 4) * np.sin(h * ph + rng.random() * 6.28)
            pan = (v / 3 - 0.5) * 0.8
            out += to_stereo(voice * g, pan)
    out *= amp * growl
    place(out / 3, t0, gain, rev=rev)


def crack(t0, gain, seed=0, rev=0.4):
    """Transient of an impact: a bright snap and a dense body."""
    snap = fft_filter(noise(0.06, 300 + seed), 900, 9000) * expdecay(0.06, 0.008, 0.0005)
    body = fft_filter(noise(0.5, 400 + seed), 60, 700) * expdecay(0.5, 0.09, 0.001)
    body[:len(snap)] += snap * 0.7
    place(body, t0, gain, rev=rev)


def metal(t0, gain, base=150.0, tau=1.2, pan=0.0, rev=0.5, seed=0):
    """Dark metallic ring: inharmonic partials excited by a short noise hit."""
    dur = tau * 4
    t = t_(dur)
    s = np.zeros_like(t)
    rng = np.random.default_rng(seed)
    for m, a, d in ((1.0, 1.0, 1.0), (2.76, 0.55, 0.6), (5.40, 0.35, 0.35), (8.93, 0.2, 0.22), (13.34, 0.1, 0.12)):
        s += a * np.sin(2 * np.pi * base * m * (1 + 0.002 * rng.standard_normal()) * t + rng.random() * 6.28) * np.exp(-t / (tau * d))
    s *= np.minimum(1, t / 0.002)
    exc = fft_filter(noise(0.03, 500 + seed), 1500, 8000) * expdecay(0.03, 0.006, 0.0005) * 0.6
    s[:len(exc)] += exc
    place(s, t0, gain, pan, rev=rev)


def whoosh(t0, dur, gain, up=True, pan0=-0.6, pan1=0.6, seed=0, lo=180, hi=5500, rev=0.25):
    """Air moving past: noise whose band follows an arc."""
    n = int(dur * SR)
    base = noise(dur, 600 + seed)
    bands = np.geomspace(lo, hi, 12)
    u = np.arange(n) / n
    arc = np.sin(np.pi * u) if up is None else (u if up else 1 - u)
    center = np.log(bands[0]) + (np.log(bands[-1]) - np.log(bands[0])) * (0.25 + 0.6 * arc)
    out = np.zeros(n)
    for fb in bands:
        band = fft_filter(base, fb / 1.4, fb * 1.4, 2)
        out += band * np.exp(-((np.log(fb) - center) ** 2) / 0.3)
    out *= np.sin(np.pi * u) ** 1.6
    out /= np.max(np.abs(out)) + 1e-9
    pan = pan0 + (pan1 - pan0) * u
    a = (pan + 1) * np.pi / 4
    place(np.vstack([out * np.cos(a), out * np.sin(a)]), t0, gain, rev=rev)


def reverse_swell(t_end, dur, gain, seed=0, lo=150, hi=7000, rev=0.1):
    """Reversed-reverb rush that ends exactly on t_end (into a hit or a silence)."""
    n = int(dur * SR)
    u = np.arange(n) / n
    low = fft_filter(noise(dur, 700 + seed), lo, 1200)
    high = fft_filter(noise(dur, 800 + seed), 1200, hi)
    s = low * (1 - u * 0.5) + high * u ** 1.5
    s *= u ** 3
    s /= np.max(np.abs(s)) + 1e-9
    tone = osc(glide(hz('B2'), hz('B4'), dur, dur), dur) * u ** 4 * 0.25
    place_end(to_stereo(s + tone, 0), t_end, gain, rev=rev)


def riser(t0, dur, gain, seed=0, f0=110.0, f1=880.0):
    """Noise and a rising tone with a tremolo that speeds up."""
    t = t_(dur)
    u = t / dur
    s = fft_filter(noise(dur, 900 + seed), 300, 5000) * u ** 2.2 * 0.5
    s += osc(glide(f0, f1, dur, dur), dur) * u ** 2 * 0.35
    s += osc(glide(f0 * 1.5, f1 * 1.5, dur, dur), dur) * u ** 2 * 0.12
    trem_rate = 3 + 22 * u ** 2
    s *= 0.55 + 0.45 * np.sin(2 * np.pi * np.cumsum(trem_rate) / SR) ** 2
    place(s, t0, gain, rev=0.3)


def thump(t0, gain, f0=62.0, f1=38.0, dur=0.5, pan=0.0):
    """Heartbeat-like low kick."""
    s = osc(glide(f0, f1, dur, 0.09), dur) * env(int(dur * SR), 0.004, dur, 4)
    s += fft_filter(saturate(s, 2.5), 90, 300) * 0.3
    place(s, t0, gain, pan)


def tick(t0, gain, pan=0.0, seed=0, lo=2500, hi=9000):
    s = fft_filter(noise(0.02, 1000 + seed), lo, hi) * env(int(0.02 * SR), 0.0005, 0.02, 6)
    place(s, t0, gain, pan)


def click(t0, gain, pan=0.0):
    s = fft_filter(noise(0.014, int(t0 * 1000)), 1500, 7000) * env(int(0.014 * SR), 0.0005, 0.014, 5)
    s += 0.4 * osc(2200, 0.014) * env(int(0.014 * SR), 0.0005, 0.014, 5)
    place(s, t0, gain, pan)


def blip(freq, t0, gain, pan=0.0, d=0.06, rev=0.35):
    s = (osc(freq, d) + 0.15 * osc(freq * 2, d)) * env(int(d * SR), 0.003, d, 3)
    place(s, t0, gain, pan, rev=rev)


def bell(freq, t0, gain, pan=0.0, dur=1.6, rev=0.6):
    t = t_(dur)
    s = sum(a * np.sin(2 * np.pi * freq * m * t) * np.exp(-t * d) for m, a, d in ((1, 1, 2.2), (2.76, 0.35, 4.5), (5.4, 0.15, 8)))
    s *= np.minimum(1, t / 0.004)
    place(s, t0, gain, pan, rev=rev)


def pluck(freq, t0, gain, pan=0.0, dur=0.9, rev=0.4):
    t = t_(dur)
    s = sum((0.6 ** (m - 1)) * np.sin(2 * np.pi * freq * m * t) * np.exp(-t * (4 + m * 2.5)) for m in range(1, 7))
    s *= np.minimum(1, t / 0.003)
    place(s, t0, gain, pan, rev=rev)


def zap(t0, gain, pan=0.0, seed=0):
    """Energy deflecting off the shield: a fast FM chirp over a noise burst."""
    d = 0.18
    t = t_(d)
    f = 1800 * np.exp(-t / 0.04) + 180
    s = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.3 * np.sin(2 * np.pi * 70 * t))) / SR) * np.exp(-t / 0.05)
    s += fft_filter(noise(d, 1100 + seed), 1500, 6000) * np.exp(-t / 0.03) * 0.5
    place(s, t0, gain, pan, rev=0.3)


def pad(t0, t1, notes, gain, bright=1100.0, attack=0.6, release=0.8, seed=0, bus=None):
    """Dark synth-string pad: detuned additive saws, low-passed."""
    dur = t1 - t0 + release
    t = t_(dur)
    n = len(t)
    amp = np.minimum(1, t / attack) * np.clip((dur - t) / release, 0, 1)
    rng = np.random.default_rng(seed)
    out = np.zeros((2, n))
    for k, note in enumerate(notes):
        f = hz(note)
        for v, cents in enumerate((-8, 0, 7)):
            ff = f * 2 ** (cents / 1200) * (1 + 0.0025 * np.sin(2 * np.pi * (0.15 + 0.07 * v) * t + rng.random() * 6))
            ph = 2 * np.pi * np.cumsum(ff) / SR
            voice = np.zeros(n)
            for h in range(1, 12):
                if h * f > 6000:
                    break
                voice += (1 / h) / (1 + (h * f / bright) ** 4) * np.sin(h * ph + rng.random() * 6.28)
            pan = ((k + v / 3) / max(1, len(notes)) - 0.5) * 0.9
            out += to_stereo(voice, pan)
    out *= amp / (3 * len(notes)) ** 0.5
    place(out, t0, gain, rev=0.35, bus=mus if bus is None else bus)


def bass_note(freq, t0, gain, dur=0.19, cutoff=600.0):
    t = t_(dur)
    ph = 2 * np.pi * freq * t
    s = np.zeros_like(t)
    fc = 120 + cutoff * np.exp(-t / 0.05)
    for h in range(1, 24):
        if h * freq > 4000:
            break
        s += (1 / h) / (1 + (h * freq / fc) ** 4) * np.sin(h * ph)
    s *= np.minimum(1, t / 0.004) * np.clip((dur - t) / 0.03, 0, 1) * np.exp(-t / 0.18)
    place(s, t0, gain, rev=0.08, bus=mus)


def drone(points):
    """B0 + B1 sub drone with a slowly beating fifth, following a level curve."""
    lvl = automation(points)
    s = np.sin(2 * np.pi * hz('B0') * tt) + 0.55 * np.sin(2 * np.pi * hz('B1') * 1.0007 * tt + 1.0)
    s += 0.22 * np.sin(2 * np.pi * hz('F#2') * tt + 2.0) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.11 * tt))
    s *= 1 + 0.08 * np.sin(2 * np.pi * 0.23 * tt)
    s += fft_filter(saturate(s * 0.6, 2.0), 70, 300) * 0.35
    mus[:] += np.vstack([s, s]) * lvl


# --------------------------------------------------------------------- the score

hit = TL['hit']
div = TL['div']
logo = TL['logo']
beat = 0.4                     # 150 BPM; the montage cuts land on this grid
bar = beat * 2                 # half-time feel for the percussion

# Room tone: barely there, but it makes the silences feel like air, not dead.
air = np.vstack([fft_filter(noise(DUR, 1), 400, 6000), fft_filter(noise(DUR, 2), 400, 6000)])
dry += air * 0.0025

drone([
    (0.0, 0.0), (0.3, 0.015), (1.85, 0.07), (hit, 0.2), (div[0], 0.15), (6.9, 0.16), (TL['web'], 0.08),
    (TL['dark'] - 0.05, 0.08), (TL['dark'] + 0.15, 0.004), (TL['galaxy'], 0.03), (TL['collapse'], 0.15),
    (logo, 0.2), (28.2, 0.1), (DUR, 0.0),
])

# 0. Boot: ominous high cluster, the system decoding itself, a charging whine.
cl_d = TL['silence'][0][0] - 0.2
cl_t = t_(cl_d)
cluster = sum(a * np.sin(2 * np.pi * hz(nm) * cl_t + k) for k, (nm, a) in enumerate((('B4', 1.0), ('C5', 0.8), ('F5', 0.45), ('B5', 0.18))))
cluster *= (0.6 + 0.4 * np.sin(2 * np.pi * 0.9 * cl_t)) * (cl_t / cl_d) ** 2.2
cluster += fft_filter(noise(cl_d, 11), 3000, 9000) * 0.35 * (cl_t / cl_d) ** 2
place(np.vstack([cluster, np.roll(cluster, 240)]), 0.2, 0.11, rev=0.5)

boot_text = 'CYBCELL  //  SİSTEM İŞƏ DÜŞÜR'


def js_hash(n):
    x = np.sin(n * 127.1 + 311.7) * 43758.5453
    return x - np.floor(x)


for j, ch in enumerate(boot_text):
    if ch == ' ':
        continue
    ts = TL['boot'] + 0.12 + j * 0.028 + js_hash(j + 3) * 0.08
    tick(ts, 0.08, pan=(j / len(boot_text) - 0.5) * 0.8, seed=j, lo=3000, hi=8000)
    if j % 3 == 0:
        blip(hz('B6') * (1.0, 1.335, 1.5, 2.0)[j % 4], ts + 0.01, 0.022, pan=(j / len(boot_text) - 0.5) * 0.8, d=0.03)
# Progress bar: a thin data whine.
pw_d = TL['point'] - 0.2 - (TL['boot'] + 0.2)
pw = osc(glide(900, 2400, pw_d, pw_d), pw_d) * np.sin(np.pi * t_(pw_d) / pw_d) ** 2
place(pw, TL['boot'] + 0.2, 0.018, rev=0.3)
# Tube switch-off, then the point of light starts charging.
off_d = 0.18
place(osc(glide(2200, 70, off_d, off_d), off_d) * env(int(off_d * SR), 0.005, off_d, 2), TL['point'] - 0.17, 0.05)
click(TL['point'], 0.08)
ch_d = TL['silence'][0][0] - TL['point']
ch_t = t_(ch_d)
charge = osc(glide(260, 2100, ch_d, ch_d) * (1 + 0.01 * np.sin(2 * np.pi * 31 * ch_t)), ch_d) * (ch_t / ch_d) ** 1.8
place(charge, TL['point'], 0.06, rev=0.3)
reverse_swell(TL['silence'][0][0], 0.75, 0.2, seed=1)

# 1. First hit: the cell ignites.
boom(hit, 0.85, 95, 31, tau=1.5)
braam(hit, 0.42, [('B0', 0.7), ('B1', 1.0), ('F#2', 0.6), ('B2', 0.4)], dur=4.2, bright=2800, seed=1)
crack(hit, 0.5, seed=1)
metal(hit, 0.12, base=hz('B2'), tau=1.4, rev=0.7, seed=1)
whoosh(hit + 0.02, 0.9, 0.18, False, 0, 0, seed=2, lo=120, hi=4000)
# The burning cell: a low roar and a fire-like crackle.
roar_d = div[0] - hit + 0.6
roar_t = t_(roar_d)
roar = fft_filter(noise(roar_d, 21), 28, 140) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.4 * roar_t))
roar *= np.minimum(1, roar_t / 0.4) * np.clip((roar_d - roar_t) / 0.7, 0, 1)
place(np.vstack([roar, fft_filter(noise(roar_d, 22), 28, 140) * np.minimum(1, roar_t / 0.4) * np.clip((roar_d - roar_t) / 0.7, 0, 1)]), hit + 0.3, 0.15)
rc = np.random.default_rng(5)
for k in range(70):
    t0 = hit + 0.4 + rc.random() * (div[0] - hit - 0.3)
    tick(t0, 0.015 + 0.025 * rc.random(), pan=rc.random() * 1.4 - 0.7, seed=100 + k, lo=900, hi=5000)
pad(hit + 1.0, div[0] + 0.4, ['B1', 'F#2', 'B2', 'D3'], 0.2, bright=700, attack=1.4, seed=1)
reverse_swell(div[0], 0.5, 0.1, seed=2)

# 2. Division: heartbeat, a wet split, a dark bell rising through B minor.
for k, (t0, nm) in enumerate(zip(div, ('B3', 'D4', 'F#4', 'B4'))):
    thump(t0, 0.45 + 0.08 * k, 64, 38)
    pop_d = 0.25
    pop_t = t_(pop_d)
    pop = fft_filter(noise(pop_d, 30 + k), 200, 3000) * np.sin(2 * np.pi * np.cumsum(glide(1400, 260, pop_d, 0.12)) / SR) * np.exp(-pop_t / 0.05)
    place(pop, t0, 0.12, pan=(-1) ** k * 0.35, rev=0.3)
    bell(hz(nm), t0 + 0.005, 0.05, pan=(-1) ** k * 0.3, dur=1.4)
    whoosh(t0 - 0.12, 0.34, 0.05, None, 0, 0, seed=40 + k)
pad(div[0], TL['web'] - 0.1, ['B1', 'F#2', 'D3', 'F#3'], 0.26, bright=900, attack=0.5, release=0.1, seed=2)
riser(div[3] + 0.1, TL['silence'][1][0] - div[3] - 0.1, 0.12, seed=3)
reverse_swell(TL['silence'][1][0], 0.6, 0.18, seed=3)

# 3. Montage: ostinato, half-time kick, 16th ticks; chords follow the scenes.
m0 = TL['web']
m1 = TL['dark']
CH = [
    (TL['web'], TL['ai'], ['B2', 'D3', 'F#3', 'B3'], 'B1'),
    (TL['ai'], TL['tower'], ['G2', 'B2', 'D3', 'G3'], 'G1'),
    (TL['tower'], TL['chart'], ['D3', 'F#3', 'A3', 'D4'], 'D2'),
    (TL['chart'], TL['kiosk'], ['A2', 'C#3', 'E3', 'A3'], 'A1'),
    (TL['kiosk'], TL['shield'], ['F#2', 'A#2', 'C#3', 'F#3'], 'F#1'),
    (TL['shield'], TL['dark'], ['B2', 'D3', 'F#3', 'B3'], 'B1'),
]
for k, (a, b, notes, root) in enumerate(CH):
    pad(a, b, notes, 0.16, bright=900 + 90 * k, attack=0.25, release=0.12, seed=10 + k)
    f = hz(root)
    nsteps = int(round((b - a) / (beat / 2)))
    for j in range(nsteps):
        tb = a + j * beat / 2
        pos = j % 4
        mult = (1, 1, 2, 1)[pos]
        vel = (1.0, 0.55, 0.75, 0.6)[pos]
        prog = (tb - m0) / (m1 - m0)
        bass_note(f * mult, tb, 0.14 * vel, cutoff=350 + 900 * prog)
nb = int(round((m1 - m0) / bar))
for j in range(nb):
    tb = m0 + j * bar
    thump(tb, 0.26, 70, 42, 0.4)
for j in range(int(round((m1 - m0) / (beat / 4)))):
    tb = m0 + j * beat / 4
    tick(tb, 0.06 if j % 2 else 0.1, pan=0.3 if j % 2 else -0.25, seed=2000 + j, lo=4500, hi=10000)
# A soft shaker-like air layer that breathes with the 8ths.
sh_d = m1 - m0
sh_t = t_(sh_d)
shaker = np.vstack([fft_filter(noise(sh_d, 71), 4000, 9000), fft_filter(noise(sh_d, 72), 4000, 9000)])
shaker *= (0.35 + 0.65 * np.abs(np.sin(np.pi * sh_t / (beat / 2))) ** 6) * np.minimum(1, sh_t / 0.3) * np.clip((sh_d - sh_t) / 0.1, 0, 1)
place(shaker, m0, 0.045)

# Montage hits on every cut.
boom(TL['web'], 0.6, 85, 33, tau=0.9)
braam(TL['web'], 0.25, [('B1', 1.0), ('F#2', 0.6), ('B2', 0.4)], dur=1.8, bright=2200, tau=0.6, seed=2)
crack(TL['web'], 0.42, seed=2)
metal(TL['web'], 0.08, base=hz('F#2'), tau=0.9, seed=2)
for k, t0 in enumerate((TL['ai'], TL['tower'], TL['chart'], TL['kiosk'], TL['shield'])):
    boom(t0, 0.4, 80, 36, tau=0.55)
    crack(t0, 0.4, seed=10 + k)
    metal(t0, 0.1, base=hz(('D3', 'G2', 'A2', 'F#2', 'B2')[k]), tau=0.8, pan=(-1) ** k * 0.25, seed=10 + k)
    whoosh(t0 - 0.42, 0.5, 0.16, True, (-1) ** k * 0.6, -((-1) ** k) * 0.3, seed=50 + k)
whoosh(TL['app'] - 0.3, 0.55, 0.09, None, 0.5, -0.5, seed=60)
tick(TL['app'], 0.05, seed=61, lo=1500, hi=7000)

# Scene sounds.
w = TL['web']
whoosh(w + 0.4, 0.6, 0.025, None, 0.5, -0.4, seed=70, lo=800, hi=6000)
click(w + 1.0, 0.09, -0.3)
blip(hz('F#5'), w + 1.02, 0.02, -0.3)
a = TL['app']
blip(hz('E5'), a + 0.47, 0.03, 0.1)
blip(hz('B5'), a + 0.56, 0.025, 0.15)
rb = np.random.default_rng(12)
scale = [hz(n) for n in ('B5', 'D6', 'E6', 'F#6', 'A6', 'B6')]
for k in range(34):
    t0 = TL['ai'] + 0.3 + k * 0.05 + rb.random() * 0.02
    blip(scale[rb.integers(len(scale))], t0, 0.008 + 0.006 * rb.random(), pan=rb.random() * 1.4 - 0.7, d=0.035)
hum_d = TL['tower'] - TL['ai']
hum_t = t_(hum_d)
hum = np.sin(2 * np.pi * 110 * hum_t + 2.5 * np.sin(2 * np.pi * 55 * hum_t) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.8 * hum_t)))
place(hum * np.sin(np.pi * hum_t / hum_d) ** 2, TL['ai'], 0.02, rev=0.3)
tw = TL['tower']
for f in range(15):
    t0 = tw + 0.5 + (f / 14) * 1.1
    metal(t0, 0.02, base=90 * 2 ** (f / 24), tau=0.12, pan=0.3 * np.sin(f), rev=0.2, seed=200 + f)
    tick(t0, 0.02, pan=0.3 * np.sin(f), seed=300 + f, lo=1200, hi=5000)
servo_d = 0.45
servo = osc(glide(180, 340, servo_d, servo_d), servo_d) + 0.4 * osc(glide(360, 680, servo_d, servo_d), servo_d)
place(servo * np.sin(np.pi * t_(servo_d) / servo_d), tw + 1.95, 0.025, rev=0.3)
bell(hz('F#5'), tw + 2.35, 0.02, 0.2, 1.2)
c = TL['chart']
for k, nm in enumerate(('B2', 'D3', 'E3', 'F#3', 'A3', 'B3', 'D4')):
    pluck(hz(nm), c + 0.45 + k * 0.07, 0.06, pan=-0.5 + k / 6)
line_d = 0.75
place(osc(glide(hz('F#4'), hz('F#5'), line_d, line_d), line_d) * np.sin(np.pi * t_(line_d) / line_d) ** 2, c + 1.05, 0.02, rev=0.4)
bell(hz('B5'), c + 1.8, 0.03, 0.4, 1.4)
kz = TL['kiosk'] + 0.1
for k, f in enumerate((1245.0, 1661.0)):
    blip(f, kz + 0.75 + k * 0.1, 0.02, 0.2, d=0.08)
pr = fft_filter(noise(0.5, 77), 1800, 5000) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 38 * t_(0.5)))) * env(int(0.5 * SR), 0.02, 0.5, 1)
place(pr, kz + 1.1, 0.015, 0.1)
bell(hz('D5'), kz + 1.25, 0.03)
bell(hz('A5'), kz + 1.33, 0.02, 0.2)
sh = TL['shield']
ping = osc(hz('F#5'), 1.2) * np.exp(-t_(1.2) * 4) * np.minimum(1, t_(1.2) / 0.005)
place(ping, sh + 0.12, 0.025, rev=0.8)
ANG = [-0.3, -2.8, 0.55, -1.2, 2.55, -1.95]
for k in range(6):
    tk = sh + 0.35 + k * 0.2
    pan = float(np.cos(ANG[k])) * 0.7
    whoosh(tk, 0.5, 0.03, True, pan * 1.2, pan * 0.5, seed=80 + k, lo=600, hi=6000)
    thump(tk + 0.5, 0.12, 120, 60, 0.3, pan)
    zap(tk + 0.5, 0.035, pan, seed=k)

# 4. Breath: the music is sucked out; a thin tone and one heartbeat.
dk = TL['dark']
reverse_swell(dk, 0.45, 0.12, seed=5)
boom(dk, 0.08, 60, 24, tau=0.7, drop=1.0, rev=0.3)
whoosh(dk, 1.1, 0.07, False, 0.4, -0.4, seed=90, lo=100, hi=2500)
br_d = TL['galaxy'] - dk + 1.2
br_t = t_(br_d)
place(osc(hz('B5'), br_d) * np.minimum(1, br_t / 0.3) * np.clip((br_d - br_t) / 0.9, 0, 1), dk, 0.02, rev=0.6)
thump(dk + 0.6, 0.2, 58, 36, 0.6)

# 5. Build: the galaxy forms, pulses speed up, tension chords, riser.
g0 = TL['galaxy']
co = TL['collapse']
s2 = TL['silence'][2][0]
whoosh(g0, 1.5, 0.14, None, -0.7, 0.7, seed=95, lo=120, hi=4500, rev=0.4)
pad(g0, g0 + 0.8, ['G2', 'B2', 'D3', 'G3'], 0.2, bright=800, attack=0.5, release=0.15, seed=30)
pad(g0 + 0.8, g0 + 1.4, ['F#2', 'A2', 'D3', 'F#3'], 0.22, bright=900, attack=0.2, release=0.15, seed=31)
pad(g0 + 1.4, co, ['E2', 'G2', 'B2', 'E3'], 0.24, bright=1000, attack=0.2, release=0.15, seed=32)
pad(co, s2, ['F#2', 'B2', 'C#3', 'F#3', 'A#3'], 0.28, bright=1400, attack=0.15, release=0.02, seed=33)
tb = g0
step = 0.8
k = 0
while tb < s2 - 0.05:
    thump(tb, 0.28 + 0.25 * (tb - g0) / (s2 - g0), 66, 40, 0.35)
    tick(tb, 0.03, seed=3000 + k, lo=3000, hi=9000)
    k += 1
    if tb >= g0 + 1.6:
        step = 0.2
    elif tb >= g0 + 0.8:
        step = 0.4
    if tb >= co:
        step = 0.1
    tb += step
riser(g0 + 0.6, s2 - g0 - 0.6, 0.2, seed=6, f0=hz('B2'), f1=hz('B5'))
# Collapse: a reversed impact sucked into the point, cut dead by the silence.
imp_d = 1.6
imp = osc(glide(90, 32, imp_d, 0.3), imp_d) * expdecay(imp_d, 0.4) + fft_filter(noise(imp_d, 97), 80, 5000) * expdecay(imp_d, 0.25) * 0.6
suck = imp[::-1][int((imp_d - (s2 - co)) * SR):]
place_end(suck, s2, 0.3, rev=0.2)
whoosh(co, s2 - co, 0.12, True, 0.6, -0.6, seed=98, lo=300, hi=7000)

# 6. The name: the biggest hit, then the resolution in B minor.
boom(logo, 0.95, 105, 30.87, tau=2.0)
braam(logo, 0.48, [('B0', 0.7), ('B1', 1.0), ('F#2', 0.65), ('B2', 0.45), ('D3', 0.25)], dur=5.0, bright=3400, tau=2.0, seed=7)
crack(logo, 0.55, seed=7)
metal(logo, 0.13, base=hz('B2'), tau=1.8, rev=0.8, seed=7)
whoosh(logo + 0.02, 1.0, 0.16, False, 0, 0, seed=99, lo=120, hi=5000)
rs = np.random.default_rng(8)
for k in range(40):
    t0 = logo + 0.1 + rs.random() * 1.3
    blip(hz('B6') * (1, 1.189, 1.335, 1.498, 1.782)[rs.integers(5)], t0, 0.004 + 0.004 * rs.random(), pan=rs.random() * 1.6 - 0.8, d=0.05, rev=0.7)
pad(logo + 0.2, DUR, ['B1', 'F#2', 'B2', 'C#3', 'D3', 'F#3'], 0.17, bright=1300, attack=1.4, release=0.6, seed=40)
shing_d = 1.5
shing = fft_filter(noise(shing_d, 111), 3000, 9000) * np.sin(np.pi * t_(shing_d) / shing_d) ** 2
place(shing, logo + 0.9, 0.012, rev=0.6)
for t0, g in ((TL['tag1'], 0.3), (TL['tag2'], 0.36)):
    thump(t0, g, 48, 30, 0.9)
    metal(t0, 0.03, base=hz('B3'), tau=0.7, rev=0.8, seed=int(t0 * 10))

# --------------------------------------------------------------------- reverb, bus mix and master

ir_d = 3.2
it = t_(ir_d)
ir = np.vstack([fft_filter(noise(ir_d, 901), 150, 6000), fft_filter(noise(ir_d, 902), 150, 6000)])
ir *= np.exp(-it / 0.8) * np.minimum(1, it / 0.01)
ir /= np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))
wet = np.zeros((2, N))
size = 1 << (N + len(it) - 1).bit_length()
for ch in range(2):
    wet[ch] = np.fft.irfft(np.fft.rfft(send[ch], size) * np.fft.rfft(ir[ch], size), size)[:N]

# Music ducks under the big hits so they land cleanly.
duck = np.ones(N)
for th, kk in TL['hits']:
    if kk >= 0.5:
        d = np.clip((tt - th) / 0.6, 0, 1)
        duck *= 1 - (tt >= th) * kk * 0.45 * (1 - d)
mix = dry + mus * duck + wet * 0.5
mix = fft_filter(mix, 24, 15000, 1.2)

# Silences: everything, reverb tails included, stops dead before the hit.
gate = np.ones(N)
fade = int(0.008 * SR)
for a, b in TL['silence']:
    ia = int(a * SR)
    ib = int(b * SR)
    gate[ia:ib] = 0
    gate[max(0, ia - fade):ia] *= np.linspace(1, 0, min(fade, ia))
mix *= gate
mix *= np.clip(tt / 0.05, 0, 1) * np.clip((DUR - tt) / 1.0, 0, 1)

FFMPEG = None


def ffmpeg():
    global FFMPEG
    if FFMPEG is None:
        import imageio_ffmpeg
        FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
    return FFMPEG


def write(path, x):
    pcm = (np.clip(x.T, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def measure(path):
    r = subprocess.run([ffmpeg(), '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
    s = r.stderr[r.stderr.rfind('Summary:'):]
    i = float(re.search(r'I:\s+(-?[\d.]+) LUFS', s).group(1))
    tp = float(re.search(r'True peak:\s+Peak:\s+(-?[\d.]+) dBFS', s).group(1))
    return i, tp


def limiter(x, ceiling, look=0.003, release=0.15):
    """Stereo-linked look-ahead peak limiter."""
    a = np.max(np.abs(x), axis=0)
    w = int(look * SR)
    m = sliding_window_view(np.concatenate([a, np.zeros(w)]), w + 1).max(axis=1)[:len(a)]
    g = np.minimum(1.0, ceiling / np.maximum(m, 1e-9))
    rel = 1 - np.exp(-1 / (release * SR))
    out = np.empty_like(g)
    cur = 1.0
    for i in range(len(g)):
        gi = g[i]
        cur = gi if gi < cur else cur + (gi - cur) * rel
        out[i] = cur
    # Smooth the attack over the look-ahead window so it never clicks.
    k = np.ones(w) / w
    out = np.minimum(out, np.convolve(out, k, mode='same'))
    return x * out


out = sys.argv[1] if len(sys.argv) > 1 else 'sound.wav'
tmp = out + '.tmp.wav'
TARGET = -16.0
TP_MAX = -1.6
mix /= np.max(np.abs(mix)) + 1e-9
write(tmp, mix * 0.5)
i0, _ = measure(tmp)
gain = 10 ** ((TARGET - i0) / 20) * 0.5
level = mix * gain
for it_ in range(4):
    ceiling = 10 ** ((TP_MAX - 0.6) / 20)
    shaped = limiter(level, ceiling)
    write(tmp, shaped)
    li, ltp = measure(tmp)
    print(f'pass {it_}: {li:.2f} LUFS, true peak {ltp:.2f} dBTP')
    if abs(li - TARGET) < 0.15 and ltp <= -1.5:
        break
    level *= 10 ** ((TARGET - li) / 20)
os.replace(tmp, out)
print('wrote', out, f'{DUR}s')
