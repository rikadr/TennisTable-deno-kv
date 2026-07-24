import { useSessionStorage } from "usehooks-ts";
import { Tournament } from "../../client/client-db/tournaments/tournament";
import { losersRoundLabel } from "../leaderboard/tournament-pending-games";
import { GameTriangle, TournamentGameListCard, TreeListToggle } from "./tournament-bracket";

export const TournamentLosersBracket = ({
  tournament,
  itemRefs,
}: {
  tournament: Tournament;
  itemRefs: React.MutableRefObject<{
    [key: string]: HTMLElement | null;
  }>;
}) => {
  const [showAsList, setShowAsList] = useSessionStorage(
    `show-losers-tournament-as-list${tournament.id}`,
    window.innerWidth < 1_000,
  );
  const losersBracket = tournament.bracket?.losersBracket;

  if (!losersBracket) return null;

  if (losersBracket.length === 0) {
    return (
      <div className="mx-4 md:mx-10 mt-6">
        <div className="max-w-2xl mx-auto bg-secondary-background rounded-lg p-6">
          <h3 className="text-lg font-semibold text-secondary-text mb-2">No losers bracket rounds</h3>
          <p className="text-sm text-secondary-text">
            With only two players there are no losers bracket rounds. The loser of the winners bracket final gets
            their second chance directly in the grand final.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-primary-text/70 max-w-2xl">
        Players who lose in the winners bracket drop down here for a second chance. Lose again and you are out. The
        winner of the losers bracket meets the winners bracket champion in the grand final.
      </p>
      <TreeListToggle showAsList={showAsList} setShowAsList={setShowAsList} />
      {showAsList === false && (
        <div className="flex flex-col gap-6 w-fit max-w-full m-auto bg-primary-background rounded-lg p-4 overflow-x-auto">
          {/* Rounds stacked vertically like the winners tree: losers final at the top, round 1
              at the bottom. Not a recursive tree: consecutive losers rounds can have the same
              number of games */}
          {losersBracket.map((layer, layerIndex) => {
            // Walkover slots (a lone player who advances with no opponent) are shown as cards too;
            // only empty bye slots are hidden
            const visibleGamesInRound = layer.filter((game) => !game.isBye).length;
            if (visibleGamesInRound === 0) return null; // Round consists only of empty bye slots
            const { title, subtitle } = losersRoundLabel(layerIndex, losersBracket.length);
            // Card size follows how many cards are in the round (like the winners tree, where a
            // layer of 2^depth games renders at that depth's size), not how deep the round is
            const sizeDepth = Math.max(0, Math.ceil(Math.log2(visibleGamesInRound)));
            return (
              <div key={layerIndex} className="space-y-1">
                <h3 className="text-center text-sm text-primary-text">{title}</h3>
                {subtitle && (
                  <p className="text-center text-xs font-light text-primary-text/60">{subtitle}</p>
                )}
                <div className="flex justify-around items-start gap-2">
                  {layer.map((game, gameIndex) => {
                    // Empty bye slots are never shown; walkovers render as normal cards (with a
                    // "bye" in the empty slot) so they line up with the real games
                    if (game.isBye) return null;
                    return (
                      <GameTriangle
                        key={gameIndex}
                        tournament={tournament}
                        layerIndex={layerIndex}
                        gameIndex={gameIndex}
                        itemRefs={itemRefs}
                        section="losers"
                        depth={sizeDepth}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {showAsList && (
      <div className="flex flex-col items-center lg:flex-row-reverse lg:justify-end lg:items-start gap-2 bg-primary-background rounded-lg py-4">
        {losersBracket.map((layer, layerIndex) => {
          // Rounds consisting only of collapsed bye slots are never played
          if (layer.every((game) => game.isBye)) return null;
          const { title, subtitle } = losersRoundLabel(layerIndex, losersBracket.length);
          return (
          <div key={layerIndex} className="flex flex-col gap-1 w-full min-w-[22rem] max-w-[27rem]">
            {/* Fixed-height header so the game cards align across rounds */}
            <div className="h-10 flex flex-col justify-end">
              <h3 className="text-center text-sm text-primary-text">{title}</h3>
              <p className="text-center text-xs font-light text-primary-text/60 whitespace-nowrap">{subtitle ?? " "}</p>
            </div>
            {layer.map((game, gameIndex) => {
              // Empty bye slots are never shown; walkovers render as normal cards (with a "bye"
              // in the empty slot)
              if (game.isBye) return null;
              const fallbackKey = "LOSERS-L" + layerIndex + "G+" + gameIndex;
              return (
                <TournamentGameListCard
                  key={fallbackKey}
                  tournament={tournament}
                  game={game}
                  itemRefs={itemRefs}
                  fallbackKey={fallbackKey}
                />
              );
            })}
          </div>
          );
        })}
      </div>
      )}
    </div>
  );
};
