import React, { useMemo, useState } from "react";
import { useEventDbContext } from "../../../wrappers/event-db-context";
import { ProfilePicture } from "../../player/profile-picture";
import { fmtNum } from "../../../common/number-utils";
import { PointsBar } from "./points-bar";
import { Elo } from "../../../client/client-db/elo";
import { Link } from "react-router-dom";
import { Switch } from "@headlessui/react";
import { classNames } from "../../../common/class-names";
import { Shimmer } from "../../../common/shimmer";

export const IndividualPointsOverview: React.FC = () => {
  const context = useEventDbContext();
  const [transactionOrder, setTransactionOrder] = useState<"FIFO" | "LIFO">(
    context.individualPoints.cachedTransactionOrder ?? "FIFO",
  );

  const map = useMemo(() => {
    context.individualPoints.clearCache();
    return context.individualPoints.playerMap(transactionOrder);
  }, [context.individualPoints, transactionOrder]);

  const players = Array.from(map).map(([_, player]) => player);
  const highestElo = players.sort((a, b) => b.totalPoints - a.totalPoints)[0].totalPoints;
  return (
    <div className="px-4 text-primary-text">
      <h1>Individually numbered points</h1>
      <p className="mb-4">
        Like numbered shares, track where your original {fmtNum(Elo.INITIAL_ELO)} points have ended up.
      </p>
      <p className="mb-4 flex gap-1">
        Ranges with point no. 0 or {fmtNum(Elo.INITIAL_ELO)} are
        <Shimmer className="w-fit">highlighted</Shimmer>
      </p>
      <Switch
        checked={transactionOrder === "LIFO"}
        onChange={() => (transactionOrder === "FIFO" ? setTransactionOrder("LIFO") : setTransactionOrder("FIFO"))}
        className="group relative mb-4 flex h-10 w-36 cursor-pointer rounded-full bg-secondary-background p-1 transition-colors duration-200 ease-in-out focus:outline-none data-[focus]:outline-1 data-[focus]:outline-white"
      >
        <div
          className={classNames(
            "absolute top-1/2 transform -translate-y-1/2 left-5 z-10",
            transactionOrder === "LIFO" ? "text-secondary-text" : "text-primary-text",
          )}
        >
          FIFO {transactionOrder === "FIFO" && "🔚"}
        </div>
        <div
          className={classNames(
            "absolute top-1/2 transform -translate-y-1/2 right-5 z-10",
            transactionOrder === "LIFO" ? "text-primary-text" : "text-secondary-text",
          )}
        >
          {transactionOrder === "LIFO" && "🔝"} LIFO
        </div>
        <span
          aria-hidden="true"
          className="pointer-events-none inline-block h-8 w-[5rem] translate-x-0 rounded-full bg-primary-background ring-0 shadow-lg transition duration-200 ease-in-out group-data-[checked]:translate-x-[3.5rem]"
        />
      </Switch>
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
