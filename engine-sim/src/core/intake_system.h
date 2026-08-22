#pragma once
#include <memory>
#include <vector>

#include "core/config.h"
#include "core/waveguide.h"

namespace enginesim {

// Intake side: one runner per cylinder into a plenum pipe. The plenum's
// far end opens toward the throttle body and the airbox. Its radiated
// output is the intake noise. The whole network sits at the quasi-static
// manifold pressure; the waveguide carries only the acoustic part.
class IntakeSystem {
 public:
  void init(const SimConfig& cfg, double fs);

  void beginSample();

  double portIncoming(int cyl) const { return runners_[cyl]->outA(); }
  double portImpedance(int cyl) const { return runners_[cyl]->impedance(); }
  double portDensity(int cyl) const { return runners_[cyl]->density(); }

  void setPortFlow(int cyl, double u) {
    auto& r = *runners_[cyl];
    r.inA(r.outA() + r.impedance() * u);
  }

  // Returns the radiated intake noise. throttle in [0,1] scales how much
  // sound escapes past the throttle plate.
  double finishSample(double throttle);

  void clear();

 private:
  std::vector<std::unique_ptr<WaveguidePipe>> runners_;
  std::unique_ptr<WaveguidePipe> plenum_;
  Junction junction_;
  RadiationEnd radiation_;
  double radGain_ = 0.25;
};

}  // namespace enginesim
