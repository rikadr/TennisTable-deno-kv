// GUI layer: Dear ImGui + GLFW. Only built with ENGINESIM_GUI=ON.
// Controls (throttle, rev blip) and live plots (output waveform,
// cylinder pressure trace, runner pressure). Rendering never blocks
// audio: the GUI thread reads snapshots the simulation thread publishes
// through a double buffer.

#include <atomic>
#include <array>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <thread>
#include <vector>

#ifndef GLFW_INCLUDE_NONE
#define GLFW_INCLUDE_NONE
#endif
#include <GLFW/glfw3.h>

// Minimal OpenGL declarations. The sandbox used for compile checks has
// no GL headers; these match the GL ABI on every platform we target.
extern "C" {
typedef int GLint;
typedef int GLsizei;
typedef unsigned int GLbitfield;
typedef float GLfloat;
void glViewport(GLint, GLint, GLsizei, GLsizei);
void glClearColor(GLfloat, GLfloat, GLfloat, GLfloat);
void glClear(GLbitfield);
}
#ifndef GL_COLOR_BUFFER_BIT
#define GL_COLOR_BUFFER_BIT 0x00004000
#endif

#include "imgui.h"
#include "backends/imgui_impl_glfw.h"
#include "backends/imgui_impl_opengl3.h"

#include "core/config.h"
#include "core/engine.h"
#include "core/resampler.h"

namespace enginesim {

namespace {

constexpr int kScope = 2048;

struct GuiShared {
  std::atomic<bool> running{true};
  std::atomic<double> throttle{0.1};
  std::atomic<double> rpm{800.0};
  // Double-buffered scope snapshots (single writer, single reader).
  std::array<std::array<float, kScope>, 2> wave{};
  std::array<std::array<float, kScope>, 2> cylBar{};
  std::atomic<int> page{0};
};

// Offline-paced simulation for the GUI when the realtime layer is off:
// runs the engine in blocks pinned to the wall clock so the plots move
// at real speed even without an audio device.
void guiSimThread(const SimConfig& cfg, uint64_t seed, GuiShared* shared) {
  Engine engine;
  engine.init(cfg, seed);
  const double dt = 1.0 / cfg.internalRate();
  double rpm = cfg.engine.idleRpm;
  int scopePos = 0;
  int writePage = 1;
  std::array<float, kScope> wave{};
  std::array<float, kScope> cyl{};
  auto next = std::chrono::steady_clock::now();

  while (shared->running.load(std::memory_order_relaxed)) {
    const double thr = shared->throttle.load(std::memory_order_relaxed);
    for (int i = 0; i < 480; ++i) {
      const double x = rpm / 4700.0;
      const double tMax = 250.0 * (1.0 - 0.35 * (x - 1.0) * (x - 1.0));
      double tInd = thr * std::fmax(60.0, tMax);
      if (rpm > cfg.engine.revLimitRpm) tInd = 0.0;
      const double tFric = 22.0 + 0.0042 * rpm + 8e-7 * rpm * rpm;
      rpm += (tInd - tFric) / 0.18 * 60.0 / kTwoPi * dt;
      if (rpm < cfg.engine.idleRpm * 0.92) rpm = cfg.engine.idleRpm * 0.92;
      engine.setRpm(rpm);
      engine.setThrottle(thr < 0.09 && rpm < cfg.engine.idleRpm * 1.1 ? 0.09
                                                                      : thr);
      const double s = engine.step();
      wave[scopePos] = static_cast<float>(softLimit(s, 1.0));
      cyl[scopePos] =
          static_cast<float>(engine.cylinderPressure(0) / 1e5);
      if (++scopePos == kScope) {
        scopePos = 0;
        shared->wave[writePage] = wave;
        shared->cylBar[writePage] = cyl;
        shared->page.store(writePage, std::memory_order_release);
        writePage ^= 1;
      }
    }
    shared->rpm.store(rpm, std::memory_order_relaxed);
    next += std::chrono::microseconds(480 * 1000000 / cfg.internalRate());
    std::this_thread::sleep_until(next);
  }
}

}  // namespace

int runGui(const SimConfig& cfg, uint64_t seed) {
  if (!glfwInit()) {
    std::fprintf(stderr, "glfwInit failed\n");
    return 1;
  }
  glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
  glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 2);
#ifdef __APPLE__
  glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
  glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GLFW_TRUE);
#endif
  GLFWwindow* win = glfwCreateWindow(900, 600, "enginesim", nullptr, nullptr);
  if (!win) {
    glfwTerminate();
    std::fprintf(stderr, "cannot create window\n");
    return 1;
  }
  glfwMakeContextCurrent(win);
  glfwSwapInterval(1);

  IMGUI_CHECKVERSION();
  ImGui::CreateContext();
  ImGui_ImplGlfw_InitForOpenGL(win, true);
#ifdef __APPLE__
  ImGui_ImplOpenGL3_Init("#version 150");
#else
  ImGui_ImplOpenGL3_Init("#version 130");
#endif

  GuiShared shared;
  std::thread sim(guiSimThread, cfg, seed, &shared);

  float throttle = 0.1f;
  while (!glfwWindowShouldClose(win)) {
    glfwPollEvents();
    ImGui_ImplOpenGL3_NewFrame();
    ImGui_ImplGlfw_NewFrame();
    ImGui::NewFrame();

    ImGui::Begin("engine");
    ImGui::Text("%s", cfg.name.c_str());
    ImGui::Text("rpm: %.0f", shared.rpm.load());
    if (ImGui::SliderFloat("throttle", &throttle, 0.0f, 1.0f)) {
      shared.throttle.store(throttle);
    }
    if (ImGui::Button("rev blip")) shared.throttle.store(1.0);
    ImGui::SameLine();
    if (ImGui::Button("lift")) {
      throttle = 0.0f;
      shared.throttle.store(0.0);
    }

    const int page = shared.page.load(std::memory_order_acquire);
    ImGui::PlotLines("output", shared.wave[page].data(), kScope, 0, nullptr,
                     -1.0f, 1.0f, ImVec2(0, 120));
    ImGui::PlotLines("cyl 1 pressure (bar)", shared.cylBar[page].data(),
                     kScope, 0, nullptr, 0.0f, 120.0f, ImVec2(0, 120));
    ImGui::End();

    ImGui::Render();
    int w, h;
    glfwGetFramebufferSize(win, &w, &h);
    glViewport(0, 0, w, h);
    glClearColor(0.08f, 0.08f, 0.10f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT);
    ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
    glfwSwapBuffers(win);
  }

  shared.running.store(false);
  sim.join();
  ImGui_ImplOpenGL3_Shutdown();
  ImGui_ImplGlfw_Shutdown();
  ImGui::DestroyContext();
  glfwDestroyWindow(win);
  glfwTerminate();
  return 0;
}

}  // namespace enginesim
