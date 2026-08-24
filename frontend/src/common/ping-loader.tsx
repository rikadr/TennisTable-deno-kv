import React, { useEffect, useRef } from "react";
import { CONTACT_Y, Direction, Point, RALLY, Stroke, planStroke, positionAt } from "./rally-simulation";

/** How fast the rally is played back. */
const PACE = 1.45;
/** How much of the ball's path is still visible behind it, in seconds. */
const TRAIL_SECONDS = 0.85;
/** How widely the speed and the bounce point vary from stroke to stroke. */
const VARIATION = 0.7;

/** The physics runs on a fixed step, so a fast ball still traces its curve. */
const SUBSTEP = 0.004;
/** Enough positions to hold the longest trail. */
const HISTORY = 256;
/** How wide the trail is where it leaves the ball, and how fast it narrows. */
const TRAIL_WIDTH = 2.8;
const TRAIL_TAPER = 0.9;
const TRAIL_ALPHA = 0.85;

/** The slice of the court the canvas shows. */
const VIEW_WIDTH = 200;
const VIEW_TOP = 14;
const VIEW_HEIGHT = 92;

const TABLE_WIDTH = 3.2;
const BOUNCE_RING_SECONDS = 0.3;
/** How much the ball flattens as it meets the table. */
const SQUASH = 0.32;

type Palette = { ball: string; table: string; trail: string };

/**
 * Read the theme through the element itself, so the loader follows whichever
 * `theme-*` class is on an ancestor. The tokens hold "r,g,b" rather than a colour.
 */
function readPalette(element: HTMLElement): Palette {
  const style = getComputedStyle(element);
  const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    ball: token("--color-primary-text", "255,255,255"),
    table: token("--color-secondary-background", "107,114,128"),
    trail: token("--color-tertiary-background", "255,255,255"),
  };
}

function rgba(channels: string, alpha: number): string {
  return `rgba(${channels},${alpha})`;
}

/**
 * The loading screen: a table tennis rally, simulated rather than animated.
 *
 * It draws to two stacked canvases. The trail layer draws the recorded path of the
 * ball, and the scene layer holds the table, the net and the ball. Keeping them
 * apart stops the ball painting its own width into the trail.
 *
 * The trail is one filled polygon: a ribbon that runs up one side of the recorded
 * path and back down the other, narrowing to a point at the far end. Drawing it in
 * one piece is what keeps it smooth. Every way of building the same fade out of
 * many strokes shows the joins between them, because a stroke that overlaps its
 * neighbour composites brighter at the overlap and one that stops short of its
 * neighbour leaves a notch on the outside of a turn.
 *
 * The trail is rebuilt from a ring buffer of positions every frame. Fading a canvas
 * that is never cleared is the usual way to do this, but it leaves a permanent
 * ghost: below about 5/255 the 8 bit alpha multiply rounds back to itself, so the
 * oldest part of the path stops fading and builds up behind the rally.
 */
export const PingPongLoader: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const trailCanvas = trailRef.current;
    const sceneCanvas = sceneRef.current;
    if (!root || !trailCanvas || !sceneCanvas) return;

    const trail = trailCanvas.getContext("2d");
    const scene = sceneCanvas.getContext("2d");
    if (!trail || !scene) return;

    let palette = readPalette(root);
    const prefersStill =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // --- the rally ---------------------------------------------------------
    let stroke: Stroke = planStroke(1, RALLY.leftX, 60, VARIATION);
    let elapsed = 0;
    let leftover = 0;
    const ball: Point = { x: stroke.x0, y: stroke.y0 };

    const historyX = new Float32Array(HISTORY);
    const historyY = new Float32Array(HISTORY);
    let head = 0;
    let recorded = 0;

    let bounceX = 0;
    let bounceAge = -1;

    /** Advance the rally by exactly one substep and record where the ball is. */
    function advance() {
      const before = elapsed;
      elapsed += SUBSTEP;

      if (before < stroke.bounceTime && elapsed >= stroke.bounceTime) {
        bounceX = stroke.bounceX;
        bounceAge = 0;
      }
      // The bat reverses the ball in the same step it arrives, and time past the end
      // of the stroke is carried into the next one, so the ball never waits.
      if (elapsed >= stroke.duration) {
        const carried = elapsed - stroke.duration;
        const next: Direction = stroke.direction > 0 ? -1 : 1;
        stroke = planStroke(next, stroke.targetX, stroke.targetY, VARIATION);
        elapsed = carried;
      }

      positionAt(stroke, elapsed, ball);
      historyX[head] = ball.x;
      historyY[head] = ball.y;
      head = (head + 1) % HISTORY;
      if (recorded < HISTORY) recorded++;
    }

    // --- the canvases ------------------------------------------------------
    function scaleCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth || VIEW_WIDTH;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(((width * VIEW_HEIGHT) / VIEW_WIDTH) * ratio);
      const scale = canvas.width / VIEW_WIDTH;
      context.setTransform(scale, 0, 0, scale, 0, -VIEW_TOP * scale);
      context.lineCap = "round";
      context.lineJoin = "round";
    }

    function resize() {
      if (!trailCanvas || !sceneCanvas || !trail || !scene || !root) return;
      // Setting the width clears the canvas, so anything on it has to be put back.
      scaleCanvas(trailCanvas, trail);
      scaleCanvas(sceneCanvas, scene);
      palette = readPalette(root);
      // While the rally is running the next frame repaints anyway. A still frame
      // has no next frame, so it is repainted here or it is lost.
      if (prefersStill) repaint();
    }

    // --- drawing -----------------------------------------------------------
    // The unit normal to the path at each recorded position, so the ribbon can be
    // offset to either side. Allocated once and rewritten in place.
    const normalX = new Float32Array(HISTORY);
    const normalY = new Float32Array(HISTORY);

    function recordedAt(stepsBack: number): number {
      return (head - 1 - stepsBack + HISTORY * 2) % HISTORY;
    }

    function drawTrail(context: CanvasRenderingContext2D) {
      context.clearRect(0, VIEW_TOP, VIEW_WIDTH, VIEW_HEIGHT);

      const segments = Math.min(recorded - 1, Math.round(TRAIL_SECONDS / SUBSTEP));
      if (segments <= 2) return;

      // A one sided difference, looking back in time. A centred one would average
      // the two legs where the ball reverses off a bat, cancel out, and leave the
      // cross section pointing nowhere; this keeps the corner instead.
      for (let step = 0; step <= segments; step++) {
        const here = recordedAt(Math.min(segments - 1, step));
        const older = recordedAt(Math.min(segments, step + 1));
        const dx = historyX[here] - historyX[older];
        const dy = historyY[here] - historyY[older];
        const length = Math.hypot(dx, dy);
        if (length < 1e-6) {
          normalX[step] = normalX[Math.max(0, step - 1)];
          normalY[step] = normalY[Math.max(0, step - 1)];
        } else {
          normalX[step] = -dy / length;
          normalY[step] = dx / length;
        }
      }

      const halfWidth = (step: number) =>
        (TRAIL_WIDTH / 2) * Math.pow(1 - step / segments, TRAIL_TAPER);

      context.globalAlpha = TRAIL_ALPHA;
      context.fillStyle = rgba(palette.trail, 1);
      context.beginPath();
      for (let step = 0; step <= segments; step++) {
        const at = recordedAt(step);
        const half = halfWidth(step);
        const x = historyX[at] + normalX[step] * half;
        const y = historyY[at] + normalY[step] * half;
        if (step === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      for (let step = segments; step >= 0; step--) {
        const at = recordedAt(step);
        const half = halfWidth(step);
        context.lineTo(historyX[at] - normalX[step] * half, historyY[at] - normalY[step] * half);
      }
      context.closePath();
      context.fill();
      context.globalAlpha = 1;
    }

    function drawScene(context: CanvasRenderingContext2D, seconds: number) {
      context.clearRect(0, VIEW_TOP, VIEW_WIDTH, VIEW_HEIGHT);

      context.strokeStyle = rgba(palette.table, 1);
      context.lineWidth = TABLE_WIDTH;
      context.beginPath();
      context.moveTo(RALLY.tableX0, RALLY.tableY);
      context.lineTo(RALLY.tableX1, RALLY.tableY);
      context.moveTo(RALLY.netX, RALLY.netTop);
      context.lineTo(RALLY.netX, RALLY.tableY);
      context.stroke();

      if (bounceAge >= 0) {
        bounceAge += seconds;
        const age = bounceAge / BOUNCE_RING_SECONDS;
        if (age >= 1) {
          bounceAge = -1;
        } else {
          context.strokeStyle = rgba(palette.trail, 0.45 * (1 - age));
          context.lineWidth = 1.4;
          context.beginPath();
          context.arc(bounceX, RALLY.tableY, 3 + 11 * age, 0, Math.PI * 2);
          context.stroke();
        }
      }

      const nearness = Math.max(0, 1 - (CONTACT_Y - ball.y) / 7);
      context.fillStyle = rgba(palette.ball, 1);
      context.beginPath();
      context.ellipse(
        ball.x,
        ball.y,
        RALLY.ballRadius * (1 + SQUASH * nearness),
        RALLY.ballRadius * (1 - SQUASH * 0.94 * nearness),
        0,
        0,
        Math.PI * 2,
      );
      context.fill();
    }

    function draw(seconds: number) {
      if (!trail || !scene) return;
      leftover += seconds;
      let guard = 0;
      while (leftover >= SUBSTEP && guard++ < 200) {
        leftover -= SUBSTEP;
        advance();
      }
      drawTrail(trail);
      drawScene(scene, seconds);
    }

    // --- the loop ----------------------------------------------------------
    function repaint() {
      if (!trail || !scene) return;
      drawTrail(trail);
      drawScene(scene, 0);
    }

    resize();

    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(() => resize());
    observer?.observe(trailCanvas);
    window.addEventListener("resize", resize);

    let frame = 0;
    if (prefersStill) {
      // One readable frame of a rally, and then nothing moves.
      for (let step = 0; step < 200; step++) draw(SUBSTEP);
    } else {
      let previous = 0;
      const tick = (now: number) => {
        if (!previous) previous = now;
        draw(Math.min(0.05, (now - previous) / 1000) * PACE);
        previous = now;
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div ref={rootRef} className="flex w-full items-center justify-center p-6">
      <div
        className="relative aspect-[200/92] w-full max-w-xl"
        role="img"
        aria-label="Loading. A table tennis ball plays a rally."
      >
        <canvas ref={trailRef} className="absolute inset-0 h-full w-full" />
        <canvas ref={sceneRef} className="absolute inset-0 h-full w-full" />
      </div>
    </div>
  );
};
