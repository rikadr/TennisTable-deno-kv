#pragma once
#include <cstdint>

#include "core/config.h"
#include "core/util.h"

namespace enginesim {

// Valvetrain and mechanical noise: short, seeded noise bursts through a
// resonant band-pass, triggered on valve events and scaled with speed.
class MechanicalNoise {
 public:
  void init(const SimConfig& cfg, double fs, uint64_t seed);

  void trigger(double strength) { env_ += gain_ * strength; }

  double process() {
    const double x = env_ * rng_.bipolar();
    env_ *= decay_;
    // State-variable band-pass.
    const double hp = x - low_ - q_ * band_;
    band_ += f_ * hp;
    low_ += f_ * band_;
    return band_;
  }

  void clear() {
    env_ = 0.0;
    band_ = low_ = 0.0;
  }

 private:
  Rng rng_{1};
  double env_ = 0.0;
  double gain_ = 0.008;
  double decay_ = 0.999;
  double f_ = 0.2, q_ = 0.5;
  double band_ = 0.0, low_ = 0.0;
};

}  // namespace enginesim
