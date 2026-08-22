# Metric targets

Set after the first reference-compared renders (R8 V10 idle,
2026-08-22). The reference is refs/r8_v10_800.wav; see refs/SOURCES.md
for its provenance and limits. Revisit these when better references
(more rpm points, known microphone chain) arrive.

## Hard exit criteria (from the project brief)

- Firing frequency error < 0.5% at every tested rpm.
- Harmonic amplitude RMS error (harmonics 1-20, mean-removed) < 3 dB
  at reference-matched points.
- All sanity checks pass: no NaN, no full-scale sample, deterministic
  output for a fixed seed, RTF >= 10 single-threaded in the sandbox.

## Multi-scale STFT distance threshold

- Definition: mean over windows 256/1024/4096 of the mean absolute
  difference of log magnitudes, after normalizing the render to the
  reference RMS (tools/analyze.py).
- First successful reference-compared render measured 1.99; after five
  iterations 1.86.
- TARGET: <= 1.20 at the idle reference point. Rationale: the floor is
  not 0 for any render because the reference contains ambience and
  recording noise the simulator must not imitate; 1.2 is roughly the
  distance between the two halves of the reference clip itself plus
  margin (the two halves measure ~0.9 apart).

## Soft character targets at idle (from the reference)

- HNR: 8 +- 2 dB (currently 11.9; too tonal).
- Crest factor: 18 +- 2 dB (currently 14.2; too flat).
- Spectral centroid: 1350 +- 250 Hz (currently 1675).
- Cycle-averaged pulse decay: about 5 ms.

## Known non-goals

- Harmonic 1 (67 Hz) sits +17 dB above the reference at idle. The
  reference's h1 dip is most likely room interference or the recorder's
  low cut; matching it with output filtering would be corrective EQ.
  Leave it unless a better reference contradicts this.
