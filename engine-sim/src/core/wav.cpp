#include "core/wav.h"

#include <cstdint>
#include <cstdio>
#include <cstring>

namespace enginesim {

namespace {
void put32(uint8_t* p, uint32_t v) {
  p[0] = v & 0xFF; p[1] = (v >> 8) & 0xFF;
  p[2] = (v >> 16) & 0xFF; p[3] = (v >> 24) & 0xFF;
}
void put16(uint8_t* p, uint16_t v) {
  p[0] = v & 0xFF; p[1] = (v >> 8) & 0xFF;
}
}  // namespace

bool writeWav16(const std::string& path, const std::vector<double>& samples,
                int sampleRate) {
  FILE* f = std::fopen(path.c_str(), "wb");
  if (!f) return false;

  const uint32_t dataBytes = static_cast<uint32_t>(samples.size() * 2);
  uint8_t h[44];
  std::memcpy(h, "RIFF", 4);
  put32(h + 4, 36 + dataBytes);
  std::memcpy(h + 8, "WAVE", 4);
  std::memcpy(h + 12, "fmt ", 4);
  put32(h + 16, 16);
  put16(h + 20, 1);   // PCM
  put16(h + 22, 1);   // mono
  put32(h + 24, static_cast<uint32_t>(sampleRate));
  put32(h + 28, static_cast<uint32_t>(sampleRate * 2));
  put16(h + 32, 2);
  put16(h + 34, 16);
  std::memcpy(h + 36, "data", 4);
  put32(h + 40, dataBytes);
  if (std::fwrite(h, 1, 44, f) != 44) { std::fclose(f); return false; }

  std::vector<uint8_t> buf(samples.size() * 2);
  for (size_t i = 0; i < samples.size(); ++i) {
    double v = samples[i];
    if (v > 1.0) v = 1.0;
    if (v < -1.0) v = -1.0;
    const int16_t s = static_cast<int16_t>(v * 32767.0);
    buf[i * 2] = static_cast<uint8_t>(s & 0xFF);
    buf[i * 2 + 1] = static_cast<uint8_t>((s >> 8) & 0xFF);
  }
  const bool ok = std::fwrite(buf.data(), 1, buf.size(), f) == buf.size();
  std::fclose(f);
  return ok;
}

}  // namespace enginesim
