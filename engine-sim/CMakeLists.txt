cmake_minimum_required(VERSION 3.20)
project(enginesim CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

option(ENGINESIM_REALTIME "Build the real-time audio layer (miniaudio)" OFF)
option(ENGINESIM_GUI "Build the GUI layer (Dear ImGui + GLFW)" OFF)

if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()

add_compile_options(-Wall -Wextra)

# Safe math flags: no errno from libm calls and no trap assumptions. These
# keep IEEE NaN and rounding semantics (unlike -ffast-math, which measured
# +3% and is not worth the risk to the solver).
add_compile_options(-fno-math-errno -fno-trapping-math)

include(CheckIPOSupported)
check_ipo_supported(RESULT ENGINESIM_IPO_OK OUTPUT _ipo_msg)
if(ENGINESIM_IPO_OK AND CMAKE_BUILD_TYPE STREQUAL "Release")
  set(CMAKE_INTERPROCEDURAL_OPTIMIZATION ON)
endif()

# Core library. It has no audio and no graphics dependency.
add_library(enginesim_core
  src/core/config.cpp
  src/core/cylinder.cpp
  src/core/engine.cpp
  src/core/exhaust_system.cpp
  src/core/intake_system.cpp
  src/core/mechanical.cpp
  src/core/renderer.cpp
  src/core/waveguide.cpp
  src/core/wav.cpp
)
target_include_directories(enginesim_core PUBLIC src third_party)
# Fast math on the core only, keeping IEEE NaN semantics so the NaN sanity
# checks stay valid. Proven stable: selftest, 10-minute NaN run, and the
# full metric cycle are unchanged within tolerance (docs/iteration_log.md).
target_compile_options(enginesim_core PRIVATE -ffast-math -fno-finite-math-only)

# Headless renderer. This is the primary executable.
add_executable(enginesim src/main.cpp)
target_link_libraries(enginesim PRIVATE enginesim_core)

if(ENGINESIM_REALTIME)
  add_library(enginesim_realtime
    src/realtime/rt_audio.cpp
  )
  target_include_directories(enginesim_realtime PUBLIC src third_party)
  target_link_libraries(enginesim_realtime PUBLIC enginesim_core)
  target_compile_definitions(enginesim_realtime PUBLIC ENGINESIM_REALTIME=1)
  target_compile_definitions(enginesim PRIVATE ENGINESIM_REALTIME=1)
  target_link_libraries(enginesim PRIVATE enginesim_realtime)
  if(APPLE)
    target_link_libraries(enginesim_realtime PUBLIC
      "-framework CoreAudio" "-framework AudioToolbox" "-framework AudioUnit"
      "-framework CoreFoundation")
  else()
    find_package(Threads REQUIRED)
    target_link_libraries(enginesim_realtime PUBLIC Threads::Threads ${CMAKE_DL_LIBS})
  endif()
endif()

if(ENGINESIM_GUI)
  set(GLFW_BUILD_DOCS OFF CACHE BOOL "" FORCE)
  set(GLFW_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
  set(GLFW_BUILD_TESTS OFF CACHE BOOL "" FORCE)
  set(GLFW_INSTALL OFF CACHE BOOL "" FORCE)
  if(NOT APPLE)
    # The Linux sandbox compile-checks the GUI without display libraries.
    # A Linux desktop build that should open windows needs the X11 or
    # Wayland dev packages and these two switched back on.
    set(GLFW_BUILD_X11 OFF CACHE BOOL "" FORCE)
    set(GLFW_BUILD_WAYLAND OFF CACHE BOOL "" FORCE)
  endif()
  add_subdirectory(third_party/glfw glfw EXCLUDE_FROM_ALL)
  # Vendored third-party code is not held to this project's warning level.
  target_compile_options(glfw PRIVATE -w)
  add_library(enginesim_imgui
    third_party/imgui/imgui.cpp
    third_party/imgui/imgui_draw.cpp
    third_party/imgui/imgui_tables.cpp
    third_party/imgui/imgui_widgets.cpp
    third_party/imgui/backends/imgui_impl_glfw.cpp
    third_party/imgui/backends/imgui_impl_opengl3.cpp
  )
  target_include_directories(enginesim_imgui PUBLIC third_party/imgui third_party/imgui/backends)
  # No GL headers are needed: the OpenGL3 backend carries its own loader
  # and the sandbox has none. GLFW_INCLUDE_NONE keeps glfw3.h from
  # including GL/gl.h.
  target_compile_definitions(enginesim_imgui PUBLIC GLFW_INCLUDE_NONE)
  target_link_libraries(enginesim_imgui PUBLIC glfw)
  # Vendored third-party code is not held to this project's warning level.
  target_compile_options(enginesim_imgui PRIVATE -w)

  add_library(enginesim_gui src/gui/gui_app.cpp)
  target_include_directories(enginesim_gui PUBLIC src third_party)
  target_link_libraries(enginesim_gui PUBLIC enginesim_core enginesim_imgui)
  target_compile_definitions(enginesim_gui PUBLIC ENGINESIM_GUI=1)
  if(APPLE)
    target_link_libraries(enginesim_gui PUBLIC "-framework OpenGL")
    target_compile_definitions(enginesim PRIVATE ENGINESIM_GUI=1)
    target_link_libraries(enginesim PRIVATE enginesim_gui)
  else()
    find_package(OpenGL QUIET)
    if(OpenGL_FOUND)
      target_link_libraries(enginesim_gui PUBLIC OpenGL::GL)
      target_compile_definitions(enginesim PRIVATE ENGINESIM_GUI=1)
      target_link_libraries(enginesim PRIVATE enginesim_gui)
    else()
      message(STATUS "enginesim: no OpenGL runtime; the GUI layer is "
                     "compile-checked but not linked into the executable")
    endif()
  endif()
endif()
