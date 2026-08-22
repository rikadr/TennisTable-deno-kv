#pragma once
#include <atomic>
#include <cstddef>
#include <vector>

namespace enginesim {

// Lock-free single-producer single-consumer ring buffer for audio
// samples. The producer is the simulation thread; the consumer is the
// audio callback. All memory is allocated in the constructor. push/pop
// never allocate, lock or block.
class SpscRing {
 public:
  explicit SpscRing(size_t capacityPow2)
      : buf_(capacityPow2), mask_(capacityPow2 - 1) {}

  size_t freeSpace() const {
    const size_t w = wpos_.load(std::memory_order_relaxed);
    const size_t r = rpos_.load(std::memory_order_acquire);
    return buf_.size() - (w - r);
  }

  size_t available() const {
    const size_t w = wpos_.load(std::memory_order_acquire);
    const size_t r = rpos_.load(std::memory_order_relaxed);
    return w - r;
  }

  // Producer side. Returns the number of samples written.
  size_t push(const float* src, size_t n) {
    const size_t w = wpos_.load(std::memory_order_relaxed);
    const size_t r = rpos_.load(std::memory_order_acquire);
    const size_t space = buf_.size() - (w - r);
    if (n > space) n = space;
    for (size_t i = 0; i < n; ++i) buf_[(w + i) & mask_] = src[i];
    wpos_.store(w + n, std::memory_order_release);
    return n;
  }

  // Consumer side (audio callback). Fills dst; missing samples become
  // zero so an underrun clicks instead of blocking.
  void popOrZero(float* dst, size_t n) {
    const size_t w = wpos_.load(std::memory_order_acquire);
    const size_t r = rpos_.load(std::memory_order_relaxed);
    size_t have = w - r;
    if (have > n) have = n;
    for (size_t i = 0; i < have; ++i) dst[i] = buf_[(r + i) & mask_];
    for (size_t i = have; i < n; ++i) dst[i] = 0.0f;
    rpos_.store(r + have, std::memory_order_release);
  }

 private:
  std::vector<float> buf_;
  size_t mask_;
  std::atomic<size_t> wpos_{0};
  std::atomic<size_t> rpos_{0};
};

}  // namespace enginesim
