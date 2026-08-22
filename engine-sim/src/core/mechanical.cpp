#include "core/mechanical.h"

#include <cmath>

namespace enginesim {

void MechanicalNoise::init(const SimConfig& cfg, double fs, uint64_t seed) {
  rng_ = Rng(seed + 0xABCDull);
  gain_ = cfg.mechanical.valvetrainGain;
  decay_ = std::exp(-1.0 / (0.0025 * fs));  // ~2.5 ms bursts
  const double fc = cfg.mechanical.tickBandpassHz;
  f_ = 2.0 * std::sin(kPi * fc / fs);
  if (f_ > 0.9) f_ = 0.9;
  q_ = 0.35;
  clear();
}

}  // namespace enginesim
