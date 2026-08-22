#include "core/intake_system.h"

namespace enginesim {

void IntakeSystem::init(const SimConfig& cfg, double fs) {
  const auto& in = cfg.intake;
  const int n = cfg.engine.cylinders;

  runners_.clear();
  junction_ = Junction();

  for (int i = 0; i < n; ++i) {
    auto p = std::make_unique<WaveguidePipe>();
    p->init(in.runnerLengthM, in.runnerDiameterM, in.manifoldTempK,
            cfg.exhaust.ambientPressurePa, fs, cfg.exhaust.lossPerMeter,
            cfg.exhaust.lossCutoffHz, 0.0, 0.0);
    runners_.push_back(std::move(p));
  }

  plenum_ = std::make_unique<WaveguidePipe>();
  plenum_->init(in.plenumLengthM, in.plenumDiameterM, in.manifoldTempK,
                cfg.exhaust.ambientPressurePa, fs, cfg.exhaust.lossPerMeter,
                cfg.exhaust.lossCutoffHz, 0.05, 0.0);

  for (auto& r : runners_) junction_.addPortB(r.get());
  junction_.addPortA(plenum_.get());
  junction_.finalize();

  radiation_.init(in.plenumDiameterM * 0.5, plenum_->soundSpeed(), fs, 0.97);
  radGain_ = in.radiationGain;
}

void IntakeSystem::beginSample() {
  for (auto& r : runners_) r->propagate();
  plenum_->propagate();
}

double IntakeSystem::finishSample(double throttle) {
  junction_.scatter();
  radiation_.process(plenum_.get());
  // A nearly closed throttle blocks most of the escaping sound.
  const double open = 0.15 + 0.85 * throttle;
  return radGain_ * open * radiation_.radiated();
}

void IntakeSystem::clear() {
  for (auto& r : runners_) r->clear();
  plenum_->clear();
  radiation_.clear();
}

}  // namespace enginesim
