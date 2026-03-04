import { useCallback, useRef, startTransition } from "react";
import { useNavigate, NavigateOptions } from "react-router-dom";
import { transitionForRoute } from "../components/transition-link";

export type TransitionType = "slide-left" | "slide-right" | "slide-up" | "slide-down" | "fade" | "scale-up";

/**
 * Returns a navigate function that triggers a View Transition via React's
 * startTransition. The transition type controls which CSS animation plays.
 *
 * When no `transition` option is provided, the animation is inferred from the route.
 * Wrap the page content in React's <ViewTransition> for this to work.
 */
export function useTransitionNavigate() {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  return useCallback(
    (to: string | number, options?: NavigateOptions & { transition?: TransitionType }) => {
      if (typeof to === "number") {
        // Browser back/forward — use slide-right for back, slide-left for forward
        const type = to < 0 ? "slide-right" : "slide-left";
        document.documentElement.dataset.viewTransition = type;
        startTransition(() => {
          navigateRef.current(to);
        });
        return;
      }
      const { transition, ...navOptions } = options ?? {};
      const type = transition ?? transitionForRoute(to);
      document.documentElement.dataset.viewTransition = type;
      startTransition(() => {
        navigateRef.current(to, navOptions);
      });
    },
    [],
  );
}
