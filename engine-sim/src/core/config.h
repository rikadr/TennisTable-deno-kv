#pragma once
#include <string>
#include <vector>

namespace enginesim {

// Mirrors configs/*.json. All lengths in metres, angles in degrees,
// pressures in Pa, temperatures in K, unless the name says otherwise.

struct EngineConfig {
  int cylinders = 6;
  std::string layout = "V";
  double vAngleDeg = 60.0;
  double boreMm = 94.0;
  double strokeMm = 83.0;
  double rodLengthMm = 147.5;
  double compressionRatio = 10.8;
  std::vector<int> firingOrder = {1, 2, 3, 4, 5, 6};
  std::vector<int> bankOfCylinder = {0, 1, 0, 1, 0, 1};
  bool evenFire = true;
  double idleRpm = 650.0;
  double redlineRpm = 6500.0;
  double revLimitRpm = 6600.0;
};

struct CombustionConfig {
  double wiebeA = 5.0;
  double wiebeM = 2.0;
  double burnDurationDeg = 55.0;
  double sparkAdvanceDeg = 22.0;
  // Idle spark is retarded for stability; combustion ends late and the
  // exhaust valve opens on high pressure (the idle pop). Advance blends
  // from idle value to sparkAdvanceDeg with manifold pressure.
  double sparkAdvanceIdleDeg = 6.0;
  double heatPerKgAirJ = 2.8e6;
  double combustionEfficiency = 0.96;
  double cycleVariation = 0.04;
  // Combustion variability rises at low load (lean, low turbulence).
  // Effective variation = cycleVariation * (1 + idleVariationBoost *
  // (1 - manifold/ambient)).
  double idleVariationBoost = 0.0;
  double wallTempK = 450.0;
  double wallH = 500.0;  // W/(m^2 K)
};

struct ValvetrainConfig {
  double intakeDurationDeg = 235.0;
  double exhaustDurationDeg = 235.0;
  double intakeLiftMm = 10.0;
  double exhaustLiftMm = 10.0;
  double intakeCenterlineAtdcDeg = 110.0;
  double exhaustCenterlineAtdcDeg = 250.0;
  double intakeValveDiameterMm = 37.0;
  double exhaustValveDiameterMm = 32.0;
  int valvesPerPort = 2;
  double dischargeCoefficient = 0.65;
};

struct IntakeConfig {
  double manifoldTempK = 330.0;
  double runnerLengthM = 0.32;
  double runnerDiameterM = 0.042;
  double plenumLengthM = 0.35;
  double plenumDiameterM = 0.12;
  double radiationGain = 0.25;
};

struct ChamberConfig {
  double lengthM = 0.45;
  double diameterM = 0.20;
  double tempK = 650.0;
  double absorption = 0.3;  // 0..1, extra loss inside the chamber
};

struct ExhaustConfig {
  double ambientPressurePa = 101325.0;
  double ambientTempK = 293.0;
  std::vector<double> runnerLengthsM = {0.24, 0.26, 0.18, 0.20, 0.21, 0.23};
  double runnerDiameterM = 0.038;
  double runnerTempK = 1050.0;
  std::vector<double> bankPipeLengthsM = {0.9, 1.1};
  double bankPipeDiameterM = 0.054;
  double bankPipeTempK = 900.0;
  double midPipeLengthM = 0.5;
  double midPipeDiameterM = 0.057;
  double midPipeTempK = 750.0;
  std::vector<ChamberConfig> chambers;
  double connectPipeLengthM = 0.6;
  double connectPipeDiameterM = 0.054;
  double connectPipeTempK = 700.0;
  double tailpipeLengthM = 0.35;
  double tailpipeDiameterM = 0.054;
  double tailpipeTempK = 550.0;
  // Dual exit: after the bank pipes an X junction feeds one full chain
  // (mid pipe, chambers, tailpipe) per bank. tailMix weights each exit
  // at the microphone.
  bool dualExit = false;
  std::vector<double> tailMix = {1.0, 0.35};
  double exitLoss = 0.0;             // extra broadband loss in the tailpipe
  double radiationReflection = 0.985;
  // Turbulence noise injected at each exhaust port, scaled by the local
  // dynamic pressure 0.5 rho u^2 of the port jet.
  double flowNoiseGain = 0.0;
  double flowNoiseCutoffHz = 3000.0;
  // Grazing-flow attenuation: extra loss exp(-k * M * L) per traversal,
  // M from the mean exhaust mass flow through each pipe.
  double flowDamping = 0.0;
  // Quadratic exit-jet loss coefficient (see RadiationEnd).
  double exitNlLoss = 0.0;
  // Distributed nonlinear (turbulent) loss inside every pipe, per metre.
  double pipeNlLoss = 0.0;
  double steepeningGain = 1.0;
  double lossPerMeter = 0.06;
  double lossCutoffHz = 8000.0;
};

struct MechanicalConfig {
  double valvetrainGain = 0.008;
  double tickBandpassHz = 3200.0;
};

struct OutputConfig {
  int sampleRate = 48000;
  int internalOversample = 2;
  // Microphone and recording-chain model (one-pole each; 0 disables).
  // This models the reference recording setup: the off-axis microphone
  // position (high frequencies beam forward, so off-axis hears less) and
  // the recorder's low-frequency cut. Calibrated once per reference
  // setup, then frozen. It is not a tuning EQ.
  double micHighpassHz = 0.0;
  double micLowpassHz = 0.0;
  double exhaustGain = 1.0;
  double intakeGain = 0.12;
  double mechanicalGain = 1.0;
  double masterGain = 6e-5;
  double limiterDrive = 1.0;
};

struct SimConfig {
  std::string name = "engine";
  EngineConfig engine;
  CombustionConfig combustion;
  ValvetrainConfig valvetrain;
  IntakeConfig intake;
  ExhaustConfig exhaust;
  MechanicalConfig mechanical;
  OutputConfig output;

  int internalRate() const { return output.sampleRate * output.internalOversample; }
};

// Loads a config from a JSON file. Throws std::runtime_error on parse or
// validation failure.
SimConfig loadConfig(const std::string& path);

}  // namespace enginesim
