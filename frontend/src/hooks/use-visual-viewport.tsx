import { useEffect, useState } from "react";

function getViewportHeight(): number {
  const viewport = window.visualViewport;
  // A pinch-zoomed viewport is also small, but the keyboard is not the cause,
  // so the layout must keep its unzoomed size.
  if (!viewport || viewport.scale > 1) return window.innerHeight;
  return viewport.height;
}

/**
 * Height in px of the part of the viewport that is actually visible. Unlike
 * 100dvh, this shrinks when the mobile on-screen keyboard opens, so layouts
 * that pin controls to the bottom can keep them above the keyboard.
 */
export function useVisualViewportHeight(): number {
  const [height, setHeight] = useState(getViewportHeight);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleResize = () => setHeight(getViewportHeight());
    viewport.addEventListener("resize", handleResize);
    return () => viewport.removeEventListener("resize", handleResize);
  }, []);

  return height;
}
