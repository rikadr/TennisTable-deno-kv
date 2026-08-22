#pragma once
#include <cmath>
#include "core/util.h"

namespace enginesim {

// Slider-crank kinematics for one cylinder.
// theta is the crank angle in radians. theta = 0 is TDC of this cylinder.
struct CrankGeometry {
  double crankRadius = 0.0;   // m, stroke / 2
  double rodLength = 0.0;     // m, centre to centre
  double boreArea = 0.0;      // m^2
  double clearanceVol = 0.0;  // m^3
  double sweptVol = 0.0;      // m^3

  void set(double boreM, double strokeM, double rodM, double compressionRatio) {
    crankRadius = strokeM * 0.5;
    rodLength = rodM;
    boreArea = kPi * 0.25 * boreM * boreM;
    sweptVol = boreArea * strokeM;
    clearanceVol = sweptVol / (compressionRatio - 1.0);
  }

  // Distance from the crank axis to the piston pin.
  double pistonPos(double theta) const {
    const double s = std::sin(theta);
    const double c = std::cos(theta);
    const double under = rodLength * rodLength - crankRadius * crankRadius * s * s;
    return crankRadius * c + std::sqrt(under);
  }

  // Cylinder volume at crank angle theta.
  double volume(double theta) const {
    const double xMax = crankRadius + rodLength;
    return clearanceVol + boreArea * (xMax - pistonPos(theta));
  }

  // dV / dtheta, analytic.
  double dVolume(double theta) const {
    const double s = std::sin(theta);
    const double c = std::cos(theta);
    const double under = rodLength * rodLength - crankRadius * crankRadius * s * s;
    const double dx = -crankRadius * s -
                      (crankRadius * crankRadius * s * c) / std::sqrt(under);
    return -boreArea * dx;
  }

  // Volume and dV/dtheta in one pass (shares sin, cos, sqrt).
  void volumeAndDeriv(double theta, double& vol, double& dVol) const {
    const double s = std::sin(theta);
    const double c = std::cos(theta);
    const double under =
        rodLength * rodLength - crankRadius * crankRadius * s * s;
    const double root = std::sqrt(under);
    const double x = crankRadius * c + root;
    vol = clearanceVol + boreArea * (crankRadius + rodLength - x);
    const double dx = -crankRadius * s - (crankRadius * crankRadius * s * c) / root;
    dVol = -boreArea * dx;
  }

  // Tabulated volume and derivative over one crank revolution, indexed by
  // crank angle in degrees. Both curves are smooth; 4096 points keep the
  // linear-interpolation error below 1e-9 m^3. Call buildTables() once.
  void buildTables() {
    for (int i = 0; i <= kTabN; ++i) {
      const double th = kTwoPi * i / kTabN;
      volumeAndDeriv(th, volTab_[i], dVolTab_[i]);
    }
  }

  // crankDeg must lie in [0, 360).
  void volumeAndDerivFast(double crankDeg, double& vol, double& dVol) const {
    const double x = crankDeg * (kTabN / 360.0);
    int i = static_cast<int>(x);
    const double f = x - i;
    if (i >= kTabN) i = kTabN - 1;
    vol = volTab_[i] + f * (volTab_[i + 1] - volTab_[i]);
    dVol = dVolTab_[i] + f * (dVolTab_[i + 1] - dVolTab_[i]);
  }

 private:
  static constexpr int kTabN = 4096;
  double volTab_[kTabN + 1] = {};
  double dVolTab_[kTabN + 1] = {};
};

}  // namespace enginesim
