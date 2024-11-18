import { TournamentWithGames } from "../../client-db/tournament";
import { classNames } from "../../common/class-names";
import { useClientDbContext } from "../../wrappers/client-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { layerIndexToTournamentRound, WinnerBox } from "../leaderboard/tournament-pending-games";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { Link } from "react-router-dom";

export const TournamentPage: React.FC = () => {
  const context = useClientDbContext();

  const tournament = context.tournaments.getTournaments()[0];

  if (!tournament) return <div>No tournaments</div>;

  return (
    <div>
      <h1>{tournament.name}</h1>
      <GameTriangle tournament={tournament} layerIndex={0} gameIndex={0} />
    </div>
  );
};

type Size = "lg" | "md" | "sm" | "xs" | "xxs";

type GameTriangleProps = {
  tournament: TournamentWithGames;
  layerIndex: number;
  gameIndex: number;
};
const GameTriangle: React.FC<GameTriangleProps> = ({ tournament, layerIndex, gameIndex }) => {
  const context = useClientDbContext();

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

  const isPending = game.player1 && game.player2 && !game.winner && !game.skipped;

  const p1IsLoser = game.winner && game.winner === game.player2;
  const p2IsLoser = game.winner && game.winner === game.player1;

  const p1IsWinner = game.winner && game.winner === game.player1;
  const p2IsWinner = game.winner && game.winner === game.player2;

  const showRegisterResultOption =
    game.player1 && game.player2 && game.winner === undefined && game.skipped === undefined;
  const showSkipGameOption = game.player1 && game.player2 && game.winner === undefined && game.skipped === undefined;
  const advanceToGame = game.advanceTo
    ? tournament.bracket[game.advanceTo.layerIndex]?.[game.advanceTo.gameIndex]
    : undefined;
  const showUndoSkipOption =
    game.skipped && advanceToGame && advanceToGame.winner === undefined && advanceToGame.skipped === undefined;

  const showMenu = showRegisterResultOption || showSkipGameOption || showUndoSkipOption;
  return (
    <div className="w-fit space-y-2">
      {layerIndex === 0 && gameIndex === 0 && game.winner && (
        <div className="w-96 m-auto mb-6">
          <WinnerBox winner={game.winner} />
        </div>
      )}
      {layerIndex < 3 ? (
        <h2 className="font-light text-sm text-center">{layerIndexToTournamentRound(layerIndex)}</h2>
      ) : (
        <div className="h-0" />
      )}
      <Menu>
        <div className="w-full flex">
          <MenuButton
            disabled={!showMenu}
            className={classNames(
              wrapperStyles[size],
              "rounded-lg mx-auto",
              game.winner || game.skipped || !isPending ? "bg-secondary-background/50" : "bg-secondary-background",
              isPending && "bg-secondary-background ring-2 ring-secondary-text",
              showMenu && "hover:bg-secondary-background/50",
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
              <div className={classNames("whitespace-nowrap", playerTextStyles[size], p1IsLoser && "line-through")}>
                {game.player1} {p1IsWinner && " 🏆"}
              </div>
            </div>
            {size !== "xxs" && <div className="w-full text-center font-thin italic text-xs">vs</div>}
            <div
              className={classNames("flex", playerWrapperStyles[size], size === "lg" ? "items-center" : "items-end")}
            >
              <div className="grow" />
              <div className={classNames("whitespace-nowrap", playerTextStyles[size], p2IsLoser && "line-through")}>
                {p2IsWinner && "🏆 "}
                {game.player2}
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
        </div>
        <MenuItems
          anchor="bottom"
          className="flex flex-col gap-0 rounded-lg bg-secondary-background ring-2 ring-secondary-text shadow-xl"
        >
          {showRegisterResultOption && (
            <MenuItem>
              <Link
                to={`/add-game/?player1=${game.player1 || ""}&player2=${game.player2 || ""}`}
                className="w-full px-4 py-2 text-left data-[focus]:bg-primary-background/50"
              >
                Register result
              </Link>
            </MenuItem>
          )}
          {showSkipGameOption && (
            <MenuItem>
              <button
                className="w-full px-4 py-2 text-left data-[focus]:bg-primary-background/50"
                onClick={() => context.tournaments.skipGame({ advancing: game.player1!, eliminated: game.player2! })}
              >
                Skip game ({game.player1} win)
              </button>
            </MenuItem>
          )}
          {showSkipGameOption && (
            <MenuItem>
              <button
                className="w-full px-4 py-2 text-left data-[focus]:bg-primary-background/50"
                onClick={() => context.tournaments.skipGame({ advancing: game.player2!, eliminated: game.player1! })}
              >
                Skip game ({game.player2} win)
              </button>
            </MenuItem>
          )}
          {showUndoSkipOption && (
            <MenuItem>
              <button
                className="w-full px-4 py-2 text-left data-[focus]:bg-primary-background/50"
                onClick={() => context.tournaments.undoSkipGame(game.skipped!)}
              >
                Undo skip
              </button>
            </MenuItem>
          )}
        </MenuItems>
      </Menu>

      {layerIndex < tournament.bracket.length && (
        <div className="flex gap-2">
          <GameTriangle tournament={tournament} layerIndex={layerIndex + 1} gameIndex={gameIndex * 2} />
          <GameTriangle tournament={tournament} layerIndex={layerIndex + 1} gameIndex={gameIndex * 2 + 1} />
        </div>
      )}
    </div>
  );
};

export const QuestionMark: React.FC<{ size: number }> = ({ size }) => {
  return (
    <div
      className={classNames("overflow-hidden bg-primary-background shrink-0 rounded-full")}
      style={{ height: size, width: size, fontSize: size * 0.66 + "px" }}
    >
      <div className={classNames("w-full h-full ")}>?</div>
    </div>
  );
};
