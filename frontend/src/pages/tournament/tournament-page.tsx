import { TournamentWithGames } from "../../client-db/tournament";
import { classNames } from "../../common/class-names";
import { useClientDbContext } from "../../wrappers/client-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { layerIndexToTournamentRound, WinnerBox } from "../leaderboard/tournament-pending-games";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { Link } from "react-router-dom";
import { useRerender } from "../../hooks/use-rerender";
import { useCallback, useEffect, useRef } from "react";
import { useTennisParams } from "../../hooks/use-tennis-params";
import { useSessionStorage } from "usehooks-ts";

export const TournamentPage: React.FC = () => {
  const { tournament: tournamentId, player1, player2 } = useTennisParams();

  const rerender = useRerender();
  const context = useClientDbContext();

  const tournaments = context.tournaments.getTournaments();
  const tournament = tournaments.length === 1 ? tournaments[0] : tournaments.find((t) => t.id === tournamentId);

  // Determine default based on screen width and layer debth in bracket. Also, store in local storage?
  const [showAsList, setShowAsList] = useSessionStorage(`show-tournament-as-list${tournamentId}`, false);

  // ScrollTo
  const itemRefs = useRef<{ [key: string]: HTMLElement | null }>({});
  const gameKey = getGameKeyFromPlayers(player1 ?? "", player2 ?? "");
  const scrollToGame = useCallback(() => {
    const element = itemRefs.current[gameKey];
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
    } else {
      console.warn(`Item with ID '${gameKey}' not found.`);
    }
  }, [gameKey]);

  useEffect(() => {
    // Run the scroll function after a short delay to ensure rendering is complete
    const timeout = setTimeout(scrollToGame, 100);
    return () => clearTimeout(timeout);
  }, [scrollToGame, showAsList]);

  if (!tournament) return <div>No tournament selected</div>;

  return (
    <div>
      <h1 className="m-auto w-fit">{tournament.name}</h1>
      <button
        className="py-2 px-4 cursor-pointer bg-secondary-background hover:bg-secondary-background/70 rounded-md"
        onClick={() => setShowAsList(!showAsList)}
      >
        Toggle view! Current: {showAsList ? "List" : "Tree 🌲"}
      </button>
      {tournament.bracket[0][0].winner && (
        <div className="min-w-80 max-w-96 space-y-2">
          <WinnerBox winner={tournament.bracket[0][0].winner} />{" "}
        </div>
      )}
      {showAsList ? (
        <GamesList tournament={tournament} rerender={rerender} itemRefs={itemRefs} />
      ) : (
        <div className="w-fit m-auto">
          <GameTriangle tournament={tournament} layerIndex={0} gameIndex={0} rerender={rerender} itemRefs={itemRefs} />
        </div>
      )}
    </div>
  );
};
type GamesListProps = {
  tournament: TournamentWithGames;
  rerender: () => void;
  itemRefs: React.MutableRefObject<{
    [key: string]: HTMLElement | null;
  }>;
};
const GamesList: React.FC<GamesListProps> = ({ tournament, rerender, itemRefs }) => {
  const { player1, player2 } = useTennisParams();

  return (
    <div className="flex flex-col items-center lg:flex-row-reverse lg:justify-end lg:items-start gap-2">
      {tournament.bracket.map((layer, layerIndex) => (
        <div key={layerIndex} className="flex flex-col gap-1 w-full min-w-[22rem] max-w-[27rem]">
          <h3 className="text-center text-sm">{layerIndexToTournamentRound(layerIndex)}</h3>
          {layer.map((game, gameIndex) => {
            // Skip empty qualifier games
            if (layerIndex === tournament.bracket.length - 1 && !game.player1 && !game.player2) return null;
            const { isPending, p1IsWinner, p2IsWinner, p1IsLoser, p2IsLoser, showMenu } = getGameStates(
              tournament,
              game,
            );

            const gameKey =
              game.player1 && game.player2
                ? getGameKeyFromPlayers(game.player1, game.player2)
                : "L" + layerIndex + "G+" + gameIndex;

            const isParamSelectedGame = gameKey === getGameKeyFromPlayers(player1, player2);

            return (
              <Menu key={gameKey} ref={(el) => (itemRefs.current[gameKey] = el)}>
                <MenuButton
                  disabled={!showMenu}
                  className={classNames(
                    "relative w-full px-4 py-2 rounded-lg flex items-center gap-x-4 h-12",
                    isPending ? "bg-secondary-background ring-2 ring-secondary-text" : "bg-secondary-background/50",
                    showMenu && "hover:bg-secondary-background/70",
                    isParamSelectedGame && "animate-wiggle",
                  )}
                >
                  <h2 className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">VS</h2>
                  <div className="flex gap-3 items-center justify-center">
                    {game.player1 ? (
                      <ProfilePicture name={game.player1} size={35} shape="circle" clickToEdit={false} border={3} />
                    ) : (
                      <QuestionMark size={38} />
                    )}
                    <h3 className={classNames(p1IsWinner && "font-semibold", p1IsLoser && "line-through font-thin")}>
                      {game.player1} {winStateEmoji(p1IsWinner, game.skipped)}
                    </h3>
                  </div>
                  <div className="grow" />
                  <div className="flex gap-3 items-center justify-center">
                    <h3 className={classNames(p2IsWinner && "font-semibold", p2IsLoser && "line-through font-thin")}>
                      {winStateEmoji(p2IsWinner, game.skipped)} {game.player2}
                    </h3>
                    {game.player2 ? (
                      <ProfilePicture name={game.player2} size={35} shape="circle" clickToEdit={false} border={3} />
                    ) : (
                      <QuestionMark size={38} />
                    )}
                  </div>
                  <GameMenuItems tournament={tournament} game={game} rerender={rerender} />
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
  tournament: TournamentWithGames;
  layerIndex: number;
  gameIndex: number;
  rerender: () => void;
  itemRefs: React.MutableRefObject<{
    [key: string]: HTMLElement | null;
  }>;
};
const GameTriangle: React.FC<GameTriangleProps> = ({ tournament, layerIndex, gameIndex, rerender, itemRefs }) => {
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

  const game = tournament.bracket[layerIndex]?.[gameIndex];

  if (!game || (layerIndex === tournament.bracket.length - 1 && !game.player1 && !game.player2)) {
    return size === "xs" || size === "xxs" ? null : <div className="grow" />;
  }

  const { isPending, p1IsWinner, p2IsWinner, p1IsLoser, p2IsLoser, showMenu } = getGameStates(tournament, game);

  const gameKey =
    game.player1 && game.player2
      ? getGameKeyFromPlayers(game.player1, game.player2)
      : "L" + layerIndex + "G+" + gameIndex;

  const isParamSelectedGame = gameKey === getGameKeyFromPlayers(player1, player2);

  return (
    <div className="w-fit space-y-2">
      {layerIndex < 3 ? (
        <h2 className="font-light text-sm text-center">{layerIndexToTournamentRound(layerIndex)}</h2>
      ) : (
        <div className="h-0" />
      )}
      <Menu key={gameKey} ref={(el) => (itemRefs.current[gameKey] = el)}>
        <div className="w-full flex">
          <MenuButton
            disabled={!showMenu}
            className={classNames(
              wrapperStyles[size],
              "rounded-lg mx-auto",
              game.winner || game.skipped || !isPending ? "bg-secondary-background/50" : "bg-secondary-background",
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
                  name={game.player1}
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
                {game.player1} {winStateEmoji(p1IsWinner, game.skipped)}
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
                {winStateEmoji(p2IsWinner, game.skipped)} {game.player2}
              </div>
              {game.player2 ? (
                <ProfilePicture
                  name={game.player2}
                  border={playerPictureBorder[size]}
                  shape="circle"
                  size={playerPictureSize[size]}
                />
              ) : (
                <QuestionMark size={playerPictureSize[size] + playerPictureBorder[size]} />
              )}
            </div>
          </MenuButton>
          <GameMenuItems tournament={tournament} game={game} rerender={rerender} />
        </div>
      </Menu>

      {layerIndex < tournament.bracket.length && (
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

function winStateEmoji(winner?: boolean, skipped?: any) {
  if (winner) {
    return !!skipped ? "🆓" : "🏆";
  }
}

function getGameStates(tournament: TournamentWithGames, game: TournamentWithGames["bracket"][number][number]) {
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
    ? tournament.bracket[game.advanceTo.layerIndex]?.[game.advanceTo.gameIndex]
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

export const GameMenuItems: React.FC<{
  tournament: TournamentWithGames;
  game: TournamentWithGames["bracket"][number][number];
  rerender: () => void;
}> = ({ tournament, game, rerender }) => {
  const context = useClientDbContext();

  const { showCompareOption, showRegisterResultOption, showSkipGameOption, showUndoSkipOption } = getGameStates(
    tournament,
    game,
  );

  return (
    <MenuItems
      anchor="bottom"
      className="flex flex-col gap-0 rounded-lg bg-secondary-background ring-2 ring-secondary-text shadow-xl"
    >
      {showCompareOption && (
        <MenuItem>
          <Link
            to={`/1v1/?player1=${game.player1 || ""}&player2=${game.player2 || ""}`}
            className="w-full px-4 py-2 text-left data-[focus]:bg-primary-background/50"
          >
            🥊 Compare players 👀
          </Link>
        </MenuItem>
      )}
      {showRegisterResultOption && (
        <MenuItem>
          <Link
            to={`/add-game/?player1=${game.player1 || ""}&player2=${game.player2 || ""}`}
            className="w-full px-4 py-2 text-left data-[focus]:bg-primary-background/50"
          >
            🏆 Register result
          </Link>
        </MenuItem>
      )}
      {showSkipGameOption && (
        <MenuItem>
          <button
            className="w-full px-4 py-2 text-left data-[focus]:bg-primary-background/50"
            onClick={() => {
              context.tournaments.skipGame(
                { advancing: game.player1!, eliminated: game.player2!, time: new Date().getTime() },
                tournament.id,
              );
              rerender();
            }}
          >
            🆓 Skip game ({game.player1} moves up)
          </button>
        </MenuItem>
      )}
      {showSkipGameOption && (
        <MenuItem>
          <button
            className="w-full px-4 py-2 text-left data-[focus]:bg-primary-background/50"
            onClick={() => {
              context.tournaments.skipGame(
                { advancing: game.player2!, eliminated: game.player1!, time: new Date().getTime() },
                tournament.id,
              );
              rerender();
            }}
          >
            🆓 Skip game ({game.player2} moves up)
          </button>
        </MenuItem>
      )}
      {showUndoSkipOption && (
        <MenuItem>
          <button
            className="w-full px-4 py-2 text-left data-[focus]:bg-primary-background/50"
            onClick={() => {
              context.tournaments.undoSkipGame(game.skipped!, tournament.id);
              rerender();
            }}
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

function getGameKeyFromPlayers(player1: string | undefined | null, player2: string | undefined | null) {
  return `P1:${player1 ?? ""}:P2:${player2 ?? ""}`;
}
