import { Link } from "react-router-dom";
import { classNames } from "../../common/class-names";
import { fmtNum } from "../../common/number-utils";
import { useClientDbContext } from "../../wrappers/client-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { Tournament } from "../../client/client-db/tournaments/tournament";
import { GroupScorePlayer, TournamentGroupPlay } from "../../client/client-db/tournaments/group-play";

export const TournamentGroupPlayComponent: React.FC<{ tournament: Tournament; rerender: () => void }> = ({
  tournament,
  rerender,
}) => {
  if (tournament.tournamentDb.groupPlay === false) {
    return null;
  }

  return (
    <div>
      <h1>Group play</h1>
      <div className="md:flex">
        <TournamentGroupScores tournament={tournament} />
        <GroupPlayRules />
      </div>
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-10 mx-6 mt-10">
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
        <p>Win: {fmtNum(Tournament.GROUP_POINTS.WIN)}</p>
        <p>Loss: {fmtNum(Tournament.GROUP_POINTS.LOSS)}</p>
        <p>DNF: {fmtNum(Tournament.GROUP_POINTS.DNF)}</p>
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
        <p>2: Least DNFs</p>
        <p>3: Least losses</p>
        <p>4: Highest score before group size adjustment</p>
        <p>5: Highest ELO rating</p>
        <p>6: First to sign up for the tournament</p>
        <p>7: If all the above somehow are equal: Highest bribe</p>
      </div>
    </div>
  </div>
);

export const TournamentGroupScores: React.FC<{ tournament: Tournament }> = ({ tournament }) => {
  if (tournament.groupPlay?.groupScores === undefined) {
    return null;
  }

  const scores = Array.from(tournament.groupPlay.groupScores).sort(TournamentGroupPlay.sortGroupScores);
  const cutOffIndex = tournament.groupPlay.getBracketSize();

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

export const TournamentGroups: React.FC<{ tournament: Tournament; rerender: () => void }> = ({
  tournament,
  rerender,
}) => {
  const { tournaments } = useClientDbContext();

  if (tournament.groupPlay?.groups === undefined) {
    return null;
  }

  return tournament.groupPlay.groups.map((group, groupIndex) => (
    <div key={groupIndex} className="max-w-96 w-full space-y-2">
      <div className="rounded-lg ring-2 ring-secondary-background text-secondary-text p-2 px-4">
        <section className="flex justify-between items-baseline">
          <h2 className="text-xl font-normal">Group {groupIndex + 1}</h2>
          <p className="text-xs">
            {fmtNum(group.groupGames.length - group.pending.length)} of {fmtNum(group.groupGames.length)} games
            completed
          </p>
        </section>
        <p className="text-xs">{fmtNum(group.players.length)} players:</p>
        <p>{group.players.join(", ")}</p>
      </div>
      {group.groupGames.map((game) => {
        const gameIsWon = game.winner !== undefined;
        const gameIsSkipped = game.skipped !== undefined;
        function handleSkip(player: string) {
          if (gameIsWon) return;
          if (!gameIsSkipped) {
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
          <div key={game.player1! + game.player2!} className="group">
            <div
              className={classNames(
                "h-12 px-2 rounded-lg ring-secondary-background ring-2 flex items-center",
                game.winner ? "bg-secondary-background" : "group-hover:bg-secondary-background/50",
              )}
            >
              <div className="w-1/2">
                <button
                  onClick={() => handleSkip(game.player1!)}
                  className={classNames(
                    "flex gap-2 items-center",
                    game.winner === game.player2 && "font-light italic line-through",
                  )}
                >
                  <ProfilePicture name={game.player1} size={35} shape="circle" clickToEdit={false} border={2.5} />
                  {game.player1}
                  {game.winner === game.player1 && (game.skipped ? " 🆓" : " 🏆")}
                </button>
              </div>
              {game.winner ? (
                <div>v.s.</div>
              ) : (
                <Link to={`/add-game/?player1=${game.player1 || ""}&player2=${game.player2 || ""}`}>v.s.</Link>
              )}
              <div className="w-1/2 flex justify-end">
                <button
                  onClick={() => handleSkip(game.player2!)}
                  className={classNames(
                    "flex gap-2 items-center",
                    game.winner === game.player1 && "font-light italic line-through",
                  )}
                >
                  {game.winner === game.player2 && (game.skipped ? "🆓 " : "🏆 ")}
                  {game.player2}
                  <ProfilePicture name={game.player2} size={35} shape="circle" clickToEdit={false} border={2.5} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  ));
};
