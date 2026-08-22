# Research: Physics-Based Engine Sound Synthesis

This document collects reference material for a C++ re-creation of the
engine-audio approach in AngeTheGreat's "Engine Simulator"
(https://github.com/ange-yaghi/engine-sim). All source citations refer to the
`master` branch of that repository. File paths are relative to the repository
root. A local clone used for this study is at
`/home/user/ange-yaghi/engine-sim`.

The maintained fork https://github.com/Engine-Simulator/engine-sim-community-edition
contains **no source code**. It is a binary distribution repository for release
v0.1.14a and is marked as no longer actively maintained. The author closed the
source of later versions. All code study below therefore uses the original
repository.

Writing style note: this document follows ASD-STE100 rules. Sentences are
short. Each sentence gives one idea.

---

## 1. How engine-sim produces sound

### 1.1 Two clock domains

The program runs the physics at a low rate and the audio at 44100 Hz.

- The physics rate is `m_simulationFrequency`. The default is **10000 Hz**
  (`src/simulator.cpp:13`, `src/engine.cpp:39`). The engine script can change
  it (`es/objects/objects.mr:113`). The user can change it at run time with
  `N + scroll` (`src/engine_sim_application.cpp:753-760`).
- The audio rate is **44100 Hz**. The synthesizer input buffer, output buffer,
  and sample rate are all set to 44100 in `Simulator::initializeSynthesizer()`
  (`src/simulator.cpp:204-212`).

Each video frame, `Simulator::startFrame(dt)` computes the number of physics
steps: `steps = round(dt * simulationSpeed / timestep)`. A feedback loop then
adjusts the step count by about ±10% to hold the synthesizer input latency at
a target of **0.1 s** (`src/simulator.cpp:64-93`). This loop replaces exact
clock synchronization between the physics thread and the audio thread.

### 1.2 One physics step

`Simulator::simulateStep()` (`src/simulator.cpp:95-153`) does, per step:

1. `m_system->process(timestep, 1)` — one step of the rigid-body constraint
   solver from `ange-yaghi/simple-2d-constraint-solver` (`atg_scs`). The
   default configuration is `OptimizedNsvRigidBodySystem` with a
   `GaussSeidelSleSolver` (`src/simulator.cpp:29-43`). The crank train is a
   true 2D rigid-body system, not a kinematic formula. Each cylinder adds:
   a `LineConstraint` (piston stays on the bore axis), two `LinkConstraint`
   pins (piston–rod, rod–crank journal), and the crankshaft gets a
   `FixedPositionConstraint` plus a `RotationFrictionConstraint`
   (`src/piston_engine_simulator.cpp:52-186`). Constraint stiffness is
   `ks = 5000`, damping `kd = 10`. Gas pressure enters the solver as an
   external force generator: `CombustionChamber::apply()` pushes
   `F = -A * (P_cyl - P_crankcase)` plus a Stribeck-type friction force onto
   the piston body (`src/combustion_chamber.cpp:404-435`).
2. Engine, vehicle, and transmission updates.
3. `simulateStep_()` — combustion and gas flow (see below).
4. `writeToSynthesizer()` — one audio-input sample per physics step.

Inside `PistonEngineSimulator::simulateStep_()`
(`src/piston_engine_simulator.cpp:283-321`), the gas-flow network runs with
**8 sub-steps per physics step** (`m_fluidSimulationSteps = 8`,
`src/piston_engine_simulator.cpp:26`). The effective fluid rate is therefore
80000 Hz at the default settings.

### 1.3 What signal is sent to the synthesizer

This is the most surprising part. The synthesizer input is **not** the
cylinder pressure. `PistonEngineSimulator::writeToSynthesizer()`
(`src/piston_engine_simulator.cpp:370-413`) builds one scalar per exhaust
system per physics step:

```
pulse_i = attenuation^3 * 1600 * (
            (P_runnerAndPrimary - P_atm)
          + 0.1 * dynamicPressure(+x)
          + 0.1 * dynamicPressure(-x) )
```

- `P_runnerAndPrimary` is the static pressure of the 0-D gas volume that
  lumps the exhaust port, runner, and header primary for that cylinder
  (`m_exhaustRunnerAndPrimary`, set up in `src/combustion_chamber.cpp:94-109`).
- `attenuation = min(|engine speed rad/s|, 40) / 40`, cubed. This mutes the
  audio while the engine cranks slowly.
- The pulse then passes a per-cylinder `DelayFilter` — a plain sample delay of
  `(headerPrimaryLength + exhaustLength) / 343 m/s` seconds at the input rate
  (`src/piston_engine_simulator.cpp:220-227`, `include/delay_filter.h`).
  This is a one-way acoustic transport delay. There is no reflection and no
  waveguide in engine-sim.
- The delayed pulse is scaled by
  `soundAttenuation * audioVolume / cylinderCount * 1/exhaustLength^2` and
  summed into one channel per exhaust system
  (`src/piston_engine_simulator.cpp:405-409`).

So: each exhaust system is one mono channel. The channel signal is a train of
low-pass-ish pressure pulses at the simulation rate.

### 1.4 Resampling from simulation rate to audio rate

`Synthesizer::writeInput()` (`src/synthesizer.cpp:168-195`) is called once per
physics step. It advances a fractional write offset by
`audioSampleRate / inputSampleRate` (about 4.41 at defaults) and writes the
missing audio-rate samples by **linear interpolation** between the previous
input value and the new one. Each interpolated sample passes a per-channel
4th-order Butterworth low-pass called `antialiasing` — but its cutoff is set
to **1900 Hz** (`src/synthesizer.cpp:73`), far below Nyquist of either rate.
The deterministic pulse train that reaches the audio path is therefore band
limited to roughly 2 kHz. Everything above that in the final sound comes from
noise processes and the convolution reverb (next section). The Butterworth
filter itself is a direct bilinear-transform 4th-order design
(`include/butterworth_low_pass_filter.h`).

### 1.5 The audio-rate processing chain (per output sample)

`Synthesizer::renderAudio(int)` (`src/synthesizer.cpp:281-331`) runs on a
dedicated audio thread in chunks of at most 2000 samples
(`src/synthesizer.cpp:222-256`). Per channel, per 44.1 kHz sample:

1. **Jitter filter** (`include/jitter_filter.h`). The sample is read back from
   a 10-sample history at a random fractional position. The random position is
   uniform noise, scaled by `inputSampleNoise = 0.5`, then low-passed by a
   Butterworth at `inputSampleNoiseFrequencyCutoff = 10000 Hz`, then read with
   linear interpolation. This is random micro-modulation of delay. It
   decorrelates the periodic pulse train and adds "roughness".
2. **DC removal**: a one-pole low-pass at 10 Hz produces the DC estimate,
   which is subtracted: `f = f_in - LP10(f_in)` (`src/synthesizer.cpp:294-295`).
3. **Derivative**: `f_p = (f_in - f_in[n-1]) / dt` (`include/derivative_filter.h`).
4. **Air noise modulation**: white noise is low-passed by a Butterworth at
   `airNoiseFrequencyCutoff = 2000 Hz`, then mixed:
   `r_mixed = airNoise * r + (1 - airNoise)` with `airNoise = 1.0`. The
   signal becomes:

   ```
   v_in = dF_F_mix * f_p + (1 - dF_F_mix) * f * r_mixed,   dF_F_mix = 0.01
   ```

   So the dominant path is the band-limited pulse train **amplitude-modulated
   by low-passed noise**. The derivative path is a 1% high-frequency
   "presence" term (`src/synthesizer.cpp:296-309`).
5. **Convolution**: `v = convolution * IR(v_in) + (1 - convolution) * v_in`
   with `convolution = 1.0`. The IR is a measured exhaust impulse response
   loaded from a 16-bit WAV (`es/sound-library/impulse_responses.mr`, e.g.
   `smooth/smooth_39.wav`, volume 0.001). It is truncated to at most **10000
   taps** at the last sample with |x| > 100 (`src/synthesizer.cpp:86-105`).
   The convolution is a direct time-domain FIR with a circular shift register
   — O(N) multiplies per sample, no FFT (`src/convolution_filter.cpp`). This
   is the main spectral shaper of the final sound.
6. Channels are summed. The sum passes one more 4th-order Butterworth at
   `0.45 * fs` (a true anti-alias guard, `src/synthesizer.cpp:79`).
7. **Leveling filter (AGC)** (`src/leveling_filter.cpp`): a peak tracker with
   decay 0.999 per sample computes `attenuation = target / peak`, clamped to
   [1e-5, 1.9], smoothed by `a = 0.9*a + 0.1*a_new`. Target level is 30000
   (near the int16 limit of 32767). This normalizes loudness across engines.
8. Multiply by user volume, round, clamp to int16.

### 1.6 Pipeline summary

```
cylinder gas (0-D)             10 kHz physics, 80 kHz fluid substeps
  -> exhaust runner+primary volume (0-D)
  -> collector volume (0-D) -> atmosphere
  runner pressure deviation --> gain, speed ramp
  -> pure transport delay (L / 343 m/s)
  -> per-exhaust mono channel @ 10 kHz
  -> linear-interp upsample to 44.1 kHz + 4th-order Butterworth @ 1900 Hz
  -> random fractional-delay jitter (10 kHz noise BW)
  -> DC block (10 Hz) ; + 1% derivative
  -> x (low-passed white noise @ 2 kHz)      [amplitude modulation]
  -> FIR convolution with measured exhaust IR (<= 10000 taps, direct form)
  -> sum channels -> Butterworth @ 0.45 fs
  -> AGC leveler (target 30000) -> volume -> int16
```

Design lesson: engine-sim gets its "character" mostly from (a) correct pulse
timing and amplitude from the physics, and (b) a measured impulse response
plus noise modulation. The acoustic tube itself is only a delay. A digital
waveguide exhaust (sections 4–6) is the natural upgrade and replaces both the
`DelayFilter` and part of the convolution IR with physics.

---

## 2. Cylinder thermodynamics and combustion

### 2.1 The Wiebe function (standard practice)

Standard engine-cycle codes model the mass fraction burned with the Wiebe
function:

```
x_b(theta) = 1 - exp( -a * ((theta - theta_0) / dtheta)^(m+1) )
```

- `theta_0` = start of combustion, `dtheta` = total burn duration.
- Typical efficiency parameter `a ≈ 5` (gives x_b ≈ 0.993 at theta_0+dtheta).
- Typical form factor `m ≈ 2`.
- Source: https://www.sciencedirect.com/topics/engineering/wiebe-function
  (typical values a = 5, m = 2 for SI engines).

The heat-release rate follows by differentiation:

```
dQ/dtheta = Q_total * a * (m+1) / dtheta * y^m * exp(-a * y^(m+1)),
y = (theta - theta_0) / dtheta
```

Typical SI values: 10–90% burn duration of roughly 20–40 crank degrees at
mid load; total (0–100%) durations of 40–70 degrees are common inputs
(https://www.sciencedirect.com/topics/engineering/wiebe-function,
https://www.sae.org/publications/technical-papers/content/2021-01-0379/).
Cycle-to-cycle variation in SI engines shows up as COV of IMEP of a few
percent at normal operation (roughly 1–5%; higher near lean/dilute limits).
For sound, the audible effect is per-cycle variation of peak pressure and
burn phasing. A simple model perturbs `a`, `dtheta`, or an efficiency factor
per cycle with a few-percent random spread.

### 2.2 What engine-sim does instead

engine-sim does **not** use a Wiebe function. It uses a geometric flame model
plus a 0-D energy-based gas state.

**Gas state** (`include/gas_system.h`, `src/gas_system.cpp`): each volume
stores moles `n`, thermal energy `E_k`, volume `V`, a 2-D bulk momentum
vector, and mole fractions {fuel, O2, inert}. Derived quantities:

```
P = E_k / (0.5 * DOF * V)
T = E_k / (0.5 * DOF * n * R)
gamma = 1 + 2 / DOF          (DOF = 5 -> gamma = 1.4)
```

Compression work uses `dE = -P dV` through an approximate surface term
(`GasSystem::changeVolume`, `src/gas_system.cpp:45-54`).

**Ignition** (`CombustionChamber::ignite`, `src/combustion_chamber.cpp:169-224`):
ignition only starts if the equivalence ratio is between about 0.5 and 1.9.
A per-event burn efficiency is drawn with a random factor
(`burningEfficiencyRandomness` from the fuel definition). This is the
cycle-to-cycle variation mechanism, and it directly creates the audible
pulse-to-pulse level variation.

**Flame propagation** (`CombustionChamber::flow`,
`src/combustion_chamber.cpp:315-354`): a cylindrical flame front grows in
radius and height at `flameSpeed`. The newly swept volume fraction of the
charge reacts each sub-step:

```
25 O2 + 2 C8H16 -> 16 CO2 + 18 H2O        (src/gas_system.cpp:91-95)
dE = m_fuel_burned * energyDensity
```

**Flame speed** (`src/fuel.cpp:37-66`): laminar burning velocity follows a
Metghalchi–Keck-style correlation for gasoline:

```
S_L0 = B_m + B_phi * (phi - phi_m)^2,  B_m = 30.5 cm/s, B_phi = -54.9 cm/s, phi_m = 1.21
S_L  = S_L0 * (T / 298 K)^alpha * (P / 1 atm)^beta
alpha = 2.4 - 0.271 * phi^3.51
beta  = -0.357 + 0.14 * phi^2.77
```

The turbulent speed is `S_T = f(u' / S_L) * S_L` where `f` is a lookup table
keyed by mean piston speed (`turbulence_to_flame_speed_ratio`).

**Wall heat loss**: a crude Newton term toward 90 °C with a fixed coefficient
(`m_system.changeEnergy(dT * A * 100 * dt)`, `src/combustion_chamber.cpp:246-248`).

**Recommendation for the re-creation**: a Wiebe-based heat release is simpler
than engine-sim's flame model, is standard, and is fully sufficient for
sound. Keep engine-sim's per-cycle random efficiency idea. Map load and rpm
to `dtheta` (longer at low load and high rpm in crank-angle terms).

---

## 3. Valve flow model

### 3.1 Isentropic orifice equations (standard form)

Mass flow through a restriction with effective area `A_e`, upstream stagnation
pressure `p0`, upstream stagnation temperature `T0`, ratio `pr = p_down / p0`:

Subsonic regime (`pr > pr_crit`):

```
mdot = A_e * p0 / sqrt(R T0) * pr^(1/gamma)
       * sqrt( 2 gamma / (gamma - 1) * (1 - pr^((gamma-1)/gamma)) )
```

Choked regime (`pr <= pr_crit`):

```
pr_crit = (2 / (gamma + 1))^(gamma / (gamma - 1))     (= 0.5283 for gamma = 1.4)
mdot = A_e * p0 / sqrt(R T0) * sqrt(gamma) * (2/(gamma+1))^((gamma+1)/(2(gamma-1)))
```

Reference formulation: Heywood, *Internal Combustion Engine Fundamentals*,
ch. 6 (valve flow); an accessible summary is at
https://www.sciencedirect.com/topics/engineering/wiebe-function 's parent
work and in any 1-D engine code documentation, e.g. OpenWAM
(https://openwam.webs.upv.es/docs/).

Effective area versus lift `l`, valve diameter `d_v`:

```
A_curtain = pi * d_v * l                     (low lift)
A_throat  = pi/4 * (d_p^2 - d_stem^2)        (port throat)
A_e = Cd(l) * min(A_curtain, A_throat)
```

`Cd` is measured on a flow bench, usually at 28 inches of water depression,
and typically falls from ~0.9 at very low `l/d` to ~0.55–0.7 at high lift.

### 3.2 engine-sim's implementation

`GasSystem::flowRate()` (`src/gas_system.cpp:183-229`) implements exactly the
two-regime isentropic orifice model in molar form:

```
n_dot = k_flow * p0 / sqrt(R T0) * PHI(pr, gamma)
PHI_choked  = sqrt(gamma) * (2/(gamma+1))^((gamma+1)/(2(gamma-1)))
PHI_subsonic= sqrt( 2 gamma/(gamma-1) * s * (s - pr) ),  s = pr^(1/gamma)
```

Note `s*(s - pr) = pr^(2/gamma) - pr^((gamma+1)/gamma)`, the standard form.
Flow direction flips with the sign of the pressure difference. The upstream
side supplies `T0` and `p0`.

`k_flow` plays the role of `Cd * A / sqrt(M)` in one constant. engine-sim
calibrates it from flow-bench numbers: `GasSystem::k_28inH2O(scfm)` inverts
the same equations at 1 atm, 28 inH2O depression, 25 °C
(`src/gas_system.cpp:163-171`). Valve lift maps to `k_flow` through a
piecewise-linear lookup: `CylinderHead::exhaustFlowRate(cyl) =
m_exhaustPortFlow->sampleTriangle(exhaustValveLift(cyl))`
(`src/cylinder_head.cpp:56-59`). So there is no explicit `Cd(l) * pi d l`
formula. The lift-to-flow table is authored per engine in the `.mr` script.

Stability guards: per sub-step, the transferred moles are clamped to
`0.9 * n_source` and compared against the analytic pressure-equilibrium
maximum (`pressureEquilibriumMaxFlow`, `src/gas_system.cpp:556-592`), so a
large `dt * n_dot` cannot overshoot the equalization point and oscillate.
The flow routine also advects bulk momentum between volumes and clamps the
implied port velocity to the local speed of sound
(`src/gas_system.cpp:452-476`), then `dissipateExcessVelocity()` converts
super-sonic bulk velocity back into heat (`src/gas_system.cpp:261-281`).

**Recommendation**: implement the same two-regime molar flow function. Use
`A_e(l) = Cd(l) * min(pi d_v l, A_throat)` with a small `Cd` table, and keep
the equilibrium clamp — it is what lets engine-sim take large sub-steps
without blowup.

---

## 4. Exhaust acoustics with digital waveguides

Primary reference: J. O. Smith, *Physical Audio Signal Processing*, online
book, https://ccrma.stanford.edu/~jos/pasp/ (chapters "Digital Waveguide
Models", "Kelly-Lochbaum Scattering Junctions", "Lagrange Interpolation",
"Thiran Allpass Interpolators"). The site was not reachable from this
environment (egress blocked), so equations below are restated from the
standard literature; they match Smith's formulation.

### 4.1 Bidirectional delay lines

The lossless 1-D wave equation has the d'Alembert solution
`p(x,t) = p+(t - x/c) + p-(t + x/c)`. Sampling at audio rate `fs` and spatial
step `X = c/fs` turns each direction into a pure delay line. A tube section of
length `L` becomes two delay lines of

```
N = L * fs / c        samples (each direction)
```

For an exhaust at ~500 K, `c = sqrt(gamma R_specific T) ≈ 448 m/s`; a 3 m
system at 48 kHz gives N ≈ 321 samples per direction. Pressure and volume
velocity relate through the characteristic acoustic impedance of the section:

```
Z = rho * c / S         (S = cross-section area)
p = p+ + p-,   U = (p+ - p-) / Z
```

### 4.2 Scattering at area discontinuities (Kelly–Lochbaum)

At a junction of two sections with impedances Z1, Z2 (areas S1, S2):

```
k = (Z2 - Z1) / (Z2 + Z1) = (S1 - S2) / (S1 + S2)
p1- = -k * p1+ + (1 - k) * p2-        (reflected into section 1)
p2+ =  (1 + k) * p1+ + k * p2-        (transmitted into section 2)
```

One multiply is enough in the normalized one-multiply form. An expansion
(S2 > S1) gives k > 0 with an inverting reflection for the pressure wave
entering the expansion — this is what makes a collector/muffler entry
acoustically active.

### 4.3 K-branch junction (collector with K pipes)

For K sections meeting at one point, with admittances `Y_i = S_i / (rho c)`
(all `c` equal), continuity of pressure and conservation of flow give the
junction pressure and the outgoing waves:

```
p_J  = 2 * ( sum_i Y_i * p_i+ ) / ( sum_i Y_i )
p_i- = p_J - p_i+
```

where `p_i+` is the wave arriving at the junction from section i and `p_i-`
is the wave sent back into section i. For K = 2 this reduces to the
Kelly–Lochbaum equations. This is the exact junction needed for a V6 header:
3 primaries + 1 collector = a 4-branch junction per bank.

### 4.4 Losses

Viscothermal losses in a rigid tube (Kirchhoff wide-tube regime) give a
per-meter attenuation that grows as sqrt(frequency):

```
alpha(omega) ≈ (1 / (a c)) * sqrt(nu * omega / 2) * (1 + (gamma - 1)/sqrt(Pr))
```

with tube radius `a`, kinematic viscosity `nu`, Prandtl number `Pr`
(standard result; see e.g. the radiation/duct acoustics literature such as
https://www.sciencedirect.com/science/article/abs/pii/S0022460X08009085 and
JOS PASP "wall losses"). In a waveguide, lump the distributed loss of a whole
section into one filter at the section end (losses commute with delay in an
LTI chain). Practical choice: a one-pole low-pass with a gain:

```
H_loss(z) = g * (1 - b) / (1 - b z^-1)
```

Fit `g` to the total attenuation at low frequency (near 1; e.g. 0.98–0.995
per section) and `b` to match the extra attenuation at a chosen high
reference frequency (b typically 0.05–0.3 for short exhaust sections). This
is the standard Karplus–Strong/waveguide loss treatment. Hot exhaust gas has
high `nu`, so losses are stronger than in cold air; fitting to measured decay
is more honest than computing from first principles.

### 4.5 Fractional delay

`N = L fs / c` is not an integer, and `c` changes with gas temperature, so the
delay must be fractional and time-varying. Options:

- **Lagrange FIR interpolation** (order 1 = linear, orders 3–5 common).
  Coefficients for delay `D` (order M): `h[n] = prod_{k != n} (D - k)/(n - k)`.
  Pros: always stable, coefficients cheap to update every sample, no
  transient when `D` changes. Cons: low-pass magnitude error near Nyquist;
  best accuracy needs `D ≈ M/2 + integer`, so keep the fractional part
  centered.
- **Thiran allpass** (order M, maximally flat group delay):
  `a_k = (-1)^k C(M,k) prod_{n=0..M} (D - M + n)/(D - M + k + n)`.
  Pros: unity magnitude at all frequencies (no damping error, important for
  resonant tubes). Cons: phase error at high frequency; coefficient changes
  excite transients, so it suits slow smooth modulation only.
- Reference: J. O. Smith, PASP, "Delay-Line Interpolation" chapters
  (https://ccrma.stanford.edu/~jos/pasp/Delay_Line_Interpolation.html);
  Välimäki, *Discrete-Time Modeling of Acoustic Tubes Using Fractional Delay
  Filters* (1995), http://users.spa.aalto.fi/vpv/publications/vesa_phd.html.

**Recommendation**: 3rd-order Lagrange for the exhaust lines. Temperature (and
thus `c` and `N`) changes slowly; Lagrange handles the modulation without
transients, and the slight high-frequency droop merges into the loss filter
budget.

---

## 5. Radiation termination (open tailpipe)

### 5.1 Levine–Schwinger key results

Levine and Schwinger solved radiation from an unflanged circular pipe exactly
(H. Levine, J. Schwinger, "On the radiation of sound from an unflanged
circular pipe", Physical Review 73, 383–406, 1948,
https://doi.org/10.1103/PhysRev.73.383; reference list entry:
https://www.scirp.org/reference/referencespapers?referenceid=89602).

Key low-frequency results for a pipe of radius `a`, wavenumber `k`:

- Normalized radiation impedance (plane-wave mode):
  `Z_r / (rho c / S) ≈ (ka)^2 / 4 + j * 0.6133 * ka` for small `ka`.
- **End correction**: the pipe behaves as if longer by
  `delta = 0.6133 * a` as `ka -> 0`. The correction falls with frequency
  (to about 0.4 a near ka ≈ 3)
  (https://www.researchgate.net/figure/End-correction-coefficient-for-unflanged-circular-duct-FE-predictions-Levine-and_fig8_224911928).
- **Reflection coefficient**: `R(omega) = -|R| e^{-2 j k delta(ka)}`.
  Magnitude expansion for small ka: `|R| ≈ 1 - (ka)^2 / 2`. |R| decreases
  monotonically with ka in the plane-wave range; the model is valid below the
  first higher-order duct mode at ka = 1.841.
- The minus sign matters: an open end reflects a compression as a
  rarefaction. This inversion, applied to the engine's exhaust pulse, is the
  physical origin of scavenging tuning and of the "burble" interaction.

Modern fitted formulas for both |R|(ka) and delta(ka) exist in:
F. Silva et al., "Approximation formulae for the acoustic radiation impedance
of a cylindrical pipe", J. Sound and Vibration (2009),
https://www.sciencedirect.com/science/article/abs/pii/S0022460X08009085 —
these fits guarantee Hermitian symmetry and a causal impulse response, and
are directly usable as continuous-time prototypes for IIR fitting. See also
Dalmont, Nederveen, Joly, "Radiation impedance of tubes with different
flanges", JSV (2001),
https://www.sciencedirect.com/science/article/abs/pii/S0022460X00934874.

### 5.2 Practical IIR approximation for a waveguide

Target frequency response for the reflection filter seen by the tailpipe
delay line:

```
R(omega) = -|R|(ka) * exp(-2 j k delta(ka)),   k = omega / c,  a = pipe radius
```

A robust two-step recipe:

1. Put the bulk of the phase into the delay line: extend the tailpipe line by
   `round(2 * 0.6133 * a * fs / c)`-sample round-trip equivalent, i.e. add
   `0.6133 * a` to the physical length L before computing N. (The factor 2
   round trip is automatic when the one-way length includes delta.)
2. Fit the remaining magnitude with a first-order IIR low-pass with negative
   gain:

```
R(z) = -g * (1 - b) / (1 - b z^-1)
```

   Choose `g = |R|(ka -> 0) ≈ 0.995` (not exactly 1; keeps the loop passive)
   and choose `b` so that the filter magnitude equals the Levine–Schwinger
   |R| at a mid reference frequency, e.g. ka = 1:

```
|H(e^{j w1})| = g (1-b) / sqrt(1 - 2 b cos w1 + b^2)  =  |R|_LS(ka=1)
```

   Solve the quadratic in `b` (one real root in (0,1)). For a 50 mm tailpipe
   (a = 0.025 m) at c = 450 m/s, ka = 1 sits at f = c/(2 pi a) ≈ 2.9 kHz.
   A second-order fit (one pole pair or two real poles, least-squares over
   the band ka in [0, 1.8], e.g. with an `invfreqz`-style solver against the
   Silva et al. formulas) reduces the magnitude error to under ~1% if needed.
3. Passivity check: require `|R(e^{jw})| <= 1` for all w. A pure low-pass with
   g < 1 satisfies this by construction.

The transmitted (radiated) signal — what the listener hears — is the
complement: `T(z) = 1 + R(z)` applied to the outgoing wave at the pipe mouth
(pressure at the opening), optionally followed by a differentiator-like
+6 dB/oct tilt because far-field radiation from a small source is
proportional to the time derivative of the volume flow (monopole radiation:
`p_far(t) ≈ rho/(4 pi r) * dU/dt`). This replaces engine-sim's `dF_F_mix`
derivative hack with physics.

---

## 6. Nonlinear wave steepening

### 6.1 Physics

For a rightward simple wave in a perfect gas, each wavelet moves at

```
dx/dt = u + c = c0 + ((gamma + 1) / 2) * u
```

because the local sound speed is `c = c0 + ((gamma - 1)/2) u` and the wavelet
rides on the flow `u`. High-pressure (high-u) parts travel faster, overtake
the front, and steepen it. For an initially sinusoidal velocity wave of
amplitude `u0` and angular frequency `omega`, the shock-formation distance is

```
x_s = c0^2 / (beta * omega * u0),   beta = (gamma + 1) / 2
```

Engine exhaust pulses have p' of order 0.1–1 bar, so `u0` is tens of m/s and
`x_s` is of order 1 m — the same length as the exhaust. Steepening is
therefore audible: it converts smooth pressure pulses into "crackly" sharp
fronts at high load. Documented in brass acoustics: A. Hirschberg,
J. Gilbert, R. Msallam, A. P. J. Wijnands, "Shock waves in trombones",
J. Acoust. Soc. Am. 99(3), 1754–1758 (1996),
https://doi.org/10.1121/1.414698.

### 6.2 Discrete-time approximations used in physical modelling

- **Amplitude-dependent (signal-driven) fractional delay.** Split the tube
  into short waveguide sections. In each section, read the delay line with a
  fractional delay that depends on the sample's own amplitude:
  `D_eff = D0 * c0 / (c0 + beta * u_hat)` where `u_hat` is the local wave
  amplitude converted to velocity (`u = p+ / Z / S` scaling). Over many
  sections this approximates simple-wave distortion. This is the method of
  the trombone models: R. Msallam, S. Dequidt, R. Caussé, S. Tassart,
  "Physical model of the trombone including nonlinear effects; application to
  the sound synthesis of loud tones", Acta Acustica united with Acustica 86
  (2000) 725–736,
  https://www.ingentaconnect.com/content/dav/aaua/2000/00000086/00000004/art00017.
- **Truncated-Burgers / frequency-domain step.** Propagate the outgoing wave
  through a memoryless nonlinear substitution step per section
  (lossless Burgers step: `u(x + dx) = u(tau + beta u dx / c0^2)`), applied
  via resampling of the section output. Equivalent to the above; needs a
  guard against multivalued (post-shock) solutions — clip by taking the
  steepest monotone solution (equal-area rule approximated by min/max
  limiting).
- **Cheap approximation.** One global waveshaper plus a level-dependent
  low-pass-to-high-pass tilt. No propagation physics, but usable as a first
  step: drive brightness from pulse amplitude.

**Recommendation**: implement 4–8 waveguide sections per exhaust run with
per-sample amplitude-modulated fractional delay (Lagrange). Keep `beta u / c0`
small per section (< 0.05) so the delay modulation stays well-conditioned.

---

## 7. Upgrade path: 1-D finite-volume Euler

If the waveguide (linear acoustics + weak nonlinearity) proves insufficient,
the reference method is a 1-D compressible Euler solver on the duct, the
descendant of the method of characteristics (MOC) used by Benson for engine
ducts. MOC background and modern practice: OpenWAM, the open-source 1-D
gas-dynamics engine code from CMT/UPV, initially based on Benson's MOC work,
later moved to finite volumes (https://openwam.webs.upv.es/docs/); overview
of 1-D intake/exhaust gas dynamics: https://doi.org/10.3390/jmse8121036 and
https://journals.sagepub.com/doi/10.1243/14680874JER01008 (boundary
conditions for 1-D engine duct flows).

Equations (area-varying duct, conservative form):

```
d/dt [rho S, rho u S, rho E S] + d/dx [rho u S, (rho u^2 + p) S, (rho E + p) u S]
   = [0, p dS/dx, -q_wall - friction]
```

Explicit schemes (Lax–Wendroff, HLLC/Rusanov FV, TVD limiters) require the
CFL condition:

```
dt <= CFL * dx / max(|u| + c),   CFL ~ 0.5–0.9
```

Cost example: L = 3 m, dx = 5 mm gives 600 cells; with |u| + c ≈ 700 m/s,
dt ≈ 5e-6 s, so ~200 k steps per second of audio for one duct — feasible but
about 100x the waveguide cost, and the audio band demands small dx (at least
~10 cells per wavelength at 10 kHz: dx <= 4.5 mm at c = 450 m/s).

When it becomes necessary:

- Pressure ratios across the pulse above roughly 1.5–2 (strong shocks), where
  amplitude-modulated delay lines lose accuracy.
- Strong mean flow (Mach > ~0.3) where convection detunes the tube
  asymmetrically (downstream and upstream delays differ: L/(c+u) vs L/(c-u)).
  A waveguide can still fake this with unequal delays per direction.
- Large temperature gradients along the pipe (c varies with x); a waveguide
  handles this only piecewise.
- Complex silencer internals (perforates, plug flow) where measured or
  lumped models fail.

**Recommendation**: keep the FV Euler as a later, offline-validated upgrade.
Start with the waveguide; keep the exhaust module behind an interface so the
duct model is swappable.

---

## 8. Toyota 2GR-FE parameters

| Parameter | Value | Source |
|---|---|---|
| Configuration | 60° V6, 3456 cc, DOHC 24v, dual VVT-i | https://www.motorreviewer.com/engine.php?engine_id=129 |
| Firing order | **1-2-3-4-5-6** (Toyota factory spec) | https://workshop-manuals.com/toyota/camry/v6-3.5l_(2gr-fe)/powertrain_management/tune-up_and_engine_performance_checks/firing_order/component_information/specifications/ |
| Cylinder numbering | Cylinders 1-3-5 on Bank 1; cylinders 2-4-6 on Bank 2 | https://www.justanswer.com/toyota/6bepz-toyota-avalon-touring-bank-cat-failed-inspection.html |
| Bank placement (transverse FWD installs: Camry, Venza, RX350, Sienna) | Bank 1 (cyl 1-3-5) is the **rear bank, firewall side**; Bank 2 (cyl 2-4-6) faces the radiator | https://www.justanswer.com/toyota/6bepz-toyota-avalon-touring-bank-cat-failed-inspection.html and https://www.fixya.com/cars/t19129691-firing_order_3_5l_v6_2gr_fe |
| Crank / firing intervals | Even firing every 120°; a 60° V6 needs adjacent crank pins splayed (offset) to reach even 120° intervals | https://www.eng-tips.com/threads/why-is-60-degrees-the-preferred-bank-angle-for-a-v6-and-90-for-a-v8.407482/ |
| Rotation | Clockwise, seen from the front of the engine (accessory side) | https://enginetechspecs.com/toyota_2gr_fe_technical_data.html |
| Bore | 94.0 mm | https://www.motorreviewer.com/engine.php?engine_id=129 |
| Stroke | 83.0 mm | https://www.motorreviewer.com/engine.php?engine_id=129 |
| Compression ratio | 10.8:1 | https://www.motorreviewer.com/engine.php?engine_id=129 |
| Connecting rod length (center-to-center) | 147.5 mm (stock) | https://www.monkeywrenchracing.com/product/mwr-forged-connecting-rods-6-toyota-2gr-fe/ and https://henchrods.com/shop/2gr-i-beam-forged-connecting-rods-for-toyota-2gr-fe-2gr-147-5mm-one-set/ |
| Redline, Toyota/Lexus applications (Camry, RX350, Highlander) | ~6200–6800 rpm depending on application; peak power at 6200 rpm | https://cararac.com/blog/lexus-rx-3-5-engine-problems-durability.html and https://www.motorreviewer.com/engine.php?engine_id=129 |
| Redline, Lotus Evora (2GR-FE, Lotus-adapted) | 7000 rpm rev limit (raised in Sport mode); Evora S peak power at 7000 rpm | https://wiki.seloc.org/a/Toyota_engines and https://en.wikipedia.org/wiki/Lotus_Evora |

Notes on conflicts and cautions:

- **Firing order**: multiple Toyota factory-manual mirrors agree on
  1-2-3-4-5-6. With cylinders 1-3-5 on one bank and 2-4-6 on the other, this
  order alternates banks on every firing event (R-L-R-L-R-L every 120°).
  This alternation is the main low-frequency signature of the exhaust note
  when the banks have separate exhaust paths.
- **Bank sides**: "left/right" statements conflict between sources because
  they depend on the viewing direction. The stable statements are:
  Bank 1 = the bank containing cylinder 1 = the firewall (rear) bank in
  transverse installations; Bank 2 = the radiator-side (front) bank. In the
  mid-engined Lotus Evora the same engine sits behind the driver, so
  front/rear labels flip relative to the car even though bank identity does
  not.
- **Redline**: sources conflict. One aggregator claims a 7400 rpm Camry
  redline (https://zeperfs.com/en/fiche10957-toyota-camry-3-5-v6.htm); this
  disagrees with tachometer markings and with peak power at 6200 rpm, and
  should be treated as wrong. Use ~6300 rpm (Camry/RX350 family) and
  7000 rpm (Evora) as the modeling values.
- **Crank pin offset**: the "60° crank pin offset for even firing" claim is
  standard 60°-V6 engineering practice (source above). A 2GR-specific
  factory document stating the pin offset angle was not found in this
  research pass; treat the exact offset geometry as inferred (each crank
  throw pair splayed so ignition events land every 120° of crank rotation).

Derived modeling numbers: displacement per cylinder = pi/4 * 0.094^2 *
0.083 = 576 cc; rod/stroke ratio = 147.5 / 83 = 1.777; crank radius =
41.5 mm.

---

## 9. Design implications

- Run physics near 10 kHz and fluids at an 8x substep like engine-sim, but
  run the **exhaust waveguide at the audio rate** (44.1/48 kHz). Feed it the
  valve mass-flow from the fluid step with sample-and-hold plus one-pole
  smoothing, instead of engine-sim's linear-interp + 1900 Hz Butterworth,
  so the pulse edges keep their high-frequency content physically.
- Keep engine-sim's latency-servo frame loop (steps adjusted ±10% around a
  0.1 s buffer target). It is simple and it works.
- Use the two-regime isentropic orifice for all volume-to-volume flows, with
  `A_e = Cd(l) * min(curtain, throat)`, and keep the pressure-equilibrium
  clamp from `gas_system.cpp` for stability at large substeps.
- Use Wiebe heat release (a = 5, m = 2, load/rpm-dependent burn duration)
  instead of the geometric flame model. Add per-cycle random efficiency and
  phasing jitter (few percent) — engine-sim shows this randomness is a large
  part of the perceived realism.
- Exhaust model: per-cylinder primary waveguide -> 3-into-1 K-branch junction
  per bank (Section 4.3 equations) -> collector waveguide -> tailpipe ->
  Levine–Schwinger termination (first-order negative-gain low-pass reflection,
  end correction folded into the delay length). Output = transmitted pressure
  passed through a d/dt radiation tilt.
- Model gas-temperature dependence of `c` per section; update fractional
  delays (3rd-order Lagrange) slowly from the 0-D gas temperatures.
- Add weak nonlinearity as amplitude-modulated delay across 4–8 sections per
  run; escalate to 1-D FV Euler only if strong-shock behavior is required.
- Keep an optional short measured-IR convolution as a "cabinet/room" stage
  after the physical model. engine-sim proves a static IR carries a lot of
  timbre cheaply; with a real waveguide it can shrink to a room/mic IR.
- Keep engine-sim's output conditioning: DC blocker, gentle AGC toward a
  fixed target, final anti-alias low-pass at 0.45 fs, int16 clamp.
- For the 2GR-FE: 6 cylinders firing 1-2-3-4-5-6 every 120°, banks
  alternate every event; give each bank its own header + collector waveguide
  and join (or keep separate to dual tailpipes) to reproduce the V6 note.
