#pragma once
#include "core/config.h"
#include "core/gas.h"
#include "core/kinematics.h"
#include "core/util.h"
#include "core/valve.h"

namespace enginesim {

// Port conditions the cylinder sees this sample. The port's absolute
// pressure depends on the flow itself: P = base + 2 p_in + Z0 U. The
// cylinder solves the coupled valve/line equation implicitly.
struct PortState {
  double basePressurePa = 101325.0;  // ambient (exhaust) or manifold (intake)
  double incomingWave = 0.0;         // p- arriving at the port
  double impedance = 1.0;            // Z0 = rho c / S of the duct
  double gasTempK = 300.0;           // duct gas temperature (for backflow)
  double density = 1.2;              // duct gas density
};

struct CylinderOutputs {
  double mdotExhaust = 0.0;  // kg/s, positive out of the cylinder
  double mdotIntake = 0.0;   // kg/s, positive into the cylinder
  double pressurePa = 0.0;
  double tempK = 0.0;
  bool valveEvent = false;   // an intake or exhaust valve opened or closed
};

// One cylinder: crank-angle volume, ideal-gas energy balance, Wiebe heat
// release, wall heat loss, and compressible valve flow on both ports.
class Cylinder {
 public:
  void init(const SimConfig& cfg, int index, double phaseDeg, uint64_t seed);

  // Advance by dThetaDeg of crank rotation over dt seconds.
  CylinderOutputs step(double globalCycleDeg, double dThetaDeg, double dt,
                       const PortState& intakePort, const PortState& exhaustPort,
                       double intakeTempK, bool sparkEnabled);

  void setVariationScale(double s) { varScale_ = s; }
  // Overrun/limiter pops: when the spark is cut, popChance of the cycles
  // ignite late in the cycle instead, with popHeat of a normal charge.
  void setOverrun(double popChance, double popHeat) {
    popChance_ = popChance;
    popHeat_ = popHeat;
  }
  void setSparkAdvance(double advDeg) {
    sparkAngleDeg_ = 720.0 - advDeg;
    if (sparkAngleDeg_ >= 720.0) sparkAngleDeg_ -= 720.0;
  }

  double phaseDeg() const { return phaseDeg_; }
  double pressurePa() const { return p_; }
  double tempK() const { return t_; }

 private:
  double wiebeX(double tau) const;

  CrankGeometry geom_;
  CamLobe intakeCam_, exhaustCam_;
  ValveGeometry intakeValve_, exhaustValve_;

  double phaseDeg_ = 0.0;   // this cylinder's TDC-firing offset in the cycle
  double prevLocalDeg_ = 0.0;

  // Gas state.
  double m_ = 4e-4;  // kg
  double t_ = 400.0; // K
  double p_ = 101325.0;

  // Combustion state.
  double wiebeA_ = 5.0, wiebeM_ = 2.0;
  double burnBaseDeg_ = 55.0;
  double sparkAngleDeg_ = 698.0;  // cycle angle where burn starts
  double heatPerKgAir_ = 2.8e6;
  double combEff_ = 0.96;
  double cycleVar_ = 0.04;
  double varScale_ = 1.0;
  double burnProgressDeg_ = -1.0;  // < 0 means not burning
  double popPendingDeg_ = -1.0;    // countdown to a scheduled late burn
  double popChance_ = 0.0;
  double popHeat_ = 0.3;
  double burnDurDeg_ = 55.0;
  double qTotal_ = 0.0;
  double prevXb_ = 0.0;

  // Walls.
  double wallTempK_ = 450.0;
  double wallH_ = 500.0;
  double boreCircumference_ = 0.3;

  // Cached lifts from the previous step (valve event detection).
  double prevLiftIn_ = 0.0;
  double prevLiftEx_ = 0.0;

  // Warm starts for the port-flow fixed point (cylinder-to-duct sign).
  double warmIn_ = 0.0;
  double warmEx_ = 0.0;

  Rng rng_{1};
};

}  // namespace enginesim
