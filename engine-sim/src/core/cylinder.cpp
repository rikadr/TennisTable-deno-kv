#include "core/cylinder.h"

#include <algorithm>
#include <cmath>

namespace enginesim {

void Cylinder::init(const SimConfig& cfg, int index, double phaseDeg,
                    uint64_t seed) {
  geom_.set(cfg.engine.boreMm * 1e-3, cfg.engine.strokeMm * 1e-3,
            cfg.engine.rodLengthMm * 1e-3, cfg.engine.compressionRatio);

  intakeCam_.centerlineDeg = cfg.valvetrain.intakeCenterlineAtdcDeg + 360.0;
  intakeCam_.durationDeg = cfg.valvetrain.intakeDurationDeg;
  intakeCam_.maxLiftM = cfg.valvetrain.intakeLiftMm * 1e-3;
  exhaustCam_.centerlineDeg = cfg.valvetrain.exhaustCenterlineAtdcDeg;
  exhaustCam_.durationDeg = cfg.valvetrain.exhaustDurationDeg;
  exhaustCam_.maxLiftM = cfg.valvetrain.exhaustLiftMm * 1e-3;

  intakeValve_.headDiameterM = cfg.valvetrain.intakeValveDiameterMm * 1e-3;
  intakeValve_.dischargeCoeff = cfg.valvetrain.dischargeCoefficient;
  intakeValve_.valvesPerPort = cfg.valvetrain.valvesPerPort;
  exhaustValve_.headDiameterM = cfg.valvetrain.exhaustValveDiameterMm * 1e-3;
  exhaustValve_.dischargeCoeff = cfg.valvetrain.dischargeCoefficient;
  exhaustValve_.valvesPerPort = cfg.valvetrain.valvesPerPort;

  wiebeA_ = cfg.combustion.wiebeA;
  wiebeM_ = cfg.combustion.wiebeM;
  burnBaseDeg_ = cfg.combustion.burnDurationDeg;
  burnDurDeg_ = burnBaseDeg_;
  sparkAngleDeg_ = wrapAngle(720.0 - cfg.combustion.sparkAdvanceDeg, 720.0);
  heatPerKgAir_ = cfg.combustion.heatPerKgAirJ;
  combEff_ = cfg.combustion.combustionEfficiency;
  cycleVar_ = cfg.combustion.cycleVariation;
  wallTempK_ = cfg.combustion.wallTempK;
  wallH_ = cfg.combustion.wallH;

  phaseDeg_ = phaseDeg;
  prevLocalDeg_ = wrapAngle(-phaseDeg, 720.0);
  rng_ = Rng(seed + 0x1000ull * static_cast<uint64_t>(index + 1));

  // Start filled with warm residual gas at ambient pressure.
  const double v0 = geom_.volume(deg2rad(prevLocalDeg_ * 0.5));
  t_ = 500.0;
  p_ = 101325.0;
  m_ = p_ * v0 / (kGasR * t_);
}

double Cylinder::wiebeX(double tau) const {
  if (tau <= 0.0) return 0.0;
  if (tau >= 1.0) tau = 1.0;
  return 1.0 - std::exp(-wiebeA_ * std::pow(tau, wiebeM_ + 1.0));
}

namespace {

// Solve the coupled valve/duct flow. The duct pressure rises (or falls)
// with the flow itself: P_port = base + 2 p_in + Z0 * mdot / rho.
// Positive result: flow from the cylinder into the duct.
// Negative result: backflow from the duct into the cylinder.
double solvePortFlow(double area, double pCyl, double tCyl,
                     const PortState& port) {
  if (area <= 0.0) return 0.0;
  const double pStill = port.basePressurePa + 2.0 * port.incomingWave;
  const double zOverRho = port.impedance / port.density;

  if (pCyl >= pStill) {
    // Outflow. The choked branch does not depend on the duct pressure.
    const double g = kGammaCyl;
    const double prCrit = std::pow(2.0 / (g + 1.0), g / (g - 1.0));
    const double mdotChoked = orificeMassFlow(area, pCyl, tCyl, 0.0, g);
    if (pStill + zOverRho * mdotChoked <= prCrit * pCyl) return mdotChoked;
    // Subsonic: damped fixed point on mdot. The map is contracting
    // because the duct back-pressure rises slowly with mdot.
    double mdot = 0.5 * mdotChoked;
    for (int it = 0; it < 6; ++it) {
      double pPort = pStill + zOverRho * mdot;
      if (pPort > pCyl) pPort = pCyl;
      const double f = orificeMassFlow(area, pCyl, tCyl, pPort, g);
      mdot = 0.5 * (mdot + f);
    }
    return mdot;
  }

  // Backflow: the duct is the upstream side, and drawing flow out of it
  // lowers the duct pressure.
  const double g = kGammaCyl;
  double mdot = 0.0;
  for (int it = 0; it < 6; ++it) {
    double pPort = pStill - zOverRho * mdot;
    if (pPort < pCyl) pPort = pCyl;
    const double f = orificeMassFlow(area, pPort, port.gasTempK, pCyl, g);
    mdot = 0.5 * (mdot + f);
  }
  return -mdot;
}

}  // namespace

CylinderOutputs Cylinder::step(double globalCycleDeg, double dThetaDeg,
                               double dt, const PortState& intakePort,
                               const PortState& exhaustPort,
                               double intakeTempK, bool sparkEnabled) {
  CylinderOutputs out;
  const double localDeg = wrapAngle(globalCycleDeg - phaseDeg_, 720.0);
  const double thetaRad = deg2rad(localDeg);

  const double v = geom_.volume(thetaRad);
  const double dv = geom_.dVolume(thetaRad) * deg2rad(dThetaDeg);
  p_ = m_ * kGasR * t_ / v;

  // --- Valve lift and flow ---
  const double liftIn = intakeCam_.lift(localDeg);
  const double liftEx = exhaustCam_.lift(localDeg);
  const double prevLiftIn = intakeCam_.lift(prevLocalDeg_);
  const double prevLiftEx = exhaustCam_.lift(prevLocalDeg_);
  out.valveEvent = ((liftIn > 0.0) != (prevLiftIn > 0.0)) ||
                   ((liftEx > 0.0) != (prevLiftEx > 0.0));

  const double aIn = intakeValve_.effectiveArea(liftIn);
  const double aEx = exhaustValve_.effectiveArea(liftEx);

  // Intake: positive flow enters the cylinder from the runner.
  // The solver's sign convention is cylinder-to-duct, so negate.
  double mdotIn = -solvePortFlow(aIn, p_, t_, intakePort);

  // Exhaust: positive flow leaves the cylinder into the runner.
  double mdotEx = solvePortFlow(aEx, p_, t_, exhaustPort);

  // Bound the mass change for stability.
  const double maxDm = 0.2 * m_;
  double dmIn = std::clamp(mdotIn * dt, -maxDm, maxDm);
  double dmEx = std::clamp(mdotEx * dt, -maxDm, maxDm);
  mdotIn = dmIn / dt;
  mdotEx = dmEx / dt;

  // --- Combustion trigger at the spark angle ---
  const double distNow = wrapAngle(localDeg - sparkAngleDeg_, 720.0);
  const double distPrev = wrapAngle(prevLocalDeg_ - sparkAngleDeg_, 720.0);
  if (distNow < distPrev && distNow < 90.0) {
    if (sparkEnabled) {
      const double vQ = 1.0 + cycleVar_ * rng_.gauss();
      const double vDur = 1.0 + 0.6 * cycleVar_ * rng_.gauss();
      qTotal_ = m_ * heatPerKgAir_ * combEff_ * std::max(0.2, vQ);
      burnDurDeg_ = burnBaseDeg_ * std::clamp(vDur, 0.6, 1.6);
      burnProgressDeg_ = 0.0;
      prevXb_ = 0.0;
    } else {
      burnProgressDeg_ = -1.0;  // misfire (rev limiter cut)
    }
  }

  double dQComb = 0.0;
  if (burnProgressDeg_ >= 0.0) {
    burnProgressDeg_ += dThetaDeg;
    const double tau = burnProgressDeg_ / burnDurDeg_;
    const double xb = wiebeX(tau);
    dQComb = qTotal_ * (xb - prevXb_);
    prevXb_ = xb;
    if (tau >= 1.2) burnProgressDeg_ = -1.0;
  }

  // --- Wall heat loss ---
  const double height = v / geom_.boreArea;
  const double aWall = 2.5 * geom_.boreArea + kPi * std::sqrt(4.0 * geom_.boreArea / kPi) * height;
  const double dQWall = wallH_ * aWall * (t_ - wallTempK_) * dt;

  // --- Energy balance ---
  // dU = -P dV + dQ_comb - dQ_wall + h_in dm_in - h_out dm_out.
  double dU = -p_ * dv + dQComb - dQWall;
  if (dmIn >= 0.0) {
    dU += kCpCyl * intakeTempK * dmIn;
  } else {
    dU += kCpCyl * t_ * dmIn;  // reverse flow out through the intake
  }
  if (dmEx >= 0.0) {
    dU -= kCpCyl * t_ * dmEx;
  } else {
    dU -= kCpCyl * exhaustPort.gasTempK * dmEx;  // backflow from the runner
  }

  const double uOld = m_ * kCvCyl * t_;
  double mNew = m_ + dmIn - dmEx;
  if (mNew < 1e-6) mNew = 1e-6;
  double tNew = (uOld + dU) / (mNew * kCvCyl);
  tNew = std::clamp(tNew, 220.0, 3400.0);

  m_ = mNew;
  t_ = tNew;
  const double vNext = geom_.volume(deg2rad(wrapAngle(localDeg, 720.0)));
  p_ = m_ * kGasR * t_ / vNext;
  prevLocalDeg_ = localDeg;

  out.mdotExhaust = mdotEx;
  out.mdotIntake = mdotIn;
  out.pressurePa = p_;
  out.tempK = t_;
  return out;
}

}  // namespace enginesim
