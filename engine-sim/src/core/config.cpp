#include "core/config.h"

#include <fstream>
#include <stdexcept>

#include "nlohmann/json.hpp"

namespace enginesim {

using nlohmann::json;

namespace {

template <typename T>
void get(const json& j, const char* key, T& out) {
  if (j.contains(key)) out = j.at(key).get<T>();
}

void getChambers(const json& j, const char* key, std::vector<ChamberConfig>& out) {
  if (!j.contains(key)) return;
  out.clear();
  for (const auto& c : j.at(key)) {
    ChamberConfig ch;
    get(c, "length_m", ch.lengthM);
    get(c, "diameter_m", ch.diameterM);
    get(c, "temp_k", ch.tempK);
    get(c, "absorption", ch.absorption);
    out.push_back(ch);
  }
}

}  // namespace

SimConfig loadConfig(const std::string& path) {
  std::ifstream f(path);
  if (!f) throw std::runtime_error("cannot open config: " + path);
  json j = json::parse(f);

  SimConfig c;
  get(j, "name", c.name);

  if (j.contains("engine")) {
    const auto& e = j.at("engine");
    get(e, "cylinders", c.engine.cylinders);
    get(e, "layout", c.engine.layout);
    get(e, "v_angle_deg", c.engine.vAngleDeg);
    get(e, "bore_mm", c.engine.boreMm);
    get(e, "stroke_mm", c.engine.strokeMm);
    get(e, "rod_length_mm", c.engine.rodLengthMm);
    get(e, "compression_ratio", c.engine.compressionRatio);
    get(e, "firing_order", c.engine.firingOrder);
    get(e, "bank_of_cylinder", c.engine.bankOfCylinder);
    get(e, "even_fire", c.engine.evenFire);
    get(e, "idle_rpm", c.engine.idleRpm);
    get(e, "redline_rpm", c.engine.redlineRpm);
    get(e, "rev_limit_rpm", c.engine.revLimitRpm);
  }
  if (j.contains("combustion")) {
    const auto& b = j.at("combustion");
    get(b, "wiebe_a", c.combustion.wiebeA);
    get(b, "wiebe_m", c.combustion.wiebeM);
    get(b, "burn_duration_deg", c.combustion.burnDurationDeg);
    get(b, "spark_advance_deg", c.combustion.sparkAdvanceDeg);
    get(b, "spark_advance_idle_deg", c.combustion.sparkAdvanceIdleDeg);
    get(b, "heat_per_kg_air_j", c.combustion.heatPerKgAirJ);
    get(b, "combustion_efficiency", c.combustion.combustionEfficiency);
    get(b, "cycle_variation", c.combustion.cycleVariation);
    get(b, "idle_variation_boost", c.combustion.idleVariationBoost);
    get(b, "wall_temp_k", c.combustion.wallTempK);
    get(b, "wall_h_w_m2k", c.combustion.wallH);
  }
  if (j.contains("valvetrain")) {
    const auto& v = j.at("valvetrain");
    get(v, "intake_duration_deg", c.valvetrain.intakeDurationDeg);
    get(v, "exhaust_duration_deg", c.valvetrain.exhaustDurationDeg);
    get(v, "intake_lift_mm", c.valvetrain.intakeLiftMm);
    get(v, "exhaust_lift_mm", c.valvetrain.exhaustLiftMm);
    get(v, "intake_centerline_atdc_deg", c.valvetrain.intakeCenterlineAtdcDeg);
    get(v, "exhaust_centerline_atdc_deg", c.valvetrain.exhaustCenterlineAtdcDeg);
    get(v, "intake_valve_diameter_mm", c.valvetrain.intakeValveDiameterMm);
    get(v, "exhaust_valve_diameter_mm", c.valvetrain.exhaustValveDiameterMm);
    get(v, "valves_per_port", c.valvetrain.valvesPerPort);
    get(v, "discharge_coefficient", c.valvetrain.dischargeCoefficient);
  }
  if (j.contains("intake")) {
    const auto& i = j.at("intake");
    get(i, "manifold_temp_k", c.intake.manifoldTempK);
    get(i, "runner_length_m", c.intake.runnerLengthM);
    get(i, "runner_diameter_m", c.intake.runnerDiameterM);
    get(i, "plenum_length_m", c.intake.plenumLengthM);
    get(i, "plenum_diameter_m", c.intake.plenumDiameterM);
    get(i, "radiation_gain", c.intake.radiationGain);
  }
  if (j.contains("exhaust")) {
    const auto& x = j.at("exhaust");
    get(x, "ambient_pressure_pa", c.exhaust.ambientPressurePa);
    get(x, "ambient_temp_k", c.exhaust.ambientTempK);
    get(x, "runner_lengths_m", c.exhaust.runnerLengthsM);
    get(x, "runner_diameter_m", c.exhaust.runnerDiameterM);
    get(x, "runner_temp_k", c.exhaust.runnerTempK);
    get(x, "bank_pipe_lengths_m", c.exhaust.bankPipeLengthsM);
    get(x, "bank_pipe_diameter_m", c.exhaust.bankPipeDiameterM);
    get(x, "bank_pipe_temp_k", c.exhaust.bankPipeTempK);
    get(x, "mid_pipe_length_m", c.exhaust.midPipeLengthM);
    get(x, "mid_pipe_diameter_m", c.exhaust.midPipeDiameterM);
    get(x, "mid_pipe_temp_k", c.exhaust.midPipeTempK);
    getChambers(x, "chambers", c.exhaust.chambers);
    get(x, "connect_pipe_length_m", c.exhaust.connectPipeLengthM);
    get(x, "connect_pipe_diameter_m", c.exhaust.connectPipeDiameterM);
    get(x, "connect_pipe_temp_k", c.exhaust.connectPipeTempK);
    get(x, "tailpipe_length_m", c.exhaust.tailpipeLengthM);
    get(x, "tailpipe_diameter_m", c.exhaust.tailpipeDiameterM);
    get(x, "tailpipe_temp_k", c.exhaust.tailpipeTempK);
    get(x, "dual_exit", c.exhaust.dualExit);
    get(x, "exit_loss", c.exhaust.exitLoss);
    get(x, "flow_noise_gain", c.exhaust.flowNoiseGain);
    get(x, "flow_damping", c.exhaust.flowDamping);
    get(x, "exit_nl_loss", c.exhaust.exitNlLoss);
    get(x, "pipe_nl_loss", c.exhaust.pipeNlLoss);
    get(x, "flow_noise_cutoff_hz", c.exhaust.flowNoiseCutoffHz);
    get(x, "radiation_reflection", c.exhaust.radiationReflection);
    get(x, "tail_mix", c.exhaust.tailMix);
    get(x, "steepening_gain", c.exhaust.steepeningGain);
    get(x, "loss_per_meter", c.exhaust.lossPerMeter);
    get(x, "loss_cutoff_hz", c.exhaust.lossCutoffHz);
  }
  if (j.contains("mechanical")) {
    const auto& m = j.at("mechanical");
    get(m, "valvetrain_gain", c.mechanical.valvetrainGain);
    get(m, "tick_bandpass_hz", c.mechanical.tickBandpassHz);
  }
  if (j.contains("output")) {
    const auto& o = j.at("output");
    get(o, "sample_rate", c.output.sampleRate);
    get(o, "internal_oversample", c.output.internalOversample);
    get(o, "mic_highpass_hz", c.output.micHighpassHz);
    get(o, "mic_lowpass_hz", c.output.micLowpassHz);
    get(o, "exhaust_gain", c.output.exhaustGain);
    get(o, "intake_gain", c.output.intakeGain);
    get(o, "mechanical_gain", c.output.mechanicalGain);
    get(o, "master_gain", c.output.masterGain);
    get(o, "limiter_drive", c.output.limiterDrive);
  }

  // Validation.
  const int n = c.engine.cylinders;
  if (n < 1 || n > 16) throw std::runtime_error("cylinders out of range");
  if (static_cast<int>(c.engine.firingOrder.size()) != n)
    throw std::runtime_error("firing_order size does not match cylinders");
  if (static_cast<int>(c.engine.bankOfCylinder.size()) != n)
    throw std::runtime_error("bank_of_cylinder size does not match cylinders");
  if (static_cast<int>(c.exhaust.runnerLengthsM.size()) != n)
    throw std::runtime_error("runner_lengths_m size does not match cylinders");
  if (c.engine.compressionRatio <= 1.0)
    throw std::runtime_error("compression_ratio must exceed 1");
  if (c.output.internalOversample < 1 || c.output.internalOversample > 8)
    throw std::runtime_error("internal_oversample out of range");
  return c;
}

}  // namespace enginesim
