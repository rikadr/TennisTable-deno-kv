#pragma once
#include <cmath>
#include <cstdint>
#include <algorithm>

namespace enginesim {

constexpr double kPi = 3.14159265358979323846;
constexpr double kTwoPi = 2.0 * kPi;

inline double deg2rad(double d) { return d * kPi / 180.0; }
inline double rad2deg(double r) { return r * 180.0 / kPi; }

// Wrap an angle into [0, period).
inline double wrapAngle(double a, double period) {
  double r = std::fmod(a, period);
  if (r < 0.0) r += period;
  return r;
}

// Deterministic xorshift64* random generator. The audio path must not
// depend on the platform random source.
class Rng {
 public:
  explicit Rng(uint64_t seed = 1) : state_(seed ? seed : 0x9E3779B97F4A7C15ull) {}

  uint64_t nextU64() {
    uint64_t x = state_;
    x ^= x >> 12;
    x ^= x << 25;
    x ^= x >> 27;
    state_ = x;
    return x * 0x2545F4914F6CDD1Dull;
  }

  // Uniform in [0, 1).
  double uniform() {
    return static_cast<double>(nextU64() >> 11) * (1.0 / 9007199254740992.0);
  }

  // Uniform in [-1, 1).
  double bipolar() { return 2.0 * uniform() - 1.0; }

  // Approximate normal deviate. The sum of 4 uniforms is smooth enough
  // for cycle variation and stays bounded in [-2, 2] sigma-like range.
  double gauss() {
    return (uniform() + uniform() + uniform() + uniform() - 2.0) * 1.732;
  }

 private:
  uint64_t state_;
};

}  // namespace enginesim
