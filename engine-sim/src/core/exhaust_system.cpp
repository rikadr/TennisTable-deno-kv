#include "core/exhaust_system.h"

#include <stdexcept>

namespace enginesim {

void ExhaustSystem::init(const SimConfig& cfg, double fs) {
  const auto& x = cfg.exhaust;
  ambientPa_ = x.ambientPressurePa;
  const int n = cfg.engine.cylinders;
  const double steep = x.steepeningGain;

  runners_.clear();
  pipes_.clear();
  junctions_.clear();

  for (int i = 0; i < n; ++i) {
    auto p = std::make_unique<WaveguidePipe>();
    p->init(x.runnerLengthsM[i], x.runnerDiameterM, x.runnerTempK,
            ambientPa_, fs, x.lossPerMeter, x.lossCutoffHz, 0.0, steep);
    runners_.push_back(std::move(p));
  }

  // Bank pipes. Banks are numbered by cfg.engine.bankOfCylinder.
  int nBanks = 0;
  for (int b : cfg.engine.bankOfCylinder) nBanks = std::max(nBanks, b + 1);
  if (static_cast<int>(x.bankPipeLengthsM.size()) < nBanks)
    throw std::runtime_error("bank_pipe_lengths_m needs one entry per bank");

  std::vector<WaveguidePipe*> bankPipes;
  for (int b = 0; b < nBanks; ++b) {
    auto p = std::make_unique<WaveguidePipe>();
    p->init(x.bankPipeLengthsM[b], x.bankPipeDiameterM, x.bankPipeTempK,
            ambientPa_, fs, x.lossPerMeter, x.lossCutoffHz, 0.0, steep);
    bankPipes.push_back(p.get());
    pipes_.push_back(std::move(p));
  }

  // One collector junction per bank: runner B ends + bank pipe A end.
  for (int b = 0; b < nBanks; ++b) {
    Junction j;
    for (int i = 0; i < n; ++i) {
      if (cfg.engine.bankOfCylinder[i] == b) j.addPortB(runners_[i].get());
    }
    j.addPortA(bankPipes[b]);
    junctions_.push_back(std::move(j));
  }

  // Chain: Y junction -> mid pipe -> [chamber (-> connect pipe ->) ...]
  // -> tailpipe.
  auto mid = std::make_unique<WaveguidePipe>();
  mid->init(x.midPipeLengthM, x.midPipeDiameterM, x.midPipeTempK, ambientPa_,
            fs, x.lossPerMeter, x.lossCutoffHz, 0.0, steep);
  WaveguidePipe* prev = mid.get();
  pipes_.push_back(std::move(mid));

  {
    Junction y;
    for (auto* bp : bankPipes) y.addPortB(bp);
    y.addPortA(prev);
    junctions_.push_back(std::move(y));
  }

  for (size_t ci = 0; ci < x.chambers.size(); ++ci) {
    const auto& ch = x.chambers[ci];
    auto chamber = std::make_unique<WaveguidePipe>();
    chamber->init(ch.lengthM, ch.diameterM, ch.tempK, ambientPa_, fs,
                  x.lossPerMeter, x.lossCutoffHz * (1.0 - 0.7 * ch.absorption),
                  ch.absorption, 0.0);
    Junction j;
    j.addPortB(prev);
    j.addPortA(chamber.get());
    junctions_.push_back(std::move(j));
    prev = chamber.get();
    pipes_.push_back(std::move(chamber));

    if (ci + 1 < x.chambers.size()) {
      auto conn = std::make_unique<WaveguidePipe>();
      conn->init(x.connectPipeLengthM, x.connectPipeDiameterM,
                 x.connectPipeTempK, ambientPa_, fs, x.lossPerMeter,
                 x.lossCutoffHz, 0.0, steep);
      Junction j2;
      j2.addPortB(prev);
      j2.addPortA(conn.get());
      junctions_.push_back(std::move(j2));
      prev = conn.get();
      pipes_.push_back(std::move(conn));
    }
  }

  auto tail = std::make_unique<WaveguidePipe>();
  tail->init(x.tailpipeLengthM, x.tailpipeDiameterM, x.tailpipeTempK,
             ambientPa_, fs, x.lossPerMeter, x.lossCutoffHz, 0.0, steep);
  Junction jt;
  jt.addPortB(prev);
  jt.addPortA(tail.get());
  junctions_.push_back(std::move(jt));
  tailpipe_ = tail.get();
  pipes_.push_back(std::move(tail));

  for (auto& j : junctions_) j.finalize();
  radiation_.init(x.tailpipeDiameterM * 0.5, tailpipe_->soundSpeed(), fs);
}

void ExhaustSystem::beginSample() {
  for (auto& r : runners_) r->propagate();
  for (auto& p : pipes_) p->propagate();
}

double ExhaustSystem::finishSample() {
  for (auto& j : junctions_) j.scatter();
  radiation_.process(tailpipe_);
  return radiation_.radiated();
}

void ExhaustSystem::clear() {
  for (auto& r : runners_) r->clear();
  for (auto& p : pipes_) p->clear();
  radiation_.clear();
}

}  // namespace enginesim
