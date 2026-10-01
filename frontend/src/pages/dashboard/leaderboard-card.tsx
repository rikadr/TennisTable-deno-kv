import React from "react";
import { useNavigate } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { themedPlaceImage } from "./themed-place-number";
import { fmtNum } from "../../common/number-utils";
import { classNames } from "../../common/class-names";
import { determineNextSeason } from "../../client/client-db/seasons/seasons";
import { RelativeTime } from "../../common/date-utils";
import { DashboardCard } from "./dashboard-card";
import { Podium, PodiumEntry } from "./podium";
import { DashboardSeasonState, LeaderboardView } from "./dashboard-season";
import { DASHBOARD_ROW_CLASS_NAME, PlayerNameCell } from "./dashboard-table";

/** The podium shows the top 3. The table continues from this rank */
const PODIUM_PLACES = 3;

type Row = {
  playerId: string;
  rank: number;
  score: number;
  /** Score difference to the player one rank above */
  interval?: number;
  winLossRatio?: number;
  to: string;
};

type Props = {
  view: LeaderboardView;
  setView: (view: LeaderboardView) => void;
  season: DashboardSeasonState;
};

export const LeaderboardCard: React.FC<Props> = ({ view, setView, season }) => {
  const context = useEventDbContext();
  const leaderboard = context.leaderboard.getLeaderboard();

  const toggle = <ViewToggle view={view} setView={setView} />;

  if (view === "season") {
    const { currentSeason, isOffSeason, lastSeason } = season;

    if (isOffSeason || !currentSeason) {
      const nextSeason = determineNextSeason(Date.now());
      const lastSeasonTop = lastSeason?.getLeaderboard().slice(0, PODIUM_PLACES) ?? [];
      return (
        <DashboardCard title="Leaderboard" subtitle={isOffSeason ? "Off-season" : undefined} action={toggle}>
          <div className="mx-3 mb-3 p-4 rounded-lg bg-secondary-background text-secondary-text text-center">
            {isOffSeason ? (
              <p className="text-lg font-medium text-center">
                Next season starts{" "}
                <span className="lowercase">
                  <RelativeTime date={new Date(nextSeason.start)} />
                </span>
              </p>
            ) : (
              <p className="text-lg font-medium text-center">The season has no games yet</p>
            )}
            {isOffSeason ? (
              <p className="text-sm opacity-80 text-center">
                {new Date(nextSeason.start).toLocaleString("nb-NO", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            ) : (
              <p className="text-sm opacity-80 text-center">Play a game to join the season leaderboard</p>
            )}
          </div>
          {lastSeason && lastSeasonTop.length > 0 && (
            <div className="pb-3">
              <h3 className="px-3 text-lg">Top 3 last season</h3>
              <Podium
                entries={lastSeasonTop.map((player) => ({
                  playerId: player.playerId,
                  score: player.seasonScore,
                  to: `/season/player?seasonStart=${lastSeason.start}&playerId=${player.playerId}`,
                }))}
              />
            </div>
          )}
        </DashboardCard>
      );
    }

    const rows: Row[] = currentSeason.getLeaderboard().map((player, index, list) => ({
      playerId: player.playerId,
      rank: index + 1,
      score: player.seasonScore,
      interval: list[index - 1] ? player.seasonScore - list[index - 1].seasonScore : undefined,
      to: `/player/${player.playerId}?tab=season`,
    }));

    return (
      <DashboardCard
        title="Leaderboard"
        subtitle={
          <>
            Season ends{" "}
            <span className="lowercase">
              <RelativeTime date={new Date(currentSeason.end)} />
            </span>
          </>
        }
        action={toggle}
      >
        <LeaderboardBody rows={rows} showWinLossRatio={false} />
      </DashboardCard>
    );
  }

  const rows: Row[] = leaderboard.rankedPlayers.map((player, index, list) => ({
    playerId: player.id,
    rank: player.rank,
    score: player.elo,
    interval: list[index - 1] ? player.elo - list[index - 1].elo : undefined,
    winLossRatio: player.wins / player.loss,
    to: `/player/${player.id}`,
  }));

  return (
    <DashboardCard
      title="Leaderboard"
      subtitle={`${fmtNum(rows.length)} ranked players · ${fmtNum(context.games.length)} games`}
      action={toggle}
    >
      <LeaderboardBody rows={rows} showWinLossRatio />
    </DashboardCard>
  );
};

const LeaderboardBody: React.FC<{ rows: Row[]; showWinLossRatio: boolean }> = ({ rows, showWinLossRatio }) => {
  const navigate = useNavigate();

  const podium: PodiumEntry[] = rows.slice(0, PODIUM_PLACES);
  const tableRows = rows.slice(PODIUM_PLACES);

  const placeNumber = (place: number) => {
    const image = themedPlaceImage(place);
    if (image) return <img className="h-7 w-7 scale-[140%]" src={image} alt={`Place ${place}`} />;
    return place;
  };

  if (rows.length === 0) {
    return <p className="px-3 pb-4 text-center">No players on the leaderboard yet</p>;
  }

  return (
    <>
      <Podium entries={podium} />
      {tableRows.length > 0 && (
        <table className="w-full text-primary-text border-collapse border-t border-primary-text/50">
          <thead className="border-b border-primary-text/50">
            <tr className="text-sm xs:text-lg md:text-xl text-primary-text">
              <th className="py-1 px-1 xs:px-2 text-left font-light">#</th>
              <th className="py-1 px-1 xs:px-2 text-left font-normal">Player</th>
              <th className="py-1 px-1 xs:px-2 text-right font-light">Score</th>
              <th className="py-1 px-1 xs:px-2 text-right font-light text-xs xs:text-sm md:text-base">Interval</th>
              {showWinLossRatio && (
                <th className="py-1 px-1 xs:px-2 text-right font-light text-xs xs:text-sm md:text-base whitespace-nowrap">
                  🏆:💔
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-primary-text/50">
            {tableRows.map((row) => (
              <tr key={row.playerId} onClick={() => navigate(row.to)} className={DASHBOARD_ROW_CLASS_NAME}>
                <td className="py-1 px-1 xs:px-2 italic w-[1%] whitespace-nowrap">{placeNumber(row.rank)}</td>
                <PlayerNameCell playerId={row.playerId} />
                <td className="py-1 px-1 xs:px-2 text-right w-[1%] whitespace-nowrap">
                  {fmtNum(row.score, { digits: 0 })}
                </td>
                <td className="py-1 px-1 xs:px-2 text-right w-[1%] whitespace-nowrap text-xs xs:text-sm md:text-base">
                  {row.interval !== undefined ? fmtNum(row.interval, { digits: 0 }) : "-"}
                </td>
                {showWinLossRatio && (
                  <td className="py-1 px-1 xs:px-2 text-right w-[1%] whitespace-nowrap text-xs xs:text-sm md:text-base">
                    {row.winLossRatio?.toLocaleString("no-NO", {
                      maximumFractionDigits: 1,
                    })}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
};

const ViewToggle: React.FC<{ view: LeaderboardView; setView: (view: LeaderboardView) => void }> = ({
  view,
  setView,
}) => (
  <div className="shrink-0 inline-flex rounded-lg ring-1 ring-primary-text/25 p-0.5" role="group">
    {(
      [
        ["overall", "Overall"],
        ["season", "Season"],
      ] as const
    ).map(([value, label]) => (
      <button
        key={value}
        onClick={() => setView(value)}
        aria-pressed={view === value}
        className={classNames(
          "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
          view === value ? "bg-secondary-background text-secondary-text" : "text-primary-text hover:bg-primary-text/10",
        )}
      >
        {label}
      </button>
    ))}
  </div>
);
