#include "core/waveguide.h"

#include <cassert>
#include <stdexcept>
#include <cmath>

namespace enginesim {

void DelayLine::init(int capacity) {
  int n = 16;
  while (n < capacity) n <<= 1;
  buf_.assign(static_cast<size_t>(n), 0.0f);
  mask_ = n - 1;
  widx_ = 0;
}

void DelayLine::clear() {
  std::fill(buf_.begin(), buf_.end(), 0.0f);
  widx_ = 0;
}

void OnePoleLP::setCutoff(double fcHz, double fs) {
  if (fcHz >= fs * 0.45) {
    a_ = 1.0;
    return;
  }
  a_ = 1.0 - std::exp(-kTwoPi * fcHz / fs);
}

void WaveguidePipe::init(double lengthM, double diameterM, double tempK,
                         double ambientPa, double fs, double lossPerMeter,
                         double lossCutoffHz, double extraLoss,
                         double steepening) {
  tempK_ = tempK;
  c_ = speedOfSound(kGammaPipe, tempK);
  rho_ = gasDensity(ambientPa, tempK);
  area_ = kPi * 0.25 * diameterM * diameterM;
  z0_ = rho_ * c_ / area_;
  delay_ = lengthM * fs / c_;
  if (delay_ < 4.0) delay_ = 4.0;
  gain_ = std::exp(-lossPerMeter * lengthM) * (1.0 - extraLoss);
  baseGain_ = gain_;
  lengthM_ = lengthM;
  lpF_.setCutoff(lossCutoffHz, fs);
  lpB_.setCutoff(lossCutoffHz, fs);
  fwd_.init(static_cast<int>(delay_) + 12);
  bwd_.init(static_cast<int>(delay_) + 12);

  // Physical steepening: wave speed is c + ((gamma+1)/2) u with
  // u = p / (rho c). A pressure p shortens the transit time by
  // tau0 * ((gamma+1)/2) * p / (rho c^2) samples.
  const double physK = (kGammaPipe + 1.0) * 0.5 / (rho_ * c_ * c_);
  steepK_ = steepening * physK * delay_;

  // Static-path interpolation coefficients for the fixed delay.
  delayInt_ = static_cast<int>(delay_);
  DelayLine::lagrangeCoefs(delay_ - delayInt_, coefs_);
}

void WaveguidePipe::clear() {
  fwd_.clear();
  bwd_.clear();
  lpF_.clear();
  lpB_.clear();
  outA_ = outB_ = 0.0;
}

void Junction::addPortA(WaveguidePipe* p) { ports_.push_back({p, false, 0.0}); }
void Junction::addPortB(WaveguidePipe* p) { ports_.push_back({p, true, 0.0}); }

void Junction::finalize() {
  if (ports_.size() > static_cast<size_t>(kMaxPorts))
    throw std::runtime_error("junction has too many ports");
  double sum = 0.0;
  for (auto& port : ports_) {
    port.y = port.pipe->admittance();
    sum += port.y;
  }
  invSumY_ = sum > 0.0 ? 1.0 / sum : 0.0;
}

void RadiationEnd::init(double pipeRadiusM, double soundSpeed, double fs,
                        double reflectionGain) {
  reflGain_ = reflectionGain;
  // |R| of an unflanged open pipe falls with ka. Match the one-pole corner
  // to ka = 1, f = c / (2 pi a). Above this, energy radiates instead of
  // reflecting. See docs/research.md, Levine-Schwinger section.
  const double fc = soundSpeed / (kTwoPi * pipeRadiusM);
  lp_.setCutoff(fc, fs);
  radiated_ = 0.0;
  prevU_ = 0.0;
  // Unity transfer magnitude at 1 kHz for the first difference.
  diffNorm_ = fs / (kTwoPi * 1000.0);
}

void RadiationEnd::process(WaveguidePipe* pipe) {
  const double pin = pipe->outB();
  const double refl = -reflGain_ * lp_.process(pin);
  pipe->inB(refl);
  // Exit volume velocity (up to the constant Z0) and its derivative.
  const double u = pin - refl;
  radiated_ = diffNorm_ * (u - prevU_);
  prevU_ = u;
}

void RadiationEnd::clear() {
  lp_.clear();
  radiated_ = 0.0;
  prevU_ = 0.0;
}

}  // namespace enginesim
