# Real-time safety review

The audio callback must never allocate, lock, block, or perform I/O.
The sandbox cannot run the callback, so safety is enforced by this
call-tree review. Check it against `src/realtime/rt_audio.cpp` and
`src/realtime/ring_buffer.h` after any change to those files.

## Thread layout

- Audio callback (CoreAudio thread via miniaudio): consumes samples
  from a lock-free SPSC ring buffer.
- Simulation thread (std::thread): produces samples into the ring.
  It may sleep and take its time; it is not real-time critical as long
  as it stays ahead of the ring (the sandbox measures the margin as
  RTF; see docs/iteration_log.md).
- Control thread (main): reads stdin, writes only std::atomic values.

## Callback call tree (complete)

```
audioCallback(ma_device*, out, in, frames)
 +- dev->pUserData                      pointer read
 +- SpscRing::available()               two atomic loads, subtraction
 +- std::atomic<uint64_t>::fetch_add    lock-free counter (underruns)
 +- SpscRing::popOrZero(dst, n)
     +- two atomic loads (acquire/relaxed)
     +- bounded loop: at most n iterations, index arithmetic, copies
     +- one atomic store (release)
```

Properties, verified by reading the code:

- No heap allocation: the ring's vector is sized in the constructor
  before the device starts; popOrZero only indexes it.
- No locks or syscalls: only std::atomic loads/stores with
  acquire/release ordering; std::atomic<size_t> and
  std::atomic<uint64_t> are lock-free on every target platform
  (static_assert candidates if a new platform appears).
- No I/O, no logging, no exceptions on this path.
- Bounded time: every loop is bounded by `frames` (<= the device
  period, requested 256).
- Underruns produce zeros (a click), never a stall: popOrZero fills
  the remainder with silence instead of waiting.

## Producer side (simulation thread)

Engine::step() is allocation-free after Engine::init(): all delay
lines, tables and vectors are sized during init. The step path calls
only arithmetic, std::sin/cos-free table lookups, and bounded solver
loops (max 6 iterations). This matters for keeping the RTF margin, not
for callback safety: the ring isolates the callback from any producer
hiccup.

Verified allocation-free by review of: Engine::step, Cylinder::step,
solvePortFlow, WaveguidePipe::propagate, DelayLine::read4/readFrac,
Junction::scatter, RadiationEnd::process, MechanicalNoise::process,
IntakeSystem/ExhaustSystem begin/finishSample, HalfBandDecimator::push,
DcBlocker::process, softLimit. None of these call new/malloc, none
take a lock, none do I/O. ExhaustSystem::setMeanFlow (called every 64
samples) computes a few exp() calls and writes pipe gains; it stays on
the simulation thread.

## Things that are deliberately NOT on the audio thread

- Config parsing, engine init, WAV writing: before the device starts
  or on other threads.
- The GUI reads plot data through a double buffer with an atomic page
  index; it never touches the audio thread.
- printf of rpm/underruns happens on the control thread.
