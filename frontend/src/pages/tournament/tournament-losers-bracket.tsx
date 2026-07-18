import { Tournament } from "../../client/client-db/tournaments/tournament";
import { losersLayerIndexToTournamentRound } from "../leaderboard/tournament-pending-games";
import { TournamentGameListCard } from "./tournament-bracket";

export const TournamentLosersBracket = ({
  tournament,
  itemRefs,
}: {
  tournament: Tournament;
  itemRefs: React.MutableRefObject<{
    [key: string]: HTMLElement | null;
  }>;
}) => {
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
      <div className="flex flex-col items-center lg:flex-row-reverse lg:justify-end lg:items-start gap-2 bg-primary-background rounded-lg py-4">
        {losersBracket.map((layer, layerIndex) => (
          <div key={layerIndex} className="flex flex-col gap-1 w-full min-w-[22rem] max-w-[27rem]">
            <h3 className="text-center text-sm text-primary-text">
              {losersLayerIndexToTournamentRound(layerIndex, losersBracket.length)}
            </h3>
            {layer.map((game, gameIndex) => {
              // Structural bye slots are never played
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
        ))}
      </div>
    </div>
  );
};
