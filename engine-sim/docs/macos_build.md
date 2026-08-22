# macOS build (Apple Silicon)

The core and the renderer are portable C++20 with no platform code.
The real-time layer uses miniaudio (CoreAudio backend). The GUI layer
uses Dear ImGui + GLFW (vendored). All dependencies are vendored in
`third_party/`; the build needs no network access.

## Prerequisites

- Xcode command line tools: `xcode-select --install`
- Homebrew packages: `brew install cmake ninja` (ninja optional)

GLFW and ImGui build from the vendored sources; do NOT `brew install
glfw` for this project.

## Build

Headless (what the sandbox tests):

```
cd engine-sim
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
./build/enginesim --selftest
```

Full build with real-time audio and GUI:

```
cmake -B build -DCMAKE_BUILD_TYPE=Release \
      -DENGINESIM_REALTIME=ON -DENGINESIM_GUI=ON
cmake --build build -j
```

Run:

```
./build/enginesim --config configs/r8_v10.json --realtime   # audio only
./build/enginesim --config configs/r8_v10.json --gui        # GUI + audio
```

The realtime layer links CoreAudio/AudioToolbox/AudioUnit frameworks;
the GUI layer links the OpenGL framework. CMake adds these
automatically on APPLE.

## Notes

- The audio callback is real-time safe by construction; see
  docs/realtime_safety.md for the call-tree review.
- Buffer size request is 256 frames at 48 kHz. If CoreAudio gives a
  larger buffer, the ring keeps feeding it; latency rises, nothing
  breaks.
- The simulation thread is a std::thread; no special entitlements are
  needed.
- Expected performance: the sandbox (Xeon 2.8 GHz vCPU) renders at
  RTF ~9 single-threaded at 96 kHz internal rate; an M4 Max core is
  several times faster, so real-time leaves a wide margin.
