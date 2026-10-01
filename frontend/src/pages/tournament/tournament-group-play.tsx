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
import { useLayoutEffect, useRef, useState } from "react";
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
  const remainingOf = new Map<string, number>();
  groupPlay.groups.forEach((group) =>
    group.pending.forEach((game) =>
      [game.player1, game.player2].forEach((p) => p && remainingOf.set(p, (remainingOf.get(p) ?? 0) + 1)),
    ),
  );

  const hasGroupSizeAdjustment = scores.some((s) => s.groupSizeAdjustmentFactor !== 1);
  const hasEliminationZone = cutOffIndex < scores.length;
  const hasEnded = groupPlay.groupPlayEnded !== undefined;
  const columnCount = 7 + (hasGroupSizeAdjustment ? 2 : 0);

  // Below md, the stats go on a line under the name. Full words do not fit as column headers on a phone.
  const statCell = "hidden md:table-cell py-0.5 px-2 text-right w-[1%] whitespace-nowrap";
  const statHeader = "hidden md:table-cell py-1 px-2 text-right font-light whitespace-nowrap";
  const factorCell = "hidden lg:table-cell py-0.5 px-2 text-right w-[1%] whitespace-nowrap";
  const factorHeader = "hidden lg:table-cell py-1 px-2 text-right font-light whitespace-nowrap";

  const row = (player: GroupScorePlayer, place: number, isEliminated: boolean) => {
    const gamesLeft = remainingOf.get(player.name) ?? 0;
    const summary = [
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
        <td className="py-0.5 px-1 xs:px-2 text-right w-[1%] whitespace-nowrap">{place}</td>
        <td className="py-0.5 px-1 xs:px-2 w-[100%] max-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <ProfilePicture playerId={player.name} size={24} shape="circle" border={2} />
            <div className="min-w-0 leading-tight">
              <div className="truncate font-normal">{context.playerName(player.name)}</div>
              <div className="md:hidden text-xs leading-tight">{summary}</div>
            </div>
          </div>
        </td>
        <td className="py-0.5 px-1 xs:px-2 text-right w-[1%] whitespace-nowrap font-medium">
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
      <SectionTitle>Group play standings</SectionTitle>
      <div className="bg-primary-background rounded-lg w-full overflow-hidden ring-1 ring-secondary-background">
        <table className="w-full text-primary-text border-collapse text-sm xs:text-base">
          <thead className="border-b border-primary-text/50">
            <tr>
              <th className="py-1 px-1 xs:px-2 text-right font-light">#</th>
              <th className="py-1 px-1 xs:px-2 text-left font-normal">Player</th>
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
                    ⚠️ The top {fmtNum(cutOffIndex)} {hasEnded ? "advanced" : "advance"} to the finals
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
  const isMediumScreen = useMediaQuery("(min-width: 768px)");
  const avatarSize = isMediumScreen ? 32 : 28;

  if (tournament.groupPlay?.groups === undefined) {
    return null;
  }

  return (
    <section>
      <SectionTitle>Groups</SectionTitle>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3">
        {tournament.groupPlay.groups.map((_, groupIndex) => (
          <GroupCard
            key={groupIndex}
            tournament={tournament}
            groupIndex={groupIndex}
            itemRefs={itemRefs}
            avatarSize={avatarSize}
          />
        ))}
      </div>
    </section>
  );
};

type GroupCardView = "games" | "players";

const GroupCard: React.FC<{
  tournament: Tournament;
  groupIndex: number;
  itemRefs: ItemRefs;
  avatarSize: number;
}> = ({ tournament, groupIndex, itemRefs, avatarSize }) => {
  const [view, setView] = useState<GroupCardView>("games");
  const groupPlay = tournament.groupPlay!;
  const group = groupPlay.groups[groupIndex];
  const played = group.groupGames.length - group.pending.length;
  const factor = group.players[0] ? groupPlay.groupScores.get(group.players[0])?.groupSizeAdjustmentFactor : 1;

  return (
    <div className="min-w-0 rounded-lg ring-1 ring-secondary-background bg-secondary-background/20 p-2 xs:p-3 space-y-2">
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
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <p className="text-xs xs:text-sm">
            {fmtNum(group.players.length)} players
            {factor !== undefined && factor !== 1 && <> · group size factor ×{fmtNum(factor, { digits: 2 })}</>}
          </p>
          <div className="inline-flex rounded-lg ring-1 ring-primary-text/25 p-0.5" role="group">
            {(
              [
                ["games", "All games"],
                ["players", "Players"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setView(value)}
                aria-pressed={view === value}
                className={classNames(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                  view === value ? "bg-secondary-background text-secondary-text" : "hover:bg-primary-text/10",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "games" ? (
        <GroupGames tournament={tournament} groupIndex={groupIndex} itemRefs={itemRefs} avatarSize={avatarSize} />
      ) : (
        <GroupPlayers tournament={tournament} groupIndex={groupIndex} avatarSize={avatarSize + 16} />
      )}
    </div>
  );
};

const GroupGames: React.FC<{
  tournament: Tournament;
  groupIndex: number;
  itemRefs: ItemRefs;
  avatarSize: number;
}> = ({ tournament, groupIndex, itemRefs, avatarSize }) => {
  const { player1: paramPlayer1, player2: paramPlayer2 } = useTennisParams();
  const groupPlay = tournament.groupPlay!;
  const group = groupPlay.groups[groupIndex];
  const canUndoSkip = groupPlay.groupPlayEnded === undefined || Date.now() - groupPlay.groupPlayEnded < 60 * 60 * 1_000; // 1 hour buffer to undo skips
  // Games left to play first, so players find their next game at the top
  const games = group.groupGames
    .map((game, gameIndex) => ({ game, gameIndex, isPending: group.pending.includes(game) }))
    .sort((a, b) => Number(b.isPending) - Number(a.isPending));

  return (
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
                  isPending ? "bg-secondary-background ring-2 ring-secondary-text" : "bg-secondary-background/60",
                  isParamSelectedGame && "animate-wiggle",
                )}
              >
                <GameSide player={game.player1} winner={game.winner} skipped={!!game.skipped} avatarSize={avatarSize} />
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
  );
};

type OpponentResult = {
  opponent: string;
  /** Undefined while the game is not played */
  won?: boolean;
  skipped: boolean;
  /** When the game was played. Undefined for a game that is not played or that was skipped */
  playedAt?: number;
  /** The game can be played now */
  isPending: boolean;
  /** The skip to undo. Undefined for a game that was not skipped */
  skipId?: string;
};

/** One entry per player of the group, in the order of the standings */
const GroupPlayers: React.FC<{ tournament: Tournament; groupIndex: number; avatarSize: number }> = ({
  tournament,
  groupIndex,
  avatarSize,
}) => {
  const groupPlay = tournament.groupPlay!;
  const group = groupPlay.groups[groupIndex];
  const canUndoSkip = groupPlay.groupPlayEnded === undefined || Date.now() - groupPlay.groupPlayEnded < 60 * 60 * 1_000; // 1 hour buffer to undo skips
  // The group's players are in the tie-breaker order, so a row keeps its place when the standings change
  const players = group.players;

  const resultsOf = (player: string): OpponentResult[] =>
    group.players
      .filter((opponent) => opponent !== player)
      .map((opponent) => {
        const game = group.groupGames.find(
          (g) => (g.player1 === player && g.player2 === opponent) || (g.player1 === opponent && g.player2 === player),
        );
        return {
          opponent,
          won: game?.winner === undefined ? undefined : game.winner === player,
          skipped: !!game?.skipped,
          playedAt: game?.winner !== undefined && !game.skipped ? game.completedAt : undefined,
          isPending: !!game && group.pending.includes(game),
          skipId: game?.skipped?.skipId,
        };
      });

  return (
    <div className="space-y-1.5">
      {players.map((player) => (
        <GroupPlayerEntry
          key={player}
          player={player}
          results={resultsOf(player)}
          avatarSize={avatarSize}
          tournamentId={tournament.id}
          canUndoSkip={canUndoSkip}
        />
      ))}
    </div>
  );
};

const GroupPlayerEntry: React.FC<{
  player: string;
  results: OpponentResult[];
  avatarSize: number;
  tournamentId: string;
  canUndoSkip: boolean;
}> = ({ player, results, avatarSize, tournamentId, canUndoSkip }) => {
  const context = useEventDbContext();
  const [expanded, setExpanded] = useState(false);
  const [rowRef, rowWidth] = useElementWidth<HTMLButtonElement>();
  // The row's padding, the player's picture, the chevron and the 3 gaps between the 4 parts
  const fixedWidth = 16 + avatarSize + 20 + 3 * 8;

  return (
    <div className="rounded-lg text-secondary-text text-sm xs:text-base overflow-hidden">
      <button
        ref={rowRef}
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-2 px-2 py-1.5 bg-secondary-background hover:bg-secondary-background/70 transition-colors"
      >
        <ProfilePicture playerId={player} size={avatarSize} shape="circle" border={2} />
        <div className="flex-1 min-w-0 text-left">
          <div className="truncate font-normal">{context.playerName(player)}</div>
          {/* Games completed, a skipped game too, of all the games of the player in the group */}
          <div className="text-xs font-light">
            {fmtNum(results.filter((result) => result.won !== undefined).length)} of {fmtNum(results.length)}
          </div>
        </div>
        <OpponentStack results={results} availableWidth={rowWidth - fixedWidth - MIN_NAME_WIDTH} />
        <svg
          className={classNames("w-5 h-5 shrink-0 transition-transform", expanded && "rotate-180")}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="divide-y divide-secondary-text/20 border-t border-secondary-text/20">
          {results.map((result) => {
            const score =
              result.playedAt === undefined
                ? undefined
                : context.games.find((g) => g.playedAt === result.playedAt)?.score?.setsWon;
            const sets =
              score && (result.won ? [score.gameWinner, score.gameLoser] : [score.gameLoser, score.gameWinner]);
            return (
              <Menu key={result.opponent}>
                <div>
                  <MenuButton className="w-full flex items-center gap-2 pl-4 pr-2 py-1 text-left bg-secondary-background hover:bg-secondary-background/70 transition-colors">
                    <ProfilePicture playerId={result.opponent} size={32} shape="circle" border={2} />
                    <span className="flex-1 min-w-0 truncate">{context.playerName(result.opponent)}</span>
                    {result.won !== undefined && (
                      <span className="shrink-0 whitespace-nowrap text-xs xs:text-sm">
                        {resultEmoji(result)} {result.won ? "Won" : "Lost"}
                        {sets && ` ${sets[0]}–${sets[1]}`}
                        {result.skipped && " (skipped)"}
                      </span>
                    )}
                  </MenuButton>
                  <GameMenuItems
                    player1={player}
                    player2={result.opponent}
                    showCompare
                    showRegisterResult={result.isPending}
                    showSkipGame={{ show: result.isPending, tournamentId }}
                    showUndoSkip={{ show: result.skipped && canUndoSkip, skipId: result.skipId || "", tournamentId }}
                    showGameDetails={{ show: result.playedAt !== undefined, playedAt: result.playedAt }}
                  />
                </div>
              </Menu>
            );
          })}
        </div>
      )}
    </div>
  );
};

/** 🏆 for a win, 🆓 for a win on a skip, 💔 for a loss, nothing for a game that is not played */
function resultEmoji(result: OpponentResult): string {
  if (result.won === undefined) return "";
  if (!result.won) return "💔";
  return result.skipped ? "🆓" : "🏆";
}

const STACK_PICTURE_SIZE = 36;
/** The space between 2 pictures when there is room for all of them side by side */
const STACK_GAP = 4;
/** How far each picture moves right of the one before it when the row is narrow. Keeps the result icons readable */
const STACK_MIN_OFFSET = 14;
/** The stack always leaves this much room for the player's name */
const MIN_NAME_WIDTH = 96;
/** The height of the result icon below each picture */
const STACK_RESULT_HEIGHT = 18;
/** The width of the ribbon that hangs below a picture and holds the result icon */
const STACK_RIBBON_WIDTH = 20;

/** The width of an element, updated when it changes */
function useElementWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setWidth(element.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/**
 * The opponents' pictures in a row, each with the result against that opponent below it. The pictures
 * spread over the available width: they overlap when the row is narrow, and stand side by side with a
 * small gap when there is room.
 */
const OpponentStack: React.FC<{ results: OpponentResult[]; availableWidth: number }> = ({
  results,
  availableWidth,
}) => {
  const count = results.length;
  const sideBySideWidth = count * STACK_PICTURE_SIZE + (count - 1) * STACK_GAP;
  const narrowestWidth = STACK_PICTURE_SIZE + (count - 1) * STACK_MIN_OFFSET;
  const width = count > 0 ? Math.max(narrowestWidth, Math.min(sideBySideWidth, availableWidth)) : 0;
  const offset = count > 1 ? (width - STACK_PICTURE_SIZE) / (count - 1) : 0;

  return (
    <div className="relative shrink-0" style={{ width, height: STACK_PICTURE_SIZE + STACK_RESULT_HEIGHT }}>
      {results.map((result, index) => (
        <div
          key={result.opponent}
          className="absolute top-0 flex flex-col items-center"
          // The first opponent is on top, like the stacks on the dashboard
          style={{ left: index * offset, width: STACK_PICTURE_SIZE, zIndex: count - index }}
        >
          {result.won !== undefined && (
            // A ribbon from behind the picture down below the icon, so the icon is easy to see on any background
            <div
              className="absolute rounded-full bg-secondary-text"
              style={{ top: STACK_PICTURE_SIZE / 2, bottom: 0, width: STACK_RIBBON_WIDTH }}
            />
          )}
          <div className="relative">
            <ProfilePicture playerId={result.opponent} size={STACK_PICTURE_SIZE} shape="circle" border={2} />
          </div>
          <span className="relative text-xs flex items-center justify-center" style={{ height: STACK_RESULT_HEIGHT }}>
            {resultEmoji(result)}
          </span>
        </div>
      ))}
    </div>
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
