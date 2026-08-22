#include "core/renderer.h"

#include <chrono>
#include <cmath>
#include <cstdio>

#include "core/engine.h"
#include "core/resampler.h"
#include "core/waveguide.h"
#include "core/util.h"

namespace enginesim {

namespace {

// Deterministic pulse-train stand-in for the engine: an exponentially
// decaying resonant response to one impulse per firing event. It exists to
// prove the analysis harness, not to sound like an engine.
class StubTone {
 public:
  void init(const SimConfig& cfg, double fs) {
    fs_ = fs;
    cylinders_ = cfg.engine.cylinders;
    phase_ = 0.0;
    b_ = l_ = 0.0;
  }
  void setRpm(double rpm) { rpm_ = rpm; }
  double step() {
    const double fFire = rpm_ / 60.0 * cylinders_ / 2.0;
    phase_ += fFire / fs_;
    double x = 0.0;
    if (phase_ >= 1.0) {
      phase_ -= 1.0;
      x = 1.0;
    }
    // Resonator near 300 Hz plus a decaying comb of harmonics via a
    // narrow band-pass; enough structure for the metric pipeline.
    const double f = 2.0 * std::sin(kPi * 300.0 / fs_);
    const double hp = x - l_ - 0.08 * b_;
    b_ += f * hp;
    l_ += f * b_;
    return 0.4 * b_ + 0.2 * x;
  }

 private:
  double fs_ = 96000.0, rpm_ = 3000.0, phase_ = 0.0;
  int cylinders_ = 6;
  double b_ = 0.0, l_ = 0.0;
};

// Human-style revving in neutral: throttle blips drive a simple crank
// model (inertia, a torque curve, friction). The rev limiter cut in the
// engine handles blips that reach the limit.
class RevProfile {
 public:
  void init(const SimConfig& cfg, uint64_t seed, double durationS) {
    idle_ = cfg.engine.idleRpm;
    redline_ = cfg.engine.redlineRpm;
    rpm_ = idle_;
    Rng rng(seed + 0x5EED);
    // Blip targets as a fraction of the redline; the third one leans on
    // the limiter. Repeat the pattern if the render is long.
    const double base[] = {0.60, 0.85, 1.03, 0.72, 1.03, 0.55};
    double t = 1.4;
    for (int i = 0; i < 24 && t < durationS; ++i) {
      Blip b;
      b.start = t + 0.15 * rng.uniform();
      b.targetRpm = redline_ * base[i % 6] * (1.0 + 0.04 * rng.bipolar());
      blips_.push_back(b);
      // Rise time + fall time + idle pause before the next blip.
      t = b.start + 0.9 + 2.2 * (b.targetRpm / redline_) +
          0.7 + 0.6 * rng.uniform();
    }
  }

  void setRevLimit(double r) { revLimit_ = r; }

  // Advance by dt; returns rpm and writes the throttle.
  double step(double t, double dt, double* throttle) {
    Blip* active = nullptr;
    for (Blip& b : blips_) {
      if (t >= b.start && !b.done) {
        active = &b;
        break;
      }
    }

    double want = 0.0;
    if (active) {
      // A target above the limiter means "lean on the limiter": hold the
      // throttle open for a moment once the limit is reached.
      const double eff = std::min(active->targetRpm, revLimit_ * 0.985);
      if (rpm_ < eff && active->holdUntil < 0.0) {
        want = 1.0;
      } else {
        if (active->holdUntil < 0.0) {
          active->holdUntil =
              t + (active->targetRpm > revLimit_ * 0.985 ? 0.45 : 0.0);
        }
        if (t < active->holdUntil) {
          want = 1.0;
        } else {
          active->done = true;
        }
      }
    }

    // Idle governor: hold the idle speed with a small throttle opening.
    if (want == 0.0 && rpm_ < idle_ * 1.1) want = 0.09;
    thr_ += (want - thr_) * (dt / (dt + 0.06));  // throttle actuator lag
    *throttle = thr_;

    // Crank dynamics in neutral. Torque curve peaks mid-range. The spark
    // cut above the rev limit removes the indicated torque, so the speed
    // bounces on the limiter the way the sound does.
    const double x = rpm_ / 4700.0;
    const double tMax = 250.0 * (1.0 - 0.35 * (x - 1.0) * (x - 1.0));
    double tInd = thr_ * std::max(60.0, tMax);
    if (rpm_ > revLimit_) tInd = 0.0;
    const double tFric = 22.0 + 0.0042 * rpm_ + 8e-7 * rpm_ * rpm_;
    const double inertia = 0.18;  // kg m^2, crank + flywheel
    const double alpha = (tInd - tFric) / inertia;      // rad/s^2
    rpm_ += alpha * 60.0 / kTwoPi * dt;
    if (rpm_ < idle_ * 0.92) rpm_ = idle_ * 0.92;
    return rpm_;
  }

 private:
  struct Blip {
    double start = 0.0;
    double targetRpm = 3000.0;
    double holdUntil = -1.0;
    bool done = false;
  };
  std::vector<Blip> blips_;
  double rpm_ = 650.0, idle_ = 650.0, redline_ = 6500.0, thr_ = 0.09;
  double revLimit_ = 6600.0;
};

}  // namespace

std::vector<double> renderAudio(const SimConfig& cfg, const RenderOptions& opt,
                                RenderStats& stats) {
  const double fsInt = static_cast<double>(cfg.internalRate());
  const int64_t warmupSamples = static_cast<int64_t>(opt.warmupS * fsInt);
  const int64_t renderSamples = static_cast<int64_t>(opt.durationS * fsInt);
  const int64_t outSamples =
      static_cast<int64_t>(opt.durationS * cfg.output.sampleRate);

  std::vector<double> outBuf;
  outBuf.reserve(static_cast<size_t>(outSamples) + 64);

  Engine engine;
  StubTone stub;
  RevProfile rev;
  if (opt.stubTone) {
    stub.init(cfg, fsInt);
  } else {
    engine.init(cfg, opt.seed);
    engine.setThrottle(opt.throttle);
  }
  if (opt.revProfile) {
    rev.init(cfg, opt.seed, opt.durationS);
    rev.setRevLimit(cfg.engine.revLimitRpm);
  }

  HalfBandDecimator deci;
  DcBlocker dc;
  dc.init(fsInt);
  OnePoleLP micLp, micHpLp;
  const bool useMicLp = cfg.output.micLowpassHz > 0.0;
  const bool useMicHp = cfg.output.micHighpassHz > 0.0;
  if (useMicLp) micLp.setCutoff(cfg.output.micLowpassHz, fsInt);
  if (useMicHp) micHpLp.setCutoff(cfg.output.micHighpassHz, fsInt);
  Rng jitterRng(opt.seed + 0x77ull);
  double jitter = 0.0;

  stats = RenderStats();
  const auto t0 = std::chrono::steady_clock::now();

  const int64_t total = warmupSamples + renderSamples;
  const bool oversampled = cfg.output.internalOversample == 2;
  for (int64_t i = 0; i < total; ++i) {
    const bool capture = i >= warmupSamples;
    const double u = capture
        ? static_cast<double>(i - warmupSamples) / renderSamples
        : 0.0;
    double rpm;
    if (opt.revProfile) {
      double thr;
      rpm = rev.step(u * opt.durationS, 1.0 / fsInt, &thr);
      if (!opt.stubTone) engine.setThrottle(thr);
    } else {
      rpm = opt.rpmStart + (opt.rpmEnd - opt.rpmStart) * u;
    }

    // Slow random walk on rpm; a real crank never spins perfectly evenly.
    // The walk has unit RMS after normalization, so rpmJitter is the
    // relative rpm deviation it produces.
    jitter = 0.99995 * jitter + 0.0005 * jitterRng.bipolar();
    double dev = jitter / 0.029;
    if (dev > 3.0) dev = 3.0;
    if (dev < -3.0) dev = -3.0;
    rpm *= 1.0 + opt.rpmJitter * dev;

    double s;
    if (opt.stubTone) {
      stub.setRpm(rpm);
      s = stub.step();
    } else {
      engine.setRpm(rpm);
      s = engine.step();
      if (engine.cylinderPressure(0) > stats.peakCylPressurePa)
        stats.peakCylPressurePa = engine.cylinderPressure(0);
    }

    if (!std::isfinite(s)) {
      ++stats.nanCount;
      s = 0.0;
    }
    s = dc.process(s);
    if (useMicHp) s -= micHpLp.process(s);
    if (useMicLp) s = micLp.process(s);

    if (!capture) continue;
    double y;
    bool ready;
    if (oversampled) {
      ready = deci.push(s, y);
    } else {
      y = s;
      ready = true;
    }
    if (ready) {
      // The limiter runs after decimation so no later stage can push a
      // sample past full scale.
      y = softLimit(y, cfg.output.limiterDrive);
      outBuf.push_back(y);
      const double a = std::fabs(y);
      if (a > stats.maxAbs) stats.maxAbs = a;
    }
  }

  const auto t1 = std::chrono::steady_clock::now();
  stats.wallS = std::chrono::duration<double>(t1 - t0).count();
  stats.sampleCount = static_cast<int64_t>(outBuf.size());
  const double audioS =
      static_cast<double>(outBuf.size()) / cfg.output.sampleRate;
  stats.rtf = stats.wallS > 0.0 ? audioS / stats.wallS : 0.0;

  if (static_cast<int64_t>(outBuf.size()) > outSamples)
    outBuf.resize(static_cast<size_t>(outSamples));
  return outBuf;
}

bool writeStatsJson(const std::string& path, const SimConfig& cfg,
                    const RenderOptions& opt, const RenderStats& stats) {
  FILE* f = std::fopen(path.c_str(), "w");
  if (!f) return false;
  std::fprintf(f,
               "{\n"
               "  \"config\": \"%s\",\n"
               "  \"rpm_start\": %.1f,\n"
               "  \"rpm_end\": %.1f,\n"
               "  \"duration_s\": %.3f,\n"
               "  \"throttle\": %.3f,\n"
               "  \"seed\": %llu,\n"
               "  \"sample_rate\": %d,\n"
               "  \"samples\": %lld,\n"
               "  \"max_abs\": %.6f,\n"
               "  \"nan_count\": %lld,\n"
               "  \"peak_cyl_pressure_bar\": %.2f,\n"
               "  \"wall_s\": %.3f,\n"
               "  \"rtf\": %.2f\n"
               "}\n",
               cfg.name.c_str(), opt.rpmStart, opt.rpmEnd, opt.durationS,
               opt.throttle, static_cast<unsigned long long>(opt.seed),
               cfg.output.sampleRate,
               static_cast<long long>(stats.sampleCount), stats.maxAbs,
               static_cast<long long>(stats.nanCount),
               stats.peakCylPressurePa / 1e5, stats.wallS, stats.rtf);
  std::fclose(f);
  return true;
}

}  // namespace enginesim
