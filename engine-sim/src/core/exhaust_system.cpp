#include "core/exhaust_system.h"

#include <algorithm>
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
  tailpipes_.clear();
  radiations_.clear();
  tailMix_.clear();

  auto makePipe = [&](double len, double dia, double temp, double extraLoss,
                      double st) {
    auto p = std::make_unique<WaveguidePipe>();
    p->init(len, dia, temp, ambientPa_, fs, x.lossPerMeter, x.lossCutoffHz,
            extraLoss, st, x.pipeNlLoss);
    WaveguidePipe* raw = p.get();
    pipes_.push_back(std::move(p));
    return raw;
  };

  for (int i = 0; i < n; ++i) {
    auto p = std::make_unique<WaveguidePipe>();
    p->init(x.runnerLengthsM[i], x.runnerDiameterM, x.runnerTempK,
            ambientPa_, fs, x.lossPerMeter, x.lossCutoffHz, 0.0, steep,
            x.pipeNlLoss);
    runners_.push_back(std::move(p));
  }

  // Bank pipes. Banks are numbered by cfg.engine.bankOfCylinder.
  int nBanks = 0;
  for (int b : cfg.engine.bankOfCylinder) nBanks = std::max(nBanks, b + 1);
  if (static_cast<int>(x.bankPipeLengthsM.size()) < nBanks)
    throw std::runtime_error("bank_pipe_lengths_m needs one entry per bank");

  std::vector<WaveguidePipe*> bankPipes;
  for (int b = 0; b < nBanks; ++b) {
    bankPipes.push_back(makePipe(x.bankPipeLengthsM[b], x.bankPipeDiameterM,
                                 x.bankPipeTempK, 0.0, steep));
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

  // Downstream chain builder: mid pipe -> [chamber (-> connect ->) ...]
  // -> tailpipe -> radiation. Returns the chain's first pipe.
  auto buildChain = [&]() {
    WaveguidePipe* first =
        makePipe(x.midPipeLengthM, x.midPipeDiameterM, x.midPipeTempK, 0.0,
                 steep);
    WaveguidePipe* prev = first;
    for (size_t ci = 0; ci < x.chambers.size(); ++ci) {
      const auto& ch = x.chambers[ci];
      auto chamber = std::make_unique<WaveguidePipe>();
      chamber->init(ch.lengthM, ch.diameterM, ch.tempK, ambientPa_, fs,
                    x.lossPerMeter,
                    x.lossCutoffHz * (1.0 - 0.7 * ch.absorption),
                    ch.absorption, 0.0);
      Junction j;
      j.addPortB(prev);
      j.addPortA(chamber.get());
      junctions_.push_back(std::move(j));
      prev = chamber.get();
      pipes_.push_back(std::move(chamber));

      if (ci + 1 < x.chambers.size()) {
        WaveguidePipe* conn =
            makePipe(x.connectPipeLengthM, x.connectPipeDiameterM,
                     x.connectPipeTempK, 0.0, steep);
        Junction j2;
        j2.addPortB(prev);
        j2.addPortA(conn);
        junctions_.push_back(std::move(j2));
        prev = conn;
      }
    }
    WaveguidePipe* tail = makePipe(x.tailpipeLengthM, x.tailpipeDiameterM,
                                   x.tailpipeTempK, x.exitLoss, steep);
    Junction jt;
    jt.addPortB(prev);
    jt.addPortA(tail);
    junctions_.push_back(std::move(jt));
    tailpipes_.push_back(tail);
    RadiationEnd r;
    r.init(x.tailpipeDiameterM * 0.5, tail->soundSpeed(), fs,
           x.radiationReflection, x.exitNlLoss,
           tail->density() * tail->soundSpeed() * tail->soundSpeed());
    radiations_.push_back(r);
    return first;
  };

  if (x.dualExit) {
    // X junction: all bank pipe ends and the head of one chain per bank.
    Junction cross;
    for (auto* bp : bankPipes) cross.addPortB(bp);
    std::vector<WaveguidePipe*> heads;
    for (int b = 0; b < nBanks; ++b) heads.push_back(buildChain());
    for (auto* h : heads) cross.addPortA(h);
    junctions_.push_back(std::move(cross));
    for (int b = 0; b < nBanks; ++b) {
      const size_t mi = static_cast<size_t>(b);
      tailMix_.push_back(mi < x.tailMix.size() ? x.tailMix[mi] : 1.0);
    }
  } else {
    // Y junction into a single chain.
    WaveguidePipe* head = buildChain();
    Junction y;
    for (auto* bp : bankPipes) y.addPortB(bp);
    y.addPortA(head);
    junctions_.push_back(std::move(y));
    tailMix_.push_back(1.0);
  }

  for (auto& j : junctions_) j.finalize();
  flowDamping_ = x.flowDamping;
  nBanks_ = nBanks;
}

void ExhaustSystem::setMeanFlow(double mdotTotal) {
  // Exit convection loss (independent of flow_damping).
  const double split = tailMix_.size() > 1 ? 0.5 : 1.0;
  for (size_t i = 0; i < radiations_.size(); ++i) {
    const auto* t = tailpipes_[i];
    const double m =
        mdotTotal * split / (t->density() * t->area() * t->soundSpeed());
    radiations_[i].setMeanMach(m);
  }
  if (flowDamping_ <= 0.0) return;
  // Runners see 1/n of the flow, bank pipes 1/banks, the rest sees all
  // of it (dual exit splits it again). M = mdot / (rho S c).
  // Upstream-traveling waves fight the flow and lose flowDamping_ per
  // Mach-metre; downstream-traveling waves ride it and lose little.
  const double kUp = flowDamping_;
  const double kDown = 0.15 * flowDamping_;
  const double perRunner = mdotTotal / std::max<size_t>(1, runners_.size());
  for (auto& r : runners_) {
    const double m = perRunner / (r->density() * r->area() * r->soundSpeed());
    r->setFlowGain(std::exp(-kDown * m * r->lengthM()),
                   std::exp(-kUp * m * r->lengthM()));
  }
  for (auto& p : pipes_) {
    double share = mdotTotal;
    if (p->area() < 0.9 * tailpipes_[0]->area() * 4.0) share *= split;
    const double m = share / (p->density() * p->area() * p->soundSpeed());
    p->setFlowGain(std::exp(-kDown * m * p->lengthM()),
                   std::exp(-kUp * m * p->lengthM()));
  }
}

void ExhaustSystem::beginSample() {
  for (auto& r : runners_) r->propagate();
  for (auto& p : pipes_) p->propagate();
}

double ExhaustSystem::finishSample() {
  for (auto& j : junctions_) j.scatter();
  double out = 0.0;
  for (size_t i = 0; i < radiations_.size(); ++i) {
    radiations_[i].process(tailpipes_[i]);
    out += tailMix_[i] * radiations_[i].radiated();
  }
  return out;
}

void ExhaustSystem::clear() {
  for (auto& r : runners_) r->clear();
  for (auto& p : pipes_) p->clear();
  for (auto& r : radiations_) r.clear();
}

}  // namespace enginesim
