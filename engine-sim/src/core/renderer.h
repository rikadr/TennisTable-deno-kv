#pragma once
#include <cstdint>
#include <string>
#include <vector>

#include "core/config.h"

namespace enginesim {

struct RenderOptions {
  double rpmStart = 3000.0;
  double rpmEnd = 3000.0;
  double durationS = 6.0;
  double warmupS = 1.0;
  double throttle = 0.8;
  double rpmJitter = 0.003;  // slow random walk, fraction of rpm
  uint64_t seed = 1;
  bool stubTone = false;     // bypass physics; test the harness
  bool profile = false;
};

struct RenderStats {
  double maxAbs = 0.0;
  int64_t nanCount = 0;
  int64_t sampleCount = 0;
  double rtf = 0.0;          // seconds of audio per second of wall clock
  double wallS = 0.0;
  double cylinderS = 0.0;    // profile: time in cylinder physics
  double acousticS = 0.0;    // profile: time in waveguides
  double peakCylPressurePa = 0.0;
};

// Renders audio at the output rate. Returns the samples; fills stats.
std::vector<double> renderAudio(const SimConfig& cfg, const RenderOptions& opt,
                                RenderStats& stats);

// Writes stats as JSON.
bool writeStatsJson(const std::string& path, const SimConfig& cfg,
                    const RenderOptions& opt, const RenderStats& stats);

}  // namespace enginesim
