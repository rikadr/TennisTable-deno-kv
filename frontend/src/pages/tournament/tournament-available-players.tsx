import { useEffect, useState } from "react";
import { classNames } from "../../common/class-names";
import { ProfilePicture } from "../player/profile-picture";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { Tournament } from "../../client/client-db/tournaments/tournament";
import { Link } from "react-router-dom";

export const TournamentAvailablePlayers = ({ tournament }: { tournament: Tournament }) => {
  const context = useEventDbContext();

  const storageKey = `tournament-available-${tournament.id}`;

  const [checkedPlayers, setCheckedPlayers] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return new Set();
      const parsed: { players: string[]; storedAt: number } = JSON.parse(raw);
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      if (parsed.storedAt < midnight.getTime()) {
        localStorage.removeItem(storageKey);
        return new Set();
      }
      return new Set(parsed.players);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    try {
      const data = JSON.stringify({ players: Array.from(checkedPlayers), storedAt: Date.now() });
      localStorage.setItem(storageKey, data);
    } catch {
      // ignore storage errors
    }
  }, [checkedPlayers, storageKey]);

  const allPendingGames = tournament.findAllPendingGames();

  // Get unique players that have pending games
  const playersWithPendingGames = new Set<string>();
  allPendingGames.forEach((game) => {
    playersWithPendingGames.add(game.player1);
    playersWithPendingGames.add(game.player2);
  });

  const sortedPlayers = Array.from(playersWithPendingGames).sort((a, b) =>
    context.playerName(a).localeCompare(context.playerName(b), undefined, { sensitivity: "base" }),
  );

  const togglePlayer = (playerId: string) => {
    setCheckedPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  };

  const selectAll = () => setCheckedPlayers(new Set(sortedPlayers));
  const selectNone = () => setCheckedPlayers(new Set());

  // For each checked player, find their pending games against other checked players
  const checkedPlayerGames = sortedPlayers
    .filter((p) => checkedPlayers.has(p))
    .map((playerId) => {
      const gamesAgainstChecked = allPendingGames.filter(
        (game) =>
          (game.player1 === playerId && checkedPlayers.has(game.player2)) ||
          (game.player2 === playerId && checkedPlayers.has(game.player1)),
      );

      const opponents = gamesAgainstChecked.map((game) =>
        game.player1 === playerId ? game.player2 : game.player1,
      );

      return { playerId, opponents };
    })
    .filter((entry) => entry.opponents.length > 0);

  const totalPlayableGames = allPendingGames.filter(
    (game) => checkedPlayers.has(game.player1) && checkedPlayers.has(game.player2),
  ).length;

  if (sortedPlayers.length === 0) {
    return (
      <div className="text-center text-primary-text py-8">
        <p className="text-lg">No pending games in this tournament</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center text-primary-text space-y-1">
        <h2 className="text-xl font-bold">Available Players Today</h2>
        <p className="text-sm text-primary-text/70">
          Check off players who are at the office to see what games can be played
        </p>
      </div>

      {/* Select all / none */}
      <div className="flex gap-2 justify-center">
        <button
          onClick={selectAll}
          className="text-xs px-3 py-1 rounded bg-secondary-background text-secondary-text hover:bg-secondary-background/70"
        >
          Select all
        </button>
        <button
          onClick={selectNone}
          className="text-xs px-3 py-1 rounded bg-secondary-background text-secondary-text hover:bg-secondary-background/70"
        >
          Select none
        </button>
      </div>

      {/* Player checkboxes */}
      <div className="ring-1 ring-secondary-background rounded-lg p-4 bg-primary-background">
        <h3 className="text-primary-text font-semibold mb-3">
          Players with pending games{" "}
          <span className="font-thin italic text-sm">({sortedPlayers.length})</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {sortedPlayers.map((playerId) => {
            const isChecked = checkedPlayers.has(playerId);
            return (
              <button
                key={playerId}
                onClick={() => togglePlayer(playerId)}
                className={classNames(
                  "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left",
                  isChecked
                    ? "bg-secondary-background text-secondary-text ring-2 ring-secondary-text/30"
                    : "bg-primary-background text-primary-text/60 ring-1 ring-secondary-background hover:bg-secondary-background/30",
                )}
              >
                <div
                  className={classNames(
                    "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 text-xs",
                    isChecked ? "border-secondary-text bg-secondary-text text-secondary-background" : "border-primary-text/40",
                  )}
                >
                  {isChecked && "✓"}
                </div>
                <ProfilePicture playerId={playerId} size={28} border={2} />
                <span className="truncate text-sm font-medium">{context.playerName(playerId)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      {checkedPlayers.size > 0 && (
        <div className="text-center text-primary-text text-sm">
          <span className="font-semibold">{checkedPlayers.size}</span> player{checkedPlayers.size !== 1 && "s"} selected
          {" — "}
          <span className="font-semibold">{totalPlayableGames}</span> game{totalPlayableGames !== 1 && "s"} can be played
        </div>
      )}

      {/* Per-player pending games against checked players */}
      {checkedPlayerGames.map(({ playerId, opponents }) => (
        <div key={playerId} className="ring-1 ring-secondary-background rounded-lg overflow-hidden bg-primary-background">
          <div className="flex items-center gap-3 px-4 py-3 bg-secondary-background text-secondary-text">
            <ProfilePicture playerId={playerId} size={36} border={2} />
            <div>
              <h3 className="font-bold text-lg">{context.playerName(playerId)}</h3>
              <p className="text-xs text-secondary-text/70">
                {opponents.length} game{opponents.length !== 1 && "s"} available today
              </p>
            </div>
          </div>
          <div className="divide-y divide-secondary-background/50">
            {opponents.map((opponentId) => (
              <Link
                key={opponentId}
                to={`/tournament?tournament=${tournament.id}&player1=${playerId}&player2=${opponentId}`}
                className="flex items-center gap-3 px-4 py-2 hover:bg-secondary-background/20 transition-colors text-primary-text"
              >
                <span className="text-xs text-primary-text/50 font-medium">VS</span>
                <ProfilePicture playerId={opponentId} size={28} border={2} />
                <span className="text-sm">{context.playerName(opponentId)}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {checkedPlayers.size > 1 && checkedPlayerGames.length === 0 && (
        <div className="text-center text-primary-text/60 py-4 text-sm italic">
          No pending games between the selected players
        </div>
      )}
    </div>
  );
};
