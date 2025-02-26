import { GroupScorePlayer, Tournaments, TournamentWithGames } from "../../client-db/tournament";
import { classNames } from "../../common/class-names";
import { fmtNum } from "../../common/number-utils";
import { useClientDbContext } from "../../wrappers/client-db-context";

export const TournamentGroupPlay: React.FC<{ tournament: TournamentWithGames; rerender: () => void }> = ({
  tournament,
  rerender,
}) => {
  if (tournament.groupPlay === false) {
    return null;
  }

  return (
    <div>
      <h1>Group play</h1>
      <div className="md:flex">
        <TournamentGroupScores tournament={tournament} />
        <GroupPlayRules />
      </div>
      <p className="mt-10">Groups:</p>
      <div className="grid grid-flow-row gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <TournamentGroups tournament={tournament} rerender={rerender} />
      </div>
    </div>
  );
};

const GroupPlayRules: React.FC = () => (
  <div>
    <h3 className="px-4 -mb-2 mt-2">Rules</h3>
    <div className="bg-secondary-background text-secondary-text w-96 space-y-2 py-2 px-4 rounded-lg m-4">
      <div className="flex gap-4">
        <p>Win: {fmtNum(Tournaments.GROUP_POINTS.WIN)}</p>
        <p>Loss: {fmtNum(Tournaments.GROUP_POINTS.LOSS)}</p>
        <p>DNF: {fmtNum(Tournaments.GROUP_POINTS.DNF)}</p>
      </div>
      <p className="font-light text-sm">
        Scores are multiplied by the <span className="font-bold underline">group size adjustment factor </span> to
        account for smaller groups having fewer games to score points in.
      </p>
      <p className="italic font-light text-xs">
        * If a game is skipped the advancing player scores as a winner and the other player as a DNF
      </p>
    </div>
    <div className="bg-secondary-background text-secondary-text w-96 space-y-2 py-2 px-4 rounded-lg m-4">
      <p>Players on equal scores are split by the following criteria in this order:</p>
      <div className="italic font-light text-xs">
        <p>1: Most wins</p>
        <p>2: Least losses</p>
        <p>3: Least DNFs</p>
        <p>4: Highest score before group size adjustment</p>
        <p>5: Highest ELO rating</p>
        <p>6: First to sign up for the tournament</p>
        <p>7: If all the above somehow are equal: Highest bribe</p>
      </div>
    </div>
  </div>
);

export const TournamentGroupScores: React.FC<{ tournament: TournamentWithGames }> = ({ tournament }) => {
  if (tournament.groupScores === undefined) {
    return null;
  }

  const scores = Array.from(tournament.groupScores).sort(Tournaments.sortGroupScores);
  const tournamentLayers = Math.floor(Math.log2(tournament.playerOrder!.length));
  const cutOffIndex = Math.pow(2, tournamentLayers);

  const row = (player: GroupScorePlayer, place: number) => (
    <tr key={player.name} className="hover:bg-secondary-background/50">
      <td>#{fmtNum(place)}</td>
      <td className="pl-4">{player.name}</td>
      <td className="text-lg bg-secondary-background/50 pl-3">{fmtNum(player.adjustedScore, 1)}</td>
      <td>{fmtNum(player.score, 1)}</td>
      <td>{fmtNum(player.groupSizeAdjustmentFactor, 2)}</td>
      <td>{fmtNum(player.wins)}</td>
      <td>{fmtNum(player.loss)}</td>
      <td>{fmtNum(player.dnf)}</td>
    </tr>
  );

  return (
    <div>
      <h1>Score board</h1>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>
              <p>Adjusted</p>
              <p>Score</p>
            </th>
            <th>
              <p>Score</p>
              <p>before</p>
              <p>adjustment</p>
            </th>
            <th>
              <p>Group size</p>
              <p>Adjustment</p>
              <p>Factor</p>
            </th>
            <th>Wins</th>
            <th>Loss</th>
            <th>DNF</th>
          </tr>
        </thead>
        <tbody>
          {scores.slice(0, cutOffIndex).map(([_name, player], index) => row(player, index + 1))}
          <tr>
            <td></td>
            <td className="font-bold pl-4">Elimination zone</td>
            <td>---</td>
            <td>---</td>
            <td>---</td>
            <td>---</td>
            <td>---</td>
            <td>---</td>
          </tr>
          {scores.slice(cutOffIndex).map(([_name, player], index) => row(player, index + cutOffIndex + 1))}
        </tbody>
      </table>
    </div>
  );
};
export const TournamentGroups: React.FC<{ tournament: TournamentWithGames; rerender: () => void }> = ({
  tournament,
  rerender,
}) => {
  const { tournaments } = useClientDbContext();

  if (tournament.groups === undefined) {
    return null;
  }

  return tournament.groups?.map((group, groupIndex) => (
    <div key={groupIndex} className="max-w-96">
      Group {groupIndex + 1} <span className="text-xs">({fmtNum(group.players.length)} players)</span>
      <p>{group.players.join(", ")}</p>
      <div className="flex flex-col gap-2">
        {group.groupGames.map((game) => {
          const gameIsWon = game.winner !== undefined;
          const gameIsSkipped = game.skipped !== undefined;
          function handleSkip(player: string) {
            if (gameIsWon) return;
            if (gameIsSkipped) {
              tournaments.undoSkipGame(
                tournament.skippedGames.find((g) => g.time === game.skipped!.time)!,
                tournament.id,
              );
            } else {
              tournaments.skipGame(
                {
                  time: new Date().getTime(),
                  advancing: player,
                  eliminated: game.player1 === player ? game.player2! : game.player1!,
                },
                tournament.id,
              );
            }
            rerender();
          }
          return (
            <div
              key={game.player1! + game.player2!}
              // to={`/add-game/?player1=${game.player1 || ""}&player2=${game.player2 || ""}`}
              className="group cursor-pointer"
            >
              <div
                className={classNames(
                  "rounded-lg ring-secondary-background ring-2 group-hover:bg-secondary-background/50 flex",
                  game.winner && "bg-secondary-background",
                )}
              >
                <button onClick={() => handleSkip(game.player1!)}>{game.player1}</button>
                <div className="mx-2">v.s.</div>
                <button onClick={() => handleSkip(game.player2!)}>{game.player2}</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  ));
};
