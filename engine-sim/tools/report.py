#!/usr/bin/env python3
"""Build results/<ts>/report.html: spectrograms, metric tables against the
previous cycle, and audio players for renders and references.

Audio players point at renders/best/ and renders/prev/ (the committed
audio) and at refs/. Older reports therefore play whatever was best when
the repo was checked out; the numbers and images in each report are frozen.
"""

import argparse
import glob
import html
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

KEY_METRICS = [
    ("firing_hz_error_pct", "firing freq error %", "%.3f", False),
    ("half_order_ratio_db", "half-order level dB", "%.1f", None),
    ("harmonic_rms_err_db", "harmonic RMS err dB", "%.2f", False),
    ("mel_l1", "mel L1", "%.4f", False),
    ("mfcc_cosine", "MFCC cosine", "%.4f", False),
    ("pulse_envelope_l2", "pulse env L2", "%.4f", False),
    ("hnr_db", "HNR dB", "%.1f", None),
    ("band_l1", "band balance L1", "%.3f", False),
    ("cycle_contrast", "cycle contrast", "%.2f", None),
    ("crest_factor_db", "crest dB", "%.1f", None),
    ("shape_centroid_hz_mean", "centroid Hz", "%.0f", None),
    ("shape_flatness_mean", "flatness", "%.4f", None),
]


def load(path):
    with open(path) as f:
        return json.load(f)


def prev_results_dir(current):
    base = os.path.join(ROOT, "results")
    dirs = sorted(d for d in os.listdir(base)
                  if os.path.isdir(os.path.join(base, d))
                  and os.path.exists(os.path.join(base, d, "metrics.json")))
    cur = os.path.basename(current)
    older = [d for d in dirs if d < cur]
    return os.path.join(base, older[-1]) if older else None


def stft_of(m):
    return m.get("stft_distance", {}).get("mean")


def fmt_delta(cur, old, lower_better):
    if old is None or cur is None or lower_better is None:
        return ""
    d = cur - old
    if abs(d) < 1e-9:
        return ' <span class="same">=</span>'
    good = (d < 0) if lower_better else (d > 0)
    cls = "good" if good else "bad"
    return f' <span class="{cls}">{d:+.3f}</span>'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--results-dir", required=True)
    args = ap.parse_args()
    rdir = os.path.abspath(args.results_dir)
    agg = load(os.path.join(rdir, "metrics.json"))
    pdir = prev_results_dir(rdir)
    prev = load(os.path.join(pdir, "metrics.json")) if pdir else None

    rel = lambda p: os.path.relpath(p, rdir)
    parts = []
    parts.append(f"""<!doctype html><meta charset="utf-8">
<title>enginesim report {agg['timestamp']}</title>
<style>
 body {{ font-family: system-ui, sans-serif; margin: 2rem; max-width: 1100px; }}
 table {{ border-collapse: collapse; margin: 0.6rem 0 1.4rem; }}
 td, th {{ border: 1px solid #ccc; padding: 4px 10px; text-align: right; }}
 th {{ background: #f2f2f2; }}
 td:first-child, th:first-child {{ text-align: left; }}
 .good {{ color: #0a7a0a; font-weight: 600; }}
 .bad {{ color: #c22; font-weight: 600; }}
 .same {{ color: #999; }}
 img {{ max-width: 100%; border: 1px solid #ddd; margin: 4px 0; }}
 audio {{ width: 260px; vertical-align: middle; }}
 .pass {{ color: #0a7a0a; }} .fail {{ color: #c22; }}
 h2 {{ margin-top: 2.2rem; border-bottom: 2px solid #eee; }}
 .meta {{ color: #666; }}
</style>
<h1>enginesim verification report</h1>
<p class="meta">cycle {agg['timestamp']} &middot; git {agg['git_rev']} &middot;
label: {html.escape(agg.get('label') or '(none)')} &middot;
cpu: {html.escape(agg['cpu_model'])}
{('&middot; compared against ' + os.path.basename(pdir)) if pdir else '&middot; first cycle, no previous run'}</p>
""")

    # Sanity table
    parts.append("<h2>Sanity</h2><table><tr><th>check</th><th>value</th></tr>")
    for k, v in agg["sanity"].items():
        cls = ""
        if isinstance(v, bool):
            cls = "pass" if v else "fail"
            v = "PASS" if v else "FAIL"
        parts.append(f'<tr><td>{k}</td><td class="{cls}">{v}</td></tr>')
    parts.append("</table>")

    # Per-render sections
    for name, m in agg["renders"].items():
        pm = prev["renders"].get(name) if prev else None
        parts.append(f"<h2>{html.escape(name)}</h2>")

        # Audio row
        best = os.path.join(ROOT, "renders", "best", name + ".wav")
        prevw = os.path.join(ROOT, "renders", "prev", name + ".wav")
        refw = m.get("ref")
        row = []
        if os.path.exists(best):
            row.append(f"current best<br><audio controls src='{rel(best)}'></audio>")
        if os.path.exists(prevw):
            row.append(f"previous best<br><audio controls src='{rel(prevw)}'></audio>")
        if refw and os.path.exists(refw):
            row.append(f"reference<br><audio controls src='{rel(os.path.join(ROOT, refw)) if not os.path.isabs(refw) else rel(refw)}'></audio>")
        if row:
            parts.append("<p>" + " &nbsp; ".join(row) + "</p>")
        if not (refw and os.path.exists(refw or "")):
            parts.append("<p class='meta'>No reference recording for this point (refs/ is empty or lacks this rpm).</p>")

        # Metric table
        parts.append("<table><tr><th>metric</th><th>value</th><th>vs prev</th></tr>")
        stft = stft_of(m)
        if stft is not None:
            old = stft_of(pm) if pm else None
            parts.append(f"<tr><td>multi-scale STFT dist</td><td>{stft:.4f}</td>"
                         f"<td>{fmt_delta(stft, old, True)}</td></tr>")
        for key, label, fmt, lower_better in KEY_METRICS:
            if key not in m:
                continue
            cur = m[key]
            old = pm.get(key) if pm else None
            parts.append(f"<tr><td>{label}</td><td>{fmt % cur}</td>"
                         f"<td>{fmt_delta(cur, old, lower_better)}</td></tr>")
        rs = m.get("render_stats", {})
        for k in ("max_abs", "rtf", "peak_cyl_pressure_bar"):
            if k in rs:
                parts.append(f"<tr><td>{k}</td><td>{rs[k]:.3f}</td><td></td></tr>")
        parts.append("</table>")

        spec = os.path.join(rdir, name + "_spec.png")
        if os.path.exists(spec):
            parts.append(f"<img src='{os.path.basename(spec)}' alt='spectrogram {name}'>")

    with open(os.path.join(rdir, "report.html"), "w") as f:
        f.write("\n".join(parts))
    print("report:", os.path.join(rdir, "report.html"))


if __name__ == "__main__":
    main()
