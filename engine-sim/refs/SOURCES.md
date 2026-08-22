# Reference audio provenance

The user approved sourcing reference audio online (session instruction,
2026-08-22). One car is used for tuning.

## Audi R8 V10 5.2 FSI (chosen reference)

- Source repository: https://github.com/sathyaram/exhaustnotes
  (file `public/sounds/audir8.m4a`, retrieved 2026-08-22).
- The repository is a hobby web app that plays exhaust clips of known
  cars. It carries no explicit audio license; the clips are most likely
  taken from enthusiast videos. Treat these files as
  reference-for-analysis only. Do not redistribute them as a sound
  library.
- Conversion: ffmpeg (imageio-ffmpeg 7.0.2), m4a to WAV, mono, 48 kHz.
- `r8_v10_800.wav`: seconds 0.3 to 6.3 of the clip. Steady idle. The
  comb spacing is 33.33 Hz. For an even-fire V10 recorded at one
  tailpipe, the dominant comb is the per-bank order 2.5 per revolution,
  so 33.33 Hz puts the idle at 800 rpm.
- `r8_v10_full.wav`: the whole 24 s clip (idle, then several revs to
  roughly 4000+ rpm). Used for aggregate spectral statistics, not for
  time-aligned distances.
- Selection basis (measured, see docs/iteration_log.md): highest
  bandwidth-to-noise combination of 11 candidate clips: peak 0.51
  (no clipping), quietest-window floor -33 dB, 99.9% energy bandwidth
  7.8 kHz.

## Rejected candidates

- HL-CEAD (github.com/MachineLearningVisionRG/machine_biometrics):
  real recordings at labeled 1000/1500/2000 rpm, but the microphone sat
  in the engine bay of economy cars and the phone recorder applied noise
  cancellation. Wrong source character for a tailpipe simulator.
- ATG-Simulator/VehicleNoiseSynthesizer sample loops (MIT): exhaust
  loops labeled by rpm, but measurement shows the comb does not match
  the labels (pitch-shifted grains, about 9% off) and the loops are
  about 1 s long. Kept as a possible secondary check only.
- Other exhaustnotes clips (Ferrari 458, Lexus LFA, Huracan, and
  others): lower bandwidth, clipping, or no steady segment.
