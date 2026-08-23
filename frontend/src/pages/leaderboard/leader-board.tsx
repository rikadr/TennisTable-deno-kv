import React from "react";
import { useNavigate } from "react-router-dom";
import { PodiumPlace } from "./podium-place";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { RecentGames } from "./recent-games";
import { RecentAchievements } from "./recent-achievements";
import { TournamentHighlightsAndPendingGames } from "./tournament-pending-games";
import { getClientConfig, Theme, themeOrOverrideTheme } from "../../client/client-config/get-client-config";
import easterBunny from "../../img/easter/easter-bunny-realistic.png";
import { getEgg, getPumpkin } from "./themed-place-number";
import { RecentLeaderBoardChanges } from "./recent-leaderboard-changes";
import { RecentHallOfFame } from "./recent-hall-of-fame";
import { fmtNum } from "../../common/number-utils";
import { classNames } from "../../common/class-names";
import { useLocalStorage } from "../../hooks/use-local-storage";
import { useLiveGameQuery } from "../live-game/use-live-game";
import { LiveGameCard } from "./live-game-card";
import { determineNextSeason, determineSeason } from "../../client/client-db/seasons/seasons";
import { RelativeTime } from "../../common/date-utils";

type LeaderboardView = "overall" | "season";

const LIVE_GAME_CARD_POLL_MS = 10_000;

const LeaderboardToggle = ({
  className,
  view,
  setView,
}: {
  className?: string;
  view: LeaderboardView;
  setView: (v: LeaderboardView) => void;
}) => (
  <div className={classNames("flex justify-center gap-2 p-4", className)}>
    <button
      onClick={() => setView("overall")}
      className={classNames(
        "px-4 py-2 rounded text-sm font-medium transition-colors ring-1",
        view === "overall"
          ? "bg-secondary-background text-secondary-text ring-secondary-text"
          : "bg-primary-background text-primary-text ring-secondary-background hover:opacity-80",
      )}
    >
      Overall
    </button>
    <button
      onClick={() => setView("season")}
      className={classNames(
        "px-4 py-2 rounded text-sm font-medium transition-colors ring-1",
        view === "season"
          ? "bg-secondary-background text-secondary-text ring-secondary-text"
          : "bg-primary-background text-primary-text ring-secondary-background hover:opacity-80",
      )}
    >
      Current Season
    </button>
  </div>
);

export const LeaderBoard: React.FC = () => {
  const context = useEventDbContext();
  const navigate = useNavigate();
  // The card shows the score of a game in progress. A slow fallback poll keeps
  // it current if the WebSocket broadcast does not arrive.
  const liveGameQuery = useLiveGameQuery({ refetchIntervalMs: LIVE_GAME_CARD_POLL_MS });
  const leaderboard = context.leaderboard.getLeaderboard();
  const [viewString, setViewString] = useLocalStorage("leaderboard_view", "overall");
  
  // Validate and cast view
  const view: LeaderboardView = viewString === "season" ? "season" : "overall";
  const setView = (v: LeaderboardView) => setViewString(v);

  const client = getClientConfig();
  const theme = themeOrOverrideTheme(client.theme);

  const playersWithNoMatches = context.players.filter(
    (player) =>
      !leaderboard.rankedPlayers.some((r) => r.id === player.id) &&
      !leaderboard.unrankedPlayers.some((u) => u.id === player.id),
  );

  // Get current season
  const seasons = context.seasons.getSeasons();
  const currentSeason = seasons.find((s) => Date.now() >= s.start && Date.now() <= s.end);
  const seasonLeaderboard = currentSeason?.getLeaderboard() || [];

  // Off-season: we are in the grace period between two seasons
  const isOffSeason = Date.now() > determineSeason(Date.now()).end;
  const nextSeason = determineNextSeason(Date.now());
  const lastSeason = isOffSeason ? [...seasons].reverse().find((s) => s.end < Date.now()) : undefined;
  const lastSeasonTop3 = lastSeason?.getLeaderboard().slice(0, 3) ?? [];

  // Get players who haven't participated in current season
  const seasonParticipantIds = new Set(seasonLeaderboard.map((p) => p.playerId));
  const playersNotInSeason = context.players
    .filter((player) => !seasonParticipantIds.has(player.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Get top 3 based on current view
  const nr1 = view === "season" && seasonLeaderboard[0]
    ? context.leaderboard.getPlayerSummary(seasonLeaderboard[0].playerId)
    : leaderboard.rankedPlayers[0];
  const nr2 = view === "season" && seasonLeaderboard[1]
    ? context.leaderboard.getPlayerSummary(seasonLeaderboard[1].playerId)
    : leaderboard.rankedPlayers[1];
  const nr3 = view === "season" && seasonLeaderboard[2]
    ? context.leaderboard.getPlayerSummary(seasonLeaderboard[2].playerId)
    : leaderboard.rankedPlayers[2];

  const nr1Score = view === "season" && seasonLeaderboard[0] ? seasonLeaderboard[0].seasonScore : undefined;
  const nr2Score = view === "season" && seasonLeaderboard[1] ? seasonLeaderboard[1].seasonScore : undefined;
  const nr3Score = view === "season" && seasonLeaderboard[2] ? seasonLeaderboard[2].seasonScore : undefined;

  const themedPlaceNumber = (place: number) => {
    let themedImage: string | undefined = undefined;
    if (theme === Theme.HALLOWEEN) {
      themedImage = getPumpkin(place);
    }
    if (theme === Theme.EASTER) {
      themedImage = getEgg(place);
    }
    if (themedImage) {
      return <img className="scale-[175%]" src={themedImage} alt="Themed place number" />;
    }
  };

  return (
    <div className="w-full px-4 flex flex-col justify-center items-center md:items-start gap-6 md:flex-row ">
      <div className="w-full max-w-md md:w-[450px] flex flex-col gap-2 items-center">
        <LiveGameCard liveGameQuery={liveGameQuery} />
        <TournamentHighlightsAndPendingGames />
        <RecentHallOfFame />
        <div className="bg-primary-background rounded-lg w-full space-y-2">
          <h1 className="text-2xl text-center text-primary-text my-2">
            {view === "season" ? "Season Leaderboard" : "Overall Leaderboard"}
          </h1>
          <LeaderboardToggle
            className="md:hidden border-b border-primary-text/20 mb-2"
            view={view}
            setView={setView}
          />
          {view === "season" && isOffSeason ? (
            <>
              <div className="w-full p-4 rounded-lg bg-secondary-background text-secondary-text text-center space-y-1">
                <p className="text-lg font-medium">
                  Next season starts <RelativeTime date={new Date(nextSeason.start)} />
                </p>
                <p className="text-sm opacity-80">
                  {new Date(nextSeason.start).toLocaleString("nb-NO", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              {lastSeason && lastSeasonTop3.length > 0 && (
                <>
                  <h2 className="text-lg text-center text-primary-text pt-2">Top 3 last season</h2>
                  {lastSeasonTop3.map((player, index) => {
                    const playerSummary = context.leaderboard.getPlayerSummary(player.playerId);
                    if (!playerSummary) return null;
                    return (
                      <PodiumPlace
                        key={player.playerId}
                        size={(["default", "sm", "xs"] as const)[index]}
                        place={index + 1}
                        playerSummary={playerSummary}
                        profilePicture
                        score={player.seasonScore}
                        to={`/season/player?seasonStart=${lastSeason.start}&playerId=${player.playerId}`}
                      />
                    );
                  })}
                </>
              )}
            </>
          ) : (
            <>
              {nr1 && (
                <PodiumPlace
                  size="default"
                  place={1}
                  playerSummary={nr1}
                  profilePicture
                  score={nr1Score}
                  to={
                    view === "season" && currentSeason
                      ? `/player/${nr1.id}?tab=season`
                      : undefined
                  }
                />
              )}
              {nr2 && (
                <PodiumPlace
                  size="sm"
                  place={2}
                  playerSummary={nr2}
                  profilePicture
                  score={nr2Score}
                  to={
                    view === "season" && currentSeason
                      ? `/player/${nr2.id}?tab=season`
                      : undefined
                  }
                />
              )}
              {nr3 && (
                <PodiumPlace
                  size="xs"
                  place={3}
                  playerSummary={nr3}
                  profilePicture
                  score={nr3Score}
                  to={
                    view === "season" && currentSeason
                      ? `/player/${nr3.id}?tab=season`
                      : undefined
                  }
                />
              )}
            </>
          )}
        </div>
        <RecentGames view={view} />
        <RecentAchievements view={view} />
        <RecentLeaderBoardChanges view={view} />
        {theme === Theme.EASTER && <img src={easterBunny} alt="Easter bunny chick" />}
      </div>

      <div className="bg-primary-background rounded-lg w-full max-w-md md:w-[450px]">
        {/* Toggle (Desktop) */}
        <LeaderboardToggle
          className="hidden md:flex border-b border-primary-text/20"
          view={view}
          setView={setView}
        />

        {view === "overall" ? (
          <>
            {/* Overall Leaderboard */}
            <table className="w-full text-primary-text border-collapse">
              <thead>
                <tr className="text-sm xs:text-lg md:text-xl text-primary-text">
                  <th className="py-1 px-1 xs:px-2 text-left font-light">#</th>
                  <th className="py-1 px-1 xs:px-2 text-left font-normal">Player</th>
                  <th className="py-1 px-1 xs:px-2 text-right font-light">Score</th>
                  <th className="py-1 px-1 xs:px-2 text-right font-light text-xs xs:text-sm md:text-base">Interval</th>
                  <th className="py-1 px-1 xs:px-2 text-right font-light text-xs xs:text-sm md:text-base whitespace-nowrap">
                    🏆:💔
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-text/50">
                {leaderboard.rankedPlayers.map((player, index, list) => (
                  <tr
                    key={index}
                    onClick={() => navigate(`/player/${player.id}`)}
                    className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text cursor-pointer transition-colors text-sm xs:text-lg md:text-xl font-light"
                  >
                    <td className="py-1 px-1 xs:px-2 italic w-[1%] whitespace-nowrap">
                      {themedPlaceNumber(player.rank) ?? player.rank}
                    </td>
                    <td className="py-1 px-1 xs:px-2 w-full max-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <ProfilePicture playerId={player.id} size={28} border={2} />
                        <span className="font-normal truncate">{player.name}</span>
                      </div>
                    </td>
                    <td className="py-1 px-1 xs:px-2 text-right w-[1%] whitespace-nowrap">
                      {player.elo.toLocaleString("no-NO", {
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="py-1 px-1 xs:px-2 text-right w-[1%] whitespace-nowrap text-xs xs:text-sm md:text-base">
                      {list[index - 1]
                        ? (player.elo - list[index - 1].elo).toLocaleString("no-NO", {
                            maximumFractionDigits: 0,
                          })
                        : "-"}
                    </td>
                    <td className="py-1 px-1 xs:px-2 text-right w-[1%] whitespace-nowrap text-xs xs:text-sm md:text-base">
                      {(player.wins / player.loss).toLocaleString("no-NO", {
                        maximumFractionDigits: 1,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h1 className="text-2xl text-center text-primary-text mt-4">Unranked players</h1>
            <p className="w-full text-center text-primary-text mb-2">
              Play {context.client.gameLimitForRanked} or more games to get ranked
            </p>
            <table className="w-full text-primary-text border-collapse">
              <thead>
                <tr className="text-sm xs:text-lg md:text-xl text-primary-text">
                  <th className="py-1 px-1 xs:px-2 text-left font-normal">Player</th>
                  <th className="py-1 px-1 xs:px-2 text-right font-light">Elo</th>
                  <th className="py-1 px-1 xs:px-2 text-right font-light">Games</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-text/50">
                {leaderboard.unrankedPlayers.map((player, index) => (
                  <tr
                    key={index}
                    onClick={() => navigate(`/player/${player.id}`)}
                    className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text cursor-pointer transition-colors text-sm xs:text-lg md:text-xl font-light"
                  >
                    <td className="py-1 px-1 xs:px-2 w-full max-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <ProfilePicture playerId={player.id} size={28} border={2} />
                        <span className="font-normal truncate">{player.name}</span>
                      </div>
                    </td>
                    <td className="py-1 px-1 xs:px-2 text-right w-[1%] whitespace-nowrap">
                      {player.elo.toLocaleString("no-NO", {
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="py-1 px-1 xs:px-2 text-right w-[1%] whitespace-nowrap">{player.games.length}</td>
                  </tr>
                ))}
                {playersWithNoMatches.map((player, index) => (
                  <tr
                    key={index}
                    onClick={() => navigate(`/player/${player.id}`)}
                    className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text cursor-pointer transition-colors text-sm xs:text-lg md:text-xl font-light"
                  >
                    <td className="py-1 px-1 xs:px-2 w-full max-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <ProfilePicture playerId={player.id} size={28} border={2} />
                        <span className="font-normal truncate">{player.name}</span>
                      </div>
                    </td>
                    <td className="py-1 px-1 xs:px-2 text-right w-[1%] whitespace-nowrap">-</td>
                    <td className="py-1 px-1 xs:px-2 text-right w-[1%] whitespace-nowrap">0</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <>
            {/* Season Leaderboard */}
            {currentSeason ? (
              <>
                <table className="w-full text-primary-text border-collapse">
                  <thead>
                    <tr className="text-sm xs:text-lg md:text-xl text-primary-text">
                      <th className="py-1 px-1 xs:px-2 text-left font-light">#</th>
                      <th className="py-1 px-1 xs:px-2 text-left font-normal">Player</th>
                      <th className="py-1 px-1 xs:px-2 text-right font-light">Score</th>
                      <th className="py-1 px-1 xs:px-2 text-right font-light text-xs xs:text-sm md:text-base">Interval</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary-text/50">
                    {seasonLeaderboard.map((player, index, list) => (
                      <tr
                        key={player.playerId}
                        onClick={() => navigate(`/player/${player.playerId}?tab=season`)}
                        className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text cursor-pointer transition-colors text-sm xs:text-lg md:text-xl font-light"
                      >
                        <td className="py-1 px-1 xs:px-2 italic w-[1%] whitespace-nowrap">
                          {themedPlaceNumber(index + 1) ?? index + 1}
                        </td>
                        <td className="py-1 px-1 xs:px-2 w-full max-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <ProfilePicture playerId={player.playerId} size={28} border={2} />
                            <span className="font-normal truncate">{context.playerName(player.playerId)}</span>
                          </div>
                        </td>
                        <td className="py-1 px-1 xs:px-2 text-right w-[1%] whitespace-nowrap">{fmtNum(player.seasonScore)}</td>
                        <td className="py-1 px-1 xs:px-2 text-right w-[1%] whitespace-nowrap text-xs xs:text-sm md:text-base">
                          {list[index - 1] ? fmtNum(player.seasonScore - list[index - 1].seasonScore) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h1 className="text-2xl text-center text-primary-text mt-10">Not yet participated</h1>
                <p className="w-full text-center text-primary-text mb-4">
                  Play a game this season to join the leaderboard
                </p>
                <table className="w-full text-primary-text border-collapse">
                  <thead>
                    <tr className="text-sm xs:text-lg md:text-xl text-primary-text">
                      <th className="py-1 px-1 xs:px-2 text-left font-normal">Player</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary-text/50">
                    {playersNotInSeason.map((player) => (
                      <tr
                        key={player.id}
                        onClick={() => navigate(`/player/${player.id}?tab=season`)}
                        className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text cursor-pointer transition-colors text-sm xs:text-lg md:text-xl font-light"
                      >
                        <td className="py-1 px-1 xs:px-2 max-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <ProfilePicture playerId={player.id} size={28} border={2} />
                            <span className="font-normal truncate">{player.name}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <div className="p-8 text-center text-secondary-text">
                <p>No active season at the moment</p>
                <button
                  onClick={() => setView("overall")}
                  className="mt-4 px-4 py-2 rounded text-sm font-medium transition-colors ring-1 bg-secondary-background text-secondary-text ring-secondary-text hover:opacity-80"
                >
                  View Overall Leaderboard
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
