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
};

}  // namespace enginesim
