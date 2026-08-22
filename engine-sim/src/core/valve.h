#pragma once
#include <cmath>
#include "core/util.h"

namespace enginesim {

// Cam lobe with a raised-cosine lift curve. The curve has zero lift and
// zero slope at both ends. Angles are in degrees of crank rotation over a
// 720-degree cycle. centerline is the angle of maximum lift measured from
// this cylinder's firing TDC.
struct CamLobe {
  double centerlineDeg = 0.0;
  double durationDeg = 235.0;
  double maxLiftM = 0.010;

  // Lift at cycle angle (deg in [0, 720)).
  double lift(double cycleDeg) const {
    double d = cycleDeg - centerlineDeg;
    // Fold into [-360, 360) so the lobe works across the cycle wrap.
    if (d > 360.0) d -= 720.0;
    if (d < -360.0) d += 720.0;
    const double half = durationDeg * 0.5;
    if (d <= -half || d >= half) return 0.0;
    const double x = (d + half) / durationDeg;  // 0..1 across the event
    const double c = 0.5 - 0.5 * std::cos(kTwoPi * x);
    return maxLiftM * c;
  }
};

// Poppet valve flow geometry. The effective area is the smaller of the
// curtain area and the throat area, scaled by the discharge coefficient
// and the number of valves per port.
struct ValveGeometry {
  double headDiameterM = 0.032;
  double dischargeCoeff = 0.65;
  int valvesPerPort = 2;

  double effectiveArea(double liftM) const {
    if (liftM <= 0.0) return 0.0;
    const double curtain = kPi * headDiameterM * liftM;
    const double throat = kPi * 0.25 * headDiameterM * headDiameterM * 0.85;
    return dischargeCoeff * valvesPerPort * std::min(curtain, throat);
  }
};

}  // namespace enginesim
