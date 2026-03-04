import React, { useCallback, startTransition } from "react";
import { Link, LinkProps, useNavigate } from "react-router-dom";
import { TransitionType } from "../hooks/use-view-transition";

/** Infer a fitting transition style from the target route. */
export function transitionForRoute(to: string): TransitionType {
  if (to.startsWith("/add-game") || to === "/add-player") return "slide-up";
  if (to.startsWith("/player/")) return "slide-left";
  if (to.startsWith("/tournament") && to !== "/tournament/list") return "slide-left";
  if (to.startsWith("/season") && to !== "/season/list") return "slide-left";
  if (to.startsWith("/simulations/")) return "slide-left";
  if (to.startsWith("/1v1")) return "slide-left";
  if (to.startsWith("/game/edit")) return "slide-up";
  if (to === "/camera") return "slide-up";
  if (to === "/settings" || to === "/admin" || to === "/me") return "scale-up";
  if (to === "/log-in" || to === "/sign-up") return "slide-up";
  if (to === "/recent-games") return "slide-left";
  return "fade";
}

type TransitionLinkProps = LinkProps & {
  transition?: TransitionType;
};

/**
 * Drop-in replacement for React Router's <Link> that triggers a View Transition.
 * When no `transition` prop is provided, the animation is inferred from the route.
 */
export const TransitionLink = React.forwardRef<HTMLAnchorElement, TransitionLinkProps>(
  ({ transition, onClick, to, ...rest }, ref) => {
    const navigate = useNavigate();

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLAnchorElement>) => {
        // Let modified clicks pass through (open in new tab, etc.)
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
          onClick?.(e);
          return;
        }

        e.preventDefault();
        onClick?.(e);

        const type = transition ?? transitionForRoute(String(to));
        document.documentElement.dataset.viewTransition = type;
        startTransition(() => {
          navigate(to as string);
        });
      },
      [navigate, to, transition, onClick],
    );

    return <Link ref={ref} to={to} onClick={handleClick} {...rest} />;
  },
);

TransitionLink.displayName = "TransitionLink";
