# Iteration log

One entry per change. Keep the numbers. Newest at the bottom.
Metric shorthand: fErr = firing frequency error %, harmRMS = harmonic
amplitude RMS error vs reference (dB), stft = multi-scale STFT log-mag
distance, mel = mel L1, half = half-order level relative to integer
orders (dB), RTF = real-time factor, 60 s render, Release,
single-threaded. Sandbox CPU: Intel Xeon @ 2.80 GHz (4 vCPU).

## 2026-08-22 Baseline and infrastructure (2GR-FE target)

- First full build. Selftest passed. First render: fErr 0.005%, no NaN.
- Diagnostic: half orders at -1.3 dB (far too strong for even fire).
  Symmetric geometry + no cycle variation: -15.5 dB. Also without
  steepening: -30.4 dB. Conclusion: half-order energy comes from
  geometric asymmetry (physical), cycle variation (physical), and the
  steepening feedback (partly numeric, watch it).
- BUG FIX (valve-duct coupling): the port pressure used the previous
  sample's flow and oscillated at Nyquist. Idle-to-redline RMS span was
  2.7 dB; the implicit solve raised it to 7.5 dB and peak cylinder
  pressure now scales 17/51/93 bar across 650/3000/6400 rpm.
- Performance: RTF 3.8 -> 9.0-9.2 (V6) via flow-function and cam and
  volume tables, no fmod/trig in the hot path, inlined delay reads and
  junction scatter, warm-started subsonic solver, fast-math (core only,
  keeps finite-math). RTF target of 10 not reached yet on the sandbox
  vCPU; every remaining cost scales with the internal rate.
- Limiter moved after the decimator after a 1.004 full-scale overshoot.

## 2026-08-22 Retarget to Audi R8 V10 5.2 (user-approved online refs)

- User approved sourcing references online and changing the target
  engine. Candidates measured in docs and refs/SOURCES.md. Chosen:
  Audi R8 V10 clip (best bandwidth/noise/steadiness combination).
- The reference idle comb (33.33 Hz spacing = order 2.5 per rev at
  800 rpm) shows one bank dominates at the microphone. Added a dual-exit
  exhaust topology (X junction, one chain per bank, tail_mix at the
  microphone) to reproduce that.
- configs/r8_v10.json created; verification points moved into the
  config ("verification" block, read by run_cycle.py).
- refs/r8_v10_800.wav (steady idle) + r8_v10_full.wav extracted.

### Baseline vs reference, idle 800 rpm (render level normalized to ref)

- fErr 0.002% PASS. half -9.7 dB.
- harmRMS 14.8 dB (target < 3). stft 1.99. mel 2.69. mfcc 0.053.
- Render vs ref character: centroid 2374 vs 1349 Hz (too bright),
  HNR 14.6 vs 7.7 dB (too tonal), crest 12.3 vs 18.5 dB (too flat),
  pulse decay 10.0 vs 4.9 ms (rings too long). Harmonic valley at
  h4-h8 and a resonant bump at h9-h13 that the reference lacks.

## Iteration 1 (R8): network damping

- Hypothesis: the waveguide network is under-damped. Real exhausts
  lose energy to flow separation, turbulence and absorptive packing;
  the model's loss_per_meter 0.06 and chamber absorption 0.25 ring too
  long, which produces the deep valleys, the resonant bump, the long
  pulse decay and the excess tonality.
- Change: loss_per_meter 0.06 -> 0.20; chamber absorption 0.25 -> 0.45.
- Result: KEEP. harmRMS 14.8 -> 12.3. Crest 12.3 -> 16.0. Pulse decay
  10.0 -> 6.2 ms. stft/mel slightly worse (see iteration 3).

## Iteration 2 (R8): exit damping

- Hypothesis: the h11-h12 bump (+20/+23 dB) is the tailpipe half-wave
  resonance (~800 Hz for the 0.3 m tip) ringing between a hard area
  step and a reflective open end. Real silencer exits lose energy to
  flow separation and the idle valve path.
- Change: new config knobs exit_loss 0.12 (extra tailpipe loss) and
  radiation_reflection 0.985 -> 0.96.
- Result: KEEP. harmRMS 12.3 -> 11.2; h11/h12 errors down 5/3 dB.

## Iteration 3 (R8): port jet turbulence noise

- Hypothesis: stft and mel distances degrade as the render gets
  cleaner; the reference has a broadband turbulence floor between
  harmonics (HNR 7.7 dB vs our 12-14 dB). Inject band-limited noise at
  each exhaust port scaled by the port jet dynamic pressure 0.5 rho u^2
  (a physical source, not output EQ).
- Change: flow_noise_gain swept 0.6 / 3.0 / 8.0 at idle.
- Result: PARTIAL KEEP (gain 3.0). At idle the jet is too slow for the
  mechanism to close the HNR gap (12.3 -> 12.0); it should matter at
  load. No metric got materially worse at gain 3.0.

## Iteration 4 (R8): silencer structure

- Hypothesis: the h4-h7 valley is the single expansion chamber's
  quarter-wave transmission notch (~335 Hz), and the h12 bump is the
  0.3 m tailpipe resonance. The real R8 box is multi-chamber and
  absorptive with short tips.
- Change: two staggered chambers (0.25 m and 0.38 m, absorption 0.5)
  joined by a 0.15 m pipe; tailpipe 0.3 -> 0.15 m.
- Result: KEEP. harmRMS 11.4 -> 8.96. mel 2.89 -> 2.78.

## Iteration 5 (R8): microphone and recording-chain model

- Hypothesis: the render is too bright (centroid 2445 vs 1349 Hz) even
  with exhaust-only ablation, and the reference lacks content below
  ~100 Hz. Both match the recording setup, not the engine: an off-axis
  microphone hears less high frequency (radiation directivity), and
  phone recorders cut low frequency. The project brief allows a
  microphone-position response in the output stage.
- Change: output.mic_highpass_hz / mic_lowpass_hz one-poles; calibrated
  90/1600, 140/1300, 180/1600, 140/2000; frozen at 140/1300.
- Result: KEEP. harmRMS 8.96 -> 8.18, stft 2.79 -> 1.86,
  mel 2.78 -> 1.94, centroid 1664 (ref 1349).
- Note: h1 stays +17 dB against the reference. A one-pole cannot make
  the reference's 67 Hz dip without destroying h2; likely destructive
  room interference in the recording. Do not chase it with EQ.

### Idle scoreboard after iterations 1-5

| metric | baseline | now | ref/target |
| --- | --- | --- | --- |
| harmRMS dB | 14.8 | 8.2 | < 3 |
| stft | 1.99 | 1.86 | targets.md |
| mel L1 | 2.69 | 1.94 | - |
| HNR dB | 14.6 | 11.9 | 7.7 |
| crest dB | 12.3 | 14.2 | 18.5 |
| centroid Hz | 2374 | 1675 | 1349 |

## Iteration 6 (R8): steepening rework (correctness fix)

- Symptom: firing frequency FAIL at 6000 rpm (16-20% error) and
  half orders above integer orders at load. Ablation: clean with
  steepening off.
- Cause: the whole-line delay modulation driven by the line's own
  output is an FM feedback loop; at load the modulation saturated its
  clamp and produced strong subharmonics. A softer clamp did not help.
- Change: feedforward Burgers-style correction after a static delay
  read: y = x + delta(x) * (x - x_prev), delta = tau0 * ((gamma+1)/2)
  * p / (rho c^2) samples, soft-saturated at 1.5 samples (shock
  formation). Periodic input stays periodic, so no subharmonics.
- Result: KEEP. 6000 rpm firing error 20% -> 0.003%, half orders
  +0.8 -> -4.9 dB, idle metrics unchanged. All pipes now use the fast
  static read path. Master gain recalibrated to 0.006 (8000 rpm WOT
  peaks at 0.66).

## Iteration 7 (R8): load-dependent cycle variation

- Hypothesis: the reference idle is rough and peaky (HNR 7.7 dB,
  crest 18.5 dB) because idle combustion is lean and slow, with high
  cycle-to-cycle variability; our fixed 4% variation is a warm-load
  number.
- Change: effective variation = cycle_variation * (1 +
  idle_variation_boost * (1 - manifold/ambient)); boost swept
  1.5 / 2.5 / 3.5, kept 3.5 (about 14% at idle, 4% at WOT).
- Result: KEEP. stft 1.86 -> 1.31 (target 1.20), mel 1.93 -> 1.71,
  HNR 11.9 -> 10.9, harmRMS 8.2 -> 7.67. Crest unchanged (13-14 vs
  18.5), still open.

## Iteration 6 (R8): steepening rework, first pass (correctness)

- Symptom: firing frequency FAIL at 6000 rpm (16-20% error), half
  orders above integer orders at load. Clean with steepening off.
- Cause: whole-line delay modulation driven by the line's own output is
  an FM feedback loop; at load it saturated its clamp and produced
  subharmonics. A soft clamp did not help.
- Change: static delay read plus a first-order Burgers term
  y = x + delta * (x - x_prev).
- Result: subharmonics gone (0.003% firing error at 6000 rpm), but see
  iteration 9: the Taylor form is a treble amplifier. Superseded.

## Iteration 7 (R8): load-dependent cycle variation

- Hypothesis: idle combustion is lean and slow with high variability;
  the fixed 4% variation is a load number. The reference idle is rough
  (HNR 7.7 dB) and ours too clean.
- Change: effective variation = cycle_variation * (1 + boost *
  (1 - manifold/ambient)); boost swept 1.5/2.5/3.5, kept 3.5
  (about 14% at idle, 4% at WOT).
- Result: KEEP. stft 1.86 -> 1.31, mel 1.93 -> 1.71, HNR 11.9 -> 10.9,
  harmRMS 8.2 -> 7.7 at the idle reference point.

## Iteration 8 (user listening feedback)

- The user heard: (a) a static high-pitch crunch at idle unrelated to
  rpm; (b) the rev demo muffled, like a vacuum cleaner; (c) wants a
  straight-piped configuration, banks merged in an X pipe.
- (a) was the fixed-frequency valvetrain tick band-pass plus too much
  port turbulence noise: valvetrain_gain 0.008 -> 0.002,
  flow_noise_gain 3 -> 1.
- (b) was the stock-silencer chambers plus the 1300 Hz microphone
  low-pass calibrated against the muffled stock recording.
- (c) configs/r8_v10_straight.json: no chambers, open tips, no mic
  low-pass. The stock-reference config r8_v10.json stays for the
  metric loop.

## Iteration 9 (R8): steepening as a true shifted read

- Symptom: straight-pipe idle centroid 5.3 kHz; sounds like a vacuum
  cleaner even unmuffled.
- Cause: the Taylor form of iteration 6 (y = x + delta * dx) has gain
  |1 + j delta omega| - it amplifies high frequencies on every
  traversal instead of time-shifting them.
- Change: re-read the delay line at the shifted position
  delay - softsat(k * x, 1.5 samples). Feedforward, bounded, periodic
  input stays periodic.
- Result: KEEP. Idle centroid 5348 -> 3051 Hz, 6000 rpm still clean
  (0.14% firing error, half orders -5.6 dB).

## Iteration 10 (R8): radiate d(exit flow)/dt, not mouth pressure

- Symptom: almost no energy below 300 Hz anywhere (2-4% of total).
- Cause: the radiation tap took the mouth pressure p+ + p-, which the
  open-end boundary condition forces toward zero at low frequency. The
  microphone actually hears the far-field of a monopole:
  p = rho/(4 pi r) * dQ/dt, and the mouth is a velocity antinode.
- Change: radiated = d/dt[(p+ - p-)], normalized to unity at 1 kHz.
- Result: KEEP (with iteration 11; alone it added highs too).

## Iteration 11 (R8): flow-dependent damping and duct HF loss

- Hypothesis: real exhaust resonances are damped by grazing mean flow
  (dominant loss in real systems, absent in the model), and the
  fixed-pitch 1-2 kHz duct resonances are the vacuum-cleaner whine.
  Separately, the per-traversal loss filter at 8 kHz barely touches
  1-5 kHz, so energy steepening pushes upward is never reabsorbed.
- Change: per-pipe gain exp(-flow_damping * M * L) updated from the
  mean exhaust mass flow (flow_damping 6); loss_cutoff_hz 8000 -> 2200
  on the straight-pipe config (swept 3000/1800/2200).
- Result: KEEP. Idle bands (20-100/100-300/300-800/800-2000 Hz):
  2/2/11/39% -> 12/11/42/33%; centroid 4335 -> 1260 Hz. At 6000 rpm
  94% of the energy sits in the firing-order band. Firing error 0.08%,
  half orders -3.9 dB.

## Iteration 12 (user listening feedback, round 2)

- The user still heard a vacuum-cleaner whine, a Geiger-counter idle
  and no explosive pulses ("an engine spinning with no power").
- Diagnosis with a new --dump mode (per-sample cylinder pressure, port
  wave, exit flow, radiated): the exit flow carries clean 66.7 Hz
  firing pulsation (86% of its energy below 100 Hz), but the radiated
  output was a continuous drone: under-damped 800-2000 Hz duct modes
  accumulate over many reflections and the d/dt radiation tap weights
  them up. Band comparison against the reference made it explicit:
  reference 57% at 100-300 Hz and 5% at 800-2000; the render had 65%
  at 800-2000.
- Fixes, all physics:
  - Idle spark retard (spark_advance_idle_deg 5, blending to full
    advance with load): combustion ends late at idle, the exhaust
    valve opens on higher pressure, each blowdown pops.
  - Exit reflection falls with mean-flow Mach ((1-M)/(1+M)^2) and a
    quadratic exit-jet loss gated by the instantaneous exit velocity.
  - Distributed nonlinear (turbulent) loss per pipe (pipe_nl_loss).
  - Per-traversal loss corner moved to 2000 Hz (stock) / 1400 Hz
    (straight): stands in for junction flow losses, thermal gradients
    and catalysts that the model lacks; the 800-2000 Hz share fell
    from 66% to 4-5% (stock).
  - Geiger sources muted: valvetrain ticks and port noise had
    fixed-pitch content unrelated to rpm.
- New first-class metrics in analyze.py: band_shares/band_l1 (energy
  balance the log-magnitude metrics under-weighted) and cycle_contrast
  (pulse-gated versus drone).

## Iteration 13 (R8): geometry search against the idle reference

- tools/geom_search.py: coordinate descent over runner/bank/mid/tail
  lengths, loss parameters and the recording high-pass, objective =
  harmonic RMS error + 10 * band-share L1 against the reference.
- Kept: runner scale 0.8 (0.32-0.35 m), bank pipes 0.245 m, mid 0.2 m,
  tail 0.15 m, loss_per_meter 0.35, loss corner 2000 Hz, recording
  high-pass 220 Hz. Objective 15+ -> 7.83; harmonic RMS error at the
  idle reference 8.0 -> 4.4 dB (target < 3).
- The straight-pipe config inherits the tuned header geometry (same
  physical parts), keeps open tips and no microphone low-pass.

## Iteration 14 (V6 renders exposed two load-path bugs)

- Rendering the Toyota 2GR-FE with the modern physics showed an
  INVERTED level ladder: idle louder than WOT redline. Chain dump:
  port waves scale correctly with load (+20 dB), but the exit AC flow
  at WOT was 4x SMALLER than at idle.
- Cause 1: grazing-flow damping applied to both travel directions.
  At WOT mean flow this stacked to roughly -30 dB across the network.
  Physically the mean flow attenuates upstream-traveling waves and
  barely touches downstream-traveling ones. Fix: directional flow
  gains (kDown = 0.15 kUp); flow_damping recalibrated to 3.
- Cause 2: pipe_nl_loss 20 and exit_nl_loss 30 were about 20x beyond
  the physical quadratic-resistance scale (zeta ~ 1); at WOT wave
  amplitudes they removed ~18 dB per traversal. Set to 1 and 3.
- Result: V6 RMS ladder now monotonic (-30.7 / -26.0 / -21.9 dB at
  650 / 3000 / 6400). The same fixes apply to both R8 configs.
- configs/2gr_fe.json modernized: idle spark retard, idle variation
  boost, duct loss corner 1600 Hz, directional flow damping, Geiger
  sources off, level recalibrated.

## Iteration 15 (user feedback: interference, Geiger idle, dynamics, pops)

- "Electronic interference at high revs": REAL DSP BUG. The grazing-flow
  gains and the exit convection factor stepped once every 64 samples,
  a 1500 Hz zipper modulation. Both now glide per-sample (~35 ms).
  Verified: the top spectral peaks at 6400 rpm are engine orders and
  cycle-rate sidebands only.
- "Geiger clicks, no rumble": the flat per-metre loss damped 100-300 Hz
  as hard as HF, but wall losses are physically tiny at low frequency.
  Flat loss cut to 0.08-0.12 on listening configs; the HF corner does
  the damping. The 100-300 Hz modes now ring a few cycles per pop.
- "Are you adding compression?": no dynamics processor exists; the
  soft limiter was engaging on peaks. Recalibrated so only the loudest
  overrun bangs touch it. The idle-to-WOT RMS span is still ~6-10 dB
  against a real ~25-30 dB; chain dumps show the remaining gap sits in
  the source span (port pulses +20 dB, real ~+30 dB) and the
  muffler-path attenuation of WOT harmonics. OPEN ITEM.
- NEW physics: deceleration fuel cut (DFCO, throttle < 6% above
  2200 rpm, resume below 1600) with stochastic late burns: popChance of
  cut cycles ignite 150-280 deg late with 0.5-1.5 x popHeat of a
  normal charge, while the exhaust valve is open. The pop travels
  through the normal gas path. Also fires when banging the limiter.
  Knobs: combustion.overrun_pop_chance / overrun_pop_heat.

## Iteration 16 (the Geiger signature, root-caused)

- The user uploaded the rejected idle render as a hard negative
  reference. Measurement: 62% of its energy below 100 Hz (inaudible on
  common playback), 2% at 100-300 Hz where a real engine's audible
  presence lives (the real R8 idle: 57%). The "Geiger" percept is the
  sparse >300 Hz residue of pulses whose body is inaudible.
- New isolation tool: --pulse-test injects one clean 5 ms pulse into
  runner 0 with the engine off and analyzes the radiated response.
  Bisection: full network passes 1% of the pulse energy at 150-300 Hz;
  without the two expansion chambers, 70%. The double-chamber reactive
  muffler annihilates the presence band - physically correct (a stock
  Camry idles near-silent), which made the stock-muffler demo config
  inherently lifeless.
- Fixes and findings on the way:
  - Chamber absorption is now frequency-dependent (packing absorbs
    high frequencies only); the broadband per-traversal loss multiplied
    over internal bounces and was unphysical.
  - Port reflection: a closed valve reflects ~0.8, not 1.0
    (exhaust.port_reflection); softens runner-stub combs.
  - Woschni-style wall-heat scaling with piston speed (idle P_EVO was
    already thermodynamically plausible; kept as correct physics).
  - Steepening shift cap raised from 1.5 samples (~100x below physical)
    to 12% of each line delay; cam lift gains a shape exponent
    (lift_shape_power 0.7) for a real crack-open ramp.
- The V6 demo config becomes a straight-through sports cat-back
  (no reactive chambers, loss corner 900 Hz):
  idle bands 7/61/23/8 vs the real car 16/57/18/5;
  pulse-character metric 4.8 vs the real recording 4.3;
  idle-to-WOT RMS span 19.4 dB (was ~6).
- New sanity gate in run_cycle.py ("presence_ok"): the lowest-rpm
  steady render must hold at least 20% of its energy at 100-300 Hz and
  at most 55% below 100 Hz. The rejected signature can no longer pass
  a cycle silently.
