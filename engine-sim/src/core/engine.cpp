#include "core/engine.h"

#include <cmath>

namespace enginesim {

void Engine::init(const SimConfig& cfg, uint64_t seed) {
  cfg_ = cfg;
  fs_ = static_cast<double>(cfg.internalRate());
  dt_ = 1.0 / fs_;
  cycleDeg_ = 0.0;
  rpm_ = cfg.engine.idleRpm;

  const int n = cfg.engine.cylinders;
  cylinders_.assign(static_cast<size_t>(n), Cylinder());

  // Even-fire: the k-th cylinder in the firing order reaches TDC-firing at
  // k * 720 / n cycle degrees.
  const double spacing = 720.0 / n;
  for (int k = 0; k < n; ++k) {
    const int cylId = cfg.engine.firingOrder[k] - 1;
    cylinders_[cylId].init(cfg, cylId, spacing * k, seed);
  }

  exhaust_.init(cfg, fs_);
  intake_.init(cfg, fs_);
  mech_.init(cfg, fs_, seed);

  flowNoiseRng_ = Rng(seed + 0xF10Bull);
  flowNoiseLp_.assign(static_cast<size_t>(n), OnePoleLP());
  for (auto& lp : flowNoiseLp_) lp.setCutoff(cfg.exhaust.flowNoiseCutoffHz, fs_);
}

double Engine::step() {
  // Crank advance: 6 deg per second per rpm.
  const double dTheta = 6.0 * rpm_ * dt_;
  cycleDeg_ = wrapAngle(cycleDeg_ + dTheta, 720.0);

  // Quasi-static manifold pressure from throttle, smoothed.
  const double target =
      cfg_.exhaust.ambientPressurePa * (0.25 + 0.75 * throttle_);
  manifoldPa_ += (target - manifoldPa_) * (dt_ / (dt_ + 0.05));

  // Rev limiter with hysteresis: cut spark above the limit.
  if (rpm_ > cfg_.engine.revLimitRpm) sparkEnabled_ = false;
  else if (rpm_ < cfg_.engine.revLimitRpm - 200.0) sparkEnabled_ = true;

  exhaust_.beginSample();
  intake_.beginSample();

  const int n = cfg_.engine.cylinders;
  double mechTrig = 0.0;
  for (int i = 0; i < n; ++i) {
    PortState exPort;
    exPort.basePressurePa = cfg_.exhaust.ambientPressurePa;
    exPort.incomingWave = exhaust_.portIncoming(i);
    exPort.impedance = exhaust_.portImpedance(i);
    exPort.gasTempK = exhaust_.portTempK(i);
    exPort.density = exhaust_.portDensity(i);

    PortState inPort;
    inPort.basePressurePa = manifoldPa_;
    inPort.incomingWave = intake_.portIncoming(i);
    inPort.impedance = intake_.portImpedance(i);
    inPort.gasTempK = cfg_.intake.manifoldTempK;
    inPort.density = intake_.portDensity(i);

    const CylinderOutputs out = cylinders_[i].step(
        cycleDeg_, dTheta, dt_, inPort, exPort, cfg_.intake.manifoldTempK,
        sparkEnabled_);

    // Convert mass flow to volume velocity in each duct.
    const double uEx = out.mdotExhaust / exhaust_.portDensity(i);
    const double uIn = -out.mdotIntake / intake_.portDensity(i);

    // Port jet turbulence: band-limited noise scaled by the dynamic
    // pressure of the port jet. Physical source, not output EQ.
    double noiseP = 0.0;
    if (cfg_.exhaust.flowNoiseGain > 0.0) {
      const double uJet = uEx / exhaust_.runnerArea(i);
      const double q = 0.5 * exhaust_.portDensity(i) * uJet * uJet;
      noiseP = cfg_.exhaust.flowNoiseGain * q *
               flowNoiseLp_[i].process(flowNoiseRng_.bipolar());
    }
    exhaust_.setPortFlow(i, uEx, noiseP);
    intake_.setPortFlow(i, uIn);

    if (out.valveEvent) mechTrig += 0.4 + 0.6 * (rpm_ / cfg_.engine.redlineRpm);
  }

  if (mechTrig > 0.0) mech_.trigger(mechTrig);

  lastExhaust_ = exhaust_.finishSample();
  lastIntake_ = intake_.finishSample(throttle_);
  const double mechOut = mech_.process() * cfg_.output.mechanicalGain;

  const double mix = cfg_.output.exhaustGain * lastExhaust_ +
                     cfg_.output.intakeGain * lastIntake_;
  return cfg_.output.masterGain * mix + mechOut;
}

void Engine::clearAcoustics() {
  exhaust_.clear();
  intake_.clear();
  mech_.clear();
}

}  // namespace enginesim
