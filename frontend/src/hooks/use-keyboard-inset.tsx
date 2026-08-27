import { useEffect, useState } from "react";

function getKeyboardInset(): number {
  const viewport = window.visualViewport;
  // A pinch-zoomed viewport is also small, but the keyboard is not the cause,
  // so the layout must keep its unzoomed size.
  if (!viewport || viewport.scale > 1) return 0;
  return Math.max(0, window.innerHeight - viewport.height);
}

/**
 * Height in px of the part of the viewport the mobile on-screen keyboard
 * covers, 0 while it is closed. Mobile browsers overlay the keyboard without
 * shrinking 100dvh, so bottom-pinned layouts must subtract this to stay
 * visible while typing.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(getKeyboardInset);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleResize = () => setInset(getKeyboardInset());
    viewport.addEventListener("resize", handleResize);
    window.addEventListener("resize", handleResize);
    return () => {
      viewport.removeEventListener("resize", handleResize);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return inset;
}
