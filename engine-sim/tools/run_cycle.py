#!/usr/bin/env python3
"""One full verification cycle: build, render, sanity, metrics, report.

Usage:
  python3 tools/run_cycle.py [--label "what changed"] [--quick]
      [--no-promote] [--config configs/2gr_fe.json]

Writes results/<timestamp>/ with metrics JSON, spectrogram PNGs and
report.html. Never overwrites an old results directory. With promotion
(default) the steady renders are copied to renders/best/ and the old best
moves to renders/prev/, so the repo always carries the current and the
previous best audio.
"""

import argparse
import datetime
import filecmp
import json
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BIN = os.path.join(ROOT, "build", "enginesim")

# (rpm, throttle) steady verification points.
STEADY = [(650, 0.10), (1500, 0.35), (3000, 0.55), (4500, 0.75), (6400, 0.95)]
SWEEP = (800, 7000, 20.0, 1.0)
SEED = 42
ENGINE = "2gr_fe"


def run(cmd, **kw):
    print("+", " ".join(str(c) for c in cmd))
    return subprocess.run(cmd, check=True, cwd=ROOT, **kw)


def cpu_model():
    try:
        with open("/proc/cpuinfo") as f:
            for line in f:
                if line.startswith("model name"):
                    return line.split(":", 1)[1].strip()
    except OSError:
        pass
    return "unknown"


def git_rev():
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], cwd=ROOT).decode().strip()
    except Exception:
        return "unknown"


def render(cfg, out_wav, stats, rpm=None, sweep=None, duration=6.0,
           throttle=0.5, seed=SEED, extra=()):
    cmd = [BIN, "--config", cfg, "--duration", str(duration),
           "--throttle", str(throttle), "--seed", str(seed),
           "--out", out_wav, "--stats", stats]
    if sweep:
        cmd += ["--sweep", f"{sweep[0]}:{sweep[1]}"]
    else:
        cmd += ["--rpm", str(rpm)]
    cmd += list(extra)
    run(cmd)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--label", default="")
    ap.add_argument("--config", default="configs/2gr_fe.json")
    ap.add_argument("--quick", action="store_true",
                    help="skip the 60 s RTF render and the sweep")
    ap.add_argument("--no-promote", action="store_true")
    ap.add_argument("--skip-build", action="store_true")
    args = ap.parse_args()

    if not args.skip_build:
        run(["cmake", "-B", "build", "-DCMAKE_BUILD_TYPE=Release"],
            stdout=subprocess.DEVNULL)
        run(["cmake", "--build", "build", "-j4"], stdout=subprocess.DEVNULL)
    run([BIN, "--selftest"])

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    rdir = os.path.join(ROOT, "results", ts)
    audio = os.path.join(rdir, "audio")
    os.makedirs(audio)

    agg = {
        "timestamp": ts,
        "label": args.label,
        "git_rev": git_rev(),
        "cpu_model": cpu_model(),
        "config": args.config,
        "renders": {},
        "sanity": {},
    }

    # --- Steady renders + metrics ---
    for rpm, thr in STEADY:
        name = f"{ENGINE}_{rpm}"
        wav = os.path.join(audio, name + ".wav")
        st = os.path.join(rdir, name + "_stats.json")
        render(args.config, wav, st, rpm=rpm, throttle=thr)
        ref = os.path.join(ROOT, "refs", f"{ENGINE}_{rpm}.wav")
        cmd = [sys.executable, os.path.join(ROOT, "tools", "analyze.py"),
               "--render", wav, "--rpm", str(rpm), "--out-dir", rdir,
               "--name", name]
        if os.path.exists(ref):
            cmd += ["--ref", ref]
        run(cmd)
        with open(os.path.join(rdir, name + "_metrics.json")) as f:
            m = json.load(f)
        with open(st) as f:
            m["render_stats"] = json.load(f)
        agg["renders"][name] = m

    # --- Sweep ---
    if not args.quick:
        a, b, dur, thr = SWEEP
        name = f"{ENGINE}_sweep_{a}_{b}"
        wav = os.path.join(audio, name + ".wav")
        st = os.path.join(rdir, name + "_stats.json")
        render(args.config, wav, st, sweep=(a, b), duration=dur, throttle=thr)
        mid = (a + b) / 2
        run([sys.executable, os.path.join(ROOT, "tools", "analyze.py"),
             "--render", wav, "--rpm", str(mid), "--sweep", f"{a}:{b}",
             "--out-dir", rdir, "--name", name])
        with open(os.path.join(rdir, name + "_metrics.json")) as f:
            m = json.load(f)
        with open(st) as f:
            m["render_stats"] = json.load(f)
        agg["renders"][name] = m

    # --- Sanity: determinism ---
    d1 = os.path.join(audio, "det_a.wav")
    d2 = os.path.join(audio, "det_b.wav")
    for d in (d1, d2):
        render(args.config, d, d + ".json", rpm=3000, throttle=0.55,
               duration=2.0, seed=123)
    agg["sanity"]["deterministic"] = filecmp.cmp(d1, d2, shallow=False)
    os.remove(d1), os.remove(d2)

    # --- Sanity: NaN and full scale across all renders ---
    agg["sanity"]["nan_free"] = all(
        m["render_stats"]["nan_count"] == 0 for m in agg["renders"].values())
    agg["sanity"]["below_full_scale"] = all(
        m["render_stats"]["max_abs"] <= 0.999 for m in agg["renders"].values())

    # --- RTF over a 60 s render ---
    if not args.quick:
        wav = os.path.join(audio, "rtf_probe.wav")
        st = os.path.join(rdir, "rtf_stats.json")
        render(args.config, wav, st, rpm=3000, throttle=0.55, duration=60.0)
        with open(st) as f:
            rtf = json.load(f)["rtf"]
        agg["sanity"]["rtf_60s"] = rtf
        agg["sanity"]["rtf_ok"] = rtf >= 10.0
        os.remove(wav)

    # --- Aggregate verdicts ---
    firing_ok = all(
        m.get("firing_hz_error_pct", 99) < 0.5
        for m in agg["renders"].values() if not m.get("is_sweep"))
    agg["sanity"]["firing_freq_ok"] = firing_ok

    with open(os.path.join(rdir, "metrics.json"), "w") as f:
        json.dump(agg, f, indent=1)

    # --- Promote renders so the repo carries best + previous best ---
    if not args.no_promote:
        best = os.path.join(ROOT, "renders", "best")
        prev = os.path.join(ROOT, "renders", "prev")
        if os.path.isdir(best):
            shutil.rmtree(prev, ignore_errors=True)
            shutil.move(best, prev)
        os.makedirs(best, exist_ok=True)
        for rpm, _ in STEADY:
            src = os.path.join(audio, f"{ENGINE}_{rpm}.wav")
            if os.path.exists(src):
                shutil.copy(src, os.path.join(best, f"{ENGINE}_{rpm}.wav"))
        with open(os.path.join(best, "SOURCE.json"), "w") as f:
            json.dump({"results_dir": ts, "git_rev": agg["git_rev"],
                       "label": args.label}, f, indent=1)

    # --- Report ---
    run([sys.executable, os.path.join(ROOT, "tools", "report.py"),
         "--results-dir", rdir])

    print("\n==== cycle summary ====")
    print(f"results: results/{ts}  label: {args.label!r}")
    for k, v in agg["sanity"].items():
        print(f"  {k}: {v}")
    for name, m in agg["renders"].items():
        line = f"  {name}:"
        if "firing_hz_error_pct" in m:
            line += f" f_err={m['firing_hz_error_pct']:.3f}%"
            line += f" half={m['half_order_ratio_db']:.1f}dB"
        if "harmonic_rms_err_db" in m:
            line += f" harmRMS={m['harmonic_rms_err_db']:.2f}dB"
        if "stft_distance" in m:
            line += f" stft={m['stft_distance']['mean']:.4f}"
        line += f" crest={m['crest_factor_db']:.1f}dB"
        line += f" max={m['render_stats']['max_abs']:.3f}"
        print(line)

    ok = all(v for k, v in agg["sanity"].items() if isinstance(v, bool))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
