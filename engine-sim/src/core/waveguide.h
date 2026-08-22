#pragma once
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
    buf_[widx_] = v;
    widx_ = (widx_ + 1) & mask_;
  }

  // Value written `delay` samples ago, before this sample's write.
  // Requires 2 <= delay <= capacity - 4.
  double readFrac(double delay) const;

 private:
  std::vector<double> buf_;
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
  void propagate();

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
};

// N-port parallel junction. Pressure is continuous and volume velocity is
// conserved. p_J = 2 sum(Y_i p_i_in) / sum(Y_i); out_i = p_J - p_i_in.
class Junction {
 public:
  void addPortA(WaveguidePipe* p);  // pipe joins the junction at its A end
  void addPortB(WaveguidePipe* p);  // pipe joins the junction at its B end
  void finalize();
  void scatter();
  double pressure() const { return lastPressure_; }

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
