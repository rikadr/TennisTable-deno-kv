import { useEffect, useState } from "react";
import { classNames } from "../../common/class-names";
import { ProfilePicture } from "../player/profile-picture";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { Tournament } from "../../client/client-db/tournaments/tournament";
import { Link } from "react-router-dom";
import { tournamentGameLink } from "./tournament-game-location";
import { tournamentNudgeMessage } from "./tournament-nudge-message";

const COPIED_ALL = "all";

export const TournamentAvailablePlayers = ({ tournament }: { tournament: Tournament }) => {
  const context = useEventDbContext();

  const storageKey = `tournament-available-${tournament.id}`;

  const [copied, setCopied] = useState<string>();

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

      const opponents = gamesAgainstChecked.map((game) => {
        const opponentId = game.player1 === playerId ? game.player2 : game.player1;
        // The player is player 1, so a group game link opens the row of the player
        return {
          opponentId,
          link: tournamentGameLink(tournament.id, { ...game, player1: playerId, player2: opponentId }),
        };
      });

      return { playerId, opponents };
    })
    .filter((entry) => entry.opponents.length > 0);

  const totalPlayableGames = allPendingGames.filter(
    (game) => checkedPlayers.has(game.player1) && checkedPlayers.has(game.player2),
  ).length;

  const nudgeMessage = (playerId: string, opponents: { opponentId: string; link: string }[]) =>
    tournamentNudgeMessage({
      playerName: context.playerName(playerId),
      tournamentName: tournament.name,
      opponents: opponents.map(({ opponentId, link }) => ({
        name: context.playerName(opponentId),
        url: window.location.origin + link,
      })),
    });

  const markCopied = (key: string) => {
    setCopied(key);
    setTimeout(() => setCopied((current) => (current === key ? undefined : current)), 2000);
  };

  const copyNudgeMessage = async (playerId: string, opponents: { opponentId: string; link: string }[]) => {
    const { html, plain } = nudgeMessage(playerId, opponents);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        }),
      ]);
    } catch {
      await navigator.clipboard.writeText(plain);
    }
    markCopied(playerId);
  };

  const copyAllNudgeMessages = async () => {
    const messages = checkedPlayerGames.map(({ playerId, opponents }) => ({
      playerName: context.playerName(playerId),
      message: nudgeMessage(playerId, opponents).slack,
    }));
    await navigator.clipboard.writeText(JSON.stringify(messages, null, 2));
    markCopied(COPIED_ALL);
  };

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
          Players with pending games <span className="font-thin italic text-sm">({sortedPlayers.length})</span>
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
                    isChecked
                      ? "border-secondary-text bg-secondary-text text-secondary-background"
                      : "border-primary-text/40",
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
          <span className="font-semibold">{totalPlayableGames}</span> game{totalPlayableGames !== 1 && "s"} can be
          played
        </div>
      )}

      {checkedPlayerGames.length > 0 && (
        <div className="flex justify-center">
          <button
            onClick={copyAllNudgeMessages}
            className="text-xs px-3 py-1 rounded bg-secondary-background text-secondary-text hover:bg-secondary-background/70"
          >
            {copied === COPIED_ALL ? "Copied ✓" : "Copy Slack messages for all (JSON)"}
          </button>
        </div>
      )}

      {/* Per-player pending games against checked players */}
      {checkedPlayerGames.map(({ playerId, opponents }) => (
        <div
          key={playerId}
          className="ring-1 ring-secondary-background rounded-lg overflow-hidden bg-primary-background"
        >
          <div className="flex items-center gap-3 px-4 py-3 bg-secondary-background text-secondary-text">
            <ProfilePicture playerId={playerId} size={36} border={2} />
            <div className="grow min-w-0">
              <h3 className="font-bold text-lg truncate">{context.playerName(playerId)}</h3>
              <p className="text-xs text-secondary-text/70">
                {opponents.length} game{opponents.length !== 1 && "s"} available today
              </p>
            </div>
            <button
              onClick={() => copyNudgeMessage(playerId, opponents)}
              className="text-xs px-3 py-1 rounded shrink-0 ring-1 ring-secondary-text/30 hover:bg-secondary-text/10"
            >
              {copied === playerId ? "Copied ✓" : "Copy Slack message"}
            </button>
          </div>
          <div className="divide-y divide-secondary-background/50">
            {opponents.map(({ opponentId, link }) => (
              <Link
                key={opponentId}
                to={link}
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
