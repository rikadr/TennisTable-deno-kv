#pragma once
#include <string>
#include <vector>

namespace enginesim {

// Writes a mono 16-bit PCM WAV file. Values outside [-1, 1] are clamped.
// Returns false on I/O failure.
bool writeWav16(const std::string& path, const std::vector<double>& samples,
                int sampleRate);

}  // namespace enginesim
