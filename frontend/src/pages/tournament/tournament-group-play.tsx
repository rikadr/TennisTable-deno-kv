import { classNames } from "../../common/class-names";
import { fmtNum } from "../../common/number-utils";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { Tournament } from "../../client/client-db/tournaments/tournament";
import { GroupScorePlayer, TournamentGroupPlay } from "../../client/client-db/tournaments/group-play";
import { getGameKeyFromPlayers } from "./tournament-page";
import { Menu, MenuButton } from "@headlessui/react";
import { useTennisParams } from "../../hooks/use-tennis-params";
import { useMediaQuery } from "../../hooks/use-media-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GameMenuItems, QuestionMark, winStateEmoji } from "./tournament-bracket";

type ItemRefs = React.MutableRefObject<{ [key: string]: HTMLElement | null }>;

export const TournamentGroupPlayComponent: React.FC<{
  tournament: Tournament;
  itemRefs: ItemRefs;
}> = ({ tournament, itemRefs }) => {
  if (tournament.tournamentConfig.groupPlay === false) {
    return null;
  }

  // Phones and tablets read top to bottom: standings, groups, rules.
  // From xl the rules go next to the standings, and the groups get the full width below.
  return (
    <div className="text-primary-text grid gap-6 xl:grid-cols-[minmax(0,56rem)_minmax(0,1fr)]">
      <div className="min-w-0 xl:col-start-1 xl:row-start-1">
        <TournamentGroupScores tournament={tournament} />
      </div>
      <div className="min-w-0 xl:col-span-2 xl:row-start-2">
        <TournamentGroups tournament={tournament} itemRefs={itemRefs} />
      </div>
      <div className="min-w-0 xl:col-start-2 xl:row-start-1">
        <GroupPlayRules tournament={tournament} />
      </div>
    </div>
  );
};

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-xl md:text-2xl font-bold mb-2">{children}</h2>
);

const GroupPlayRules: React.FC<{ tournament: Tournament }> = ({ tournament }) => {
  const hasRandomGroupSeeding = tournament.groupPlay?.hasRandomGroupSeeding ?? false;
  const hasUnequalGroups = tournament.groupPlay
    ? new Set(tournament.groupPlay.groups.map((g) => g.players.length)).size > 1
    : false;

  const tieBreakers = [
    "Most wins",
    "Fewest skips",
    ...(hasUnequalGroups ? ["Highest score before the group size adjustment"] : []),
    "Fewest losses",
    "Highest leaderboard rank at the tournament start",
    "First to sign up to the tournament",
    hasRandomGroupSeeding
      ? "Group play tie-breaker order (see the Info tab)"
      : "Group seeding order (see the Info tab)",
  ];

  return (
    <section>
      <SectionTitle>Rules</SectionTitle>
      <div className="rounded-lg ring-1 ring-secondary-background bg-secondary-background/20 p-3 md:p-4 space-y-4 text-sm">
        <div className="space-y-2">
          <h3 className="font-semibold text-base">Points</h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Win", points: Tournament.GROUP_POINTS.WIN },
              { label: "Loss", points: Tournament.GROUP_POINTS.LOSS },
              { label: "Skip", points: Tournament.GROUP_POINTS.SKIP },
            ].map(({ label, points }) => (
              <div key={label} className="rounded-lg bg-secondary-background/40 py-1.5">
                <div className="text-xl font-bold">{fmtNum(points)}</div>
                <div className="text-xs">{label}</div>
              </div>
            ))}
          </div>
          {hasUnequalGroups && (
            <p>
              The groups have different sizes. The points of a player in a smaller group are multiplied by the{" "}
              <span className="font-semibold">group size factor</span>, because smaller groups play fewer games.
            </p>
          )}
          <p>A player who skips a game gets the skip points. The other player gets the win points.</p>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold text-base">Tie-breakers</h3>
          <p>When players have equal points, these rules decide the order:</p>
          <ol className="space-y-1">
            {tieBreakers.map((text, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 mt-px rounded-full bg-secondary-background/60 flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
};

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
  const context = useEventDbContext();
  const players = tournament.groupPlay!.groupSeeding;
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
          <p className="w-20 truncate">{context.playerName(player.id)}</p>
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
  const navigate = useNavigate();

  if (tournament.groupPlay?.groupScores === undefined) {
    return null;
  }

  const groupPlay = tournament.groupPlay;
  const scores = Array.from(groupPlay.groupScores)
    .sort(TournamentGroupPlay.sortGroupScores)
    .map(([_, player]) => player);
  const cutOffIndex = groupPlay.getBracketSize();
  const groupOf = new Map(groupPlay.groups.flatMap((group, index) => group.players.map((p) => [p, index + 1])));
  const remainingOf = new Map<string, number>();
  groupPlay.groups.forEach((group) =>
    group.pending.forEach((game) =>
      [game.player1, game.player2].forEach((p) => p && remainingOf.set(p, (remainingOf.get(p) ?? 0) + 1)),
    ),
  );

  const hasGroupSizeAdjustment = scores.some((s) => s.groupSizeAdjustmentFactor !== 1);
  const hasEliminationZone = cutOffIndex < scores.length;
  const hasEnded = groupPlay.groupPlayEnded !== undefined;
  const columnCount = 8 + (hasGroupSizeAdjustment ? 2 : 0);

  // Below md, the stats go on a line under the name. Full words do not fit as column headers on a phone.
  const statCell = "hidden md:table-cell py-1 px-2 text-right w-[1%] whitespace-nowrap";
  const statHeader = "hidden md:table-cell py-1 px-2 text-right font-light whitespace-nowrap";
  const factorCell = "hidden lg:table-cell py-1 px-2 text-right w-[1%] whitespace-nowrap";
  const factorHeader = "hidden lg:table-cell py-1 px-2 text-right font-light whitespace-nowrap";

  const row = (player: GroupScorePlayer, place: number, isEliminated: boolean) => {
    const gamesLeft = remainingOf.get(player.name) ?? 0;
    const summary = [
      `Group ${groupOf.get(player.name)}`,
      count(player.wins, "win", "wins"),
      count(player.loss, "loss", "losses"),
      ...(player.skips > 0 ? [count(player.skips, "skip", "skips")] : []),
      ...(gamesLeft > 0 ? [count(gamesLeft, "game left", "games left")] : []),
    ].join(" · ");

    return (
      <tr
        key={player.name}
        onClick={() => navigate(`/player/${player.name}`)}
        className={classNames(
          "bg-primary-background hover:bg-secondary-background hover:text-secondary-text cursor-pointer transition-colors font-light",
          isEliminated && "text-primary-text/60",
        )}
      >
        <td className="py-1 px-1 xs:px-2 text-right w-[1%] whitespace-nowrap">{place}</td>
        <td className="py-1 px-1 xs:px-2 w-[100%] max-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <ProfilePicture playerId={player.name} size={24} shape="circle" />
            <div className="min-w-0">
              <div className="truncate font-normal">{context.playerName(player.name)}</div>
              <div className="md:hidden text-xs">{summary}</div>
            </div>
          </div>
        </td>
        <td className={classNames(statCell, "text-center")}>{groupOf.get(player.name)}</td>
        <td className="py-1 px-1 xs:px-2 text-right w-[1%] whitespace-nowrap font-medium">
          {fmtNum(player.adjustedScore, { digits: 1 })}
        </td>
        {hasGroupSizeAdjustment && (
          <>
            <td className={factorCell}>{fmtNum(player.score, { digits: 1 })}</td>
            <td className={factorCell}>
              {player.groupSizeAdjustmentFactor === 1
                ? ""
                : "×" + fmtNum(player.groupSizeAdjustmentFactor, { digits: 2 })}
            </td>
          </>
        )}
        <td className={statCell}>{fmtNum(player.wins)}</td>
        <td className={statCell}>{fmtNum(player.loss)}</td>
        <td className={statCell}>{fmtNum(player.skips)}</td>
        <td className={statCell}>{gamesLeft > 0 ? fmtNum(gamesLeft) : ""}</td>
      </tr>
    );
  };

  return (
    <section>
      <SectionTitle>Standings</SectionTitle>
      <div className="bg-primary-background rounded-lg w-full overflow-hidden ring-1 ring-secondary-background">
        <table className="w-full text-primary-text border-collapse text-sm xs:text-base">
          <thead className="border-b border-primary-text/50">
            <tr>
              <th className="py-1 px-1 xs:px-2 text-right font-light">#</th>
              <th className="py-1 px-1 xs:px-2 text-left font-normal">Player</th>
              <th className={classNames(statHeader, "text-center")}>Group</th>
              <th className="py-1 px-1 xs:px-2 text-right font-medium">Points</th>
              {hasGroupSizeAdjustment && (
                <>
                  <th className={factorHeader}>Raw points</th>
                  <th className={factorHeader}>Factor</th>
                </>
              )}
              <th className={statHeader}>Wins</th>
              <th className={statHeader}>Losses</th>
              <th className={statHeader}>Skips</th>
              <th className={statHeader}>Games left</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary-text/50">
            {scores.slice(0, cutOffIndex).map((player, index) => row(player, index + 1, false))}
          </tbody>
          {hasEliminationZone && (
            <>
              <tbody>
                <tr className="border-y-2 border-dashed border-primary-text">
                  <td colSpan={columnCount} className="py-1 px-2 text-center text-xs xs:text-sm font-normal">
                    ▲ The top {fmtNum(cutOffIndex)} {hasEnded ? "advanced" : "advance"} to the bracket
                  </td>
                </tr>
              </tbody>
              <tbody className="divide-y divide-primary-text/50">
                {scores.slice(cutOffIndex).map((player, index) => row(player, index + cutOffIndex + 1, true))}
              </tbody>
            </>
          )}
        </table>
      </div>
      {hasGroupSizeAdjustment && (
        <p className="mt-1 text-xs xs:text-sm">The points include the group size factor. See the rules.</p>
      )}
    </section>
  );
};

function count(value: number, singular: string, plural: string): string {
  return `${fmtNum(value)} ${value === 1 ? singular : plural}`;
}

export const TournamentGroups: React.FC<{
  tournament: Tournament;
  itemRefs: ItemRefs;
}> = ({ tournament, itemRefs }) => {
  const { player1: paramPlayer1, player2: paramPlayer2 } = useTennisParams();
  const isMediumScreen = useMediaQuery("(min-width: 768px)");
  const avatarSize = isMediumScreen ? 32 : 28;

  if (tournament.groupPlay?.groups === undefined) {
    return null;
  }

  const groupPlay = tournament.groupPlay;
  const canUndoSkip = groupPlay.groupPlayEnded === undefined || Date.now() - groupPlay.groupPlayEnded < 60 * 60 * 1_000; // 1 hour buffer to undo skips

  return (
    <section>
      <SectionTitle>Groups</SectionTitle>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3">
        {groupPlay.groups.map((group, groupIndex) => {
          const played = group.groupGames.length - group.pending.length;
          const factor = group.players[0] ? groupPlay.groupScores.get(group.players[0])?.groupSizeAdjustmentFactor : 1;
          // Games left to play first, so players find their next game at the top
          const games = group.groupGames
            .map((game, gameIndex) => ({ game, gameIndex, isPending: group.pending.includes(game) }))
            .sort((a, b) => Number(b.isPending) - Number(a.isPending));

          return (
            <div
              key={groupIndex}
              className="min-w-0 rounded-lg ring-1 ring-secondary-background bg-secondary-background/20 p-2 xs:p-3 space-y-2"
            >
              <div className="space-y-1 px-1">
                <div className="flex justify-between items-baseline gap-2">
                  <h3 className="text-lg md:text-xl font-semibold">Group {groupIndex + 1}</h3>
                  <p className="text-xs xs:text-sm whitespace-nowrap">
                    {fmtNum(played)} of {fmtNum(group.groupGames.length)} games played
                  </p>
                </div>
                <div className="h-1.5 rounded-full bg-primary-text/20 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary-text transition-all"
                    style={{ width: `${group.groupGames.length ? (played / group.groupGames.length) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs xs:text-sm">
                  {fmtNum(group.players.length)} players
                  {factor !== undefined && factor !== 1 && <> · group size factor ×{fmtNum(factor, { digits: 2 })}</>}
                </p>
              </div>

              <div className="space-y-1.5">
                {games.map(({ game, gameIndex, isPending }) => {
                  const gameKey =
                    game.player1 && game.player2
                      ? getGameKeyFromPlayers(game.player1, game.player2, "group")
                      : "GR" + groupIndex + "G" + gameIndex;
                  const isParamSelectedGame = gameKey === getGameKeyFromPlayers(paramPlayer1, paramPlayer2, "group");

                  return (
                    <Menu key={gameKey} ref={(el) => (itemRefs.current[gameKey] = el)}>
                      <div>
                        <MenuButton
                          className={classNames(
                            "w-full grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-2 py-1.5 rounded-lg",
                            "text-secondary-text text-sm xs:text-base hover:bg-secondary-background/70 transition-colors",
                            isPending
                              ? "bg-secondary-background ring-2 ring-secondary-text"
                              : "bg-secondary-background/60",
                            isParamSelectedGame && "animate-wiggle",
                          )}
                        >
                          <GameSide
                            player={game.player1}
                            winner={game.winner}
                            skipped={!!game.skipped}
                            avatarSize={avatarSize}
                          />
                          <span className={classNames("text-xs font-semibold", !isPending && "opacity-50")}>VS</span>
                          <GameSide
                            player={game.player2}
                            winner={game.winner}
                            skipped={!!game.skipped}
                            avatarSize={avatarSize}
                            alignRight
                          />
                        </MenuButton>
                        <GameMenuItems
                          player1={game.player1}
                          player2={game.player2}
                          showCompare
                          showRegisterResult={isPending}
                          showSkipGame={{
                            show: isPending,
                            tournamentId: tournament.id,
                          }}
                          showUndoSkip={{
                            show: !!game.skipped && canUndoSkip,
                            skipId: game.skipped?.skipId || "",
                            tournamentId: tournament.id,
                          }}
                          showGameDetails={{
                            // A skipped game carries a winner and a time, but nobody played it
                            show: !!game.winner && !game.skipped && game.completedAt !== undefined,
                            playedAt: game.completedAt,
                          }}
                        />
                      </div>
                    </Menu>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

const GameSide: React.FC<{
  player?: string;
  winner?: string;
  skipped: boolean;
  avatarSize: number;
  alignRight?: boolean;
}> = ({ player, winner, skipped, avatarSize, alignRight = false }) => {
  const context = useEventDbContext();
  const isWinner = !!winner && winner === player;
  const isLoser = !!winner && winner !== player;

  return (
    <div
      className={classNames(
        "flex items-center gap-2 min-w-0",
        alignRight && "flex-row-reverse",
        isLoser && "opacity-50",
      )}
    >
      {player ? (
        <ProfilePicture playerId={player} size={avatarSize} shape="circle" border={2} />
      ) : (
        <QuestionMark size={avatarSize} />
      )}
      <span className={classNames("truncate", isWinner && "font-semibold", isLoser && "line-through")}>
        {context.playerName(player)}
      </span>
      {isWinner && <span className="shrink-0">{winStateEmoji(true, skipped)}</span>}
    </div>
  );
};
