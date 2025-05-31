import React, { useMemo } from "react";
import { useEventDbContext } from "../../../wrappers/event-db-context";
import { useTennisParams } from "../../../hooks/use-tennis-params";
import { PointsBar } from "./points-bar";
import { PlayerWithIndividualPoints, PointsRange } from "../../../client/client-db/individual-points";
import { ProfilePicture } from "../../player/profile-picture";
import { fmtNum } from "../../../common/number-utils";
import { Link, useNavigate } from "react-router-dom";
import { classNames } from "../../../common/class-names";

export const IndividualPointsPlayer: React.FC = () => {
  const context = useEventDbContext();
  const { playerId } = useTennisParams();

  const map = context.individualPoints.playerMap();

  if (!playerId) {
    return <p>No player found for id {playerId}</p>;
  }
  const player = map.get(playerId);
  if (!player) {
    return <p>No player found for id {playerId}</p>;
  }

  return <PlayerOverview player={player} />;
};

const PlayerOverview: React.FC<{ player: PlayerWithIndividualPoints }> = ({ player }) => {
  const context = useEventDbContext();
  const map = context.individualPoints.playerMap();

  const navigate = useNavigate();

  const groupedRanges = useMemo(() => {
    const grouped = new Map<string, { ranges: PointsRange[]; total: number }>();
    for (const range of player.pointsRanges) {
      if (grouped.has(range.originPlayerId) === false) {
        grouped.set(range.originPlayerId, { ranges: [], total: 0 });
      }
      grouped.get(range.originPlayerId)!.ranges.push(range);
      grouped.get(range.originPlayerId)!.total += range.to - range.from;
    }

    const listOfGrouped = Array.from(grouped)
      .map(([_, entry]) => entry)
      .sort((a, b) => b.total - a.total)
      .flatMap((entry) => entry.ranges);

    return listOfGrouped;
  }, [player]);

  const oponentsWithYourPointsRanges = useMemo(() => {
    const oponents = new Map<string, { id: string; ranges: PointsRange[]; total: number }>();
    map.forEach((oponent) => {
      const playersPoints = oponent.pointsRanges.filter((range) => range.originPlayerId === player.id);
      if (playersPoints.length === 0) return;
      const total = playersPoints.reduce((tot, range) => (tot += range.to - range.from), 0);
      oponents.set(oponent.id, { id: oponent.id, ranges: playersPoints, total });
    });
    const listOfOponents = Array.from(oponents)
      .map(([_, entry]) => entry)
      .sort((a, b) => b.total - a.total);
    return listOfOponents;
  }, [player, map]);

  return (
    <div className="px-4 md:px-20 lg:md:px-32 xl:px-40 text-primary-text">
      <div className="flex gap-2">
        <ProfilePicture playerId={player.id} border={3} size={100} linkToPlayer shape="rounded" />
        <div className="">
          <h1 className="text-4xl">{context.playerName(player.id)}</h1>
          <p>{fmtNum(player.totalPoints)} points</p>
        </div>
        <div className="grow" />
        <button
          className="text-xs bg-secondary-background text-secondary-text hover:brightness-125 px-8 py-4 h-fit rounded-md"
          onClick={() => navigate(`/simulations/individual-points`)}
        >
          Back
        </button>
      </div>
      <p className="mt-4">Current points holding</p>
      <PointsBar highestElo={player.totalPoints} pointsRanges={player.pointsRanges} totalPoints={player.totalPoints} />
      <p className="mt-4">Sorted by player</p>
      <PointsBar highestElo={player.totalPoints} pointsRanges={groupedRanges} totalPoints={player.totalPoints} />
      <p className="mt-4">Players with your points</p>
      {oponentsWithYourPointsRanges.map((oponent) => {
        //
        return (
          <Link
            key={oponent.id}
            to={`/simulations/individual-points/player?playerId=${oponent.id}`}
            className={classNames(
              "flex items-center gap-2 px-4 hover:bg-primary-text/10 border-primary-text/30",
              oponent.id === player.id && "border-2",
            )}
          >
            <ProfilePicture playerId={oponent.id} border={3} size={36} />
            <div className="w-24 shrink-0">
              <h2>{context.playerName(oponent.id)}</h2>
              <p>{fmtNum(oponent.total)}</p>
            </div>
            <PointsBar highestElo={player.totalPoints} pointsRanges={oponent.ranges} totalPoints={oponent.total} />
          </Link>
        );
      })}
    </div>
  );
};
