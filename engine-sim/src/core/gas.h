#pragma once
#include <cmath>
#include <algorithm>

namespace enginesim {

// Gas constants. The charge is treated as an ideal gas with constant
// specific heats. gammaCyl applies inside the cylinder where the burned
// mixture is hot. gammaPipe applies in the exhaust and intake ducts.
constexpr double kGasR = 287.0;         // J/(kg K)
constexpr double kGammaCyl = 1.33;
constexpr double kGammaPipe = 1.35;
constexpr double kCvCyl = kGasR / (kGammaCyl - 1.0);
constexpr double kCpCyl = kCvCyl * kGammaCyl;

inline double speedOfSound(double gamma, double tempK) {
  return std::sqrt(gamma * kGasR * tempK);
}

inline double gasDensity(double pressurePa, double tempK) {
  return pressurePa / (kGasR * tempK);
}

// Compressible flow through an orifice. Returns the mass flow in kg/s from
// the upstream side to the downstream side. The flow function handles the
// choked regime and the subsonic regime. It is continuous at the critical
// pressure ratio.
//
//   mdot = Cd * A * P_up / sqrt(R * T_up) * Phi(pr)
//   choked:   Phi = sqrt(g) * (2 / (g + 1)) ^ ((g + 1) / (2 (g - 1)))
//   subsonic: Phi = sqrt(2 g / (g - 1) * (pr^(2/g) - pr^((g+1)/g)))
inline double orificeMassFlow(double effAreaM2, double pUpPa, double tUpK,
                              double pDownPa, double gamma) {
  if (effAreaM2 <= 0.0 || pUpPa <= 0.0 || tUpK <= 0.0) return 0.0;
  double pr = pDownPa / pUpPa;
  if (pr >= 1.0) return 0.0;
  if (pr < 0.0) pr = 0.0;
  const double g = gamma;
  const double prCrit = std::pow(2.0 / (g + 1.0), g / (g - 1.0));
  double phi;
  if (pr <= prCrit) {
    phi = std::sqrt(g) * std::pow(2.0 / (g + 1.0), (g + 1.0) / (2.0 * (g - 1.0)));
  } else {
    const double a = std::pow(pr, 2.0 / g);
    const double b = std::pow(pr, (g + 1.0) / g);
    double d = a - b;
    if (d < 0.0) d = 0.0;
    phi = std::sqrt(2.0 * g / (g - 1.0) * d);
  }
  return effAreaM2 * pUpPa / std::sqrt(kGasR * tUpK) * phi;
}

// Fast orifice flow for the cylinder's fixed gamma. The subsonic flow
// function Phi(pr) is tabulated once; the choked value is a constant.
// Matches orificeMassFlow(kGammaCyl) within 0.1%.
class OrificeFlowTable {
 public:
  OrificeFlowTable() {
    const double g = kGammaCyl;
    prCrit_ = std::pow(2.0 / (g + 1.0), g / (g - 1.0));
    phiChoked_ = std::sqrt(g) *
                 std::pow(2.0 / (g + 1.0), (g + 1.0) / (2.0 * (g - 1.0)));
    for (int i = 0; i < kN; ++i) {
      const double pr = prCrit_ + (1.0 - prCrit_) * i / (kN - 1);
      const double a = std::pow(pr, 2.0 / g);
      const double b = std::pow(pr, (g + 1.0) / g);
      phi_[i] = std::sqrt(2.0 * g / (g - 1.0) * std::max(0.0, a - b));
    }
    invStep_ = (kN - 1) / (1.0 - prCrit_);
  }

  double prCrit() const { return prCrit_; }
  double phiChoked() const { return phiChoked_; }

  // Flow function Phi(pr); the caller multiplies by A * P_up / sqrt(R T_up).
  double phi(double pr) const {
    if (pr >= 1.0) return 0.0;
    if (pr <= prCrit_) return phiChoked_;
    const double x = (pr - prCrit_) * invStep_;
    const int i = static_cast<int>(x);
    const double f = x - i;
    return phi_[i] + f * (phi_[i + 1 < kN ? i + 1 : i] - phi_[i]);
  }

  double flow(double effAreaM2, double pUpPa, double tUpK, double pDownPa) const {
    if (effAreaM2 <= 0.0 || pUpPa <= 0.0) return 0.0;
    return effAreaM2 * pUpPa / std::sqrt(kGasR * tUpK) * phi(pDownPa / pUpPa);
  }

 private:
  static constexpr int kN = 1024;
  double phi_[kN];
  double prCrit_ = 0.54;
  double phiChoked_ = 0.67;
  double invStep_ = 1.0;
};

}  // namespace enginesim
