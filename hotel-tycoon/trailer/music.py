"""Generate a light, upbeat launch-trailer soundtrack (stereo WAV) with numpy."""
import sys
import wave
import numpy as np

SR = 44100
DUR = float(sys.argv[1]) if len(sys.argv) > 1 else 38.0
OUT = sys.argv[2] if len(sys.argv) > 2 else "music.wav"
BPM = 108
BEAT = 60 / BPM
BAR = BEAT * 4

N = int(SR * DUR)
L = np.zeros(N)
R = np.zeros(N)
rng = np.random.default_rng(7)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def add(sig, start, pan=0.0, gain=1.0):
    i = int(start * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    L[i : i + len(sig)] += sig * np.sqrt(0.5 * (1 - pan))
    R[i : i + len(sig)] += sig * np.sqrt(0.5 * (1 + pan))


def env(n, a, d, s, r, length):
    t = np.arange(n) / SR
    e = np.ones(n) * s
    e[t < a] = t[t < a] / a
    m = (t >= a) & (t < a + d)
    e[m] = 1 - (1 - s) * (t[m] - a) / d
    rel = t > length
    e[rel] = s * np.exp(-(t[rel] - length) / r)
    return e


def pad(freqs, length):
    n = int(SR * (length + 1.5))
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for f in freqs:
        for det in (-0.12, 0.0, 0.11):
            ff = f * 2 ** (det / 12)
            # soft "saw" from a few harmonics
            for h, a in ((1, 1.0), (2, 0.35), (3, 0.15), (4, 0.06)):
                sig += a * np.sin(2 * np.pi * ff * h * t + rng.random() * 6.28)
    sig *= env(n, 0.6, 0.4, 0.8, 0.6, length)
    return sig / (len(freqs) * 3 * 1.6)


def pluck(f, length=0.35):
    n = int(SR * length)
    t = np.arange(n) / SR
    sig = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t) + 0.1 * np.sin(2 * np.pi * 3 * f * t))
    return sig * np.exp(-t * 9) * np.minimum(1, t * 400)


def bass(f, length):
    n = int(SR * length)
    t = np.arange(n) / SR
    sig = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)
    return sig * np.minimum(1, t * 80) * np.exp(-t * 1.6)


def kick():
    n = int(SR * 0.35)
    t = np.arange(n) / SR
    f = 50 + 90 * np.exp(-t * 30)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 9)


def hat():
    n = int(SR * 0.06)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    noise = np.diff(np.concatenate([[0], noise]))  # crude high-pass
    return noise * np.exp(-t * 70) * 0.5


def clap():
    n = int(SR * 0.2)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    return noise * np.exp(-t * 22) * 0.35


# C – Am – F – G   (with sevenths for a softer, modern feel)
CHORDS = [
    [60, 64, 67, 71],
    [57, 60, 64, 67],
    [53, 57, 60, 64],
    [55, 59, 62, 65],
]
ROOTS = [36, 33, 29, 31]
ARP = [0, 1, 2, 3, 2, 1, 2, 3]

nbars = int(np.ceil(DUR / BAR))
for b in range(nbars):
    t0 = b * BAR
    ch = CHORDS[b % 4]
    add(pad([midi(n) for n in ch], BAR), t0, gain=0.55)
    intro = t0 < 4.4
    outro = t0 > DUR - BAR * 1.5
    if not intro:
        add(bass(midi(ROOTS[b % 4]), BAR * 0.95), t0, gain=0.55)
        add(bass(midi(ROOTS[b % 4]), BEAT * 0.9), t0 + BEAT * 2.5, gain=0.3)
    for i in range(8):
        tt = t0 + i * BEAT / 2
        note = ch[ARP[i]] + 12
        g = 0.18 if intro else 0.26
        add(pluck(midi(note)), tt, pan=-0.35 if i % 2 else 0.35, gain=g)
    if not intro and not outro:
        for i in range(4):
            add(kick(), t0 + i * BEAT, gain=0.7)
            add(hat(), t0 + i * BEAT + BEAT / 2, pan=0.2, gain=0.6)
        add(clap(), t0 + BEAT, gain=0.5)
        add(clap(), t0 + BEAT * 3, gain=0.5)

# a little sparkle on the logo reveal and end card
for when in (0.4, DUR - 6.5):
    for k, n in enumerate([84, 88, 91, 96]):
        add(pluck(midi(n), 0.8), when + k * 0.07, pan=(k - 1.5) * 0.3, gain=0.18)

mix = np.stack([L, R], axis=1)
# fade in/out and soft limiting
fade_in = np.minimum(1, np.arange(N) / (SR * 0.8))
fade_out = np.minimum(1, (N - np.arange(N)) / (SR * 2.5))
mix *= (fade_in * fade_out)[:, None]
mix = np.tanh(mix * 1.1)
mix /= np.max(np.abs(mix)) + 1e-9
mix *= 0.85
data = (mix * 32767).astype(np.int16)
with wave.open(OUT, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(data.tobytes())
print("wrote", OUT, DUR, "s")
