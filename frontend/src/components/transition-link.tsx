import React, { useCallback } from "react";
import { Link, LinkProps, useNavigate } from "react-router-dom";
import { triggerViewTransition } from "../hooks/use-view-transition";

/**
 * Drop-in replacement for React Router's <Link> that triggers a View Transition
 * expanding from the clicked element.
 */
export const TransitionLink = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ onClick, to, ...rest }, ref) => {
    const navigate = useNavigate();

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
          onClick?.(e);
          return;
        }

        e.preventDefault();
        onClick?.(e);

        triggerViewTransition(e.currentTarget, () => {
          navigate(to as string);
        });
      },
      [navigate, to, onClick],
    );

    return <Link ref={ref} to={to} onClick={handleClick} {...rest} />;
  },
);

TransitionLink.displayName = "TransitionLink";
