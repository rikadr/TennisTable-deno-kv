import React from "react";
import { useRerender } from "../../hooks/use-rerender";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { fmtNum } from "../../common/number-utils";

export const ExpectedScore: React.FC = () => {
  const rerender = useRerender();

  const context = useEventDbContext();

  return (
    <div className="flex flex-col items-center text-primary-text bg-primary-background rounded-lg p-4 w-fit m-auto">
      <section className="w-96 mb-16 space-y-4">
        <h1 className="text-2xl">Expected score</h1>
        <p>
          Predicts future games based on players' history, then simulates that future. The result should be the expected
          score for every player if current trends contiune.
        </p>
        <p>
          It simulates {window.tennisTable.futureElo.GAMES_TO_PREDICT_PER_OPONENT} games between all possible player
          pairings of ranked players. The win/loss probability is calculated in 3 ways and combined to a weighted avrage
          weighted on confidence.
        </p>
        <ol className="text-sm ml-4 list-disc">
          <li>0: Direct probability from existing results between the players.</li>
          <li>
            1: Chained probability with <b>one</b> intermediate player.
          </li>
          <li>
            2: Chained probability with <b>two</b> intermediate players.
          </li>
        </ol>
        <p>The 3 probabilities are again combined for the final prediction.</p>
        <p>EXAMPLE:</p>
        <p>
          <span className="font-lg font-bold">60% @90%</span> means 60% chance to win with a 90% confidence in the
          prediction.
        </p>
      </section>

      {context.futureElo.playersMap.size === 0 && (
        <button
          className="bg-secondary-background hover:bg-secondary-background/50 text-secondary-text rounded-lg px-10 py-2 my-2"
          onClick={async () => {
            window.tennisTable.futureElo.simulate();
            rerender();
          }}
        >
          Simulate!
        </button>
      )}

      <div>
        {context.futureElo.playersMap.size > 0 ? (
          <section className="w-96 mb-6 space-y-4">
            <h1 className="text-2xl">Data dump 👇</h1>
            <p>Feel free to naigate anywhere in the app to see the effects of the simulated games 😄</p>
          </section>
        ) : null}
        {Array.from(context.futureElo.playersMap.entries())
          .filter(([_, p]) => p.totalGames >= context.client.gameLimitForRanked)
          .map(([name, player]) => (
            <div key={name}>
              <h2 className="text-xl">{context.playerName(name)}</h2>
              <div className="space-y-2 ml-6">
                {Array.from(player.oponentsMap.entries()).map(([oponent, results]) => {
                  const fractions = [results.directFraction, results.oneLayerFraction, results.twoLayerFraction];
                  const combined = context.futureElo.combineFractions(fractions);
                  return (
                    <div key={name + oponent}>
                      {context.playerName(name)} {"->"} {context.playerName(oponent)}{" "}
                      <span className="font-bold text-lg">{fmtNum((combined?.fraction || 0) * 100)}%</span> win chanse @
                      {fmtNum((combined?.confidence || 0) * 100)}% confidence
                      <ul className="ml-6">
                        {fractions.map(
                          (fraction, index) =>
                            fraction && (
                              <li
                                key={name + oponent + index}
                                className={(fraction?.confidence || 0) === 0 ? "line-through" : ""}
                              >
                                <span className="opacity-50 font-light italic">{index}:</span>{" "}
                                {fmtNum((fraction?.fraction || 0) * 100)}% @{fmtNum((fraction?.confidence || 0) * 100)}%{" "}
                                {index === 0 && `${results.wins.length}:${results.loss.length}`}
                              </li>
                            ),
                        )}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
