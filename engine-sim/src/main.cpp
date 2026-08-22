// enginesim: headless physics-based engine sound renderer.
//
//   enginesim --config configs/2gr_fe.json --rpm 3000 --duration 6
//             --out out/v6_3000.wav [--stats out/v6_3000.json]
//   enginesim --config configs/2gr_fe.json --sweep 800:7000 --duration 20
//             --out out/sweep.wav
//   enginesim --selftest

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>

#include "core/config.h"
#include "core/exhaust_system.h"
#include "core/gas.h"
#include "core/kinematics.h"
#include "core/renderer.h"
#include "core/resampler.h"
#include "core/waveguide.h"
#include "core/wav.h"
#include <vector>

#ifdef ENGINESIM_REALTIME
namespace enginesim { int runRealtime(const SimConfig& cfg, uint64_t seed); }
#endif
#ifdef ENGINESIM_GUI
namespace enginesim { int runGui(const SimConfig& cfg, uint64_t seed); }
#endif

namespace {

int selftest() {
  using namespace enginesim;
  int failures = 0;
  auto check = [&](bool ok, const char* name) {
    std::printf("%s: %s\n", ok ? "PASS" : "FAIL", name);
    if (!ok) ++failures;
  };

  // 1. Volume ratio at BDC vs TDC equals the compression ratio.
  {
    CrankGeometry g;
    g.set(0.094, 0.083, 0.1475, 10.8);
    const double cr = g.volume(kPi) / g.volume(0.0);
    check(std::fabs(cr - 10.8) < 1e-9, "kinematics compression ratio");
    // dV is zero at TDC and BDC.
    check(std::fabs(g.dVolume(0.0)) < 1e-12 && std::fabs(g.dVolume(kPi)) < 1e-9,
          "kinematics dV zero at dead centres");
  }

  // 2. Orifice flow is continuous at the critical pressure ratio and zero
  //    at equal pressures.
  {
    const double g = 1.33;
    const double prc = std::pow(2.0 / (g + 1.0), g / (g - 1.0));
    const double a = 1e-4, pu = 5e5, tu = 1000.0;
    const double f1 = orificeMassFlow(a, pu, tu, pu * (prc - 1e-6), g);
    const double f2 = orificeMassFlow(a, pu, tu, pu * (prc + 1e-6), g);
    check(std::fabs(f1 - f2) / f1 < 1e-3, "orifice flow continuity at choke");
    check(orificeMassFlow(a, pu, tu, pu, g) == 0.0, "orifice zero flow");
  }

  // 3. A wave travels a pipe in L / c seconds.
  {
    WaveguidePipe p;
    const double fs = 96000.0, len = 0.5, temp = 900.0;
    p.init(len, 0.05, temp, 101325.0, fs, 0.0, 40000.0, 0.0, 0.0);
    const double expect = len * fs / speedOfSound(kGammaPipe, temp);
    int arrival = -1;
    for (int i = 0; i < 400; ++i) {
      p.propagate();
      p.inA(i == 0 ? 1.0 : 0.0);
      p.inB(0.0);
      if (arrival < 0 && std::fabs(p.outB()) > 0.25) arrival = i;
    }
    check(arrival > 0 && std::fabs(arrival - expect) < 3.0,
          "waveguide transit time");
  }

  // 4. Junction scattering conserves signal for equal areas (pass-through).
  {
    WaveguidePipe a, b;
    a.init(0.1, 0.05, 500.0, 101325.0, 96000.0, 0.0, 40000.0, 0.0, 0.0);
    b.init(0.1, 0.05, 500.0, 101325.0, 96000.0, 0.0, 40000.0, 0.0, 0.0);
    Junction j;
    j.addPortB(&a);
    j.addPortA(&b);
    j.finalize();
    double transmitted = 0.0;
    for (int i = 0; i < 200; ++i) {
      a.propagate();
      b.propagate();
      j.scatter();
      a.inA(i == 0 ? 1.0 : 0.0);
      b.inB(0.0);
      transmitted += std::fabs(b.outB());
    }
    check(std::fabs(transmitted - 1.0) < 0.05, "equal-area junction transparency");
  }

  std::printf(failures == 0 ? "selftest OK\n" : "selftest FAILED\n");
  return failures == 0 ? 0 : 1;
}

double parseDouble(const char* s) { return std::strtod(s, nullptr); }

}  // namespace

int main(int argc, char** argv) {
  using namespace enginesim;

  std::string configPath = "configs/2gr_fe.json";
  std::string outPath;
  std::string statsPath;
  RenderOptions opt;
  bool haveSweep = false;
  bool wantRealtime = false;
  bool wantGui = false;
  bool pulseTest = false;

  for (int i = 1; i < argc; ++i) {
    const std::string a = argv[i];
    auto next = [&]() -> const char* {
      if (i + 1 >= argc) {
        std::fprintf(stderr, "missing value for %s\n", a.c_str());
        std::exit(2);
      }
      return argv[++i];
    };
    if (a == "--config") configPath = next();
    else if (a == "--rpm") { opt.rpmStart = opt.rpmEnd = parseDouble(next()); }
    else if (a == "--sweep") {
      const std::string v = next();
      const auto p = v.find(':');
      if (p == std::string::npos) {
        std::fprintf(stderr, "--sweep needs START:END\n");
        return 2;
      }
      opt.rpmStart = parseDouble(v.substr(0, p).c_str());
      opt.rpmEnd = parseDouble(v.substr(p + 1).c_str());
      haveSweep = true;
    }
    else if (a == "--duration") opt.durationS = parseDouble(next());
    else if (a == "--warmup") opt.warmupS = parseDouble(next());
    else if (a == "--throttle") opt.throttle = parseDouble(next());
    else if (a == "--rpm-jitter") opt.rpmJitter = parseDouble(next());
    else if (a == "--seed") opt.seed = std::strtoull(next(), nullptr, 10);
    else if (a == "--out") outPath = next();
    else if (a == "--stats") statsPath = next();
    else if (a == "--stub-tone") opt.stubTone = true;
    else if (a == "--rev") opt.revProfile = true;
    else if (a == "--pulse-test") { pulseTest = true; }
    else if (a == "--dump") opt.dumpPath = next();
    else if (a == "--profile") opt.profile = true;
    else if (a == "--selftest") return selftest();
    else if (a == "--realtime") wantRealtime = true;
    else if (a == "--gui") wantGui = true;
    else if (a == "--help" || a == "-h") {
      std::printf(
          "usage: enginesim [--config F] [--rpm R | --sweep A:B]\n"
          "                 [--duration S] [--warmup S] [--throttle T]\n"
          "                 [--seed N] [--rpm-jitter F] [--out F.wav]\n"
          "                 [--stats F.json] [--stub-tone] [--selftest]\n");
      return 0;
    }
    else {
      std::fprintf(stderr, "unknown argument: %s\n", a.c_str());
      return 2;
    }
  }
  (void)haveSweep;

  SimConfig cfg;
  try {
    cfg = loadConfig(configPath);
  } catch (const std::exception& e) {
    std::fprintf(stderr, "config error: %s\n", e.what());
    return 1;
  }

  if (wantGui) {
#ifdef ENGINESIM_GUI
    return runGui(cfg, opt.seed);
#else
    std::fprintf(stderr, "built without ENGINESIM_GUI\n");
    return 1;
#endif
  }
  if (wantRealtime) {
#ifdef ENGINESIM_REALTIME
    return runRealtime(cfg, opt.seed);
#else
    std::fprintf(stderr, "built without ENGINESIM_REALTIME\n");
    return 1;
#endif
  }

  if (pulseTest) {
    // Network isolation test: one synthetic blowdown pulse into runner 0,
    // all other ports still. Writes the radiated response.
    ExhaustSystem ex;
    ex.init(cfg, cfg.internalRate());
    const double fs = cfg.internalRate();
    const int n = static_cast<int>(fs * 2.0);
    const int pw = static_cast<int>(0.005 * fs);   // 5 ms pulse
    std::vector<double> outv;
    outv.reserve(n / cfg.output.internalOversample + 8);
    HalfBandDecimator deci;
    for (int i = 0; i < n; ++i) {
      ex.beginSample();
      double u0 = 0.0;
      if (i < pw) {
        const double x = static_cast<double>(i) / pw;
        const double p = 5000.0 * (0.5 - 0.5 * std::cos(2.0 * kPi * x));
        u0 = p / ex.portImpedance(0);
      }
      for (int c2 = 0; c2 < cfg.engine.cylinders; ++c2)
        ex.setPortFlow(c2, c2 == 0 ? u0 : 0.0);
      const double rad = ex.finishSample();
      double y;
      if (cfg.output.internalOversample == 2) {
        if (deci.push(rad, y)) outv.push_back(y * 2e-4);
      } else {
        outv.push_back(rad * 2e-4);
      }
    }
    writeWav16(outPath.empty() ? "out/pulse_test.wav" : outPath, outv,
               cfg.output.sampleRate);
    std::printf("pulse test written\n");
    return 0;
  }

  if (outPath.empty()) {
    std::fprintf(stderr, "no --out path; nothing to do\n");
    return 2;
  }

  RenderStats stats;
  const std::vector<double> audio = renderAudio(cfg, opt, stats);
  if (!writeWav16(outPath, audio, cfg.output.sampleRate)) {
    std::fprintf(stderr, "cannot write %s\n", outPath.c_str());
    return 1;
  }
  if (!statsPath.empty()) writeStatsJson(statsPath, cfg, opt, stats);

  std::printf(
      "rendered %lld samples to %s | max_abs %.3f | nan %lld | rtf %.1f\n",
      static_cast<long long>(stats.sampleCount), outPath.c_str(), stats.maxAbs,
      static_cast<long long>(stats.nanCount), stats.rtf);
  return stats.nanCount == 0 ? 0 : 3;
}
