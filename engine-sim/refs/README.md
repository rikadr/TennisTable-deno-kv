# Reference recordings

The simulator is tuned against real recordings placed in this directory.
This file tells you exactly what to record and how. The analysis tools
find these files by name.

## One car only

Record ONE car and stay with it. The 2GR-FE internals are identical
across cars, but the exhaust system is not, and the exhaust controls most
of the sound. Good candidates: a Lotus Evora, a Toyota Camry/Aurion 3.5,
or a Lexus RX350/ES350. Tell me which car you recorded — the exhaust
geometry in `configs/2gr_fe.json` must match it.

Do not record a car with an aftermarket exhaust unless you want the
simulator tuned to that exhaust.

## File format and naming

- Mono WAV, 48 kHz, 16 or 24 bit. No MP3, no AAC.
- Steady points: `refs/2gr_fe_<rpm>.wav`, e.g. `refs/2gr_fe_3000.wav`.
- Sweep: `refs/2gr_fe_sweep_<start>_<end>.wav`, e.g.
  `refs/2gr_fe_sweep_1000_6500.wav`.
- 6 to 10 seconds per steady file. Trim silence from both ends.

## Microphone position

- 0.5 m behind the tailpipe exit, 45 degrees off the pipe axis, at pipe
  height. This is the standard pass-by-adjacent position and avoids the
  direct jet blowing on the capsule.
- Keep the same position for every file. Note the distance and angle if
  they differ.
- Use a windscreen. Avoid wind, rain, and walls within 3 m.

## What to record

Priority order:

1. Steady idle (~650 rpm), neutral, warm engine: `2gr_fe_650.wav`.
2. Steady held points, neutral or in gear on a dyno/road at constant
   speed: 1500, 2000, 3000, 4000, 5000, 6000 rpm. Hold each for at least
   6 seconds. Small wander is fine; do not ride the throttle rhythmically.
3. One slow full-throttle sweep from ~1000 rpm to redline, 10-20 s if
   you can do it safely (dyno preferred): `2gr_fe_sweep_1000_6500.wav`.

## What to avoid

- Clipping. Set gain so the loudest point peaks below -6 dBFS, then do
  not touch the gain again.
- Other noise: voices, wind gusts, passing cars, music, birds close by.
- Auto-processing: disable any phone AGC, noise reduction, or limiter.
  Use a recorder app with manual gain if a phone is the only option.
- Mixed cars: never put recordings from two different cars in refs/.

## Supercharger check

This engine must be naturally aspirated. If the analysis finds narrow
tonal peaks that track rpm at a non-integer multiple of the firing
frequency (supercharger whine), the recordings are from the wrong car
(e.g. a 2GR-FZE Exige) and will be rejected.
