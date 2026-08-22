#!/usr/bin/env python3
"""Compare an engine render against a reference recording.

Every realism claim in this project is a number from this file.

Usage:
  python3 tools/analyze.py --render out/v6_3000.wav --rpm 3000 \
      [--ref refs/2gr_fe_3000.wav] [--cylinders 6] [--out-dir results/x] \
      [--name v6_3000]

Outputs <out-dir>/<name>_metrics.json and <out-dir>/<name>_spec.png.
"""

import argparse
import json
import os

import numpy as np
import soundfile as sf

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

SR = 48000


def load_mono_48k(path):
    x, sr = sf.read(path, always_2d=False)
    if x.ndim > 1:
        x = x.mean(axis=1)
    if sr != SR:
        import librosa
        x = librosa.resample(x.astype(np.float64), orig_sr=sr, target_sr=SR)
    return x.astype(np.float64)


def expected_firing_hz(rpm, cylinders):
    return rpm / 60.0 * cylinders / 2.0


def magnitude_spectrum(x):
    n = len(x)
    w = np.hanning(n)
    spec = np.abs(np.fft.rfft(x * w))
    freqs = np.fft.rfftfreq(n, 1.0 / SR)
    return freqs, spec


def comb_f0(freqs, spec, f_expect, n_harm=10, search=0.2, grid=2000):
    """Find the fundamental of a harmonic comb near f_expect.

    Scores candidate f0 values by the summed log magnitude of their first
    n_harm harmonics. Robust when the fundamental itself is weak.
    """
    logspec = np.log(spec + 1e-12)
    cands = np.linspace(f_expect * (1 - search), f_expect * (1 + search), grid)
    df = freqs[1] - freqs[0]

    def score(f0s):
        s = np.zeros_like(f0s)
        for k in range(1, n_harm + 1):
            idx = f0s * k / df
            i0 = np.clip(idx.astype(int), 0, len(spec) - 2)
            frac = idx - i0
            s += (1 - frac) * logspec[i0] + frac * logspec[i0 + 1]
        return s

    sc = score(cands)
    i = int(np.argmax(sc))
    # Parabolic refinement on the comb score.
    if 0 < i < len(cands) - 1:
        a, b, c = sc[i - 1], sc[i], sc[i + 1]
        denom = a - 2 * b + c
        if abs(denom) > 1e-12:
            shift = 0.5 * (a - c) / denom
            return cands[i] + shift * (cands[1] - cands[0])
    return cands[i]


def peak_amp_db(freqs, spec, f, tol=0.02):
    """Peak magnitude in dB within +-tol (relative) of frequency f."""
    lo = np.searchsorted(freqs, f * (1 - tol))
    hi = np.searchsorted(freqs, f * (1 + tol))
    if hi <= lo:
        hi = lo + 1
    return 20 * np.log10(np.max(spec[lo:hi]) + 1e-12)


def harmonic_series(freqs, spec, f0, n=20):
    return [peak_amp_db(freqs, spec, f0 * k) for k in range(1, n + 1)]


def half_order_series(freqs, spec, f0, n=10):
    return [peak_amp_db(freqs, spec, f0 * (k + 0.5)) for k in range(0, n)]


def stft_logmag(x, win):
    hop = win // 4
    n_frames = 1 + (len(x) - win) // hop
    w = np.hanning(win)
    frames = np.lib.stride_tricks.sliding_window_view(x, win)[::hop][:n_frames]
    S = np.abs(np.fft.rfft(frames * w, axis=1))
    return np.log(S + 1e-8)


def multiscale_stft_distance(a, b):
    n = min(len(a), len(b))
    a, b = a[:n], b[:n]
    dists = {}
    for win in (256, 1024, 4096):
        A = stft_logmag(a, win)
        B = stft_logmag(b, win)
        m = min(A.shape[0], B.shape[0])
        dists[str(win)] = float(np.mean(np.abs(A[:m] - B[:m])))
    dists["mean"] = float(np.mean(list(dists.values())))
    return dists


def mel_l1_and_mfcc(a, b):
    import librosa
    n = min(len(a), len(b))
    a, b = a[:n], b[:n]
    MA = librosa.feature.melspectrogram(y=a, sr=SR, n_mels=64)
    MB = librosa.feature.melspectrogram(y=b, sr=SR, n_mels=64)
    mel_l1 = float(np.mean(np.abs(np.log(MA + 1e-8) - np.log(MB + 1e-8))))
    fa = np.mean(librosa.feature.mfcc(y=a, sr=SR, n_mfcc=13), axis=1)
    fb = np.mean(librosa.feature.mfcc(y=b, sr=SR, n_mfcc=13), axis=1)
    cos = float(1.0 - np.dot(fa, fb) / (np.linalg.norm(fa) * np.linalg.norm(fb) + 1e-12))
    return mel_l1, cos


def spectral_shape(x):
    import librosa
    cent = librosa.feature.spectral_centroid(y=x, sr=SR)[0]
    roll = librosa.feature.spectral_rolloff(y=x, sr=SR)[0]
    flat = librosa.feature.spectral_flatness(y=x)[0]
    return {
        "centroid_hz_mean": float(np.mean(cent)),
        "rolloff_hz_mean": float(np.mean(roll)),
        "flatness_mean": float(np.mean(flat)),
        "centroid_curve": cent.astype(float).tolist(),
        "rolloff_curve": roll.astype(float).tolist(),
        "flatness_curve": flat.astype(float).tolist(),
    }


def hnr_db(x):
    """Harmonic-to-noise ratio via harmonic/percussive separation."""
    import librosa
    S = librosa.stft(x, n_fft=2048)
    H, P = librosa.decompose.hpss(S)
    eh = np.sum(np.abs(H) ** 2)
    ep = np.sum(np.abs(P) ** 2)
    return float(10 * np.log10((eh + 1e-12) / (ep + 1e-12)))


def pulse_envelope(x, f_fire):
    """Cycle-average the amplitude envelope over one firing period."""
    from scipy.signal import hilbert
    period = SR / f_fire
    n_cycles = int(len(x) / period) - 2
    if n_cycles < 4:
        return None
    env = np.abs(hilbert(x))
    grid = 256
    acc = np.zeros(grid)
    for c in range(1, n_cycles + 1):
        start = c * period
        idx = start + np.arange(grid) * (period / grid)
        i0 = idx.astype(int)
        frac = idx - i0
        acc += (1 - frac) * env[i0] + frac * env[np.minimum(i0 + 1, len(env) - 1)]
    acc /= n_cycles
    # Rotate so the pulse peak sits at 25% of the frame for readability.
    peak = int(np.argmax(acc))
    acc = np.roll(acc, grid // 4 - peak)
    peak_v = float(np.max(acc))
    base = float(np.min(acc))
    rng = peak_v - base
    if rng <= 0:
        return None
    norm = (acc - base) / rng
    p = int(np.argmax(norm))
    # Attack: last 10% crossing before the peak to the peak.
    above10 = np.where(norm[:p] < 0.1)[0]
    a_start = int(above10[-1]) if len(above10) else 0
    attack_ms = (p - a_start) / grid * period / SR * 1000
    # Decay: peak to the first drop below 0.1 after it.
    below10 = np.where(norm[p:] < 0.1)[0]
    decay_ms = (int(below10[0]) if len(below10) else grid - p) / grid * period / SR * 1000
    return {
        "envelope": norm.astype(float).tolist(),
        "attack_ms": float(attack_ms),
        "decay_ms": float(decay_ms),
        "peak_to_base_ratio": float(peak_v / (base + 1e-9)),
    }


BAND_EDGES = [(20, 100), (100, 300), (300, 800), (800, 2000), (2000, 6000)]


def band_shares(x):
    """Fraction of spectral energy in each perceptual band."""
    S = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2
    fr = np.fft.rfftfreq(len(x), 1.0 / SR)
    tot = S[fr >= 20].sum() + 1e-30
    return [float(S[(fr >= a) & (fr < b)].sum() / tot) for a, b in BAND_EDGES]


def cycle_contrast(x, f_cycle):
    """Peak-to-median of the cycle-averaged envelope: how pulse-gated
    the sound is versus a continuous drone."""
    cyc = int(SR / f_cycle)
    n = len(x) // cyc
    if n < 4:
        return None
    prof = np.abs(x[:n * cyc]).reshape(n, cyc).mean(axis=0)
    if cyc >= 60:
        trim = (cyc // 60) * 60
        sm = prof[:trim].reshape(60, -1).mean(axis=1)
    else:
        sm = prof
    return float(np.max(sm) / (np.median(sm) + 1e-12))


def crest_factor_db(x):
    rms = np.sqrt(np.mean(x ** 2)) + 1e-12
    return float(20 * np.log10(np.max(np.abs(x)) / rms))


def spectrogram_png(path, x, title, ref=None, ref_title=None):
    rows = 2 if ref is not None else 1
    fig, axes = plt.subplots(rows, 1, figsize=(10, 4 * rows), squeeze=False)
    for ax, sig, t in zip(axes[:, 0], [x, ref] if ref is not None else [x],
                          [title, ref_title] if ref is not None else [title]):
        S = stft_logmag(sig, 1024)
        ax.imshow(S.T, origin="lower", aspect="auto",
                  extent=[0, len(sig) / SR, 0, SR / 2 / 1000], cmap="magma",
                  vmin=np.percentile(S, 5), vmax=np.percentile(S, 99.5))
        ax.set_ylim(0, 8)
        ax.set_ylabel("kHz")
        ax.set_title(t)
    axes[-1, 0].set_xlabel("s")
    fig.tight_layout()
    fig.savefig(path, dpi=90)
    plt.close(fig)


def analyze(render_path, rpm, cylinders, ref_path=None, sweep=None):
    x = load_mono_48k(render_path)
    m = {
        "render": render_path,
        "rpm": rpm,
        "cylinders": cylinders,
        "duration_s": len(x) / SR,
        "ref": ref_path,
    }

    is_sweep = sweep is not None
    m["is_sweep"] = is_sweep

    if not is_sweep:
        f_expect = expected_firing_hz(rpm, cylinders)
        freqs, spec = magnitude_spectrum(x)
        f0 = comb_f0(freqs, spec, f_expect)
        m["firing_hz_expected"] = f_expect
        m["firing_hz_measured"] = float(f0)
        m["firing_hz_error_pct"] = float(abs(f0 - f_expect) / f_expect * 100)

        harm = harmonic_series(freqs, spec, f0)
        half = half_order_series(freqs, spec, f0)
        m["harmonics_db"] = harm
        m["half_orders_db"] = half
        m["half_order_ratio_db"] = float(np.mean(half) - np.mean(harm[:10]))

        pe = pulse_envelope(x, f0)
        if pe:
            m["pulse"] = pe
        cc = cycle_contrast(x, f0 / (cylinders / 2.0))
        if cc:
            m["cycle_contrast"] = cc

    m["crest_factor_db"] = crest_factor_db(x)
    m["band_shares"] = band_shares(x)
    m["hnr_db"] = hnr_db(x)
    m.update({"shape_" + k if k.endswith("_mean") else k: v
              for k, v in spectral_shape(x).items()})

    if ref_path and os.path.exists(ref_path):
        r = load_mono_48k(ref_path)
        # The microphone gain of the reference is arbitrary: normalize the
        # render to the reference RMS before any level-sensitive distance.
        xr = np.sqrt(np.mean(x ** 2))
        rr = np.sqrt(np.mean(r ** 2))
        if xr > 0:
            x = x * (rr / xr)
        m["stft_distance"] = multiscale_stft_distance(x, r)
        mel, mfcc = mel_l1_and_mfcc(x, r)
        m["mel_l1"] = mel
        m["mfcc_cosine"] = mfcc
        if not is_sweep:
            freqs_r, spec_r = magnitude_spectrum(r)
            f0r = comb_f0(freqs_r, spec_r, m["firing_hz_expected"])
            harm_r = harmonic_series(freqs_r, spec_r, f0r)
            # Compare shapes: remove the overall level difference first.
            hd = np.array(m["harmonics_db"]) - np.array(harm_r)
            hd -= np.mean(hd)
            m["ref_harmonics_db"] = harm_r
            m["harmonic_err_db"] = hd.tolist()
            m["harmonic_rms_err_db"] = float(np.sqrt(np.mean(hd ** 2)))
            per = pulse_envelope(r, f0r)
            if per and "pulse" in m:
                m["ref_pulse"] = per
                d = np.array(m["pulse"]["envelope"]) - np.array(per["envelope"])
                m["pulse_envelope_l2"] = float(np.sqrt(np.mean(d ** 2)))
        rshape = spectral_shape(r)
        m["ref_centroid_hz_mean"] = rshape["centroid_hz_mean"]
        m["ref_rolloff_hz_mean"] = rshape["rolloff_hz_mean"]
        m["ref_flatness_mean"] = rshape["flatness_mean"]
        m["ref_hnr_db"] = hnr_db(r)
        m["ref_crest_factor_db"] = crest_factor_db(r)
        m["ref_band_shares"] = band_shares(r)
        m["band_l1"] = float(np.sum(np.abs(
            np.array(m["band_shares"]) - np.array(m["ref_band_shares"]))))
        if not is_sweep:
            rcc = cycle_contrast(r, m["firing_hz_expected"] / (cylinders / 2.0))
            if rcc:
                m["ref_cycle_contrast"] = rcc
    return m, x


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--render", required=True)
    ap.add_argument("--rpm", type=float, required=True,
                    help="steady rpm, or the sweep midpoint")
    ap.add_argument("--sweep", default=None, help="START:END if a sweep")
    ap.add_argument("--cylinders", type=int, default=6)
    ap.add_argument("--ref", default=None)
    ap.add_argument("--out-dir", default=".")
    ap.add_argument("--name", default=None)
    args = ap.parse_args()

    name = args.name or os.path.splitext(os.path.basename(args.render))[0]
    os.makedirs(args.out_dir, exist_ok=True)

    m, x = analyze(args.render, args.rpm, args.cylinders, args.ref, args.sweep)

    ref = load_mono_48k(args.ref) if args.ref and os.path.exists(args.ref) else None
    spectrogram_png(os.path.join(args.out_dir, f"{name}_spec.png"), x,
                    f"render: {name}", ref,
                    f"reference: {os.path.basename(args.ref)}" if ref is not None else None)

    out = os.path.join(args.out_dir, f"{name}_metrics.json")
    with open(out, "w") as f:
        json.dump(m, f, indent=1)

    keys = ["firing_hz_expected", "firing_hz_measured", "firing_hz_error_pct",
            "half_order_ratio_db", "harmonic_rms_err_db", "crest_factor_db",
            "hnr_db", "shape_centroid_hz_mean", "mel_l1", "mfcc_cosine",
            "band_l1", "cycle_contrast", "ref_cycle_contrast"]
    print(f"== {name} ==")
    for k in keys:
        if k in m:
            v = m[k]
            print(f"  {k}: {v:.3f}" if isinstance(v, float) else f"  {k}: {v}")
    if "stft_distance" in m:
        print(f"  stft_distance_mean: {m['stft_distance']['mean']:.4f}")


if __name__ == "__main__":
    main()
