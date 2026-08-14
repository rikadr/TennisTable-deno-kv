import { GameScore } from "../../client/client-db/event-store/event-types";

/**
 * Small marker shown next to a game's score in game lists when the game has a
 * point-by-point log — the game was tracked live, and its details page can
 * replay the win % over the game.
 */
export const PointSequenceMarker: React.FC<{ score?: GameScore["data"] }> = ({ score }) => {
  if (!score?.pointSequences?.length) return null;
  return (
    <span title="Tracked point by point" className="ml-1 text-[10px] md:text-xs align-middle">
      👀
    </span>
  );
};
