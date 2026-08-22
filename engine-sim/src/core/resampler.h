#pragma once
#include <array>
#include <cmath>
#include <cstddef>

#include "core/util.h"

namespace enginesim {

// 2:1 half-band decimator with a 31-tap windowed-sinc low-pass.
// Feed internal-rate samples with push(); an output sample is ready every
// second push.
class HalfBandDecimator {
 public:
  HalfBandDecimator() {
    // Blackman-windowed sinc, cutoff at 0.5 of the output Nyquist margin.
    constexpr int N = 31;
    const int mid = N / 2;
    double sum = 0.0;
    for (int i = 0; i < N; ++i) {
      const int k = i - mid;
      const double x = static_cast<double>(k);
      const double sinc = k == 0 ? 1.0 : std::sin(0.5 * kPi * x) / (0.5 * kPi * x);
      const double w = 0.42 - 0.5 * std::cos(kTwoPi * i / (N - 1)) +
                       0.08 * std::cos(2.0 * kTwoPi * i / (N - 1));
      taps_[i] = 0.5 * sinc * w;
      sum += taps_[i];
    }
    for (auto& t : taps_) t /= sum;  // unity DC gain
    hist_.fill(0.0);
  }

  // Returns true when out contains a new output sample.
  bool push(double x, double& out) {
    hist_[pos_] = x;
    pos_ = (pos_ + 1) & 63;
    phase_ ^= 1;
    if (phase_ != 0) return false;
    double acc = 0.0;
    for (int i = 0; i < 31; ++i) {
      acc += taps_[i] * hist_[(pos_ - 1 - i) & 63];
    }
    out = acc;
    return true;
  }

  void clear() {
    hist_.fill(0.0);
    pos_ = 0;
    phase_ = 0;
  }

 private:
  std::array<double, 31> taps_{};
  std::array<double, 64> hist_{};
  int pos_ = 0;
  int phase_ = 0;
};

// Identity pass-through used when internal_oversample is 1.
class Passthrough {
 public:
  bool push(double x, double& out) {
    out = x;
    return true;
  }
};

// Soft limiter: transparent at low level, saturates smoothly, never clips.
// Pade approximation of tanh, monotonic on [-3, 3], exact to 1e-3 below
// |x| = 1; clamps to +-1 outside. Avoids a libm call per sample.
inline double softLimit(double x, double drive) {
  double t = x * drive;
  if (t > 3.0) t = 3.0;
  if (t < -3.0) t = -3.0;
  const double t2 = t * t;
  return t * (27.0 + t2) / (27.0 + 9.0 * t2) / drive;
}

// One-pole DC blocker at about 5 Hz. The open pipe end radiates nothing at
// DC; this removes the numeric residue of that model.
class DcBlocker {
 public:
  void init(double fs) { a_ = 1.0 - kTwoPi * 5.0 / fs; }
  double process(double x) {
    const double y = x - x1_ + a_ * y1_;
    x1_ = x;
    y1_ = y;
    return y;
  }
  void clear() { x1_ = y1_ = 0.0; }

 private:
  double a_ = 0.999;
  double x1_ = 0.0, y1_ = 0.0;
};

}  // namespace enginesim
