import { GameScore } from "../../client/client-db/event-store/event-types";

/**
 * Small markers shown next to a game's score in game lists: 🔴 when the game
 * has a point-by-point log — the game was tracked live, and its details page
 * can replay the win % over the game — and 😵 when the game records which
 * player had the bad side of the table in each set.
 */
export const GameMarkers: React.FC<{ score?: GameScore["data"] }> = ({ score }) => {
  const tracked = Boolean(score?.pointSequences?.length);
  const hasSides = Boolean(score?.gameWinnerSides?.some((side) => side !== null));
  if (!tracked && !hasSides) return null;
  return (
    <span className="ml-1 text-[10px] md:text-xs align-middle">
      {tracked && <span title="Tracked point by point">🔴</span>}
      {hasSides && <span title="The bad side of the table is recorded per set">😵</span>}
    </span>
  );
};
