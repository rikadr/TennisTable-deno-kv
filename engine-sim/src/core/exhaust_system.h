#pragma once
#include <memory>
#include <vector>

#include "core/config.h"
#include "core/waveguide.h"

namespace enginesim {

// The full exhaust network for a V engine:
//   per-cylinder runners -> one 3-into-1 junction per bank -> bank pipes ->
//   Y junction -> mid pipe -> chambers and connecting pipes -> tailpipe ->
//   radiation end.
// A chamber is a short wide pipe. The area steps at its two junctions give
// the reflective behaviour of an expansion-chamber muffler.
class ExhaustSystem {
 public:
  void init(const SimConfig& cfg, double fs);

  // Phase 1 of the sample: read all delay lines.
  void beginSample();

  // Wave arriving at cylinder i's port, and the port's absolute pressure
  // if volume velocity U enters the runner there.
  double portIncoming(int cyl) const { return runners_[cyl]->outA(); }
  double portImpedance(int cyl) const { return runners_[cyl]->impedance(); }
  double portDensity(int cyl) const { return runners_[cyl]->density(); }
  double portTempK(int cyl) const { return runners_[cyl]->tempK(); }

  // Phase 2: inject the port flow (volume velocity, m^3/s, positive into
  // the runner). Must be called once per cylinder per sample.
  void setPortFlow(int cyl, double u) {
    auto& r = *runners_[cyl];
    r.inA(r.outA() + r.impedance() * u);
  }

  // Phase 3: scatter all junctions, process the radiation end.
  // Returns the radiated pressure at the tailpipe exit.
  double finishSample();

  void clear();

 private:
  std::vector<std::unique_ptr<WaveguidePipe>> runners_;
  std::vector<std::unique_ptr<WaveguidePipe>> pipes_;  // everything downstream
  std::vector<Junction> junctions_;
  RadiationEnd radiation_;
  WaveguidePipe* tailpipe_ = nullptr;
  double ambientPa_ = 101325.0;
};

}  // namespace enginesim
