# Design: signal flow and data structures

The sound is the pressure waveform radiated from the exhaust pipe exits
of a simulated engine. Nothing is sampled and nothing is an oscillator.
This file describes the flow from crank angle to output sample and the
main data structures. File references are relative to `src/`.

## Rates

- Output rate: 48 kHz (`output.sample_rate`).
- Internal rate: 96 kHz (`internal_oversample = 2`). Every physical
  subsystem runs at the internal rate. A 31-tap half-band FIR decimates
  to the output rate (`core/resampler.h`).

## Per-sample loop (core/engine.cpp, Engine::step)

1. Advance the crank: `cycleDeg += 6 * rpm * dt` (720-degree cycle).
2. Smooth the manifold pressure toward
   `ambient * (0.25 + 0.75 * throttle)` (time constant 50 ms).
3. Rev limiter: spark cut above `rev_limit_rpm` with 200 rpm hysteresis.
4. Waveguide phase 1: every pipe reads both of its delay lines
   (`beginSample` on the exhaust and intake systems).
5. For every cylinder (`core/cylinder.cpp`):
   - Volume and dV from the tabulated slider-crank curve.
   - Valve lift from the tabulated cam curves; effective area
     = Cd * valves * min(curtain, throat).
   - Port flow: solve `mdot = orifice(A, P_cyl, T_cyl, P_port(mdot))`
     with `P_port = base + 2 p_in + Z0 mdot / rho`. The choked branch is
     closed-form; the subsonic branch is a damped, warm-started fixed
     point. This coupling is implicit; a lagged version oscillated at
     Nyquist and compressed the dynamic range (see iteration log).
   - Wiebe heat release x(tau) = 1 - exp(-a tau^(m+1)) between spark
     and burn end; per-cycle variation of the heat and the duration.
   - Energy balance: dU = -P dV + dQ_comb - dQ_wall + sum(h dm).
   - Outputs: exhaust and intake mass flows.
6. Inject port flows into the runners: p+ = p- + Z0 U (+ turbulence
   noise scaled by the port jet dynamic pressure).
7. Waveguide phase 2: scatter all junctions, process the radiation
   ends (`finishSample`). The radiated pressure at the tailpipe exits,
   weighted by `tail_mix`, is the exhaust output. The intake plenum
   radiates through the throttle opening as the intake output.
8. Mechanical noise: valve events trigger short seeded noise bursts
   through a state-variable band-pass.
9. Mix, DC-block (5 Hz), microphone model (one-pole high/low-pass,
   models the reference recording setup), decimate, soft-limit
   (Pade tanh, after decimation so nothing can exceed full scale).

## Waveguide network (core/waveguide.*)

- `WaveguidePipe`: one duct = two delay lines (forward A->B, backward
  B->A), per-direction one-pole loss filter and broadband gain
  `exp(-loss_per_meter * L) * (1 - extra_loss)`. Delay
  `N = L * fs / c(T)`; c and rho come from the section's gas
  temperature, so hot runners are acoustically shorter than cold tails.
  Fractional delays: 3rd-order Lagrange when modulated, precomputed
  4-tap coefficients when static.
- Nonlinear steepening: the forward read position is modulated by the
  local wave amplitude, the discrete form of the amplitude-dependent
  speed c + ((gamma+1)/2) u. Compressions arrive early, fronts steepen,
  which produces crackle at load. Modulation is clamped at 22% of the
  line length.
- `Junction`: N-port parallel junction. p_J = 2 sum(Y_i p_i_in) /
  sum(Y_i), out_i = p_J - p_i_in, Y_i = S_i / (rho_i c_i). Area steps
  and collectors fall out of the admittances.
- `RadiationEnd`: open-end termination. Reflected = -g * LP(incoming),
  with the one-pole corner at ka = 1 (f = c / (2 pi a)). Low
  frequencies reflect almost fully with sign inversion; highs radiate.
  Radiated output = incoming + reflected. DC cannot radiate.

## Exhaust topology (core/exhaust_system.cpp)

Per-cylinder runners -> one collector junction per bank -> bank pipes.
Then either:
- single exit: Y junction -> mid pipe -> chambers (wide pipe sections
  with absorption; the area steps make the muffler notches) -> tailpipe
  -> radiation; or
- dual exit (`dual_exit: true`): X junction -> one full chain per bank
  -> two radiating tips, mixed by `tail_mix` (microphone position).

## Determinism and real-time safety

- One xorshift64* generator per consumer, all seeded from `--seed`.
  Two renders with the same seed are byte-identical.
- All buffers are sized in `init()`. `Engine::step` performs no
  allocation, no locking and no I/O (see docs/realtime_safety.md).

## Configuration

Everything physical lives in `configs/*.json` (SI units in the code,
mm/deg in the file where conventional). The `verification` block drives
`tools/run_cycle.py`: steady points, sweep, reference prefix.

## Upgrade path

If the waveguide ceiling is reached (metrics stall while the physics is
right), replace the runner waveguides with a 1D finite-volume Euler
solver at a higher internal rate (CFL-limited) and keep the junction
and radiation models. docs/research.md carries the details.
