import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { relativeTimeString } from "../../common/date-utils";
import { fmtNum } from "../../common/number-utils";
import { classNames } from "../../common/class-names";
import { Game } from "../../client/client-db/event-store/projectors/games-projector";

type FilterValue = "any" | "yes" | "no";
type FilterKey = "sets" | "points" | "tracked" | "sides";

const dataChecks: { key: FilterKey; label: string; short: string; test: (game: Game) => boolean }[] = [
  { key: "sets", label: "Sets recorded", short: "Sets", test: (game) => game.score !== undefined },
  { key: "points", label: "Points recorded", short: "Points", test: (game) => Boolean(game.score?.setPoints?.length) },
  {
    key: "tracked",
    label: "Tracked live",
    short: "Live",
    test: (game) => Boolean(game.score?.pointSequences?.length),
  },
  {
    key: "sides",
    label: "Bad side recorded",
    short: "Side",
    test: (game) => Boolean(game.score?.gameWinnerSides?.some((side) => side !== null)),
  },
];

const noFilters: Record<FilterKey, FilterValue> = { sets: "any", points: "any", tracked: "any", sides: "any" };

const filterInput = "bg-primary-background text-primary-text border border-primary-text/20 rounded px-2 py-1";
// Marks a filter that is not "any", so a reader sees which filters limit the list.
const activeFilter = "border-secondary-text ring-1 ring-secondary-text";

const cell = "border-b border-primary-text/20 px-1 md:px-3 py-1 md:py-1.5";

interface AdminGamesTabProps {
  onDeleteGame: (gameId: string) => void;
}

export const AdminGamesTab: React.FC<AdminGamesTabProps> = ({ onDeleteGame }) => {
  const context = useEventDbContext();
  const navigate = useNavigate();

  const [filters, setFilters] = useState(noFilters);
  const [playerSearch, setPlayerSearch] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [gamesPerPage, setGamesPerPage] = useState(50);

  const games = context.eventStore.gamesProjector.games;

  // The number of each game in the order the games were played, independent of the filters.
  const gameNumbers = useMemo(() => new Map(games.map((game, index) => [game.id, index + 1])), [games]);

  const counts = useMemo(
    () =>
      Object.fromEntries(dataChecks.map((check) => [check.key, games.filter(check.test).length])) as Record<
        FilterKey,
        number
      >,
    [games],
  );

  const search = playerSearch.trim().toLowerCase();
  const filteredGames = games.filter((game) => {
    for (const check of dataChecks) {
      const filter = filters[check.key];
      if (filter !== "any" && check.test(game) !== (filter === "yes")) return false;
    }
    if (search) {
      const names = [context.playerName(game.winner), context.playerName(game.loser)];
      if (!names.some((name) => name.toLowerCase().includes(search))) return false;
    }
    return true;
  });
  const orderedGames = newestFirst ? filteredGames.toReversed() : filteredGames;

  const totalPages = Math.max(1, Math.ceil(orderedGames.length / gamesPerPage));
  const page = Math.min(currentPage, totalPages);
  const startIndex = (page - 1) * gamesPerPage;
  const paginatedGames = orderedGames.slice(startIndex, startIndex + gamesPerPage);

  const hasFilters = search !== "" || dataChecks.some((check) => filters[check.key] !== "any");

  function setFilter(key: FilterKey, value: FilterValue) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }

  function clearFilters() {
    setFilters(noFilters);
    setPlayerSearch("");
    setCurrentPage(1);
  }

  function confirmDelete(game: Game) {
    const question = `Are you sure you want to delete the game where ${context.playerName(
      game.winner,
    )} won over ${context.playerName(game.loser)}?`;
    if (window.confirm(question)) onDeleteGame(game.id);
  }

  const pageButton =
    "px-1.5 md:px-3 py-0.5 md:py-1 text-xs md:text-sm bg-tertiary-background text-tertiary-text rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-tertiary-background/80";

  return (
    <div className="p-2 md:p-6 space-y-3 md:space-y-4">
      <p className="text-xs md:text-sm text-primary-text/60 max-w-3xl">
        Deleting games is not permanent BUT I'd prefer not to restore deleted games, so please try to just delete games
        you want to delete.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2 md:gap-3 bg-secondary-background/30 rounded-lg p-2 md:p-3 text-xs md:text-sm">
        <label className="flex flex-col gap-0.5">
          <span className="text-primary-text/60">Player</span>
          <input
            type="search"
            value={playerSearch}
            onChange={(e) => {
              setPlayerSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Name"
            className={classNames(filterInput, "w-40", search !== "" && activeFilter)}
          />
        </label>
        {dataChecks.map((check) => (
          <label key={check.key} className="flex flex-col gap-0.5">
            <span className="text-primary-text/60">{check.label}</span>
            <select
              value={filters[check.key]}
              onChange={(e) => setFilter(check.key, e.target.value as FilterValue)}
              className={classNames(filterInput, filters[check.key] !== "any" && activeFilter)}
            >
              <option value="any">Any</option>
              <option value="yes">Yes ({fmtNum(counts[check.key])})</option>
              <option value="no">No ({fmtNum(games.length - counts[check.key])})</option>
            </select>
          </label>
        ))}
        <button
          onClick={clearFilters}
          disabled={!hasFilters}
          className="px-3 py-1 rounded border border-primary-text/20 hover:bg-secondary-background hover:text-secondary-text disabled:opacity-40 disabled:pointer-events-none"
        >
          Clear
        </button>
        <span className="py-1 md:ml-auto">
          <span className="font-semibold">{fmtNum(filteredGames.length)}</span> of {fmtNum(games.length)} games
        </span>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col md:flex-row gap-2 md:gap-0 md:items-center md:justify-between bg-secondary-background text-secondary-text p-2 md:p-3 rounded-lg">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-1 md:gap-2">
            <label className="text-xs md:text-sm font-medium hidden md:inline">Games per page:</label>
            <select
              value={gamesPerPage}
              onChange={(e) => {
                setGamesPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-primary-background text-primary-text border border-primary-text/20 rounded px-1 md:px-2 py-0.5 md:py-1 text-xs md:text-sm"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
          <div className="text-xs md:text-sm">
            {orderedGames.length === 0
              ? "0 games"
              : `${fmtNum(startIndex + 1)}-${fmtNum(startIndex + paginatedGames.length)} of ${fmtNum(
                  orderedGames.length,
                )}`}
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2 flex-wrap">
          <button onClick={() => setCurrentPage(1)} disabled={page === 1} className={pageButton}>
            <span className="hidden md:inline">First</span>
            <span className="md:hidden">«</span>
          </button>
          <button onClick={() => setCurrentPage(Math.max(1, page - 1))} disabled={page === 1} className={pageButton}>
            <span className="hidden md:inline">Previous</span>
            <span className="md:hidden">‹</span>
          </button>
          <span className="px-1 md:px-3 py-0.5 md:py-1 text-xs md:text-sm">
            {page}/{totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className={pageButton}
          >
            <span className="hidden md:inline">Next</span>
            <span className="md:hidden">›</span>
          </button>
          <button onClick={() => setCurrentPage(totalPages)} disabled={page === totalPages} className={pageButton}>
            <span className="hidden md:inline">Last</span>
            <span className="md:hidden">»</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-primary-text/30 text-xs md:text-sm">
        <table className="min-w-full border-collapse">
          <thead className="bg-secondary-background text-secondary-text">
            <tr>
              <th className={classNames(cell, "text-right")}>
                <button
                  onClick={() => {
                    setNewestFirst((prev) => !prev);
                    setCurrentPage(1);
                  }}
                  title={newestFirst ? "Newest first" : "Oldest first"}
                  className="font-semibold hover:underline whitespace-nowrap"
                >
                  # {newestFirst ? "↓" : "↑"}
                </button>
              </th>
              <th className={classNames(cell, "text-left")}>Winner</th>
              <th className={classNames(cell, "text-left")}>Loser</th>
              <th className={classNames(cell, "text-left")}>Played</th>
              <th className={classNames(cell, "text-left")}>Score</th>
              <th className={classNames(cell, "text-left")}>Data</th>
              <th className={classNames(cell, "text-center")}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedGames.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-primary-text/60">
                  No games match the filters.
                </td>
              </tr>
            )}
            {paginatedGames.map((game) => (
              <tr key={game.id} className="odd:bg-secondary-background/10 hover:bg-secondary-background/30">
                <td className={classNames(cell, "text-right tabular-nums text-primary-text/60")}>
                  {fmtNum(gameNumbers.get(game.id))}
                </td>
                <td className={classNames(cell, "font-semibold whitespace-nowrap")}>
                  <button className="hover:underline" onClick={() => navigate(`/player/${game.winner}`)}>
                    {context.playerName(game.winner)}
                  </button>
                </td>
                <td className={classNames(cell, "whitespace-nowrap")}>
                  <button className="hover:underline" onClick={() => navigate(`/player/${game.loser}`)}>
                    {context.playerName(game.loser)}
                  </button>
                </td>
                <td className={classNames(cell, "whitespace-nowrap")}>
                  <p>{relativeTimeString(new Date(game.playedAt))}</p>
                  <p className="text-[10px] md:text-xs text-primary-text/60">
                    {new Date(game.playedAt).toLocaleString("nb-NO", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </td>
                <td className={cell}>
                  <button
                    className="text-left hover:underline"
                    title="Game details"
                    onClick={() => navigate(`/game?time=${game.playedAt}`)}
                  >
                    {game.score ? (
                      <>
                        <span className="font-bold whitespace-nowrap">
                          {game.score.setsWon.gameWinner}-{game.score.setsWon.gameLoser}
                        </span>
                        {game.score.setPoints && (
                          <span className="block text-[10px] md:text-xs text-primary-text/60 whitespace-nowrap">
                            {game.score.setPoints
                              .map((points) => `${points.gameWinner}-${points.gameLoser}`)
                              .join(", ")}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-primary-text/40">-</span>
                    )}
                  </button>
                </td>
                <td className={cell}>
                  <div className="flex gap-1">
                    {dataChecks.map((check) => {
                      const has = check.test(game);
                      return (
                        <span
                          key={check.key}
                          title={`${check.label}: ${has ? "yes" : "no"}`}
                          className={classNames(
                            "px-1.5 py-0.5 rounded text-[10px] md:text-xs whitespace-nowrap border",
                            has
                              ? "bg-secondary-background text-secondary-text border-secondary-background"
                              : "border-primary-text/20 text-primary-text/30 line-through",
                          )}
                        >
                          {check.short}
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td className={classNames(cell, "text-center")}>
                  <div className="flex gap-1 md:gap-2 justify-center">
                    <button
                      className="text-[10px] md:text-xs bg-blue-500 hover:bg-blue-700 text-white px-1 md:px-2 py-0.5 md:py-1 rounded-md whitespace-nowrap"
                      onClick={() => navigate(`/game/edit/score?gameId=${game.id}`)}
                    >
                      Edit
                    </button>
                    <button
                      className="text-[10px] md:text-xs bg-red-500 hover:bg-red-800 text-white px-1 md:px-2 py-0.5 md:py-1 rounded-md whitespace-nowrap"
                      onClick={() => confirmDelete(game)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
