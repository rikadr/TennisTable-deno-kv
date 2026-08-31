import React from "react";
import { useNavigate } from "react-router-dom";
import { classNames } from "../../common/class-names";

/**
 * Makes a displayed game score open that game's details page.
 *
 * Tables that show a score but send their row somewhere else — or nowhere —
 * wrap the score cell in this. The click stops at the score, so a row that
 * navigates on its own keeps its own destination.
 */
export const GameScoreLink: React.FC<{
  /** The game's played-at timestamp — the details page's `time` param. */
  playedAt: number;
  className?: string;
  children: React.ReactNode;
}> = ({ playedAt, className, children }) => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      title="Game details"
      onClick={(event) => {
        event.stopPropagation();
        navigate(`/game?time=${playedAt}`);
      }}
      className={classNames("text-left hover:underline", className)}
    >
      {children}
    </button>
  );
};
