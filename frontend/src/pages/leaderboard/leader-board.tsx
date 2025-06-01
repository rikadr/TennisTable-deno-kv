import React from "react";
import { Link } from "react-router-dom";
import { PodiumPlace } from "./podium-place";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { RecentGames } from "./recent-games";
import { TournamentHighlightsAndPendingGames } from "./tournament-pending-games";
import { getClientConfig, Theme, themeOrOverrideTheme } from "../../client/client-config/get-client-config";
import easterBunny from "../../img/easter/easter-bunny-realistic.png";
import { getEgg, getPumpkin } from "./themed-place-number";

export const LeaderBoard: React.FC = () => {
  const context = useEventDbContext();
  const leaderboard = context.leaderboard.getLeaderboard();

  const client = getClientConfig();
  const theme = themeOrOverrideTheme(client.theme);

  const playersWithNoMatches = context.players.filter(
    (player) =>
      !leaderboard.rankedPlayers.some((r) => r.id === player.id) &&
      !leaderboard.unrankedPlayers.some((u) => u.id === player.id),
  );

  const nr1 = leaderboard.rankedPlayers[0];
  const nr2 = leaderboard.rankedPlayers[1];
  const nr3 = leaderboard.rankedPlayers[2];

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
      <div className="w-full max-w-96 sm:w-96 flex flex-col gap-2 items-center">
        <TournamentHighlightsAndPendingGames />
        <div className="bg-primary-background rounded-lg w-full space-y-2">
          <h1 className="text-2xl text-center text-primary-text my-2">Leaderboard</h1>
          {nr1 && <PodiumPlace size="default" place={1} playerSummary={nr1} profilePicture />}
          {nr2 && <PodiumPlace size="sm" place={2} playerSummary={nr2} profilePicture />}
          {nr3 && <PodiumPlace size="xs" place={3} playerSummary={nr3} profilePicture />}
        </div>
        {/* <LeaderboardDistrubution /> */}
        <RecentGames />
        {theme === Theme.EASTER && <img src={easterBunny} alt="Easter bunny chick" />}
      </div>
      <div className="bg-primary-background rounded-lg">
        <div className="flex flex-col divide-y divide-primary-text/50">
          <div className="flex gap-4 text-base text-center mb-2 text-primary-text">
            <div className="w-5">#</div>
            <div className="w-40 text-left pl-2">Name</div>
            <div className="w-12 text-right">Elo</div>
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
            <div className="w-14 pl-8 text-right">Games</div>
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
              <div className="w-14 text-right text-base">
                {player.games.length.toLocaleString("no-NO", {
                  maximumFractionDigits: 0,
                })}
              </div>
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
              <div className="w-14 text-right text-base">0</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
