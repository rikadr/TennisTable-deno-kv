import { startTransition, addTransitionType, useCallback, useRef } from "react";
import { useNavigate, NavigateOptions } from "react-router-dom";

function setTransitionOrigin(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const root = document.documentElement;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  root.style.setProperty("--vt-top", `${rect.top}px`);
  root.style.setProperty("--vt-right", `${vw - rect.right}px`);
  root.style.setProperty("--vt-bottom", `${vh - rect.bottom}px`);
  root.style.setProperty("--vt-left", `${rect.left}px`);
  root.style.setProperty("--vt-radius", `${Math.min(rect.width, rect.height) * 0.15}px`);
}

function setCenterOrigin() {
  const root = document.documentElement;
  root.style.setProperty("--vt-top", "50%");
  root.style.setProperty("--vt-right", "50%");
  root.style.setProperty("--vt-bottom", "50%");
  root.style.setProperty("--vt-left", "50%");
  root.style.setProperty("--vt-radius", "0px");
}

export function triggerViewTransition(el: HTMLElement | null, updateDOM: () => void, back?: boolean) {
  if (el) {
    setTransitionOrigin(el);
  } else {
    setCenterOrigin();
  }

  startTransition(() => {
    if (back) {
      addTransitionType("navigate-back");
    }
    updateDOM();
  });
}

/**
 * Returns a navigate function that triggers a View Transition.
 * Forward navigations expand from the clicked element.
 * Back navigations (numeric `to`, e.g. -1) collapse in reverse.
 */
export function useTransitionNavigate() {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  return useCallback(
    (to: string | number, e?: React.MouseEvent | { currentTarget: HTMLElement }, options?: NavigateOptions) => {
      const el = (e?.currentTarget as HTMLElement) ?? null;
      const isBack = typeof to === "number";

      const updateDOM =
        typeof to === "number"
          ? () => navigateRef.current(to)
          : () => navigateRef.current(to, options);

      triggerViewTransition(el, updateDOM, isBack);
    },
    [],
  );
}
