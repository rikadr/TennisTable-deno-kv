#pragma once
#include <cstdint>
#include <vector>

#include "core/config.h"
#include "core/cylinder.h"
#include "core/exhaust_system.h"
#include "core/intake_system.h"
#include "core/mechanical.h"
#include "core/waveguide.h"

namespace enginesim {

// The complete engine. step() advances one internal sample and returns the
// microphone-mix sample (unclamped, before the limiter). All memory is
// allocated in init(); step() is allocation-free.
class Engine {
 public:
  void init(const SimConfig& cfg, uint64_t seed);

  void setRpm(double rpm) { rpm_ = rpm; }
  void setThrottle(double t) { throttle_ = t < 0.0 ? 0.0 : (t > 1.0 ? 1.0 : t); }
  double rpm() const { return rpm_; }

  double step();

  double crankCycleDeg() const { return cycleDeg_; }
  double cylinderPressure(int i) const { return cylinders_[i].pressurePa(); }
  double lastExhaustRad() const { return lastExhaust_; }
  double debugCylPressure() const { return dbgCylP_; }
  double debugPortWave() const { return dbgPortW_; }
  double debugExitU() const { return dbgExitU_; }
  double lastIntakeRad() const { return lastIntake_; }
  double internalRate() const { return fs_; }

  void clearAcoustics();

 private:
  SimConfig cfg_;
  double fs_ = 96000.0;
  double dt_ = 1.0 / 96000.0;
  double cycleDeg_ = 0.0;   // crank position within the 720-degree cycle
  double rpm_ = 650.0;
  double throttle_ = 0.1;
  double manifoldPa_ = 40000.0;
  bool sparkEnabled_ = true;

  std::vector<Cylinder> cylinders_;
  std::vector<OnePoleLP> flowNoiseLp_;
  Rng flowNoiseRng_{1};
  ExhaustSystem exhaust_;
  IntakeSystem intake_;
  MechanicalNoise mech_;

  double lastExhaust_ = 0.0;
  double lastIntake_ = 0.0;
  double dbgCylP_ = 0.0;
  double dbgPortW_ = 0.0;
  double dbgExitU_ = 0.0;
  double emaMdot_ = 0.0;
  int flowUpdateCounter_ = 0;
};

}  // namespace enginesim
