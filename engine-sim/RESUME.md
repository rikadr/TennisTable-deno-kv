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

- Target engine: Audi R8 V10 5.2 (user-approved change; references
  found online, see refs/SOURCES.md). Two configs:
  - configs/r8_v10.json: stock exhaust, tuned against the real idle
    recording refs/r8_v10_800.wav. This is the metric-loop config.
  - configs/r8_v10_straight.json: straight-piped listening config the
    user asked for (X-pipe merge, no chambers, no mic low-pass).
- The old 2GR-FE config remains at configs/2gr_fe.json (untuned).
- Core physics complete and iterated 13 times (docs/iteration_log.md):
  implicit valve-duct coupling, Burgers steepening via shifted reads,
  d(exit flow)/dt radiation, mean-flow convection at the exit,
  quadratic exit and pipe losses, flow damping, idle spark retard,
  load-dependent cycle variation. tools/geom_search.py auto-tunes
  geometry against a reference (coordinate descent).
- Realtime layer (miniaudio + SPSC ring) and GUI layer (ImGui + GLFW)
  build clean with -Wall -Wextra; sandbox compile-checks them (GUI
  links only where OpenGL exists). docs/realtime_safety.md has the
  callback call-tree review.
- Idle-vs-reference scoreboard: harmonic RMS error 4.4 dB (target 3),
  firing error 0.00-0.14% (PASS), band balance close, stft ~1.2.
- Open items: RTF ~5 for the V10 (target 10, sandbox CPU); crest
  factor still below the reference (13-16 vs 18.5); user listening
  verdict on round 3 pending; rev-demo character at load needs the
  user's ear.
- The user asked for renders to be posted into the chat each round
  (SendUserFile) so they can listen.

## Working method

1. Pick the single worst metric. 2. Write a hypothesis in
docs/iteration_log.md. 3. Change one thing. 4. `python3 tools/run_cycle.py`.
5. Keep if metrics improved, revert if not; log both outcomes with numbers.
Commit after every iteration. Stop when improvements stall for 5
consecutive iterations, then report.
