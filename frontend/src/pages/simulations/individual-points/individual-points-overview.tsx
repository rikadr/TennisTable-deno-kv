import React from "react";
import { useEventDbContext } from "../../../wrappers/event-db-context";
import { ProfilePicture } from "../../player/profile-picture";
import { fmtNum } from "../../../common/number-utils";
import { PointsBar } from "./points-bar";
import { Elo } from "../../../client/client-db/elo";
import { Link } from "react-router-dom";

export const IndividualPointsOverview: React.FC = () => {
  const context = useEventDbContext();

  const map = context.individualPoints.playerMap();
  const players = Array.from(map).map(([_, player]) => player);
  const highestElo = players.sort((a, b) => b.totalPoints - a.totalPoints)[0].totalPoints;
  return (
    <div className="px-4 text-primary-text">
      <h1>Individually numbered points</h1>
      <p className="mb-4">
        Like numbered shares, track where your original {fmtNum(Elo.INITIAL_ELO)} points have ended up when using a
        first in, first out order (FIFO)
      </p>
      {players.map((player) => (
        <Link
          key={player.id}
          to={`/simulations/individual-points/player?playerId=${player.id}`}
          className="flex flex-col md:flex-row items-start md:items-center hover:bg-primary-text/10 w-full md:w-[calc(100%-200px)] xl:md:w-[calc(100%-300px)]"
        >
          <div className="flex gap-2 items-center">
            <ProfilePicture playerId={player.id} border={3} size={36} linkToPlayer />
            <div className="w-24 shrink-0">
              <h2>{context.playerName(player.id)}</h2>
              <p>{fmtNum(player.totalPoints)}</p>
            </div>
          </div>
          <PointsBar highestElo={highestElo} totalPoints={player.totalPoints} pointsRanges={player.pointsRanges} />
        </Link>
      ))}
    </div>
  );
};
