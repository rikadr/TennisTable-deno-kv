# RESUME — state of the engine sound simulator

Read this first. It tells a fresh session how to continue.

## What this is

A real-time, physics-based engine sound simulator. The sound is the
pressure waveform at the exhaust pipe exit of a simulated Toyota 2GR-FE
V6. There are no samples and no oscillators. The project brief is in the
first user message of the original session; the essential rules:

- The offline WAV renderer is the primary target. Headless first.
- All realism claims must come from computed metrics, not from listening.
- Improvements must come from physics, never from corrective EQ/filters.
- Tune against ONE car's reference recordings only, once they exist.
- No forced induction. 4-stroke straight and V layouts only.
- Commit every iteration. Keep this file and docs/iteration_log.md current.

## Layout

Everything lives in `engine-sim/` inside the TennisTable repo (the branch
is dedicated to this project; the tennis app is untouched).

- `src/core/` — simulator: kinematics, cylinder thermo, valve flow,
  waveguide exhaust/intake, radiation, mixing. No audio/GUI deps.
- `src/realtime/`, `src/gui/` — optional layers behind `ENGINESIM_REALTIME`
  and `ENGINESIM_GUI` (default OFF).
- `configs/2gr_fe.json` — default engine. All tuning variables live here.
- `tools/` — analyze.py (metrics), report.py (report.html), run_cycle.py
  (render+analyze+report orchestration), sanity.py.
- `refs/` — reference recordings, provided by the user. DO NOT download
  or synthesize references. If empty, reference-matched tuning is blocked;
  see refs/README.md (recording instructions for the user).
- `results/<timestamp>/` — metrics JSON, PNGs, report.html per cycle.
  Never overwrite old results.
- `docs/` — research.md, design.md, targets.md, iteration_log.md,
  realtime_safety.md, macos_build.md.
- `third_party/` — vendored pinned deps (nlohmann/json 3.11.3, miniaudio
  0.11.21, GLFW 3.4 @7b6aead, ImGui 1.91.9b @f5befd2).

## Build and run

```
cd engine-sim
cmake -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j
./build/enginesim --selftest
./build/enginesim --config configs/2gr_fe.json --rpm 3000 --duration 6 \
    --out out/v6_3000.wav --stats out/v6_3000.json
python3 tools/run_cycle.py            # full render+metrics+report cycle
```

Python deps: numpy scipy matplotlib librosa soundfile (pip3 install).

## Current state (update this section every session)

- Core simulator, waveguide network, CLI, selftest: DONE, first render OK
  (no NaN, peak cylinder pressure ~95 bar at WOT 3000 rpm).
- Analysis harness: see tools/. Improvement loop status: see
  docs/iteration_log.md (latest entry = current best).
- refs/ is EMPTY. The user must record references per refs/README.md.
  Until then the loop tunes computable metrics only (firing frequency,
  half-order absence, pulse shape, sanity, RTF).
- Known open items: RTF was 5.1x at first measurement (target >= 10x
  single-threaded in the sandbox); output level low (master_gain).

## Working method

1. Pick the single worst metric. 2. Write a hypothesis in
docs/iteration_log.md. 3. Change one thing. 4. `python3 tools/run_cycle.py`.
5. Keep if metrics improved, revert if not; log both outcomes with numbers.
Commit after every iteration. Stop when improvements stall for 5
consecutive iterations, then report.
