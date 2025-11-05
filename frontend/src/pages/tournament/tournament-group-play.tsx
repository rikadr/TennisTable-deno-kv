import { classNames } from "../../common/class-names";
import { fmtNum } from "../../common/number-utils";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { Tournament } from "../../client/client-db/tournaments/tournament";
import { GroupScorePlayer, TournamentGroupPlay } from "../../client/client-db/tournaments/group-play";
import { GameMenuItems, getGameKeyFromPlayers, QuestionMark, winStateEmoji } from "./tournament-page";
import { Menu, MenuButton } from "@headlessui/react";
import { useTennisParams } from "../../hooks/use-tennis-params";
import { optioPlayersById } from "../../client/client-config/clients/optio-client";
import { useState } from "react";
import { Link } from "react-router-dom";

export const TournamentGroupPlayComponent: React.FC<{
  tournament: Tournament;
  rerender: () => void;
  itemRefs: React.MutableRefObject<{
    [key: string]: HTMLElement | null;
  }>;
}> = ({ tournament, rerender, itemRefs }) => {
  if (tournament.tournamentDb.groupPlay === false) {
    return null;
  }

  return (
    <div className="text-primary-text">
      {/* <GroupDistribution tournament={tournament} /> */}
      <h1>Group play</h1>
      <div className="md:flex">
        <TournamentGroupScores tournament={tournament} />
        <GroupPlayRules />
      </div>
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-10 mx-6 mt-10">
        <TournamentGroups tournament={tournament} rerender={rerender} itemRefs={itemRefs} />
      </div>
    </div>
  );
};

const GroupPlayRules: React.FC = () => (
  <div className="text-primary-text bg-primary-background rounded-lg p-6 h-fit shadow-sm">
    <h3 className="text-2xl font-bold mb-6">Rules</h3>

    {/* Scoring Section */}
    <div className="bg-secondary-background/30 text-secondary-text rounded-lg p-5 mb-4 border border-secondary-background/40">
      <h4 className="font-semibold text-lg mb-4 text-secondary-text">Point System</h4>

      <div className="flex gap-6 mb-4 text-lg">
        <div className="flex items-center gap-2">
          <span className="font-semibold">Win:</span>
          <span className="font-bold text-secondary-text">{fmtNum(Tournament.GROUP_POINTS.WIN)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Loss:</span>
          <span className="font-bold text-secondary-text">{fmtNum(Tournament.GROUP_POINTS.LOSS)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Skip:</span>
          <span className="font-bold text-secondary-text">{fmtNum(Tournament.GROUP_POINTS.SKIP)}</span>
        </div>
      </div>

      <div className="space-y-3 text-sm">
        <p className="text-secondary-text/80 leading-relaxed">
          Scores are multiplied by the{" "}
          <span className="font-semibold text-secondary-text underline decoration-secondary-text/50">
            group size adjustment factor
          </span>{" "}
          to account for smaller groups having fewer games to score points in.
        </p>

        <div className="bg-secondary-background/20 rounded p-3 border-l-4 border-secondary-background/60">
          <p className="text-xs text-secondary-text/70 italic">
            <span className="font-semibold not-italic text-secondary-text">Note:</span> If a game is skipped, the
            advancing player scores as a <span className="font-semibold">winner</span> and the other player scores as a{" "}
            <span className="font-semibold">skip</span>.
          </p>
        </div>
      </div>
    </div>

    {/* Tie-breaker Section */}
    <div className="bg-secondary-background/30 text-secondary-text rounded-lg p-5 border border-secondary-background/40">
      <h4 className="font-semibold text-lg mb-4 text-secondary-text">Tie-breaker Priority</h4>

      <p className="text-sm mb-4 text-secondary-text/80">
        When players have equal adjusted scores, ties are resolved using the following criteria in order:
      </p>

      <div className="space-y-2">
        {[
          { rank: 1, text: "Most wins" },
          { rank: 2, text: "Least skips" },
          { rank: 3, text: "Highest score before group size adjustment" },
          { rank: 4, text: "Least losses" },
          { rank: 5, text: "Highest ELO rating" },
          { rank: 6, text: "First to sign up for the tournament" },
          { rank: 7, text: "If all the above are equal: Highest bribe 😉" },
        ].map(({ rank, text }) => (
          <div
            key={rank}
            className="flex items-start gap-3 py-1.5 px-3 rounded hover:bg-secondary-background/20 transition-colors"
          >
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-secondary-background/50 flex items-center justify-center">
              <span className="text-xs font-bold text-secondary-text">{rank}</span>
            </div>
            <p className="text-sm text-secondary-text/90 leading-relaxed pt-0.5">{text}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const PlacementBox: React.FC<{ on: boolean }> = ({ on }) => {
  const [override, setOverride] = useState<boolean | null>(null);
  return (
    <div
      onClick={() => setOverride((prev) => (prev === null ? !on : !prev))}
      className={classNames(
        "w-8 h-5 ring-secondary-background ring-[0.5px]",
        ((on && override === null) || !!override) && "bg-secondary-background",
      )}
    />
  );
};
/** Used to debug group distribution visually */
export const GroupDistribution: React.FC<{ tournament: Tournament }> = ({ tournament }) => {
  const players = tournament.groupPlay!.playerOrder;
  const groups = tournament.groupPlay!.groups;
  const groupDistribution: { id: string; groupIndex: number }[] = players.map((player) => ({
    id: player,
    groupIndex: groups.findIndex((group) => group.players.includes(player)),
  }));
  return (
    <div className="flex flex-col">
      <div className="flex">
        <div className="w-24 mr-2" />
        {groups.map((group, index) => (
          <div key={index} className="w-8">
            {index + 1} ({group.players.length})
          </div>
        ))}
      </div>
      {groupDistribution.map((player, playerIndex) => (
        <div
          key={player.id}
          className="text-primary-text ring-secondary-background ring-[0.5px] hover:bg-secondary-background/30 flex"
        >
          <p className="w-20 truncate">{optioPlayersById[player.id as keyof typeof optioPlayersById]}</p>
          <p className="w-5 truncate">{playerIndex + 1}</p>
          {groups.map((_, index) => (
            <PlacementBox key={index} on={player.groupIndex === index} />
          ))}
        </div>
      ))}
    </div>
  );
};
export const TournamentGroupScores: React.FC<{ tournament: Tournament }> = ({ tournament }) => {
  const context = useEventDbContext();

  if (tournament.groupPlay?.groupScores === undefined) {
    return null;
  }

  const scores = Array.from(tournament.groupPlay.groupScores).sort(TournamentGroupPlay.sortGroupScores);
  const cutOffIndex = tournament.groupPlay.getBracketSize();

  const row = (player: GroupScorePlayer, place: number, isEliminated: boolean = false) => (
    <tr
      key={player.name}
      className={`
        transition-colors border-b border-secondary-background/20
        ${
          isEliminated
            ? "hover:bg-secondary-background/40 bg-secondary-background/20"
            : "hover:bg-secondary-background/30"
        }
      `}
    >
      <td className="px-4 py-1 text-center font-semibold">{place}</td>
      <td className="px-4 py-1 font-medium">
        <Link
          to={`/player/${player.name}`}
          className="text-secondary-text hover:text-secondary-text/80 hover:underline"
        >
          {context.playerName(player.name)}
        </Link>
      </td>
      <td className="px-4 py-1 text-center bg-secondary-background/30 font-bold text-lg">
        {fmtNum(player.adjustedScore, { digits: 1 })}
      </td>
      <td className="px-4 py-1 text-center text-secondary-text/70">{fmtNum(player.score, { digits: 1 })}</td>
      <td className="px-4 py-1 text-center text-secondary-text/70">
        {player.groupSizeAdjustmentFactor === 1 ? (
          <span className="text-secondary-text/40">—</span>
        ) : (
          fmtNum(player.groupSizeAdjustmentFactor, { digits: 2 })
        )}
      </td>
      <td className="px-4 py-1 text-center text-secondary-text font-medium">{fmtNum(player.wins)}</td>
      <td className="px-4 py-1 text-center text-secondary-text font-medium">{fmtNum(player.loss)}</td>
      <td className="px-4 py-1 text-center text-secondary-text/60">{fmtNum(player.skips)}</td>
    </tr>
  );

  return (
    <div className="text-primary-text bg-primary-background rounded-lg p-6 shadow-sm">
      <h1 className="text-2xl font-bold mb-6">Score Board</h1>

      <div className="overflow-x-auto rounded-lg border border-secondary-background/30 shadow-sm">
        <table className="min-w-full border-collapse bg-primary-background">
          <thead className="bg-secondary-background/20">
            <tr className="border-b-2 border-secondary-background/40">
              <th className="px-4 py-3 text-center font-semibold text-secondary-text">#</th>
              <th className="px-4 py-3 text-left font-semibold text-secondary-text">Player</th>
              <th className="px-4 py-3 text-center font-semibold text-secondary-text">
                <div>Adjusted</div>
                <div className="text-xs font-normal text-secondary-text/60">Score</div>
              </th>
              <th className="px-4 py-3 text-center font-semibold text-secondary-text">
                <div>Score</div>
                <div className="text-xs font-normal text-secondary-text/60">Before Adjustment</div>
              </th>
              <th className="px-4 py-3 text-center font-semibold text-secondary-text">
                <div>Group Size</div>
                <div className="text-xs font-normal text-secondary-text/60">Adjustment Factor</div>
              </th>
              <th className="px-4 py-3 text-center font-semibold text-secondary-text">Wins</th>
              <th className="px-4 py-3 text-center font-semibold text-secondary-text">Loss</th>
              <th className="px-4 py-3 text-center font-semibold text-secondary-text">Skips</th>
            </tr>
          </thead>
          <tbody>
            {/* Qualified Players */}
            {scores.slice(0, cutOffIndex).map(([_name, player], index) => row(player, index + 1, false))}

            {/* Elimination Zone Divider */}
            <tr className="bg-secondary-background/50 border-y-2 border-secondary-background/60">
              <td className="px-4 py-2 text-center">
                <span className="text-secondary-text">⚠️</span>
              </td>
              <td className="px-4 py-2 font-bold text-secondary-text">Elimination Zone</td>
              <td colSpan={6} className="px-4 py-2 text-center text-secondary-text/80 text-sm">
                Players below this line are eliminated from advancing
              </td>
            </tr>
            <tr className="border-b-2 border-secondary-background/40">
              <th className="px-4 py-1 text-sm text-center font-semibold text-secondary-text">#</th>
              <th className="px-4 py-1 text-sm text-left font-semibold text-secondary-text">Player</th>
              <th className="px-4 py-1 text-sm text-center font-semibold text-secondary-text">
                <div>Adjusted</div>
                <div className="text-xs font-normal text-secondary-text/60">Score</div>
              </th>
              <th className="px-4 py-1 text-sm text-center font-semibold text-secondary-text">
                <div>Score</div>
                <div className="text-xs font-normal text-secondary-text/60">Before Adjustment</div>
              </th>
              <th className="px-4 py-1 text-sm text-center font-semibold text-secondary-text">
                <div>Group Size</div>
                <div className="text-xs font-normal text-secondary-text/60">Adjustment Factor</div>
              </th>
              <th className="px-4 py-1 text-sm text-center font-semibold text-secondary-text">Wins</th>
              <th className="px-4 py-1 text-sm text-center font-semibold text-secondary-text">Loss</th>
              <th className="px-4 py-1 text-sm text-center font-semibold text-secondary-text">Skips</th>
            </tr>
            {/* Eliminated Players */}
            {scores.slice(cutOffIndex).map(([_name, player], index) => row(player, index + cutOffIndex + 1, true))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const TournamentGroups: React.FC<{
  tournament: Tournament;
  rerender: () => void;
  itemRefs: React.MutableRefObject<{
    [key: string]: HTMLElement | null;
  }>;
}> = ({ tournament, rerender, itemRefs }) => {
  const { player1: paramPlayer1, player2: paramPlayer2 } = useTennisParams();
  const context = useEventDbContext();

  if (tournament.groupPlay?.groups === undefined) {
    return null;
  }

  return tournament.groupPlay.groups.map((group, groupIndex) => (
    <div key={groupIndex} className="max-w-96 w-full space-y-2">
      <div className="rounded-lg ring-2 ring-secondary-background bg-primary-background text-primary-text p-2 px-4">
        <section className="flex justify-between items-baseline">
          <h2 className="text-xl font-normal">Group {groupIndex + 1}</h2>
          <p className="text-xs">
            {fmtNum(group.groupGames.length - group.pending.length)} of {fmtNum(group.groupGames.length)} games
            completed
          </p>
        </section>
        <p className="text-xs">{fmtNum(group.players.length)} players:</p>
        <p>{group.players.map((p) => context.playerName(p)).join(", ")}</p>
      </div>
      {group.groupGames.map((game, gameIndex) => {
        const gameIsWon = game.winner !== undefined;
        const gameIsSkipped = game.skipped !== undefined;
        function handleSkip(player: string) {
          if (gameIsWon) return;
          if (!gameIsSkipped) {
            context.tournaments.skipGame(
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

        const gameKey =
          game.player1 && game.player2
            ? getGameKeyFromPlayers(game.player1, game.player2, "group")
            : "GR" + groupIndex + "G" + gameIndex;

        const isParamSelectedGame = gameKey === getGameKeyFromPlayers(paramPlayer1, paramPlayer2, "group");
        const p1IsWinner = !!game.winner && game.winner === game.player1;
        const p2IsWinner = !!game.winner && game.winner === game.player2;
        const p1IsLoser = !!game.winner && game.winner !== game.player1;
        const p2IsLoser = !!game.winner && game.winner !== game.player2;
        const isPending = group.pending.includes(game);

        return (
          <Menu key={gameKey} ref={(el) => (itemRefs.current[gameKey] = el)}>
            <MenuButton
              className={classNames(
                "relative w-full px-4 py-2 rounded-lg flex items-center gap-x-4 h-12 text-secondary-text",
                "hover:bg-secondary-background/70",
                isPending ? "bg-secondary-background ring-2 ring-secondary-text" : "bg-secondary-background/60",
                isParamSelectedGame && "animate-wiggle",
              )}
            >
              <h2 className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">VS</h2>
              <div className="flex gap-3 items-center justify-center">
                {game.player1 ? (
                  <ProfilePicture playerId={game.player1} size={35} shape="circle" clickToEdit={false} border={3} />
                ) : (
                  <QuestionMark size={38} />
                )}
                <h3 className={classNames(p1IsWinner && "font-semibold", p1IsLoser && "line-through font-thin")}>
                  {context.playerName(game.player1)} {winStateEmoji(p1IsWinner, game.skipped)}
                </h3>
              </div>
              <div className="grow" />
              <div className="flex gap-3 items-center justify-center">
                <h3 className={classNames(p2IsWinner && "font-semibold", p2IsLoser && "line-through font-thin")}>
                  {winStateEmoji(p2IsWinner, game.skipped)} {context.playerName(game.player2)}
                </h3>
                {game.player2 ? (
                  <ProfilePicture playerId={game.player2} size={35} shape="circle" clickToEdit={false} border={3} />
                ) : (
                  <QuestionMark size={38} />
                )}
              </div>
              <GameMenuItems
                player1={game.player1}
                player2={game.player2}
                showCompare
                showRegisterResult={isPending}
                showSkipGamePlayer1Advance={{
                  show: isPending,
                  onSkip() {
                    handleSkip(game.player1!);
                  },
                }}
                showSkipGamePlayer2Advance={{
                  show: isPending,
                  onSkip() {
                    handleSkip(game.player2!);
                  },
                }}
                showUndoSkip={{
                  show: !!game.skipped,
                  onUndoSkip() {},
                }}
              />
            </MenuButton>
          </Menu>
        );
      })}
    </div>
  ));
};
