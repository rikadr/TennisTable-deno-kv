import React, { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { relativeTimeString } from "../../common/date-utils";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { PodiumPlace } from "../leaderboard/podium-place";
import { PlayerPointsDistrubution } from "./player-points-distribution";
import { ProfilePicture } from "./profile-picture";
import { PlayerGamesDistrubution } from "./player-games-distribution";

import { PlayerEloGraph } from "./player-elo-graph";

export const PlayerPage: React.FC = () => {
  const { name: playerId } = useParams();
  const context = useEventDbContext();

  const summary = context.leaderboard.getPlayerSummary(playerId || "");
  const pendingGames = context.tournaments.findAllPendingGamesByPlayer(playerId);

  const reverseGames = useMemo(() => {
    if (!summary) return;
    return summary?.games.slice(Math.max(summary?.games.length - 10, 0)).reverse();
  }, [summary]);

  const [showExpectedElo, setShowExpectedElo] = useState(false);

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-col items-center md:flex-row md:items-start ">
        <div className="w-64">
          <ProfilePicture playerId={playerId} clickToEdit border={8} shape="rounded" />
          <div className="w-64 my-4">
            <PodiumPlace size="default" place={summary?.rank} playerSummary={summary} />
          </div>
        </div>

        {playerId && summary.games.length > 0 && (
          <div className="bg-primary-background rounded-lg">
            <PlayerEloGraph playerId={playerId} showExpectedElo={showExpectedElo} />
            <div className="w-full flex flex-col md:flex-row justify-center items-center gap-x-6 gap-y-2 -mt-2 text-primary-text relative">
              <div>
                <div>Longest win-streak 🔥🏆 {summary.streaks?.longestWin}</div>
                <div>Longest lose-streak 🔥💔 {summary.streaks?.longestLose}</div>
              </div>
              {summary.games.length >= context.client.gameLimitForRanked && (
                <button
                  className="px-2 py-1 bg-secondary-background text-secondary-text ring-1 ring-secondary-text hover:bg-secondary-background/50 rounded-lg"
                  onClick={() => setShowExpectedElo((prev) => !prev)}
                >
                  {showExpectedElo ? "Hide" : "Show"} expected score
                  {showExpectedElo && (
                    <>
                      <p className="text-xs">* Might fluctuate wildly when too little data (few games)</p>
                      <p className="text-xs">or more players become ranked and the total points pool increases</p>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
        {summary.games.length === 0 && (
          <div className="p-10">
            <h1>It's empty here...</h1>
            <br />
            <p>- Add your Profile picture! 📸</p>
            <p>- Join tournaments! 🏆</p>
            <p>- Play games! 🏓</p>
            <p>- Analyse data and compare players! 📊</p>
          </div>
        )}
      </div>
      {pendingGames.length > 0 && (
        <div className="bg-primary-background rounded-lg w-96 mb-1">
          <h1 className="text-2xl text-center mt-4 text-primary-text">Pending tournament games</h1>
          {pendingGames.map((tournament) => (
            <div
              key={tournament.tournament.id}
              className="max-w-96 w-full mt-2 space-y-2 ring-1 ring-secondary-background rounded-lg p-2"
            >
              <Link to={`/tournament?tournament=${tournament.tournament.id}`}>
                <h1 className="text-center text-primary-text">{tournament.tournament.name}</h1>
              </Link>
              {tournament.games.map((game) => (
                <Link
                  key={tournament.tournament.id + playerId + game.oponent}
                  to={`/tournament?tournament=${tournament.tournament.id}&player1=${game.player1}&player2=${game.player2}`}
                >
                  <div className="relative w-full px-4 py-2 mt-2 rounded-lg flex items-center gap-x-4 h-12 hover:bg-secondary-background/70 bg-secondary-background ring-2 ring-secondary-text text-secondary-text">
                    <h2 className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">VS</h2>
                    <div className="flex gap-3 items-center justify-center">
                      <ProfilePicture playerId={playerId} size={35} shape="circle" clickToEdit={false} border={3} />
                      <h3>{context.playerName(playerId)}</h3>
                    </div>
                    <div className="grow" />
                    <div className="flex gap-3 items-center justify-center">
                      <h3>{context.playerName(game.oponent)}</h3>

                      <ProfilePicture playerId={game.oponent} size={35} shape="circle" clickToEdit={false} border={3} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
      {summary.games.length > 0 && (
        <div className="flex flex-col md:flex-row justify-evenly items-center md:items-start w-full md:mr-4 text-primary-text">
          <div className="w-full max-w-2xl flex flex-col justify-center">
            <div className="flex flex-col items-center bg-primary-background rounded-lg">
              <h1 className="text-2xl text-center mt-4">Points distribution</h1>
              <div className="w-full max-w-2xl">
                <PlayerPointsDistrubution playerId={playerId} />
              </div>
            </div>

            <div className="flex flex-col items-center bg-primary-background rounded-lg">
              <h1 className="text-2xl text-center mt-4">Games distribution</h1>
              <div className="w-full max-w-2xl">
                <PlayerGamesDistrubution playerId={playerId} />
              </div>
            </div>
          </div>

          <div className="bg-primary-background rounded-lg">
            <h1 className="text-2xl text-center mt-4">Last 10 games</h1>
            <div className="flex flex-col divide-y divide-primary-text/50">
              <div className="flex gap-4 text-base text-center mb-2">
                <div className="w-36 ">Game</div>
                <div className="w-12 pl-4 whitespace-nowrap">Elo +-</div>
                <div className="w-24 text-right">Time</div>
              </div>
              {reverseGames?.map((game, index) => (
                <Link
                  key={(summary?.id ?? "-") + index + game.oponent}
                  to={`/player/${game.oponent}`}
                  className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text py-1 px-2 flex gap-4 text-xl font-light"
                >
                  <div className="w-32 font-normal whitespace-nowrap">
                    {game.result === "win" ? "🏆 " : "💔 "} {context.playerName(game.oponent)}
                  </div>
                  <div className="w-12 text-right">
                    {game.pointsDiff.toLocaleString("no-NO", {
                      maximumFractionDigits: 0,
                    })}
                  </div>
                  <div className="w-32 text-right text-base">{relativeTimeString(new Date(game.time))}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
