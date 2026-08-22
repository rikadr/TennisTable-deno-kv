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

  // Exact lift at cycle angle (deg in [0, 720)).
  double liftExact(double cycleDeg) const {
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

  // Tabulated lift with linear interpolation; call buildTable() first.
  // The curve is smooth, so 2048 points over 720 degrees stay within
  // a fraction of a micrometre of the exact value.
  void buildTable() {
    for (int i = 0; i <= kTabN; ++i)
      table_[i] = liftExact(720.0 * i / kTabN);
  }

  double lift(double cycleDeg) const {
    const double x = cycleDeg * (kTabN / 720.0);
    int i = static_cast<int>(x);
    const double f = x - i;
    if (i >= kTabN) i = kTabN - 1;
    return table_[i] + f * (table_[i + 1] - table_[i]);
  }

 private:
  static constexpr int kTabN = 2048;
  double table_[kTabN + 1] = {};
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
