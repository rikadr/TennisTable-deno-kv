import { classNames } from "../../common/class-names";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { layerIndexToTournamentRound, WinnerBox } from "../leaderboard/tournament-pending-games";
import { Menu, MenuButton, MenuItem, MenuItems, Switch } from "@headlessui/react";
import { Link } from "react-router-dom";
import { useRerender } from "../../hooks/use-rerender";
import { useCallback, useEffect, useRef } from "react";
import { useTennisParams } from "../../hooks/use-tennis-params";
import { useSessionStorage } from "usehooks-ts";
import { relativeTimeString } from "../../common/date-utils";
import { TournamentSignup } from "./tournament-signup";
import { TournamentGroupPlayComponent } from "./tournament-group-play";
import { Tournament, TournamentGame } from "../../client/client-db/tournaments/tournament";
import { fmtNum } from "../../common/number-utils";

export const TournamentPage: React.FC = () => {
  const { tournament: tournamentId, player1, player2 } = useTennisParams();
  const rerender = useRerender();
  const context = useEventDbContext();
  const tournament = context.tournaments.getTournament(tournamentId);
  const [showAsList, setShowAsList] = useSessionStorage(
    `show-tournament-as-list${tournamentId}`,
    window.innerWidth < 1_000,
  );

  // ScrollTo
  const itemRefs = useRef<{ [key: string]: HTMLElement | null }>({});
  const gameKeyBracket = getGameKeyFromPlayers(player1 ?? "", player2 ?? "", "bracket");
  const gameKeyGroup = getGameKeyFromPlayers(player1 ?? "", player2 ?? "", "group");
  const scrollToGame = useCallback(() => {
    const elementBracket = itemRefs.current[gameKeyBracket];
    const elementGroup = itemRefs.current[gameKeyGroup];
    if (elementBracket || elementGroup) {
      (elementBracket ?? elementGroup)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
    } else {
      console.warn(`Item with ID '${gameKeyBracket}' nor '${gameKeyGroup}' not found.`);
    }
  }, [gameKeyBracket, gameKeyGroup]);

  useEffect(() => {
    // Run the scroll function after a short delay to ensure rendering is complete
    const timeout = setTimeout(scrollToGame, 100);
    return () => clearTimeout(timeout);
  }, [scrollToGame, showAsList]);

  if (!tournament) return <div>No tournament selected</div>;

  return (
    <div className="space-y-4">
      <div className="ring-1 ring-secondary-background w-fit mx-4 px-4 md:mx-10 md:px-6 py-4 text-primary-text bg-primary-background rounded-lg">
        <p className="text-xs italic">Tournament:</p>
        <h1 className="mb-2">{tournament.name}</h1>
        <p className="text-xs italic">Description:</p>
        <p className="text-sm mb-2">{tournament.description || "-"}</p>
        <p className="text-xs italic">Start date:</p>
        <p className="text-sm mb-2">
          {relativeTimeString(new Date(tournament.startDate))} (
          {new Intl.DateTimeFormat("en-US", {
            minute: "numeric",
            hour: "numeric",
            hour12: false,
            day: "numeric",
            month: "long",
            year: "numeric",
          }).format(new Date(tournament.startDate))}
          )
        </p>
        {tournament.winner && (
          <div className="min-w-80 max-w-96 space-y-2">
            <p className="text-xs italic">Won {relativeTimeString(new Date(tournament.endDate || 0))}</p>
            <WinnerBox winner={tournament.winner} />
          </div>
        )}
      </div>

      {tournament.startDate > new Date().getTime() && <TournamentSignup tournament={tournament} />}
      {tournament.startDate < new Date().getTime() && (
        <>
          {tournament.bracket && (
            <>
              <Switch
                checked={showAsList}
                onChange={setShowAsList}
                className="ml-4 md:ml-10 group relative flex h-10 w-36 cursor-pointer rounded-full bg-secondary-background p-1 transition-colors duration-200 ease-in-out focus:outline-none data-[focus]:outline-1 data-[focus]:outline-white"
              >
                <div
                  className={classNames(
                    "absolute top-1/2 transform -translate-y-1/2 left-5 z-10",
                    showAsList ? "text-secondary-text" : "text-primary-text",
                  )}
                >
                  Tree {!showAsList && "🌲"}
                </div>
                <div
                  className={classNames(
                    "absolute top-1/2 transform -translate-y-1/2 right-5 z-10",
                    showAsList ? "text-primary-text" : "text-secondary-text",
                  )}
                >
                  {showAsList && "🟰"} List{" "}
                </div>
                <span
                  aria-hidden="true"
                  className="pointer-events-none inline-block h-8 w-[5rem] translate-x-0 rounded-full bg-primary-background ring-0 shadow-lg transition duration-200 ease-in-out group-data-[checked]:translate-x-[3.5rem]"
                />
              </Switch>
              {showAsList ? (
                <GamesList tournament={tournament} rerender={rerender} itemRefs={itemRefs} />
              ) : (
                <div className="w-fit m-auto bg-primary-background rounded-lg p-4 ">
                  <GameTriangle
                    tournament={tournament}
                    layerIndex={0}
                    gameIndex={0}
                    rerender={rerender}
                    itemRefs={itemRefs}
                  />
                </div>
              )}
            </>
          )}
          <TournamentGroupPlayComponent tournament={tournament} rerender={rerender} itemRefs={itemRefs} />
        </>
      )}
      <button
        className="text-xs italic text-primary-text/30"
        onClick={() =>
          console.log(
            Array.from(context.tournaments.tournamentPrediction.predictTournament(tournamentId ?? "").players)
              .sort(([_, a], [__, b]) => b.wins - a.wins)
              .map(([player, { wins }]) => `${context.playerName(player)}: ${fmtNum(wins)}`),
          )
        }
      >
        Beta: Simulate tournament prediction in console log
      </button>
    </div>
  );
};

type GamesListProps = {
  tournament: Tournament;
  rerender: () => void;
  itemRefs: React.MutableRefObject<{
    [key: string]: HTMLElement | null;
  }>;
};
const GamesList: React.FC<GamesListProps> = ({ tournament, rerender, itemRefs }) => {
  const context = useEventDbContext();
  const { player1, player2 } = useTennisParams();

  return (
    <div className="flex flex-col items-center lg:flex-row-reverse lg:justify-end lg:items-start gap-2 bg-primary-background rounded-lg py-4">
      {tournament.bracket &&
        tournament.bracket.bracket.map((layer, layerIndex) => (
          <div key={layerIndex} className="flex flex-col gap-1 w-full min-w-[22rem] max-w-[27rem]">
            <h3 className="text-center text-sm text-primary-text">{layerIndexToTournamentRound(layerIndex)}</h3>
            {layer.map((game, gameIndex) => {
              // Skip empty qualifier games
              if (layerIndex === tournament.bracket!.bracket.length - 1 && !game.player1 && !game.player2) return null;
              const { isPending, p1IsWinner, p2IsWinner, p1IsLoser, p2IsLoser, showMenu, ...states } = getGameStates(
                tournament,
                game,
              );

              const gameKey =
                game.player1 && game.player2
                  ? getGameKeyFromPlayers(game.player1, game.player2, "bracket")
                  : "L" + layerIndex + "G+" + gameIndex;

              const isParamSelectedGame = gameKey === getGameKeyFromPlayers(player1, player2, "bracket");

              return (
                <Menu key={gameKey} ref={(el) => (itemRefs.current[gameKey] = el)}>
                  <MenuButton
                    disabled={!showMenu}
                    className={classNames(
                      "relative w-full px-4 py-2 rounded-lg flex items-center gap-x-4 h-12 text-secondary-text",
                      isPending ? "bg-secondary-background ring-2 ring-secondary-text" : "bg-secondary-background/60",
                      showMenu && "hover:bg-secondary-background/70",
                      isParamSelectedGame && "animate-wiggle",
                    )}
                  >
                    <h2 className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">VS</h2>
                    <div className="flex gap-3 items-center justify-center">
                      {game.player1 ? (
                        <ProfilePicture
                          playerId={game.player1}
                          size={35}
                          shape="circle"
                          clickToEdit={false}
                          border={3}
                        />
                      ) : (
                        <QuestionMark size={38} />
                      )}
                      <h3 className={classNames(p1IsWinner && "font-semibold", p1IsLoser && "line-through font-thin")}>
                        {game.player1 && context.playerName(game.player1)} {winStateEmoji(p1IsWinner, game.skipped)}
                      </h3>
                    </div>
                    <div className="grow" />
                    <div className="flex gap-3 items-center justify-center">
                      <h3 className={classNames(p2IsWinner && "font-semibold", p2IsLoser && "line-through font-thin")}>
                        {winStateEmoji(p2IsWinner, game.skipped)} {game.player2 && context.playerName(game.player2)}
                      </h3>
                      {game.player2 ? (
                        <ProfilePicture
                          playerId={game.player2}
                          size={35}
                          shape="circle"
                          clickToEdit={false}
                          border={3}
                        />
                      ) : (
                        <QuestionMark size={38} />
                      )}
                    </div>
                    <GameMenuItems
                      player1={game.player1}
                      player2={game.player2}
                      showCompare={states.showCompareOption}
                      showRegisterResult={!!states.showRegisterResultOption}
                      showSkipGamePlayer1Advance={{
                        show: !!states.showSkipGameOption,
                        onSkip: () => {
                          context.tournaments.skipGame(
                            { advancing: game.player1!, eliminated: game.player2!, time: new Date().getTime() },
                            tournament.id,
                          );
                          rerender();
                        },
                      }}
                      showSkipGamePlayer2Advance={{
                        show: !!states.showSkipGameOption,
                        onSkip: () => {
                          context.tournaments.skipGame(
                            { advancing: game.player2!, eliminated: game.player1!, time: new Date().getTime() },
                            tournament.id,
                          );
                          rerender();
                        },
                      }}
                      showUndoSkip={{
                        show: !!states.showUndoSkipOption,
                        onUndoSkip: () => {
                          context.tournaments.undoSkipGame(game.skipped!, tournament.id);
                          rerender();
                        },
                      }}
                    />
                  </MenuButton>
                </Menu>
              );
            })}
          </div>
        ))}
    </div>
  );
};

type Size = "lg" | "md" | "sm" | "xs" | "xxs";

type GameTriangleProps = {
  tournament: Tournament;
  layerIndex: number;
  gameIndex: number;
  rerender: () => void;
  itemRefs: React.MutableRefObject<{
    [key: string]: HTMLElement | null;
  }>;
};
const GameTriangle: React.FC<GameTriangleProps> = ({ tournament, layerIndex, gameIndex, rerender, itemRefs }) => {
  const context = useEventDbContext();
  const { player1, player2 } = useTennisParams();

  let size: Size = "xxs";
  switch (layerIndex) {
    case 0:
      size = "lg";
      break;
    case 1:
      size = "lg";
      break;
    case 2:
      size = "md";
      break;
    case 3:
      size = "sm";
      break;
    case 4:
      size = "xs";
      break;
    default:
      size = "xxs";
  }

  const wrapperStyles: Record<Size, string> = {
    lg: "w-96 p-3 flex items-center h-16",
    md: "w-52 p-2 -space-y-2",
    sm: "w-40 px-1 py-1.5 -space-y-2",
    xs: "w-32 p-1 -space-y-1",
    xxs: "w-24 p-0.5 -space-y-1",
  };

  const playerWrapperStyles: Record<Size, string> = {
    lg: "gap-x-3",
    md: "gap-x-3",
    sm: "gap-x-2",
    xs: "gap-x-1",
    xxs: "gap-x-0.5",
  };

  const playerTextStyles: Record<Size, string> = {
    lg: "text-xl",
    md: "text-lg",
    sm: "text-base",
    xs: "text-sm",
    xxs: "text-xs font-light",
  };

  const playerPictureSize: Record<Size, number> = {
    lg: 45,
    md: 33,
    sm: 29,
    xs: 20,
    xxs: 14,
  };
  const playerPictureBorder: Record<Size, number> = {
    lg: 3,
    md: 2,
    sm: 2,
    xs: 1,
    xxs: 1,
  };

  if (!tournament.bracket) {
    return null;
  }

  const game = tournament.bracket.bracket[layerIndex]?.[gameIndex];

  if (!game || (layerIndex === tournament.bracket.bracket.length - 1 && !game.player1 && !game.player2)) {
    return size === "xs" || size === "xxs" ? null : <div className="grow" />;
  }

  const { isPending, p1IsWinner, p2IsWinner, p1IsLoser, p2IsLoser, showMenu, ...states } = getGameStates(
    tournament,
    game,
  );

  const gameKey =
    game.player1 && game.player2
      ? getGameKeyFromPlayers(game.player1, game.player2, "bracket")
      : "L" + layerIndex + "G+" + gameIndex;

  const isParamSelectedGame = gameKey === getGameKeyFromPlayers(player1, player2, "bracket");

  return (
    <div className="w-fit space-y-2">
      {layerIndex < 3 ? (
        <h2 className="font-light text-sm text-center text-primary-text">{layerIndexToTournamentRound(layerIndex)}</h2>
      ) : (
        <div className="h-0" />
      )}
      <Menu key={gameKey} ref={(el) => (itemRefs.current[gameKey] = el)}>
        <div className="w-full flex">
          <MenuButton
            disabled={!showMenu}
            className={classNames(
              wrapperStyles[size],
              "rounded-lg mx-auto text-secondary-text",
              game.winner || game.skipped || !isPending ? "bg-secondary-background/60" : "bg-secondary-background",
              isPending && "bg-secondary-background ring-2 ring-secondary-text",
              showMenu && "hover:bg-secondary-background/70",
              isParamSelectedGame && "animate-wiggle",
            )}
          >
            <div
              className={classNames("flex", playerWrapperStyles[size], size === "lg" ? "items-center" : "items-start")}
            >
              {game.player1 ? (
                <ProfilePicture
                  playerId={game.player1}
                  border={playerPictureBorder[size]}
                  shape="circle"
                  size={playerPictureSize[size]}
                />
              ) : (
                <QuestionMark size={playerPictureSize[size] + playerPictureBorder[size]} />
              )}
              <div
                className={classNames(
                  "whitespace-nowrap",
                  playerTextStyles[size],
                  p1IsWinner && "font-semibold",
                  p1IsLoser && "line-through font-thin",
                )}
              >
                {game.player1 && context.playerName(game.player1)} {winStateEmoji(p1IsWinner, game.skipped)}
              </div>
            </div>
            {size !== "xxs" && <div className="w-full text-center font-thin italic text-xs">vs</div>}
            <div
              className={classNames("flex", playerWrapperStyles[size], size === "lg" ? "items-center" : "items-end")}
            >
              <div className="grow" />
              <div
                className={classNames(
                  "whitespace-nowrap",
                  playerTextStyles[size],
                  p2IsWinner && "font-semibold",
                  p2IsLoser && "line-through font-thin",
                )}
              >
                {winStateEmoji(p2IsWinner, game.skipped)} {game.player2 && context.playerName(game.player2)}
              </div>
              {game.player2 ? (
                <ProfilePicture
                  playerId={game.player2}
                  border={playerPictureBorder[size]}
                  shape="circle"
                  size={playerPictureSize[size]}
                />
              ) : (
                <QuestionMark size={playerPictureSize[size] + playerPictureBorder[size]} />
              )}
            </div>
          </MenuButton>
          <GameMenuItems
            player1={game.player1}
            player2={game.player2}
            showCompare={states.showCompareOption}
            showRegisterResult={!!states.showRegisterResultOption}
            showSkipGamePlayer1Advance={{
              show: !!states.showSkipGameOption,
              onSkip: () => {
                context.tournaments.skipGame(
                  { advancing: game.player1!, eliminated: game.player2!, time: new Date().getTime() },
                  tournament.id,
                );
                rerender();
              },
            }}
            showSkipGamePlayer2Advance={{
              show: !!states.showSkipGameOption,
              onSkip: () => {
                context.tournaments.skipGame(
                  { advancing: game.player2!, eliminated: game.player1!, time: new Date().getTime() },
                  tournament.id,
                );
                rerender();
              },
            }}
            showUndoSkip={{
              show: !!states.showUndoSkipOption,
              onUndoSkip: () => {
                context.tournaments.undoSkipGame(game.skipped!, tournament.id);
                rerender();
              },
            }}
          />
        </div>
      </Menu>

      {layerIndex < tournament.bracket.bracket.length && (
        <div className="flex gap-2">
          <GameTriangle
            tournament={tournament}
            layerIndex={layerIndex + 1}
            gameIndex={gameIndex * 2}
            rerender={rerender}
            itemRefs={itemRefs}
          />
          <GameTriangle
            tournament={tournament}
            layerIndex={layerIndex + 1}
            gameIndex={gameIndex * 2 + 1}
            rerender={rerender}
            itemRefs={itemRefs}
          />
        </div>
      )}
    </div>
  );
};

export function winStateEmoji(winner?: boolean, skipped?: any) {
  if (winner) {
    return !!skipped ? "🆓" : "🏆";
  }
}

function getGameStates(tournament: Tournament, game: Partial<TournamentGame>) {
  const isPending = !!game.player1 && !!game.player2 && !game.winner && !game.skipped;

  const p1IsWinner = !!game.winner && game.winner === game.player1;
  const p2IsWinner = !!game.winner && game.winner === game.player2;

  const p1IsLoser = !!game.winner && game.winner === game.player2;
  const p2IsLoser = !!game.winner && game.winner === game.player1;

  const showCompareOption = !!game.player1 && !!game.player2;
  const showRegisterResultOption =
    game.player1 && game.player2 && game.winner === undefined && game.skipped === undefined;
  const showSkipGameOption = game.player1 && game.player2 && game.winner === undefined && game.skipped === undefined;
  const advanceToGame = game.advanceTo
    ? tournament.bracket!.bracket[game.advanceTo.layerIndex]?.[game.advanceTo.gameIndex]
    : undefined;
  const showUndoSkipOption =
    game.skipped && advanceToGame?.winner === undefined && advanceToGame?.skipped === undefined;

  const showMenu = showCompareOption || showRegisterResultOption || showSkipGameOption || showUndoSkipOption;
  return {
    isPending,
    p1IsWinner,
    p2IsWinner,
    p1IsLoser,
    p2IsLoser,
    showMenu,
    showCompareOption,
    showRegisterResultOption,
    showSkipGameOption,
    showUndoSkipOption,
  };
}

type GameMenuItemsProps = {
  player1?: string;
  player2?: string;
  showCompare: boolean;
  showRegisterResult: boolean;
  showSkipGamePlayer1Advance: { show: boolean; onSkip: () => void };
  showSkipGamePlayer2Advance: { show: boolean; onSkip: () => void };
  showUndoSkip: { show: boolean; onUndoSkip: () => void };
};
export const GameMenuItems: React.FC<GameMenuItemsProps> = (props) => {
  const context = useEventDbContext();
  return (
    <MenuItems
      anchor="bottom"
      className="flex flex-col gap-0 rounded-lg bg-secondary-background ring-2 ring-secondary-text shadow-xl text-secondary-text"
    >
      {props.showCompare && (
        <MenuItem>
          <Link
            to={`/1v1/?player1=${props.player1 || ""}&player2=${props.player2 || ""}`}
            className="w-full px-4 py-2 text-left data-[focus]:bg-secondary-text/30"
          >
            🥊👀 Compare 1v1
          </Link>
        </MenuItem>
      )}
      {props.showRegisterResult && (
        <MenuItem>
          <Link
            to={`/add-game-add/?player1=${props.player1 || ""}&player2=${props.player2 || ""}`}
            className="w-full px-4 py-2 text-left data-[focus]:bg-secondary-text/30"
          >
            🏆🤝 Register completed result
          </Link>
        </MenuItem>
      )}
      {props.showRegisterResult && (
        <MenuItem>
          <Link
            to={`/add-game-track/?player1=${props.player1 || ""}&player2=${props.player2 || ""}`}
            className="w-full px-4 py-2 text-left data-[focus]:bg-secondary-text/30"
          >
            🏆🔴 Track game live
          </Link>
        </MenuItem>
      )}
      {props.showSkipGamePlayer1Advance?.show && (
        <MenuItem>
          <button
            className="w-full px-4 py-2 text-left data-[focus]:bg-secondary-text/30"
            onClick={props.showSkipGamePlayer1Advance.onSkip}
          >
            🆓 Skip game ({context.playerName(props.player1)} advances)
          </button>
        </MenuItem>
      )}
      {props.showSkipGamePlayer2Advance?.show && (
        <MenuItem>
          <button
            className="w-full px-4 py-2 text-left data-[focus]:bg-secondary-text/30"
            onClick={props.showSkipGamePlayer2Advance.onSkip}
          >
            🆓 Skip game ({context.playerName(props.player2)} advances)
          </button>
        </MenuItem>
      )}
      {props.showUndoSkip?.show && (
        <MenuItem>
          <button
            className="w-full px-4 py-2 text-left data-[focus]:bg-secondary-text/30"
            onClick={props.showUndoSkip.onUndoSkip}
          >
            ⏮️ Undo skip
          </button>
        </MenuItem>
      )}
    </MenuItems>
  );
};

export const QuestionMark: React.FC<{ size: number }> = ({ size }) => {
  size = size * 0.95;
  return (
    <div
      className={classNames("overflow-hidden bg-primary-background shrink-0 rounded-full")}
      style={{ height: size, width: size, fontSize: size * 0.66 + "px" }}
    >
      <div className={classNames("w-full h-full text-center")}>?</div>
    </div>
  );
};

export function getGameKeyFromPlayers(
  player1: string | undefined | null,
  player2: string | undefined | null,
  where: "group" | "bracket",
) {
  return `P1:${player1 ?? ""}:P2:${player2 ?? ""}:${where}`;
}
