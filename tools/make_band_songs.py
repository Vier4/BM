#!/usr/bin/env python3
"""
Записывает инструментальные версии песен групп BM.

Каждая группа звучит своими инструментами, у каждой песни своя тональность,
темп, аккорды и мелодия. Куплеты, припевы и бриджи берутся из текста песни
в js/bands-data.js, поэтому мелодия идёт ровно по строкам текста.

Готовые mp3 кладутся в music/bands/<группа>/<песня>.mp3.

Нужны Python 3, numpy, scipy и lameenc (pip install numpy scipy lameenc), а ещё node.
Запуск:  python3 tools/make_band_songs.py            — все песни
         python3 tools/make_band_songs.py 03-sputnik — одна песня
"""
import json
import math
import os
import subprocess
import sys

import lameenc
import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---------- Песни ----------
# Аккорды — по одному на такт (или на chord_bars тактов), по кругу.
SONGS = {
    # Полярный трамвай — инди-рок
    '01-poslednij-rejs': dict(style='indie', key=9, mode='minor', bpm=118, seed=11,
                              verse='Am F C G', chorus='F C G Am', bridge='Dm Am F G'),
    '02-severnoe-leto': dict(style='indie', key=2, mode='major', bpm=126, seed=12, claps=True,
                             verse='D A Bm G', chorus='G D A Bm', pre='Em G A A', bridge='Bm G D A'),
    '03-batarejki': dict(style='indie', key=4, mode='minor', bpm=104, seed=13,
                         verse='Em D C D', chorus='G D Em C', bridge='C D Em Em'),
    # Ферма снов — дрим-поп
    '01-neonovye-kity': dict(style='dream', key=5, mode='major', bpm=84, seed=21, whale=True,
                             verse='Fmaj7 Am7 Dm7 Bbmaj7', chorus='Bb F C Dm', bridge='Dm7 Bbmaj7 Fmaj7 C'),
    '02-tishe-vody': dict(style='dream', key=4, mode='major', bpm=76, seed=22, piano=True,
                          verse='E G#m A Am', chorus='C#m A E B', bridge='A B C#m C#m'),
    '03-sputnik': dict(style='dream', key=7, mode='major', bpm=96, seed=23, bleeps=True, busy_bass=True,
                       verse='G D Em C', chorus='Em C G D', bridge='C D Bm Em'),
    # Гранитные чайки — панк-рок
    '01-ne-spat': dict(style='punk', key=4, mode='minor', bpm=172, seed=31, countin=True,
                       verse='Em C G D', chorus='C G D Em', bridge='Am C D D'),
    '02-dvor-kolodec': dict(style='punk', key=7, mode='major', bpm=150, seed=32,
                            verse='G C D C', chorus='Em C G D', bridge='C D Em D'),
    '03-razbityj-skejt': dict(style='punk', key=9, mode='major', bpm=164, seed=33, skate=True, countin=True,
                              verse='A A D E', chorus='F#m D A E', bridge='D E F#m E'),
    # Лиловый октябрь — акустический фолк
    '01-chaj-s-chabrecom': dict(style='folk', key=7, mode='major', bpm=92, seed=41, meter=3, bpl=4, chord_bars=2,
                                verse='G Em C D', chorus='C G D G', lead='violin'),
    '02-pismo-v-derevnyu': dict(style='folk', key=9, mode='minor', bpm=84, seed=42, lead='accordion',
                                verse='Am Dm G C', chorus='F G C E', bridge='Dm Am E Am'),
    '03-osennij-vokzal': dict(style='folk', key=2, mode='minor', bpm=100, seed=43, lead='duet',
                              verse='Dm Bb F C', chorus='Gm Dm A Dm', bridge='Bb C F A'),
}

STYLES = {
    'indie': dict(center=60, chorus_up=5, span=7, legato=0.9, rt=2.0, wet=0.32),
    'dream': dict(center=70, chorus_up=3, span=6, legato=0.98, rt=3.8, wet=0.5),
    'punk': dict(center=59, chorus_up=5, span=5, legato=0.8, rt=0.9, wet=0.14),
    'folk': dict(center=69, chorus_up=4, span=7, legato=0.95, rt=1.6, wet=0.26),
}

# Громкость дорожек в дБ относительно мелодии, панорама, доля в реверберации
MIXES = {
    'indie': dict(lead=(0, 0, .3), lead2=(-8, -.2, .4), kick=(-3, 0, .03), snare=(-5, 0, .25), hat=(-15, .3, .05),
                  cym=(-15, -.25, .15), clap=(-11, 0, .3), bass=(-4, 0, 0), gtr1=(-6, .5, .35), gtr2=(-8, -.55, .35)),
    'dream': dict(lead=(0, 0, .45), lead2=(-10, .1, .6), kick=(-5, 0, .05), snare=(-8, 0, .5), hat=(-18, .25, .2),
                  bass=(-4, 0, .05), pad=(-7, 0, .5), bells=(-12, .35, .6), piano=(-5, -.15, .4),
                  bleeps=(-15, -.4, .4), whale=(-7, -.2, .7)),
    'punk': dict(lead=(0, 0, .15), lead2=(-5, 0, .15), kick=(-2, 0, 0), snare=(-4, 0, .12), hat=(-14, .3, .03),
                 cym=(-13, -.25, .1), bass=(-4, 0, 0), pgL=(-4, -.75, .08), pgR=(-4, .75, .08), sticks=(-8, 0, .1),
                 toms=(-6, .15, .1)),
    'folk': dict(lead=(0, .05, .3), lead2=(-5, -.25, .3), kick=(-9, 0, .1), tamb=(-15, .4, .2), shaker=(-19, -.35, .1),
                 bass=(-5, 0, .05), agtr=(-5, -.35, .25), accord=(-9, .3, .3)),
}

NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
QUAL = {'': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'm7': [0, 3, 7, 10], 'maj7': [0, 4, 7, 11],
        '5': [0, 7], 'sus2': [0, 2, 7], 'sus4': [0, 5, 7]}
SCALES = {'major': [0, 2, 4, 5, 7, 9, 11], 'minor': [0, 2, 3, 5, 7, 8, 10]}


def parse_chord(name):
    r = NOTE[name[0]]
    i = 1
    if len(name) > 1 and name[1] in '#b':
        r += 1 if name[1] == '#' else -1
        i = 2
    return r % 12, QUAL[name[i:]]


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ---------- Звук ----------
_tables = {}


def table(kind, nh):
    key = (kind, nh)
    if key not in _tables:
        x = np.arange(2048) / 2048
        w = np.zeros(2048)
        for k in range(1, nh + 1):
            if kind == 'saw':
                a = 1 / k
            elif kind == 'square':
                a = 1 / k if k % 2 else 0
            elif kind == 'tri':
                a = ((-1) ** ((k - 1) // 2)) / k ** 2 if k % 2 else 0
            elif kind == 'reed':
                a = (1 / k) * (1.0 if k % 2 else 0.5)
            elif kind == 'dull':
                a = 1 / k ** 2.4
            else:
                a = 1.0 if k == 1 else 0
            w += a * np.sin(2 * np.pi * k * x)
        _tables[key] = w / np.max(np.abs(w))
    return _tables[key]


def osc(kind, freq, n, rng):
    fmax = float(np.max(freq)) if not np.isscalar(freq) else float(freq)
    nh = max(1, min(60, int(17000 / fmax)))
    tab = table(kind, nh)
    f = np.full(n, float(freq)) if np.isscalar(freq) else freq[:n]
    idx = ((np.cumsum(f) / SR + rng.random()) % 1.0) * 2048
    i0 = idx.astype(np.int64)
    fr = idx - i0
    return tab[i0 % 2048] * (1 - fr) + tab[(i0 + 1) % 2048] * fr


def tvec(n):
    return np.arange(n) / SR


def release(sig, on, rel):
    """Затухание после отпускания ноты."""
    n = len(sig)
    i = int(on * SR)
    if i < n:
        t = np.arange(n - i) / SR
        sig[i:] *= np.exp(-t / max(rel, 1e-3))
    return sig


def fade_in(sig, sec):
    k = min(len(sig), max(1, int(sec * SR)))
    sig[:k] *= np.linspace(0, 1, k)
    return sig


def pluck(m, ring, rng, bright=0.12, decay=1.0, kind='saw'):
    f = mtof(m)
    n = int((ring + 0.15) * SR)
    t = tvec(n)
    d = decay * min(1.5, (196 / f) ** 0.35)
    sig = 0.7 * osc(kind, f, n, rng) * np.exp(-t / bright) + osc('dull', f, n, rng) * np.exp(-t / d)
    fade_in(sig, 0.002)
    return release(sig, ring, 0.05)


def lead_note(m, dur, rng, kind='saw', attack=0.02, vib=0.006, rel=0.12, scoop=True, sustain=0.85):
    f = mtof(m)
    n = int((dur + rel * 4) * SR)
    t = tvec(n)
    ramp = np.clip((t - 0.18) / 0.3, 0, 1)
    fr = f * (1 + vib * np.sin(2 * np.pi * 5.4 * t + rng.random() * 6) * ramp)
    if scoop:
        fr = fr * 2 ** (-0.35 / 12 * np.exp(-t / 0.05))
    sig = osc(kind, fr, n, rng)
    env = np.minimum(t / attack, 1.0) * (sustain + (1 - sustain) * np.exp(-t / 0.25))
    return release(sig * env, dur, rel)


def pad_note(m, dur, rng, attack=0.5, rel=1.2):
    f = mtof(m)
    n = int((dur + rel * 3) * SR)
    t = tvec(n)
    sig = sum(osc('saw', f * 2 ** (c / 1200), n, rng) for c in (-8, 0, 8)) / 3
    env = np.minimum(t / attack, 1.0)
    return release(sig * env, dur, rel)


def bell(m, rng, dec=1.6):
    f = mtof(m)
    n = int(dec * 4 * SR)
    t = tvec(n)
    sig = np.zeros(n)
    for p, a, d in ((1, 1, 1), (2.0, .35, .55), (2.76, .25, .35), (5.4, .1, .18)):
        sig += a * np.sin(2 * np.pi * f * p * t + rng.random() * 6) * np.exp(-t / (dec * d))
    return fade_in(sig, 0.002)


def piano(m, dur, rng):
    f = mtof(m)
    n = int((dur + 0.6) * SR)
    t = tvec(n)
    sig = np.zeros(n)
    base = 2.2 * (220 / f) ** 0.4
    for k in range(1, 11):
        fk = k * f * math.sqrt(1 + 0.0004 * k * k)
        if fk > 16000:
            break
        sig += (1 / k ** 1.3) * np.sin(2 * np.pi * fk * t + rng.random() * 6) * np.exp(-t / (base / k ** 0.7))
    fade_in(sig, 0.003)
    return release(sig, dur, 0.15)


def accordion(m, dur, rng, attack=0.04, rel=0.08):
    f = mtof(m)
    n = int((dur + rel * 4) * SR)
    t = tvec(n)
    sig = (osc('reed', f * 1.0035, n, rng) + osc('reed', f / 1.0035, n, rng)) / 2
    env = np.minimum(t / attack, 1.0)
    return release(sig * env, dur, rel)


def violin(m, dur, rng):
    return lead_note(m, dur, rng, kind='saw', attack=0.07, vib=0.009, rel=0.18, scoop=True, sustain=0.95)


def whale(m, rng, length=3.2):
    n = int((length + 1) * SR)
    t = tvec(n)
    bend = 3 * np.sin(np.pi * np.clip(t / length, 0, 1)) - 1.5 * np.clip(t / length, 0, 1)
    f = mtof(m) * 2 ** ((bend + 0.4 * np.sin(2 * np.pi * 0.7 * t)) / 12)
    sig = osc('sine', f, n, rng) + 0.25 * osc('sine', f * 2, n, rng)
    env = np.sin(np.pi * np.clip(t / length, 0, 1)) ** 1.5
    return sig * env


def bandnoise(n, lo, hi, rng):
    x = rng.standard_normal(n)
    if lo and hi:
        sos = butter(2, [lo, hi], btype='band', fs=SR, output='sos')
    elif lo:
        sos = butter(2, lo, btype='high', fs=SR, output='sos')
    else:
        sos = butter(2, hi, btype='low', fs=SR, output='sos')
    return sosfilt(sos, x)


def make_drums(rng):
    """Набор барабанов: по несколько вариантов каждого удара."""
    kit = {}

    def variants(fn, k=4):
        return [fn() for _ in range(k)]

    def kick():
        n = int(0.5 * SR)
        t = tvec(n)
        f = 48 + 120 * np.exp(-t / 0.03)
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.2)
        s[:int(0.004 * SR)] += bandnoise(int(0.004 * SR), 1500, 6000, rng) * 0.5
        return s

    def snare():
        n = int(0.4 * SR)
        t = tvec(n)
        return (bandnoise(n, 1200, 8000, rng) * np.exp(-t / 0.12) * 1.4
                + 0.6 * np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05))

    def hat():
        n = int(0.12 * SR)
        return bandnoise(n, 7000, None, rng) * np.exp(-tvec(n) / 0.03)

    def ohat():
        n = int(0.5 * SR)
        return bandnoise(n, 6500, None, rng) * np.exp(-tvec(n) / 0.22)

    def crash():
        n = int(2.5 * SR)
        return bandnoise(n, 3500, None, rng) * np.exp(-tvec(n) / 1.1)

    def clap():
        n = int(0.3 * SR)
        t = tvec(n)
        env = np.zeros(n)
        for off in (0, 0.011, 0.022):
            i = int(off * SR)
            env[i:] += np.exp(-(t[:n - i]) / (0.09 if off else 0.01))
        return bandnoise(n, 900, 3500, rng) * env

    def stick():
        n = int(0.08 * SR)
        t = tvec(n)
        return bandnoise(n, 1800, 5000, rng) * np.exp(-t / 0.012) + 0.4 * np.sin(2 * np.pi * 2300 * t) * np.exp(-t / 0.02)

    def tamb():
        n = int(0.25 * SR)
        t = tvec(n)
        return bandnoise(n, 6000, None, rng) * np.exp(-t / 0.08) * (1 + 0.5 * np.sin(2 * np.pi * 70 * t))

    def shaker():
        n = int(0.1 * SR)
        t = tvec(n)
        return bandnoise(n, 4500, 11000, rng) * np.minimum(t / 0.012, 1) * np.exp(-t / 0.035)

    def tom():
        n = int(0.45 * SR)
        t = tvec(n)
        f = 95 + 60 * np.exp(-t / 0.05)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22) + 0.2 * bandnoise(n, 200, 2000, rng) * np.exp(-t / 0.05)

    for name, fn in dict(kick=kick, snare=snare, hat=hat, ohat=ohat, crash=crash, clap=clap,
                         stick=stick, tamb=tamb, shaker=shaker, tom=tom).items():
        vs = variants(fn)
        kit[name] = [v / np.max(np.abs(v)) for v in vs]
    return kit


# ---------- Сведение ----------
class Mix:
    def __init__(self, seconds, rng):
        self.n = int(seconds * SR)
        self.tracks = {}
        self.rng = rng

    def add(self, name, at, sig, gain=1.0):
        tr = self.tracks.setdefault(name, np.zeros(self.n))
        at += self.rng.normal(0, 0.003)  # живая неровность
        i = int(round(at * SR))
        if i < 0:
            sig = sig[-i:]
            i = 0
        j = min(self.n, i + len(sig))
        if j > i:
            tr[i:j] += gain * sig[:j - i]


def lowpass(x, f, order=2):
    return sosfilt(butter(order, f, btype='low', fs=SR, output='sos'), x)


def highpass(x, f, order=2):
    return sosfilt(butter(order, f, btype='high', fs=SR, output='sos'), x)


def active_rms(x):
    blk = int(0.1 * SR)
    m = len(x) // blk
    if m == 0:
        return 0.0
    r = np.sqrt(np.mean(x[:m * blk].reshape(m, blk) ** 2, axis=1))
    on = r[r > 1e-4]
    return float(np.sqrt(np.mean(on ** 2))) if len(on) else 0.0


def reverb(stereo, rt, rng):
    n = int(rt * 1.2 * SR)
    t = tvec(n)
    out = []
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-6.9 * t / rt)
        ir = lowpass(ir, 5000)
        ir[:int(0.02 * SR)] = 0  # предзадержка
        ir /= np.sqrt(np.sum(ir ** 2))
        x = stereo[ch]
        size = 1 << int(math.ceil(math.log2(len(x) + n)))
        y = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:len(x)]
        out.append(y)
    return np.array(out)


def master(mix, style, rng):
    conf = MIXES[style]
    st = STYLES[style]
    dry = np.zeros((2, mix.n))
    send = np.zeros((2, mix.n))
    for name, x in mix.tracks.items():
        x = effects(name, x, style)
        db, pan, snd = conf.get(name, (-10, 0, .2))
        r = active_rms(x)
        if r == 0:
            continue
        x = x * (10 ** (db / 20)) * 0.1 / r
        a = (pan + 1) * math.pi / 4
        st_x = np.array([x * math.cos(a), x * math.sin(a)])
        dry += st_x
        send += st_x * snd
    out = dry + reverb(send, st['rt'], rng) * (st['wet'] / 0.3)
    out = np.array([highpass(ch, 30) for ch in out])
    rms = np.sqrt(np.mean(out ** 2))
    out *= 0.16 / rms
    out = np.tanh(out / 0.9) * 0.9
    return out


def effects(name, x, style):
    if name == 'bass':
        return lowpass(x, 700 if style != 'punk' else 1100)
    if name in ('pgL', 'pgR'):
        x = highpass(x, 110)
        x = np.tanh(x * 9)
        return lowpass(x, 3600, 4)
    if name in ('lead', 'lead2'):
        if style == 'punk':
            return lowpass(np.tanh(highpass(x, 150) * 6), 3800, 4)
        if style == 'indie':
            return lowpass(np.tanh(x * 1.8), 3200)
        if style == 'dream':
            x = lowpass(x, 2600)
            out = x.copy()
            d = int(0.36 * SR)  # эхо
            for k, g in ((1, .35), (2, .18), (3, .09)):
                out[d * k:] += g * x[:-d * k]
            return out
        return highpass(lowpass(x, 5200), 220)
    if name == 'pad':
        return lowpass(x, 1800)
    if name in ('gtr1', 'gtr2', 'agtr'):
        return highpass(x, 120)
    if name == 'accord':
        return lowpass(x, 3200)
    if name == 'bleeps':
        return lowpass(x, 5000)
    return x


# ---------- Музыка ----------
def voicing(chord, lo, n):
    pc, ints = chord
    base = lo + ((pc - lo) % 12)
    notes = []
    k = 0
    while len(notes) < n:
        for i in ints:
            notes.append(base + i + 12 * k)
        k += 1
    return sorted(notes)[:n]


def bass_note(chord, lo=33):
    return lo + ((chord[0] - lo) % 12)


def rhythm(rng, S, style):
    end = int(S * 0.78)
    s = 0 if rng.random() < 0.65 else 1
    on = []
    while s < end:
        on.append(s)
        if style == 'dream':
            s += int(rng.choice([2, 3, 4], p=[.45, .3, .25]))
        elif style == 'punk':
            s += int(rng.choice([1, 2], p=[.65, .35]))
        else:
            s += int(rng.choice([1, 2, 3], p=[.4, .45, .15]))
    return on


def melody_line(seed, S, spb, chords_for_slot, scale, center, span, style, variant):
    rng = np.random.default_rng(seed)
    r = rhythm(rng, S, style)
    if variant == 1:  # тот же ритм, другое окончание
        rng2 = np.random.default_rng(seed + 97)
        half = [s for s in r if s < S // 2]
        tail = [s for s in rhythm(rng2, S, style) if s >= S // 2]
        r = half + tail
    elif variant == 2:
        r = rhythm(np.random.default_rng(seed + 31), S, style)
    rng = np.random.default_rng(seed * 7 + variant)
    p = center
    notes = []
    for j, s in enumerate(r):
        pos = j / max(1, len(r) - 1)
        target = center + span * math.sin(math.pi * pos) - (2 if pos > 0.8 else 0)
        pc, ints = chords_for_slot(s)
        tones = {(pc + i) % 12 for i in ints}
        strong = s % 2 == 0 or j == len(r) - 1
        cand = [m for m in range(center - 10, center + span + 10)
                if (m % 12 in tones if strong else m % 12 in scale) and abs(m - p) <= (7 if strong else 4)]
        if not cand:
            cand = [p]
        aim = 0.6 * p + 0.4 * target
        score = [abs(m - aim) + rng.random() * 2.2 + (1.2 if (m == p and style != 'punk') else 0) for m in cand]
        p = cand[int(np.argmin(score))]
        nxt = r[j + 1] if j + 1 < len(r) else max(s + 2, int(S * 0.93))
        notes.append((s, nxt - s, p))
    return notes


def build_plan(spec, secs):
    beats = spec.get('meter', 4)
    bpl = spec.get('bpl', 2)
    plan = []
    if spec.get('countin'):
        plan.append(dict(role='count', bars=1))
    has_intro = any(n.lower().startswith('intro') for n, _ in secs)
    if not has_intro:
        plan.append(dict(role='intro', bars=4 if beats == 4 else 8))
    choruses = 0
    for name, lines in secs:
        low = name.lower()
        role = ('intro' if low.startswith('intro') else 'pre' if low.startswith('pre') else
                'chorus' if low.startswith('chorus') else 'bridge' if low.startswith('bridge') else
                'outro' if low.startswith('outro') else 'verse')
        bars = lines * bpl
        if role == 'intro':
            bars = max(4, bars)
        plan.append(dict(role=role, bars=bars, lines=lines, sung=role != 'intro', verse_no=low))
        if role == 'chorus':
            choruses += 1
            if choruses == 2:
                plan.append(dict(role='solo', bars=4 * bpl))
    if plan[-1]['role'] != 'outro':
        plan.append(dict(role='outro', bars=4 if beats == 4 else 8))
    plan.append(dict(role='end', bars=1))
    return plan


def prog(spec, role):
    key = {'verse': 'verse', 'intro': 'verse', 'pre': 'pre', 'chorus': 'chorus', 'solo': 'chorus',
           'outro': 'chorus', 'bridge': 'bridge', 'count': 'verse', 'end': 'chorus'}[role]
    names = spec.get(key)
    if not names:
        v = spec['verse'].split()
        names = ' '.join(v[2:] + v[2:]) if key == 'pre' else ' '.join(reversed(v))
    return [parse_chord(c) for c in names.split()]


INTENSITY = dict(count=.6, intro=.75, verse=.72, pre=.85, chorus=1.0, bridge=.7, solo=.95, outro=.9, end=1.0)


def render_song(song_id, spec, secs):
    rng = np.random.default_rng(spec['seed'])
    style = spec['style']
    st = STYLES[style]
    beats = spec.get('meter', 4)
    spb = beats * 2
    bar = beats * 60 / spec['bpm']
    slot = bar / spb
    bpl = spec.get('bpl', 2)
    cb = spec.get('chord_bars', 1)
    scale = {(spec['key'] + i) % 12 for i in SCALES[spec['mode']]}
    plan = build_plan(spec, secs)
    total_bars = sum(p['bars'] for p in plan)
    mix = Mix(total_bars * bar + 6, rng)
    kit = make_drums(rng)

    def hit(track, name, at, vel):
        v = kit[name][int(rng.integers(len(kit[name])))]
        mix.add(track, at, v, vel * rng.uniform(0.9, 1.0))

    t = 0.0
    first_verse_done = False
    for sec_i, sec in enumerate(plan):
        role = sec['role']
        chords = prog(spec, role)
        inten = INTENSITY[role]
        nbars = sec['bars']
        first_verse = role == 'verse' and not first_verse_done
        if role == 'verse':
            first_verse_done = True
        for b in range(nbars):
            t0 = t + b * bar
            ch = chords[(b // cb) % len(chords)]
            last_bar = b == nbars - 1
            ctx = dict(t0=t0, b=b, nbars=nbars, role=role, ch=ch, inten=inten, last=last_bar,
                       first_verse=first_verse, beats=beats, spb=spb, slot=slot, bar=bar, cb=cb)
            if role == 'end':
                final_hit(mix, hit, spec, ctx, rng)
            else:
                globals()['bar_' + style](mix, hit, spec, ctx, rng)
        # мелодия
        if sec.get('sung') or role in ('solo',) or (role == 'intro' and style == 'folk'):
            render_melody(mix, spec, st, sec, chords, t, bar, slot, spb, bpl, cb, scale, rng)
        t += nbars * bar
    out = master(mix, style, rng)
    end = int((t + 4.0) * SR)
    out = out[:, :end]
    k = int(3.5 * SR)
    out[:, -k:] *= np.linspace(1, 0, k) ** 2
    return out, t


def render_melody(mix, spec, st, sec, chords, t, bar, slot, spb, bpl, cb, scale, rng):
    style = spec['style']
    role = sec['role']
    S = bpl * spb
    lines = sec.get('lines') or sec['bars'] // bpl
    center = st['center'] + (st['chorus_up'] if role in ('chorus', 'solo', 'outro') else 0)
    if role == 'bridge':
        center += 2
    if role == 'solo':
        center += 5 if style != 'dream' else 0
    melody_role = 'chorus' if role in ('intro', 'outro', 'solo') else role
    for li in range(lines):
        lt = t + li * bpl * bar
        if lt >= t + sec['bars'] * bar - 1e-6:
            break
        variant = [0, 1, 0, 2][li % 4]

        def chords_for_slot(s, li=li):
            bar_i = li * bpl + s // spb
            return chords[(bar_i // cb) % len(chords)]

        seed = spec['seed'] * 1000 + hash_role(melody_role) * 10 + (li % 4 if variant != 1 else 1)
        if role == 'solo':
            seed += 555
        notes = melody_line(seed, S, spb, chords_for_slot, scale, center, st['span'], style, variant)
        for (s, d, m) in notes:
            at = lt + s * slot
            dur = d * slot * st['legato']
            strong = s % spb == 0
            vel = (0.95 if strong else 0.8) * INTENSITY[role]
            play_lead(mix, spec, role, m, at, dur, vel, scale, rng, li)


def hash_role(r):
    return {'verse': 1, 'chorus': 2, 'bridge': 3, 'pre': 4, 'outro': 5}.get(r, 6)


def third_above(m, scale):
    up = [x for x in range(m + 1, m + 6) if x % 12 in scale]
    return up[1] if len(up) > 1 else m + 4


def play_lead(mix, spec, role, m, at, dur, vel, scale, rng, li=0):
    style = spec['style']
    big = role in ('chorus', 'outro')
    if style == 'indie':
        mix.add('lead', at, lead_note(m, dur, rng, kind='saw', attack=0.012, vib=0.005), vel)
        if big:
            mix.add('lead2', at, lead_note(m + 12, dur, rng, kind='tri', attack=0.02, vib=0.004), vel * 0.8)
    elif style == 'dream':
        mix.add('lead', at, lead_note(m, dur, rng, kind='tri', attack=0.08, vib=0.007, rel=0.3), vel)
        if big:
            mix.add('lead2', at, lead_note(m + 12, dur, rng, kind='sine', attack=0.1, vib=0.006, rel=0.4), vel)
    elif style == 'punk':
        mix.add('lead', at, lead_note(m, dur, rng, kind='saw', attack=0.005, vib=0.004, sustain=0.95), vel)
        if big:  # хор во дворе: октава ниже и терция сверху
            mix.add('lead2', at, lead_note(m - 12, dur, rng, kind='saw', attack=0.01, vib=0.003), vel)
            mix.add('lead2', at, lead_note(third_above(m, scale), dur, rng, kind='saw', attack=0.01, vib=0.003), vel * 0.6)
    else:
        who = spec.get('lead', 'violin')
        if who == 'duet':
            who = 'accordion' if role == 'verse' and (li // 2) % 2 else 'violin'  # поют по очереди
        voice = accordion if who == 'accordion' else violin
        mix.add('lead', at, voice(m, dur, rng), vel)
        if big:
            other = violin if voice is accordion else accordion
            mix.add('lead2', at, other(third_above(m, scale) - 12 if other is accordion else third_above(m, scale), dur, rng), vel * 0.8)


# ---------- Партии по стилям ----------
def fill(hit, c, track='snare'):
    sl = c['slot']
    for k, s in enumerate([c['spb'] - 2, c['spb'] - 1.5, c['spb'] - 1, c['spb'] - 0.5]):
        hit(track, 'snare', c['t0'] + s * sl, 0.45 + 0.15 * k)


def bar_indie(mix, hit, spec, c, rng):
    t0, sl, role, ch, I = c['t0'], c['slot'], c['role'], c['ch'], c['inten']
    drums = not (role == 'intro' and c['b'] < 2)
    if drums:
        if role == 'bridge':
            hit('kick', 'kick', t0, I)
            hit('kick', 'kick', t0 + 4 * sl, I * 0.8)
            hit('snare', 'snare', t0 + 4 * sl, I * 0.9)
            for s in (0, 2, 4, 6):
                hit('hat', 'hat', t0 + s * sl, 0.5)
        else:
            ks = [0, 3, 4, 6] if role in ('chorus', 'solo', 'outro') else [0, 3, 4]
            for s in ks:
                hit('kick', 'kick', t0 + s * sl, I)
            for s in (2, 6):
                hit('snare', 'snare', t0 + s * sl, I)
            for s in range(8):
                if role in ('chorus', 'solo') and s == 7:
                    hit('hat', 'ohat', t0 + s * sl, 0.6)
                else:
                    hit('hat', 'hat', t0 + s * sl, 0.75 if s % 2 == 0 else 0.45)
            if spec.get('claps') and role in ('chorus', 'solo', 'outro'):
                for s in (2, 6):
                    hit('clap', 'clap', t0 + s * sl, 0.9)
        if c['b'] % 4 == 0 and role in ('chorus', 'solo', 'outro', 'pre'):
            hit('cym', 'crash', t0, 0.9)
        if c['last'] and role != 'outro':
            fill(hit, c)
    # бас
    bn = bass_note(ch)
    if role == 'bridge' or (role == 'intro' and c['b'] < 2):
        if role == 'bridge':
            for s in (0, 4):
                mix.add('bass', t0 + s * sl, pluck(bn, 4 * sl, rng, bright=.05, decay=.8), I)
    else:
        for s in range(8):
            m = bn + (12 if (s == 7 and role in ('chorus', 'solo')) else 0)
            mix.add('bass', t0 + s * sl, pluck(m, sl * 0.9, rng, bright=.04, decay=.5), I * (1 if s % 2 == 0 else .8))
    # звенящая гитара
    v = voicing(ch, 52, 4)
    if role == 'bridge':
        for k, m in enumerate(v):
            mix.add('gtr1', t0 + k * 0.012, pluck(m, c['bar'], rng, bright=.3, decay=1.4), 0.6)
    else:
        for s, k in enumerate([0, 1, 2, 3, 2, 1, 2, 3]):
            mix.add('gtr1', t0 + s * sl, pluck(v[k] + (12 if role == 'solo' else 0), sl * 2, rng, bright=.25, decay=.9), 0.55 if s % 2 else 0.7)
    if role in ('chorus', 'solo', 'outro', 'pre'):
        sv = voicing(ch, 45, 6)
        for s, vel in ((0, .8), (3, .55), (4, .7), (6, .6)):
            for k, m in enumerate(sv):
                mix.add('gtr2', t0 + s * sl + k * 0.01, pluck(m, sl * 2.5, rng, bright=.15, decay=.9), vel * 0.5)


def bar_dream(mix, hit, spec, c, rng):
    t0, sl, role, ch, I, bar = c['t0'], c['slot'], c['role'], c['ch'], c['inten'], c['bar']
    # пэд
    for m in voicing(ch, 55, 4):
        mix.add('pad', t0, pad_note(m, bar, rng), 0.5 * I)
    # колокольчики или пианино
    if spec.get('piano'):
        mix.add('piano', t0, piano(bass_note(ch, 40), bar, rng), 0.8 * I)
        v = voicing(ch, 60, 4)
        order = [0, 1, 2, 3, 2, 1, 2, 3] if role in ('chorus', 'solo', 'outro') else [None, None, 1, None, 2, None, 3, None]
        for s, k in enumerate(order):
            if k is not None:
                mix.add('piano', t0 + s * sl, piano(v[k], sl * 2, rng), 0.55 * I)
    elif role != 'bridge':
        v = voicing(ch, 72, 6)
        step = 1 if role in ('chorus', 'solo', 'outro') else 2
        for s in range(0, 8, step):
            mix.add('bells', t0 + s * sl, bell(v[(s // step) % len(v)], rng), 0.5)
    if spec.get('bleeps') and role in ('chorus', 'solo', 'intro', 'outro'):
        v = voicing(ch, 84, 5)
        for s in range(16):
            if rng.random() < 0.45:
                mix.add('bleeps', t0 + s * sl / 2, lead_note(v[int(rng.integers(5))], sl * 0.35, rng, kind='square', attack=.003, vib=0, rel=.03, scoop=False), 0.6)
    if spec.get('whale') and c['b'] == 0 and role in ('intro', 'bridge', 'outro', 'solo'):
        mix.add('whale', t0, whale(spec['key'] + 60, rng), 0.8)
    # барабаны
    quiet = role == 'intro' or (c['first_verse'] and c['b'] < c['nbars'] // 2)
    if not quiet:
        if role == 'bridge':
            hit('kick', 'kick', t0, 0.7)
        else:
            ks = [0, 3, 5] if role in ('chorus', 'solo', 'outro') else [0, 5]
            for s in ks:
                hit('kick', 'kick', t0 + s * sl, 0.85 * I)
            hit('snare', 'snare', t0 + 4 * sl, 0.8 * I)
            for s in range(0, 8, 2):
                hit('hat', 'hat', t0 + s * sl, 0.5)
            if spec.get('busy_bass'):
                for s in range(1, 8, 2):
                    hit('hat', 'hat', t0 + s * sl, 0.3)
    # бас
    bn = bass_note(ch, 33)
    if spec.get('busy_bass') and role not in ('intro', 'bridge'):
        for s in (0, 3, 4, 6):
            mix.add('bass', t0 + s * sl, lead_note(bn, sl * 1.2, rng, kind='saw', attack=.005, vib=0, rel=.05, scoop=False), I)
    elif not (role == 'intro' and c['b'] < 2):
        for s in (0, 4):
            mix.add('bass', t0 + s * sl, lead_note(bn, sl * 3.6, rng, kind='tri', attack=.01, vib=0, rel=.2, scoop=False), I)


def bar_punk(mix, hit, spec, c, rng):
    t0, sl, role, ch, I = c['t0'], c['slot'], c['role'], c['ch'], c['inten']
    if role == 'count':
        for s in (0, 2, 4, 6):
            hit('sticks', 'stick', t0 + s * sl, 1.0)
        return
    pv = [bass_note(ch, 40), bass_note(ch, 40) + 7, bass_note(ch, 40) + 12]
    palm = role == 'verse'
    if role == 'bridge':
        for s in (0, 2, 4, 6):
            for k, m in enumerate(pv):
                for tr in ('pgL', 'pgR'):
                    mix.add(tr, t0 + s * sl + k * 0.004, pluck(m, sl * 1.6, rng, bright=.5, decay=2), 0.9)
            hit('toms', 'tom', t0 + s * sl, 0.9)
        hit('kick', 'kick', t0, 1.0)
    else:
        for s in range(8):
            ring = sl * (0.45 if palm else 1.0)
            for m in pv:
                for tr in ('pgL', 'pgR'):
                    mix.add(tr, t0 + s * sl, pluck(m, ring, rng, bright=.5 if not palm else .08, decay=2), 0.8 if palm else 1.0)
        if spec.get('skate') and role == 'verse':
            for s in (0, 2, 4, 6):
                hit('kick', 'kick', t0 + s * sl, 1.0)
            for s in (1, 3, 5, 7):
                hit('snare', 'snare', t0 + s * sl, 0.85)
        else:
            ks = [0, 3, 4] if role in ('chorus', 'solo', 'outro', 'intro') else [0, 4]
            for s in ks:
                hit('kick', 'kick', t0 + s * sl, 1.0)
            for s in (2, 6):
                hit('snare', 'snare', t0 + s * sl, 1.0)
        for s in range(8):
            if role in ('chorus', 'solo', 'outro'):
                hit('hat', 'ohat', t0 + s * sl, 0.55)
            else:
                hit('hat', 'hat', t0 + s * sl, 0.8 if s % 2 == 0 else 0.55)
        if role in ('chorus', 'solo', 'outro', 'intro') and c['b'] % 2 == 0:
            hit('cym', 'crash', t0, 1.0)
    for s in range(8):
        mix.add('bass', t0 + s * sl, pluck(bass_note(ch, 28), sl * 0.9, rng, bright=.05, decay=.4), 1.0)
    if c['last'] and role not in ('outro',):
        fill(hit, c)


def strum(mix, track, ch, at, vel, ring, rng, down=True, lo=40, n=6, spread=0.011):
    v = voicing(ch, lo, n)
    if not down:
        v = list(reversed(v))[:4]
    for k, m in enumerate(v):
        mix.add(track, at + k * spread, pluck(m, ring, rng, bright=.08, decay=1.1), vel * (1 if down else .7))


def bar_folk(mix, hit, spec, c, rng):
    t0, sl, role, ch, I, bar = c['t0'], c['slot'], c['role'], c['ch'], c['inten'], c['bar']
    bn = bass_note(ch, 36)
    if c['beats'] == 3:  # вальс: раз — бас, два-три — гитара и аккордеон
        mix.add('bass', t0, pluck(bn, sl * 2, rng, bright=.04, decay=.5), I)
        if c['b'] % c['cb'] == 1:
            mix.add('bass', t0, pluck(bn + 7 - 12 * (bn + 7 > 47), sl * 2, rng, bright=.04, decay=.5), I * 0.3)
        for s in (2, 4):
            strum(mix, 'agtr', ch, t0 + s * sl, 0.55 * I, sl * 1.5, rng, lo=52, n=4)
            for m in voicing(ch, 60, 3):
                mix.add('accord', t0 + s * sl, accordion(m, sl * 0.8, rng), 0.4 * I)
        for s in range(6):
            hit('shaker', 'shaker', t0 + s * sl, 0.5 if s % 2 else 0.8)
        if role in ('chorus', 'solo', 'outro'):
            hit('kick', 'kick', t0, 0.7)
            for s in (2, 4):
                hit('tamb', 'tamb', t0 + s * sl, 0.6)
        return
    # 4/4
    mix.add('bass', t0, pluck(bn, sl * 3, rng, bright=.04, decay=.6), I)
    mix.add('bass', t0 + 4 * sl, pluck(bn + 7 - 12 * (bn + 7 > 47), sl * 3, rng, bright=.04, decay=.6), I * 0.85)
    if role == 'bridge':
        strum(mix, 'agtr', ch, t0, 0.7, bar, rng)
        strum(mix, 'agtr', ch, t0 + 4 * sl, 0.5, bar / 2, rng)
    else:
        for s, down in ((0, 1), (2, 1), (3, 0), (5, 0), (6, 1), (7, 0)):
            strum(mix, 'agtr', ch, t0 + s * sl, (0.65 if s in (0, 6) else 0.5) * I, sl * 2, rng, down=bool(down))
    acc_vel = {'verse': 0.25, 'intro': 0.3, 'bridge': 0.35}.get(role, 0.45)
    for m in voicing(ch, 57, 3):
        mix.add('accord', t0, accordion(m, bar * 0.95, rng, attack=.12, rel=.2), acc_vel)
    for s in range(8):
        hit('shaker', 'shaker', t0 + s * sl, 0.8 if s % 2 == 0 else 0.5)
    if role in ('chorus', 'solo', 'outro'):
        for s in (2, 6):
            hit('tamb', 'tamb', t0 + s * sl, 0.7)
        for s in (0, 4):
            hit('kick', 'kick', t0 + s * sl, 0.7)


def final_hit(mix, hit, spec, c, rng):
    t0, ch, style = c['t0'], parse_chord(chord_name_tonic(spec)), spec['style']
    ring = 4.0
    hit('kick', 'kick', t0, 1.0)
    if 'cym' in MIXES[style]:
        hit('cym', 'crash', t0, 1.0)
    if style == 'indie':
        strum(mix, 'gtr2', ch, t0, 0.6, ring, rng, lo=45)
        mix.add('bass', t0, pluck(bass_note(ch), ring, rng, bright=.05, decay=1.5), 1.0)
    elif style == 'dream':
        for m in voicing(ch, 55, 4):
            mix.add('pad', t0, pad_note(m, ring, rng, attack=.05), 0.6)
        mix.add('bass', t0, lead_note(bass_note(ch, 33), ring, rng, kind='tri', vib=0, scoop=False, rel=.8), 1.0)
        if spec.get('piano'):
            for m in voicing(ch, 52, 5):
                mix.add('piano', t0, piano(m, ring, rng), 0.6)
        else:
            mix.add('bells', t0, bell(spec['key'] + 72, rng, dec=2.5), 0.7)
    elif style == 'punk':
        for m in (bass_note(ch, 40), bass_note(ch, 40) + 7, bass_note(ch, 40) + 12):
            for tr in ('pgL', 'pgR'):
                mix.add(tr, t0, pluck(m, ring, rng, bright=.6, decay=3), 1.0)
        mix.add('bass', t0, pluck(bass_note(ch, 28), ring, rng, bright=.05, decay=1.5), 1.0)
    else:
        strum(mix, 'agtr', ch, t0, 0.8, ring, rng)
        for m in voicing(ch, 57, 3):
            mix.add('accord', t0, accordion(m, ring * 0.6, rng, attack=.05, rel=.8), 0.5)
        mix.add('bass', t0, pluck(bass_note(ch, 36), ring, rng, bright=.05, decay=1.2), 1.0)


def chord_name_tonic(spec):
    names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    return names[spec['key']] + ('m' if spec['mode'] == 'minor' else '')


# ---------- Файлы ----------
def id3(title, artist, genre):
    def frame(fid, text):
        data = b'\x01' + text.encode('utf-16')
        return fid.encode() + len(data).to_bytes(4, 'big') + b'\x00\x00' + data
    body = (frame('TIT2', title) + frame('TPE1', artist) + frame('TALB', artist) + frame('TCON', genre)
            + frame('TYER', '2026') + frame('TCOP', '2026 BM'))
    size = len(body)
    ss = bytes([(size >> 21) & 127, (size >> 14) & 127, (size >> 7) & 127, size & 127])
    return b'ID3\x03\x00\x00' + ss + body


def write_mp3(path, stereo, title, artist, genre):
    pcm = np.clip(stereo.T, -1, 1)
    pcm = (pcm * 32767).astype('<i2').tobytes()
    enc = lameenc.Encoder()
    enc.set_bit_rate(160)
    enc.set_in_sample_rate(SR)
    enc.set_channels(2)
    enc.set_quality(2)
    data = enc.encode(pcm) + enc.flush()
    with open(path, 'wb') as f:
        f.write(id3(title, artist, genre) + data)


def load_bands():
    js = r'''
    global.window = {}; require(process.argv[1]);
    console.log(JSON.stringify(window.BM_BANDS.map(b => ({id: b.id, name: b.name, genre: b.genre,
      songs: b.songs.map(s => ({id: s.id, title: s.title, lyrics: s.lyrics}))}))));
    '''
    out = subprocess.check_output(['node', '-e', js, os.path.join(ROOT, 'js', 'bands-data.js')])
    return json.loads(out)


def sections(lyrics):
    secs, known = [], {}
    cur = None
    for raw in lyrics.split('\n'):
        line = raw.strip()
        if line.startswith('[') and line.endswith(']'):
            cur = [line[1:-1], 0]
            secs.append(cur)
        elif line and cur is not None:
            cur[1] += 1
    for s in secs:
        if s[1]:
            known[s[0]] = s[1]
        else:
            s[1] = known.get(s[0]) or known.get('Chorus') or 4
    return [tuple(s) for s in secs]


def main():
    only = set(sys.argv[1:])
    for band in load_bands():
        for song in band['songs']:
            if only and song['id'] not in only:
                continue
            spec = SONGS[song['id']]
            audio, length = render_song(song['id'], spec, sections(song['lyrics']))
            path = os.path.join(ROOT, 'music', 'bands', band['id'], song['id'] + '.mp3')
            write_mp3(path, audio, song['title'], band['name'], band['genre'])
            print(f"{band['name']} — {song['title']}: {int(length // 60)}:{int(length % 60):02d}, "
                  f"{os.path.getsize(path) / 1e6:.1f} МБ")


if __name__ == '__main__':
    main()
