#!/usr/bin/env python3
"""Coordinate-descent search over exhaust geometry against the idle
reference. One parameter at a time; keep a value only if the objective
improves. The objective is the harmonic RMS error plus a band-balance
penalty against the reference band distribution.

Usage: python3 tools/geom_search.py [--config configs/r8_v10.json]
       [--rpm 800] [--throttle 0.05] [--ref refs/r8_v10_800.wav]
"""

import argparse
import copy
import json
import os
import subprocess
import sys

import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BIN = os.path.join(ROOT, "build", "enginesim")
TMP = os.path.join(ROOT, "out", "gs_tmp.json")
WAV = os.path.join(ROOT, "out", "gs_tmp.wav")

BANDS = [(20, 100), (100, 300), (300, 800), (800, 2000), (2000, 6000)]


def band_shares(x, sr):
    S = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2
    fr = np.fft.rfftfreq(len(x), 1 / sr)
    tot = S[fr >= 20].sum()
    return np.array([S[(fr >= a) & (fr < b)].sum() / tot for a, b in BANDS])


def harm_series(x, sr, f0, n=20):
    S = np.abs(np.fft.rfft(x * np.hanning(len(x))))
    fr = np.fft.rfftfreq(len(x), 1 / sr)
    out = []
    for k in range(1, n + 1):
        lo = np.searchsorted(fr, f0 * k * 0.98)
        hi = np.searchsorted(fr, f0 * k * 1.02)
        out.append(20 * np.log10(np.max(S[lo:hi]) + 1e-12))
    return np.array(out)


def objective(cfg, rpm, throttle, refx, ref_bands, ref_harm, sr, f0):
    with open(TMP, "w") as f:
        json.dump(cfg, f)
    r = subprocess.run(
        [BIN, "--config", TMP, "--rpm", str(rpm), "--throttle", str(throttle),
         "--duration", "4", "--rpm-jitter", "0", "--out", WAV],
        capture_output=True, cwd=ROOT)
    if r.returncode != 0:
        return None
    x, _ = sf.read(WAV)
    x = x[sr // 2:]
    h = harm_series(x, sr, f0)
    d = h - ref_harm
    d -= d.mean()
    harm_rms = float(np.sqrt(np.mean(d ** 2)))
    bands = band_shares(x, sr)
    band_pen = float(np.sum(np.abs(bands - ref_bands))) * 10.0
    return harm_rms + band_pen, harm_rms, band_pen


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="configs/r8_v10.json")
    ap.add_argument("--rpm", type=float, default=800.0)
    ap.add_argument("--throttle", type=float, default=0.05)
    ap.add_argument("--ref", default="refs/r8_v10_800.wav")
    ap.add_argument("--cylinders", type=int, default=10)
    ap.add_argument("--rounds", type=int, default=2)
    ap.add_argument("--write", action="store_true",
                    help="write the best values back into --config")
    args = ap.parse_args()

    cfg = json.load(open(os.path.join(ROOT, args.config)))
    refx, sr = sf.read(os.path.join(ROOT, args.ref))
    f0 = args.rpm / 60.0 * args.cylinders / 2.0
    ref_bands = band_shares(refx, sr)
    ref_harm = harm_series(refx, sr, f0)

    # (path, candidate values). Scales apply to lists.
    PARAMS = [
        (("exhaust", "bank_pipe_lengths_m"), "scale", [0.7, 0.85, 1.0, 1.25, 1.5]),
        (("exhaust", "mid_pipe_length_m"), "abs", [0.2, 0.3, 0.5, 0.7]),
        (("exhaust", "tailpipe_length_m"), "abs", [0.15, 0.3, 0.5]),
        (("exhaust", "runner_lengths_m"), "scale", [0.8, 1.0, 1.2]),
        (("exhaust", "loss_per_meter"), "abs", [0.1, 0.2, 0.35]),
        (("exhaust", "loss_cutoff_hz"), "abs", [1400.0, 2000.0, 2800.0]),
        (("output", "mic_highpass_hz"), "abs", [80.0, 140.0, 220.0]),
    ]

    def getv(c, path):
        v = c
        for k in path:
            v = v[k]
        return v

    def setv(c, path, val):
        v = c
        for k in path[:-1]:
            v = v[k]
        v[path[-1]] = val

    base = objective(cfg, args.rpm, args.throttle, refx, ref_bands, ref_harm,
                     sr, f0)
    print("start objective %.3f (harm %.2f band %.2f)" % base)

    best = base[0]
    for rnd in range(args.rounds):
        for path, mode, cands in PARAMS:
            orig = copy.deepcopy(getv(cfg, path))
            bestval = orig
            for cand in cands:
                trial = copy.deepcopy(cfg)
                if mode == "scale":
                    val = [round(v * cand, 4) for v in orig] \
                        if isinstance(orig, list) else round(orig * cand, 5)
                else:
                    val = cand
                setv(trial, path, val)
                res = objective(trial, args.rpm, args.throttle, refx,
                                ref_bands, ref_harm, sr, f0)
                if res is None:
                    continue
                tag = ""
                if res[0] < best - 1e-3:
                    best = res[0]
                    bestval = val
                    tag = "  <-- keep"
                print("r%d %-38s %-24s obj %.3f (h %.2f b %.2f)%s" %
                      (rnd, "/".join(path), str(val)[:24], res[0], res[1],
                       res[2], tag))
            setv(cfg, path, bestval)

    print("final objective %.3f" % best)
    if args.write:
        with open(os.path.join(ROOT, args.config), "w") as f:
            json.dump(cfg, f, indent=1)
        print("written to", args.config)
    else:
        with open(os.path.join(ROOT, "out", "gs_best.json"), "w") as f:
            json.dump(cfg, f, indent=1)
        print("best config in out/gs_best.json (use --write to apply)")


if __name__ == "__main__":
    main()
