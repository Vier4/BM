"""
Голос для песен BM: русский голос macOS («Милена») поёт строку по нотам.

Как это работает:
1. Голос macOS читает строку по словам (команда say) — так границы слов точные.
2. Вокодер WORLD раскладывает речь на высоту тона, тембр и шум.
3. В каждом слове находятся гласные — по одной на слог.
4. Каждый слог растягивается до длины своей ноты (тянется гласная,
   согласные остаются как есть), а высота тона заменяется нотой мелодии
   с небольшим вибрато.
5. WORLD собирает из этого пение.

Нужны macOS (say и голос Milena), numpy, scipy и pyworld.
"""
import os
import re
import subprocess
import tempfile
import wave

import numpy as np
import pyworld
from scipy.ndimage import uniform_filter1d
from scipy.signal import resample_poly

FS = 22050          # частота, на которой работает WORLD
OUT = 44100         # частота песни
FP = 5.0            # шаг анализа, мс
VOWELS = set('аеёиоуыэюяАЕЁИОУЫЭЮЯ')
VOICE = 'Milena'


def syllables(text):
    """Количество слогов = количество гласных."""
    return sum(1 for ch in text if ch in VOWELS)


_cache = {}


def speak(text, rate=165):
    key = (text, rate)
    if key in _cache:
        return _cache[key]
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, 'line.wav')
        subprocess.check_call(['say', '-v', VOICE, '-r', str(rate), '--file-format=WAVE',
                               f'--data-format=LEI16@{FS}', '-o', path, text])
        with wave.open(path) as w:
            x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float64) / 32768
    _cache[key] = x
    return x


def analyze(x):
    f0, t = pyworld.harvest(x, FS, frame_period=FP, f0_floor=70, f0_ceil=600)
    sp = pyworld.cheaptrick(x, f0, t, FS)
    ap = pyworld.d4c(x, f0, t, FS)
    # громкость кадра в полосе гласных (300–3000 Гц)
    bins = np.fft.rfftfreq((sp.shape[1] - 1) * 2, 1 / FS)
    band = (bins > 300) & (bins < 3000)
    energy = np.log10(np.sum(sp[:, band], axis=1) + 1e-12)
    return f0, sp, ap, energy


def words(text):
    """Слова строки; слова без гласных («в», «к», «с») читаются вместе со следующим."""
    toks = re.findall(r"[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)*", text)
    out, carry = [], ''
    for t in toks:
        if syllables(t) == 0:
            carry += t + ' '
            continue
        out.append(carry + t)
        carry = ''
    if carry and out:
        out[-1] += ' ' + carry.strip()
    return out


def speak_words(text, rate):
    """Читает строку по словам. Возвращает звук и границы слов в кадрах анализа."""
    gap = np.zeros(int(0.03 * FS))
    parts, spans, pos = [], [], 0
    for w in words(text):
        x = speak(w.lower(), rate)  # «Я» с заглавной голос читает как название буквы
        nz = np.flatnonzero(np.abs(x) > 0.004)  # обрезаем тишину по краям
        if len(nz):
            x = x[max(0, nz[0] - 40):nz[-1] + 40]
        parts += [x, gap]
        spans.append((pos, pos + len(x), syllables(w)))
        pos += len(x) + len(gap)
    x = np.concatenate(parts) if parts else np.zeros(FS // 10)
    hop = FS * FP / 1000
    return x, [(int(a / hop), int(b / hop) + 1, k) for a, b, k in spans]


def word_nuclei(f0, energy, a, b, k):
    """k гласных внутри слова: самые громкие звонкие места не ближе 70 мс друг к другу."""
    e = uniform_filter1d(energy, 5)[a:b]
    v = f0[a:b] > 0
    score = np.where(v, e - e.min() + 1e-3, 0)
    peaks = [i for i in range(len(score)) if score[i] > 0
             and (i == 0 or score[i] >= score[i - 1]) and (i == len(score) - 1 or score[i] >= score[i + 1])]
    peaks.sort(key=lambda i: -score[i])
    chosen, gap = [], int(70 / FP)
    for p in peaks:
        if all(abs(p - c) >= gap for c in chosen):
            chosen.append(p)
        if len(chosen) == k:
            break
    if len(chosen) < k:  # запасной путь: делим звонкую часть слова поровну
        idx = np.flatnonzero(v)
        lo, hi = (idx[0], idx[-1]) if len(idx) else (0, b - a - 1)
        chosen = list(np.linspace(lo, hi, k + 2)[1:-1].astype(int))
    return [a + c for c in sorted(chosen)]


def segments(energy, f0, spans):
    """Слоги: (начало, гласная, конец гласной, конец). Внутри слова граница — самое тихое место."""
    e = uniform_filter1d(energy, 3)
    segs = []
    for wa, wb, k in spans:
        nuc = word_nuclei(f0, energy, wa, wb, k)
        bounds = [wa]
        for a, b in zip(nuc[:-1], nuc[1:]):
            bounds.append(a + int(np.argmin(e[a:b])) if b > a else a)
        bounds.append(wb)
        for i, c in enumerate(nuc):
            segs.append((bounds[i], c, bounds[i + 1]))
    out = []
    for a, c, b in segs:
        c = min(max(c, a), max(a, b - 1))
        # конец гласной: последний громкий звонкий кадр
        v = c
        thr = e[c] - 0.6
        while v + 1 < b and f0[v + 1] > 0 and e[v + 1] > thr:
            v += 1
        out.append((a, c, v + 1, b))
    return out


def sing_line(text, notes, rate=165, vib_cents=28):
    """
    notes — [(начало, длительность, midi), ...] в секундах от начала строки,
    по одной ноте на слог. Возвращает звук (OUT Гц), начало — в момент первой ноты.
    """
    x, spans = speak_words(text, rate)
    f0, sp, ap, energy = analyze(x)
    segs = segments(energy, f0, spans)
    if len(segs) != len(notes):
        raise ValueError(f'слогов {len(segs)}, нот {len(notes)}: {text}')
    total = notes[-1][0] + notes[-1][1] + 0.25
    nf = int(total * 1000 / FP) + 1
    src = np.full(nf, -1.0)       # какой кадр речи звучит в каждом кадре пения
    pitch = np.zeros(nf)
    since = np.zeros(nf)          # сколько секунд прошло от начала ноты
    for (a, c, v, b), (t0, dur, m) in zip(segs, notes):
        o0 = int(t0 * 1000 / FP)
        D = max(4, int(dur * 1000 / FP))
        onset = min(c - a, int(D * 0.35))
        coda = min(b - v, int(D * 0.25))
        mid = max(1, D - onset - coda)
        mapping = np.concatenate([
            np.linspace(a, c, onset, endpoint=False) if onset > 0 else np.zeros(0),
            np.linspace(c, v, mid, endpoint=False),
            np.linspace(v, b, coda, endpoint=False) if coda > 0 else np.zeros(0),
        ])
        o1 = min(nf, o0 + len(mapping))
        src[o0:o1] = mapping[:o1 - o0]
        pitch[o0:o1] = m
        since[o0:o1] = np.arange(o1 - o0) * FP / 1000
    # плавные переходы между нотами (portamento ~40 мс)
    sm = pitch.copy()
    k = int(40 / FP)
    for i in range(1, nf):
        if pitch[i] and pitch[i - 1] and pitch[i] != pitch[i - 1]:
            lo = max(0, i - k // 2)
            sm[lo:i + k // 2] = np.linspace(pitch[lo], pitch[min(nf - 1, i + k // 2)], len(sm[lo:i + k // 2]))
    t = np.arange(nf) * FP / 1000
    vib = vib_cents / 100 * np.sin(2 * np.pi * 5.4 * t) * np.clip((since - 0.18) / 0.25, 0, 1)
    target = 440.0 * 2 ** ((sm + vib - 69) / 12)

    out_f0 = np.zeros(nf)
    out_sp = np.full((nf, sp.shape[1]), 1e-12)
    out_ap = np.ones((nf, ap.shape[1]))
    has = src >= 0
    s = np.clip(src[has], 0, len(f0) - 1)
    i0 = np.floor(s).astype(int)
    i1 = np.minimum(i0 + 1, len(f0) - 1)
    fr = (s - i0)[:, None]
    out_sp[has] = sp[i0] * (1 - fr) + sp[i1] * fr
    out_ap[has] = ap[i0] * (1 - fr) + ap[i1] * fr
    voiced = (f0[i0] > 0) | (f0[i1] > 0)
    out_f0[np.flatnonzero(has)[voiced]] = target[has][voiced]
    y = pyworld.synthesize(out_f0, out_sp, out_ap, FS, FP)
    y = resample_poly(y, OUT // FS, 1) if OUT % FS == 0 else resample_poly(y, OUT, FS)
    peak = np.max(np.abs(y)) or 1.0
    return y / peak
