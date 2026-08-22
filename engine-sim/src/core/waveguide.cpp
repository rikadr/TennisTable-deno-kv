#include "core/waveguide.h"

#include <cassert>
#include <cmath>

namespace enginesim {

void DelayLine::init(int capacity) {
  int n = 16;
  while (n < capacity) n <<= 1;
  buf_.assign(static_cast<size_t>(n), 0.0);
  mask_ = n - 1;
  widx_ = 0;
}

void DelayLine::clear() {
  std::fill(buf_.begin(), buf_.end(), 0.0);
  widx_ = 0;
}

double DelayLine::readFrac(double delay) const {
  // Sample written d samples ago sits at index widx_ - d.
  const int di = static_cast<int>(delay);
  const double f = delay - di;
  const int i0 = (widx_ - di + 1 + (mask_ + 1) * 2) & mask_;  // d - 1
  const int i1 = (i0 - 1) & mask_;                            // d
  const int i2 = (i0 - 2) & mask_;                            // d + 1
  const int i3 = (i0 - 3) & mask_;                            // d + 2
  const double x0 = buf_[i0], x1 = buf_[i1], x2 = buf_[i2], x3 = buf_[i3];
  // 3rd-order Lagrange interpolation, f in [0,1) between x1 and x2.
  const double fm1 = f + 1.0, f0 = f, f1 = f - 1.0, f2 = f - 2.0;
  const double c0 = -f0 * f1 * f2 / 6.0;
  const double c1 = fm1 * f1 * f2 / 2.0;
  const double c2 = -fm1 * f0 * f2 / 2.0;
  const double c3 = fm1 * f0 * f1 / 6.0;
  return c0 * x0 + c1 * x1 + c2 * x2 + c3 * x3;
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
  lpF_.setCutoff(lossCutoffHz, fs);
  lpB_.setCutoff(lossCutoffHz, fs);
  // The steepening modulation can lengthen the read delay by up to 22%.
  fwd_.init(static_cast<int>(delay_ * 1.25) + 8);
  bwd_.init(static_cast<int>(delay_ * 1.25) + 8);

  // Physical steepening: wave speed is c + ((gamma+1)/2) u with
  // u = p / (rho c). A pressure p therefore scales the transit time by
  // roughly 1 - ((gamma+1)/2) p / (rho c^2). Convert to delay samples/Pa.
  const double physK = (kGammaPipe + 1.0) * 0.5 / (rho_ * c_ * c_);
  steepK_ = steepening * physK * delay_;
  maxMod_ = 0.22 * delay_;
  steepStateF_ = steepStateB_ = 0.0;
}

void WaveguidePipe::propagate() {
  // Estimate local amplitude from the previous outputs, then modulate the
  // read position. Light smoothing avoids discontinuities in the read tap.
  if (steepK_ > 0.0) {
    steepStateF_ += 0.5 * (steepK_ * outB_ - steepStateF_);
    steepStateB_ += 0.5 * (steepK_ * outA_ - steepStateB_);
  }
  double dF = delay_ - std::clamp(steepStateF_, -maxMod_, maxMod_);
  double dB = delay_ - std::clamp(steepStateB_, -maxMod_, maxMod_);
  if (dF < 2.0) dF = 2.0;
  if (dB < 2.0) dB = 2.0;
  outB_ = gain_ * lpF_.process(fwd_.readFrac(dF));
  outA_ = gain_ * lpB_.process(bwd_.readFrac(dB));
}

void WaveguidePipe::clear() {
  fwd_.clear();
  bwd_.clear();
  lpF_.clear();
  lpB_.clear();
  outA_ = outB_ = 0.0;
  steepStateF_ = steepStateB_ = 0.0;
}

void Junction::addPortA(WaveguidePipe* p) { ports_.push_back({p, false, 0.0}); }
void Junction::addPortB(WaveguidePipe* p) { ports_.push_back({p, true, 0.0}); }

void Junction::finalize() {
  double sum = 0.0;
  for (auto& port : ports_) {
    port.y = port.pipe->admittance();
    sum += port.y;
  }
  invSumY_ = sum > 0.0 ? 1.0 / sum : 0.0;
}

void Junction::scatter() {
  double acc = 0.0;
  for (const auto& port : ports_) {
    const double pin = port.atB ? port.pipe->outB() : port.pipe->outA();
    acc += port.y * pin;
  }
  const double pj = 2.0 * acc * invSumY_;
  lastPressure_ = pj;
  for (const auto& port : ports_) {
    const double pin = port.atB ? port.pipe->outB() : port.pipe->outA();
    const double out = pj - pin;
    if (port.atB) {
      port.pipe->inB(out);
    } else {
      port.pipe->inA(out);
    }
  }
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
}

void RadiationEnd::process(WaveguidePipe* pipe) {
  const double pin = pipe->outB();
  const double refl = -reflGain_ * lp_.process(pin);
  pipe->inB(refl);
  radiated_ = pin + refl;
}

void RadiationEnd::clear() {
  lp_.clear();
  radiated_ = 0.0;
}

}  // namespace enginesim
