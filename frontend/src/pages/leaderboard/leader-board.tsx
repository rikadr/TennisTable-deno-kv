import React from "react";
import { Link } from "react-router-dom";
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
import { fmtNum } from "../../common/number-utils";
import { classNames } from "../../common/class-names";
import { useLocalStorage } from "../../hooks/use-local-storage";

type LeaderboardView = "overall" | "season";

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
        <TournamentHighlightsAndPendingGames />
        <div className="bg-primary-background rounded-lg w-full space-y-2">
          <h1 className="text-2xl text-center text-primary-text my-2">
            {view === "season" ? "Season Leaderboard" : "Overall Leaderboard"}
          </h1>
          <LeaderboardToggle
            className="md:hidden border-b border-primary-text/20 mb-2"
            view={view}
            setView={setView}
          />
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
        </div>
        <RecentGames view={view} />
        <RecentAchievements view={view} />
        <RecentLeaderBoardChanges view={view} />
        {theme === Theme.EASTER && <img src={easterBunny} alt="Easter bunny chick" />}
      </div>

      <div className="bg-primary-background rounded-lg">
        {/* Toggle (Desktop) */}
        <LeaderboardToggle
          className="hidden md:flex border-b border-primary-text/20"
          view={view}
          setView={setView}
        />

        {view === "overall" ? (
          <>
            {/* Overall Leaderboard */}
            <div className="flex flex-col divide-y divide-primary-text/50">
              <div className="flex gap-4 text-base text-center mb-2 text-primary-text">
                <div className="w-5">#</div>
                <div className="w-40 text-left pl-2">Name</div>
                <div className="w-12 text-right">Score</div>
                <div className="w-10 pl-1">Interval</div>
                <div className="w-14 text-right">🏆:💔</div>
              </div>
              {leaderboard.rankedPlayers.map((player, index, list) => (
                <Link
                  key={index}
                  to={`/player/${player.id}`}
                  className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text py-1 px-2 flex items-center gap-4 text-xl font-light text-primary-text"
                >
                  <div className="w-5 italic">{themedPlaceNumber(player.rank) ?? player.rank}</div>
                  <ProfilePicture playerId={player.id} size={28} border={2} />
                  <div className="w-28 font-normal whitespace-nowrap">{player.name}</div>
                  <div className="w-12 text-right">
                    {player.elo.toLocaleString("no-NO", {
                      maximumFractionDigits: 0,
                    })}
                  </div>
                  <div className="w-10 text-right text-base">
                    {list[index - 1]
                      ? (player.elo - list[index - 1].elo).toLocaleString("no-NO", {
                          maximumFractionDigits: 0,
                        })
                      : "-"}
                  </div>
                  <div className="w-10 text-right text-base">
                    {(player.wins / player.loss).toLocaleString("no-NO", {
                      maximumFractionDigits: 1,
                    })}
                  </div>
                </Link>
              ))}
            </div>

            <h1 className="text-2xl text-center text-primary-text mt-10">Unranked players</h1>
            <p className="w-full text-center text-primary-text mb-4">
              Play {context.client.gameLimitForRanked} or more games to get ranked
            </p>
            <div className="flex flex-col divide-y divide-primary-text/50">
              <div className="flex gap-4 text-base text-center text-primary-text mb-2">
                <div className="w-40 text-left pl-2">Name</div>
                <div className="w-12 text-right">Elo</div>
                <div className="w-12 text-right">Games</div>
              </div>
              {leaderboard.unrankedPlayers.map((player, index) => (
                <Link
                  key={index}
                  to={`/player/${player.id}`}
                  className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text py-1 px-2 flex items-center gap-4 text-xl text-primary-text font-light"
                >
                  <ProfilePicture playerId={player.id} size={28} border={2} />
                  <div className="w-28 font-normal whitespace-nowrap">{player.name}</div>
                  <div className="w-12 text-right">
                    {player.elo.toLocaleString("no-NO", {
                      maximumFractionDigits: 0,
                    })}
                  </div>
                  <div className="w-12 text-right">{player.games.length}</div>
                </Link>
              ))}
              {playersWithNoMatches.map((player, index) => (
                <Link
                  key={index}
                  to={`/player/${player.id}`}
                  className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text py-1 px-2 flex items-center gap-4 text-xl text-primary-text font-light"
                >
                  <ProfilePicture playerId={player.id} size={28} border={2} />
                  <div className="w-28 font-normal whitespace-nowrap">{player.name}</div>
                  <div className="w-12 text-right">-</div>
                  <div className="w-12 text-right">0</div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Season Leaderboard */}
            {currentSeason ? (
              <>
                <div className="flex flex-col divide-y divide-primary-text/50">
                  <div className="flex gap-4 text-base text-center mb-2 text-primary-text">
                    <div className="w-5">#</div>
                    <div className="w-40 text-left pl-2">Name</div>
                    <div className="w-12 text-right">Score</div>
                    <div className="w-16 pl-1">Interval</div>
                  </div>
                  {seasonLeaderboard.map((player, index, list) => (
                    <Link
                      key={player.playerId}
                      to={`/player/${player.playerId}?tab=season`}
                      className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text py-1 px-2 flex items-center gap-4 text-xl font-light text-primary-text"
                    >
                      <div className="w-5 italic">{themedPlaceNumber(index + 1) ?? index + 1}</div>
                      <ProfilePicture playerId={player.playerId} size={28} border={2} />
                      <div className="w-28 font-normal whitespace-nowrap">{context.playerName(player.playerId)}</div>
                      <div className="w-12 text-right">{fmtNum(player.seasonScore)}</div>
                      <div className="w-10 text-right text-base">
                        {list[index - 1] ? fmtNum(player.seasonScore - list[index - 1].seasonScore) : "-"}
                      </div>
                    </Link>
                  ))}
                </div>

                <h1 className="text-2xl text-center text-primary-text mt-10">Not yet participated</h1>
                <p className="w-full text-center text-primary-text mb-4">
                  Play a game this season to join the leaderboard
                </p>
                <div className="flex flex-col divide-y divide-primary-text/50">
                  <div className="flex gap-4 text-base text-center text-primary-text mb-2">
                    <div className="w-40 text-left pl-2">Name</div>
                  </div>
                  {playersNotInSeason.map((player) => (
                    <Link
                      key={player.id}
                      to={`/player/${player.id}?tab=season`}
                      className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text py-1 px-2 flex items-center gap-4 text-xl text-primary-text font-light"
                    >
                      <ProfilePicture playerId={player.id} size={28} border={2} />
                      <div className="w-28 font-normal whitespace-nowrap">{player.name}</div>
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-secondary-text">
                <p>No active season at the moment</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
