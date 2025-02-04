import React from "react";
import { useRerender } from "../../hooks/use-rerender";
import { useClientDbContext } from "../../wrappers/client-db-context";
import { Elo } from "../../client-db/elo";

export const ExpectedScore: React.FC = () => {
  const rerender = useRerender();

  const context = useClientDbContext();

  return (
    <div className="flex flex-col items-center">
      <h1 className="mb-6 text-2xl">Expected score</h1>
      <p className="w-96">
        Predicts future games based on players' history, then simulates that future. The result should be the expected
        score for every player if current trends contiune.
      </p>
      <button
        className="bg-secondary-background hover:bg-secondary-background/50 rounded-lg px-10 py-2 my-2"
        onClick={async () => {
          window.tennisTable.futureElo.simulate();
          rerender();
        }}
      >
        Simulate!
      </button>

      <div>
        {Array.from(context.futureElo.playersMap.entries())
          .filter(([_, p]) => p.totalGames >= Elo.GAME_LIMIT_FOR_RANKED)
          .map(([name, player]) => (
            <div key={name}>
              <h2>{name}</h2>
              <div>
                {Array.from(player.oponentsMap.entries())
                  .filter(([_, p]) => p.wins + p.loss >= Elo.GAME_LIMIT_FOR_RANKED)
                  .map(([oponent, results]) => (
                    <div key={name + oponent}>
                      {" "}
                      - {oponent}{" "}
                      {/* {JSON.stringify(context.futureElo.combineFractions([results., oneLayerFraction]))} */}
                    </div>
                  ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
