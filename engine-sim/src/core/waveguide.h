#pragma once
#include <algorithm>
#include <cstddef>
#include <vector>

#include "core/gas.h"
#include "core/util.h"

namespace enginesim {

// Circular delay line with 3rd-order Lagrange fractional read.
// All memory is allocated in init(). The audio path never allocates.
class DelayLine {
 public:
  void init(int capacity);
  void clear();

  void write(double v) {
    buf_[widx_] = static_cast<float>(v);
    widx_ = (widx_ + 1) & mask_;
  }

  // Value written `delay` samples ago, before this sample's write.
  // Requires 2 <= delay <= capacity - 4. Kept in the header so the hot
  // loop inlines it.
  double readFrac(double delay) const {
    const int di = static_cast<int>(delay);
    const double f = delay - di;
    const int i0 = (widx_ - di + 1 + (mask_ + 1) * 2) & mask_;  // d - 1
    const int i1 = (i0 - 1) & mask_;                            // d
    const int i2 = (i0 - 2) & mask_;                            // d + 1
    const int i3 = (i0 - 3) & mask_;                            // d + 2
    const double x0 = buf_[i0], x1 = buf_[i1];
    const double x2 = buf_[i2], x3 = buf_[i3];
    // 3rd-order Lagrange interpolation, f in [0,1) between x1 and x2.
    const double fm1 = f + 1.0, f0 = f, f1 = f - 1.0, f2 = f - 2.0;
    const double c0 = -f0 * f1 * f2 / 6.0;
    const double c1 = fm1 * f1 * f2 / 2.0;
    const double c2 = -fm1 * f0 * f2 / 2.0;
    const double c3 = fm1 * f0 * f1 / 6.0;
    return c0 * x0 + c1 * x1 + c2 * x2 + c3 * x3;
  }

  // 4-tap read with caller-precomputed Lagrange coefficients for a fixed
  // fractional delay di + f (coefficients from lagrangeCoefs).
  double read4(int di, const double* c) const {
    const int i0 = (widx_ - di + 1 + (mask_ + 1) * 2) & mask_;
    return c[0] * buf_[i0] + c[1] * buf_[(i0 - 1) & mask_] +
           c[2] * buf_[(i0 - 2) & mask_] + c[3] * buf_[(i0 - 3) & mask_];
  }

  static void lagrangeCoefs(double f, double* c) {
    const double fm1 = f + 1.0, f0 = f, f1 = f - 1.0, f2 = f - 2.0;
    c[0] = -f0 * f1 * f2 / 6.0;
    c[1] = fm1 * f1 * f2 / 2.0;
    c[2] = -fm1 * f0 * f2 / 2.0;
    c[3] = fm1 * f0 * f1 / 6.0;
  }

 private:
  // float storage: audio-band waves need no more precision, and the
  // halved footprint keeps every delay line cache-resident.
  std::vector<float> buf_;
  int widx_ = 0;
  int mask_ = 0;
};

// One-pole low-pass: y += a (x - y). Unity gain at DC.
class OnePoleLP {
 public:
  void setCutoff(double fcHz, double fs);
  double process(double x) {
    y_ += a_ * (x - y_);
    return y_;
  }
  void clear() { y_ = 0.0; }

 private:
  double a_ = 1.0;
  double y_ = 0.0;
};

// A straight duct section modelled as a bidirectional digital waveguide.
// End A is upstream (engine side). End B is downstream (tailpipe side).
// The forward line carries the wave from A to B. Each traversal applies a
// broadband gain and a one-pole low-pass for frequency-dependent loss.
// Nonlinear steepening modulates the read position with the local acoustic
// particle velocity, so compression phases travel faster than rarefaction
// phases. This is the discrete form of the c + ((gamma+1)/2) u wave speed.
class WaveguidePipe {
 public:
  // fs is the internal sample rate. steepening is a 0..1+ scale on the
  // physical delay modulation, 0 disables it.
  void init(double lengthM, double diameterM, double tempK, double ambientPa,
            double fs, double lossPerMeter, double lossCutoffHz,
            double extraLoss, double steepening);

  // Phase 1: read both delay lines. Call once per sample before any write.
  // Inline: this runs for every pipe at the internal rate.
  void propagate() {
    if (steepK_ > 0.0) {
      // Estimate local amplitude from the previous outputs, then modulate
      // the read position. Light smoothing avoids read-tap discontinuities.
      steepStateF_ += 0.5 * (steepK_ * outB_ - steepStateF_);
      steepStateB_ += 0.5 * (steepK_ * outA_ - steepStateB_);
      double dF = delay_ - std::clamp(steepStateF_, -maxMod_, maxMod_);
      double dB = delay_ - std::clamp(steepStateB_, -maxMod_, maxMod_);
      if (dF < 2.0) dF = 2.0;
      if (dB < 2.0) dB = 2.0;
      outB_ = gain_ * lpF_.process(fwd_.readFrac(dF));
      outA_ = gain_ * lpB_.process(bwd_.readFrac(dB));
    } else {
      // Static delay: precomputed interpolation coefficients.
      outB_ = gain_ * lpF_.process(fwd_.read4(delayInt_, coefs_));
      outA_ = gain_ * lpB_.process(bwd_.read4(delayInt_, coefs_));
    }
  }

  // Wave arriving at each end (after propagate()).
  double outA() const { return outA_; }
  double outB() const { return outB_; }

  // Phase 2: write the wave that enters at each end. Each end must receive
  // exactly one write per sample.
  void inA(double v) { fwd_.write(v); }
  void inB(double v) { bwd_.write(v); }

  double impedance() const { return z0_; }   // rho c / S, acoustic ohms
  double admittance() const { return 1.0 / z0_; }
  double area() const { return area_; }
  double density() const { return rho_; }
  double tempK() const { return tempK_; }
  double soundSpeed() const { return c_; }
  double delaySamples() const { return delay_; }

  void clear();

 private:
  DelayLine fwd_, bwd_;
  OnePoleLP lpF_, lpB_;
  double delay_ = 8.0;
  double gain_ = 1.0;
  double z0_ = 1.0;
  double area_ = 1.0;
  double rho_ = 1.0;
  double tempK_ = 300.0;
  double c_ = 340.0;
  double outA_ = 0.0, outB_ = 0.0;
  double steepK_ = 0.0;      // delay modulation per Pa
  double steepStateF_ = 0.0; // smoothed modulation, forward
  double steepStateB_ = 0.0; // smoothed modulation, backward
  double maxMod_ = 0.0;      // clamp on delay modulation, samples
  int delayInt_ = 8;         // static-path integer delay
  double coefs_[4] = {0.0, 1.0, 0.0, 0.0};  // static-path Lagrange coefs
};

// N-port parallel junction. Pressure is continuous and volume velocity is
// conserved. p_J = 2 sum(Y_i p_i_in) / sum(Y_i); out_i = p_J - p_i_in.
class Junction {
 public:
  void addPortA(WaveguidePipe* p);  // pipe joins the junction at its A end
  void addPortB(WaveguidePipe* p);  // pipe joins the junction at its B end
  void finalize();

  // Inline: runs for every junction at the internal rate.
  void scatter() {
    const int n = static_cast<int>(ports_.size());
    double pin[kMaxPorts];
    double acc = 0.0;
    for (int i = 0; i < n; ++i) {
      const Port& port = ports_[i];
      pin[i] = port.atB ? port.pipe->outB() : port.pipe->outA();
      acc += port.y * pin[i];
    }
    const double pj = 2.0 * acc * invSumY_;
    lastPressure_ = pj;
    for (int i = 0; i < n; ++i) {
      const Port& port = ports_[i];
      const double out = pj - pin[i];
      if (port.atB) {
        port.pipe->inB(out);
      } else {
        port.pipe->inA(out);
      }
    }
  }

  double pressure() const { return lastPressure_; }

  static constexpr int kMaxPorts = 20;

 private:
  struct Port {
    WaveguidePipe* pipe;
    bool atB;
    double y;
  };
  std::vector<Port> ports_;
  double invSumY_ = 0.0;
  double lastPressure_ = 0.0;
};

// Open-end radiation termination at a pipe's B end. Low frequencies
// reflect with sign inversion and magnitude near 1. High frequencies
// reflect less and radiate more. This approximates the Levine-Schwinger
// behaviour of an unflanged pipe with a one-pole fit. The radiated()
// value is the pressure that escapes the pipe mouth.
class RadiationEnd {
 public:
  void init(double pipeRadiusM, double soundSpeed, double fs,
            double reflectionGain = 0.985);
  void process(WaveguidePipe* pipe);
  double radiated() const { return radiated_; }
  void clear();

 private:
  OnePoleLP lp_;
  double reflGain_ = 0.985;
  double radiated_ = 0.0;
};

}  // namespace enginesim
