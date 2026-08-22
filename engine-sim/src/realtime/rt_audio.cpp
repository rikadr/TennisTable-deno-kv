// Real-time playback layer. Only built with ENGINESIM_REALTIME=ON.
//
// Threads:
//  - simulation thread: runs the engine, decimates, pushes into the ring.
//  - audio callback (miniaudio/CoreAudio): pops from the ring. It never
//    allocates, locks, blocks or performs I/O. See docs/realtime_safety.md.
//  - control thread (stdin): throttle and quit commands.

#include <atomic>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <iostream>
#include <string>
#include <thread>

#include "core/config.h"
#include "core/engine.h"
#include "core/resampler.h"
#include "realtime/ring_buffer.h"

#define MA_NO_DECODING
#define MA_NO_ENCODING
#define MA_NO_GENERATION
#define MINIAUDIO_IMPLEMENTATION
#if defined(__GNUC__)
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wunused-parameter"
#pragma GCC diagnostic ignored "-Wunused-function"
#pragma GCC diagnostic ignored "-Wunused-variable"
#pragma GCC diagnostic ignored "-Wunused-result"
#endif
#include "miniaudio/miniaudio.h"
#if defined(__GNUC__)
#pragma GCC diagnostic pop
#endif

namespace enginesim {

namespace {

struct RtShared {
  SpscRing ring{1 << 15};
  std::atomic<bool> running{true};
  std::atomic<double> throttle{0.1};
  std::atomic<double> rpm{800.0};
  std::atomic<uint64_t> underruns{0};
};

// Audio callback: real-time safe. Reads only the ring and atomics.
void audioCallback(ma_device* dev, void* out, const void* /*in*/,
                   ma_uint32 frames) {
  auto* shared = static_cast<RtShared*>(dev->pUserData);
  float* dst = static_cast<float*>(out);
  const size_t have = shared->ring.available();
  if (have < frames) shared->underruns.fetch_add(1, std::memory_order_relaxed);
  shared->ring.popOrZero(dst, frames);
}

// Simulation thread: same crank dynamics as the offline rev profile.
void simThread(const SimConfig& cfg, uint64_t seed, RtShared* shared) {
  Engine engine;
  engine.init(cfg, seed);
  HalfBandDecimator deci;
  DcBlocker dc;
  dc.init(cfg.internalRate());
  OnePoleLP micLp, micHpLp;
  const bool useMicLp = cfg.output.micLowpassHz > 0.0;
  const bool useMicHp = cfg.output.micHighpassHz > 0.0;
  if (useMicLp) micLp.setCutoff(cfg.output.micLowpassHz, cfg.internalRate());
  if (useMicHp) micHpLp.setCutoff(cfg.output.micHighpassHz, cfg.internalRate());

  const double dt = 1.0 / cfg.internalRate();
  const bool oversampled = cfg.output.internalOversample == 2;
  double rpm = cfg.engine.idleRpm;
  float block[256];
  size_t fill = 0;

  while (shared->running.load(std::memory_order_relaxed)) {
    if (shared->ring.freeSpace() < 512) {
      std::this_thread::sleep_for(std::chrono::milliseconds(1));
      continue;
    }
    const double thr = shared->throttle.load(std::memory_order_relaxed);
    // Crank dynamics in neutral (torque curve, friction, limiter cut).
    const double x = rpm / 4700.0;
    const double tMax = 250.0 * (1.0 - 0.35 * (x - 1.0) * (x - 1.0));
    double tInd = thr * std::fmax(60.0, tMax);
    if (rpm > cfg.engine.revLimitRpm) tInd = 0.0;
    const double tFric = 22.0 + 0.0042 * rpm + 8e-7 * rpm * rpm;
    rpm += (tInd - tFric) / 0.18 * 60.0 / kTwoPi * dt;
    const double idleFloor = cfg.engine.idleRpm * 0.92;
    if (rpm < idleFloor) rpm = idleFloor;

    engine.setRpm(rpm);
    engine.setThrottle(thr < 0.09 && rpm < cfg.engine.idleRpm * 1.1 ? 0.09
                                                                    : thr);
    shared->rpm.store(rpm, std::memory_order_relaxed);

    double s = engine.step();
    if (!std::isfinite(s)) s = 0.0;
    s = dc.process(s);
    if (useMicHp) s -= micHpLp.process(s);
    if (useMicLp) s = micLp.process(s);

    double y;
    bool ready;
    if (oversampled) {
      ready = deci.push(s, y);
    } else {
      y = s;
      ready = true;
    }
    if (!ready) continue;
    block[fill++] = static_cast<float>(softLimit(y, cfg.output.limiterDrive));
    if (fill == 256) {
      shared->ring.push(block, fill);
      fill = 0;
    }
  }
}

}  // namespace

int runRealtime(const SimConfig& cfg, uint64_t seed) {
  RtShared shared;

  ma_device_config dcfg = ma_device_config_init(ma_device_type_playback);
  dcfg.playback.format = ma_format_f32;
  dcfg.playback.channels = 1;
  dcfg.sampleRate = static_cast<ma_uint32>(cfg.output.sampleRate);
  dcfg.periodSizeInFrames = 256;
  dcfg.dataCallback = audioCallback;
  dcfg.pUserData = &shared;

  ma_device device;
  if (ma_device_init(nullptr, &dcfg, &device) != MA_SUCCESS) {
    std::fprintf(stderr, "cannot open audio device\n");
    return 1;
  }

  std::thread sim(simThread, cfg, seed, &shared);
  // Pre-fill before starting the device so the first callback has data.
  while (shared.ring.available() < 4096) {
    std::this_thread::sleep_for(std::chrono::milliseconds(2));
  }
  if (ma_device_start(&device) != MA_SUCCESS) {
    std::fprintf(stderr, "cannot start audio device\n");
    shared.running.store(false);
    sim.join();
    ma_device_uninit(&device);
    return 1;
  }

  std::printf(
      "realtime: engine %s at %d Hz.\n"
      "commands: t <0..1> throttle | r rev blip | q quit\n",
      cfg.name.c_str(), cfg.output.sampleRate);

  std::string line;
  while (std::getline(std::cin, line)) {
    if (line == "q") break;
    if (line.rfind("t ", 0) == 0) {
      shared.throttle.store(std::stod(line.substr(2)));
    } else if (line == "r") {
      shared.throttle.store(1.0);
      std::this_thread::sleep_for(std::chrono::milliseconds(700));
      shared.throttle.store(0.0);
    }
    std::printf("rpm %.0f | throttle %.2f | underruns %llu\n",
                shared.rpm.load(), shared.throttle.load(),
                static_cast<unsigned long long>(shared.underruns.load()));
  }

  shared.running.store(false);
  sim.join();
  ma_device_uninit(&device);
  return 0;
}

}  // namespace enginesim
