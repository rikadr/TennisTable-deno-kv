import { Menu, MenuButton, MenuItem, MenuItems, Switch } from "@headlessui/react";
import { Tournament, TournamentGame } from "../../client/client-db/tournaments/tournament";
import { useSessionStorage } from "usehooks-ts";
import { classNames } from "../../common/class-names";
import { useTennisParams } from "../../hooks/use-tennis-params";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { bracketLayerIndexToTournamentRound } from "../leaderboard/tournament-pending-games";
import { ProfilePicture } from "../player/profile-picture";
import { getGameKeyFromPlayers } from "./tournament-page";
import { Link, useNavigate } from "react-router-dom";

export const TournamentBracket = ({
  tournament,
  itemRefs,
}: {
  tournament: Tournament;
  itemRefs: React.MutableRefObject<{
    [key: string]: HTMLElement | null;
  }>;
}) => {
  const [showAsList, setShowAsList] = useSessionStorage(
    `show-tournament-as-list${tournament.id}`,
    window.innerWidth < 1_000,
  );

  // Check if group play is in progress
  const isGroupPlayIncomplete =
    tournament.tournamentConfig.groupPlay && tournament.groupPlay && tournament.groupPlay.groupPlayEnded === undefined;

  if (isGroupPlayIncomplete) {
    return (
      <div className="mx-4 md:mx-10 mt-6">
        <div className="max-w-2xl mx-auto bg-secondary-background rounded-lg p-6">
          <h3 className="text-lg font-semibold text-secondary-text mb-2">Group Play in Progress</h3>
          <p className="text-sm text-secondary-text">
            The bracket finals will be available once all group play matches have been completed.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <TreeListToggle showAsList={showAsList} setShowAsList={setShowAsList} />
      <GrandFinalLinkCard tournament={tournament} itemRefs={itemRefs} fromSection="winners" />
      {showAsList ? (
        <GamesList tournament={tournament} itemRefs={itemRefs} />
      ) : (
        <div className="w-fit m-auto bg-primary-background rounded-lg p-4 ">
          <GameTriangle tournament={tournament} layerIndex={0} gameIndex={0} itemRefs={itemRefs} />
        </div>
      )}
    </div>
  );
};

/**
 * Double elimination only: a card at the top of each bracket tab showing the final like a
 * normal game, so it is clear where the bracket's champion goes next. Clicking it opens the
 * Final tab.
 */
export const GrandFinalLinkCard = ({
  tournament,
  itemRefs,
  fromSection,
}: {
  tournament: Tournament;
  itemRefs: React.MutableRefObject<{
    [key: string]: HTMLElement | null;
  }>;
  fromSection: "winners" | "second-chance";
}) => {
  const grandFinal = tournament.bracket?.grandFinal;
  if (!grandFinal) return null;

  const championLabel =
    fromSection === "winners" ? "the first chance champion" : "the second chance champion";

  return (
    <div className="w-96 max-w-full mx-auto space-y-1">
      <h3 className="text-center text-sm text-primary-text">Final</h3>
      <TournamentGameListCard
        tournament={tournament}
        game={grandFinal}
        itemRefs={itemRefs}
        fallbackKey={`GRAND-FINAL-LINK-${fromSection}`}
        useFallbackKey
        linkTo={`/tournament?tournament=${tournament.id}&tab=grand-final`}
      />
      <p className="text-center text-xs font-light text-primary-text/60">
        The winner of this bracket plays the final as {championLabel}. Click the card to open it.
      </p>
    </div>
  );
};

export const TreeListToggle = ({
  showAsList,
  setShowAsList,
}: {
  showAsList: boolean;
  setShowAsList: (value: boolean) => void;
}) => {
  return (
    <Switch
      checked={showAsList}
      onChange={setShowAsList}
      className="group relative flex h-10 w-36 cursor-pointer rounded-full bg-secondary-background p-1 transition-colors duration-200 ease-in-out focus:outline-none data-[focus]:outline-1 data-[focus]:outline-white"
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
  );
};

type GamesListProps = {
  tournament: Tournament;
  itemRefs: React.MutableRefObject<{
    [key: string]: HTMLElement | null;
  }>;
};
const GamesList: React.FC<GamesListProps> = ({ tournament, itemRefs }) => {
  return (
    <div className="flex flex-col items-center lg:flex-row-reverse lg:justify-end lg:items-start gap-2 bg-primary-background rounded-lg py-4">
      {tournament.bracket &&
        tournament.bracket.bracket.map((layer, layerIndex) => (
          <div key={layerIndex} className="flex flex-col gap-1 w-full min-w-[22rem] max-w-[27rem]">
            <h3 className="text-center text-sm text-primary-text">
              {bracketLayerIndexToTournamentRound(layerIndex, tournament.bracket!.doubleElimination)}
            </h3>
            {layer.map((game, gameIndex) => {
              // Skip empty qualifier games
              if (layerIndex === tournament.bracket!.bracket.length - 1 && !game.player1 && !game.player2) return null;
              const fallbackKey = "L" + layerIndex + "G+" + gameIndex;
              return (
                <TournamentGameListCard
                  key={game.player1 && game.player2 ? getGameKeyFromPlayers(game.player1, game.player2, "bracket") : fallbackKey}
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
  );
};

type TournamentGameListCardProps = {
  tournament: Tournament;
  game: Partial<TournamentGame>;
  itemRefs: React.MutableRefObject<{
    [key: string]: HTMLElement | null;
  }>;
  /** Key used for scroll-to registration when both players are not known yet */
  fallbackKey: string;
  /** "lg" renders a bigger, more substantial card (used for the grand final) */
  size?: "md" | "lg";
  /**
   * Register under fallbackKey even when both players are known. Used when another card with the
   * same player pair on the same screen should own the players-based scroll/highlight key
   * (the grand final and the bracket reset always share a pair)
   */
  useFallbackKey?: boolean;
  /** Render as a faded, non-interactive preview of a game that may happen */
  ghost?: boolean;
  /**
   * Navigate here when the card is clicked, instead of opening the game menu. Used for cards
   * that represent a game living on another tab (the grand final card at the top of a bracket)
   */
  linkTo?: string;
};
export const TournamentGameListCard: React.FC<TournamentGameListCardProps> = ({
  tournament,
  game,
  itemRefs,
  fallbackKey,
  size = "md",
  useFallbackKey = false,
  ghost = false,
  linkTo,
}) => {
  const context = useEventDbContext();
  const navigate = useNavigate();
  const { player1, player2 } = useTennisParams();

  const isLarge = size === "lg";
  // A walkover holds a single player who advances with no opponent (see GameTriangle): shown on
  // the left with a "bye" on the right, regardless of the player's underlying role
  const isWalkover = !!game.walkover;
  const walkoverPlayer = isWalkover ? game.player1 ?? game.player2 : undefined;

  // For empty slots, name who could still arrive once the deciding game is set
  const player1Candidates =
    !ghost && !isWalkover && !game.player1
      ? tournament.bracket?.getSlotFillCandidates(game, "player1")
      : undefined;
  const player2Candidates =
    !ghost && !isWalkover && !game.player2
      ? tournament.bracket?.getSlotFillCandidates(game, "player2")
      : undefined;
  const walkoverCandidates =
    !ghost && isWalkover && !walkoverPlayer
      ? tournament.bracket?.getSlotFillCandidates(game, "player1") ??
        tournament.bracket?.getSlotFillCandidates(game, "player2")
      : undefined;

  const rawStates = getGameStates(tournament, game);
  const { isPending, p1IsWinner, p2IsWinner, p1IsLoser, p2IsLoser, showMenu, ...states } = ghost
    ? {
        ...rawStates,
        isPending: false,
        showMenu: false,
        showCompareOption: false,
        showRegisterResultOption: false,
        showSkipGameOption: false,
        showUndoSkipOption: false,
      }
    : rawStates;

  const gameKey =
    !ghost && !useFallbackKey && game.player1 && game.player2
      ? getGameKeyFromPlayers(game.player1, game.player2, "bracket")
      : fallbackKey;

  const isParamSelectedGame = !ghost && gameKey === getGameKeyFromPlayers(player1, player2, "bracket");

  const cardClassName = classNames(
    "relative w-full rounded-lg flex items-center gap-x-4 text-secondary-text",
    isLarge ? "px-5 py-4 h-24 rounded-xl" : "px-4 py-2 h-12",
    isPending ? "bg-secondary-background ring-2 ring-secondary-text" : "bg-secondary-background/60",
    isWalkover && "border border-dashed border-secondary-text/40",
    (showMenu || linkTo) && "hover:bg-secondary-background/70",
    linkTo && "cursor-pointer",
    isParamSelectedGame && "animate-wiggle",
    ghost && "opacity-50 select-none pointer-events-none",
  );

  // Rendered inside a MenuButton when the game has a menu, otherwise a plain div so the
  // CandidateHint deep-links stay clickable (a disabled button swallows their clicks)
  const cardBody = (
    <>
      <h2
            className={classNames(
              "absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2",
              isLarge && "text-xl font-bold italic",
            )}
          >
            {isWalkover ? <span className="text-xs font-thin italic">advances</span> : "VS"}
          </h2>
          <div className="flex gap-3 items-center justify-center">
            {isWalkover ? (
              walkoverPlayer ? (
                <ProfilePicture
                  playerId={walkoverPlayer}
                  size={isLarge ? 60 : 35}
                  shape="circle"
                  clickToEdit={false}
                  border={isLarge ? 4 : 3}
                />
              ) : (
                <QuestionMark size={isLarge ? 64 : 38} />
              )
            ) : game.player1 ? (
              <ProfilePicture
                playerId={game.player1}
                size={isLarge ? 60 : 35}
                shape="circle"
                clickToEdit={false}
                border={isLarge ? 4 : 3}
              />
            ) : (
              <QuestionMark size={isLarge ? 64 : 38} />
            )}
            {(isWalkover ? !walkoverPlayer && walkoverCandidates : !game.player1 && player1Candidates) ? (
              <CandidateHint
                candidates={(isWalkover ? walkoverCandidates : player1Candidates)!}
                tournamentId={tournament.id}
                align="left"
              />
            ) : (
              <h3
                className={classNames(
                  isLarge && "text-xl md:text-2xl font-semibold",
                  !isWalkover && p1IsWinner && "font-semibold",
                  !isWalkover && p1IsLoser && "line-through font-thin",
                )}
              >
                {isWalkover
                  ? walkoverPlayer && context.playerName(walkoverPlayer)
                  : game.player1 && context.playerName(game.player1)}{" "}
                {!isWalkover && game.player1 && winStateEmoji(p1IsWinner, game.skipped)}
              </h3>
            )}
          </div>
          <div className="grow" />
          <div className="flex gap-3 items-center justify-center">
            {!isWalkover && !game.player2 && player2Candidates ? (
              <CandidateHint candidates={player2Candidates} tournamentId={tournament.id} align="right" />
            ) : (
              <h3
                className={classNames(
                  isLarge && "text-xl md:text-2xl font-semibold",
                  isWalkover && "italic opacity-60",
                  !isWalkover && p2IsWinner && "font-semibold",
                  !isWalkover && p2IsLoser && "line-through font-thin",
                )}
              >
                {!isWalkover && game.player2 && winStateEmoji(p2IsWinner, game.skipped)}{" "}
                {isWalkover ? "bye" : game.player2 && context.playerName(game.player2)}
              </h3>
            )}
            {isWalkover ? (
              <ByeAvatar size={isLarge ? 64 : 38} />
            ) : game.player2 ? (
              <ProfilePicture
                playerId={game.player2}
                size={isLarge ? 60 : 35}
                shape="circle"
                clickToEdit={false}
                border={isLarge ? 4 : 3}
              />
            ) : (
              <QuestionMark size={isLarge ? 64 : 38} />
            )}
          </div>
    </>
  );

  if (linkTo) {
    // The whole card navigates (e.g. to the Final tab). A div with onClick rather than a
    // Link, so the nested CandidateHint links stay valid and clickable
    return (
      <div
        ref={(el) => {
          if (!ghost) itemRefs.current[gameKey] = el;
        }}
        role="link"
        title="Open the final"
        onClick={() => navigate(linkTo)}
        className={cardClassName}
      >
        {cardBody}
      </div>
    );
  }

  return showMenu ? (
    <Menu
      ref={(el) => {
        if (!ghost) itemRefs.current[gameKey] = el;
      }}
    >
      <div>
        <MenuButton className={cardClassName}>{cardBody}</MenuButton>
        <GameMenuItems
          player1={game.player1}
          player2={game.player2}
          showCompare={states.showCompareOption}
          showRegisterResult={states.showRegisterResultOption}
          showSkipGame={{ show: states.showSkipGameOption, tournamentId: tournament.id }}
          showUndoSkip={{
            show: states.showUndoSkipOption,
            skipId: game.skipped?.skipId || "",
            tournamentId: tournament.id,
          }}
        />
      </div>
    </Menu>
  ) : (
    <div
      ref={(el) => {
        if (!ghost) itemRefs.current[gameKey] = el;
      }}
      className={cardClassName}
    >
      {cardBody}
    </div>
  );
};

type Size = "lg" | "md" | "sm" | "xs" | "xxs";

type GameTriangleProps = {
  tournament: Tournament;
  layerIndex: number;
  gameIndex: number;
  itemRefs: React.MutableRefObject<{
    [key: string]: HTMLElement | null;
  }>;
  /** Which bracket to render from. Defaults to the winners bracket */
  section?: "winners" | "losers";
  /** Visual depth used for sizing. Defaults to layerIndex (correct for the winners bracket) */
  depth?: number;
};
export const GameTriangle: React.FC<GameTriangleProps> = ({
  tournament,
  layerIndex,
  gameIndex,
  itemRefs,
  section = "winners",
  depth,
}) => {
  const context = useEventDbContext();
  const { player1, player2 } = useTennisParams();

  const visualDepth = depth ?? layerIndex;
  let size: Size = "xxs";
  switch (visualDepth) {
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

  const layers = section === "losers" ? tournament.bracket.losersBracket : tournament.bracket.bracket;
  if (!layers) return null;

  const game = layers[layerIndex]?.[gameIndex];

  // Empty deepest-layer games are structural byes only in the winners bracket; in the losers
  // bracket the deepest layer holds real games that are simply waiting for their players
  const isEmptyQualifier =
    section === "winners" && layerIndex === layers.length - 1 && !game?.player1 && !game?.player2;
  if (!game || game.isBye || isEmptyQualifier) {
    return size === "xs" || size === "xxs" ? null : <div className="grow" />;
  }

  const { isPending, p1IsWinner, p2IsWinner, p1IsLoser, p2IsLoser, showMenu, ...states } = getGameStates(
    tournament,
    game,
  );
  // A walkover holds a single player who advances with no opponent. Rendered like a normal game
  // card (so it lines up with its neighbours) but with the lone player on the left, a "bye" in
  // the right slot, and no trophy. The player may occupy either underlying role
  const isWalkover = !!game.walkover;
  const walkoverPlayer = isWalkover ? game.player1 ?? game.player2 : undefined;

  // For empty slots, name the two players who could still arrive once the game that decides the
  // slot has both its participants (e.g. "John or Jane"), so the "?" is easier to follow
  const player1Candidates =
    !isWalkover && !game.player1 ? tournament.bracket.getSlotFillCandidates(game, "player1") : undefined;
  const player2Candidates =
    !isWalkover && !game.player2 ? tournament.bracket.getSlotFillCandidates(game, "player2") : undefined;
  const walkoverCandidates =
    isWalkover && !walkoverPlayer
      ? tournament.bracket.getSlotFillCandidates(game, "player1") ??
        tournament.bracket.getSlotFillCandidates(game, "player2")
      : undefined;

  const gameKey =
    game.player1 && game.player2
      ? getGameKeyFromPlayers(game.player1, game.player2, "bracket")
      : "L" + layerIndex + "G+" + gameIndex;

  const isParamSelectedGame = gameKey === getGameKeyFromPlayers(player1, player2, "bracket");

  const cardClassName = classNames(
    wrapperStyles[size],
    "rounded-lg mx-auto text-secondary-text",
    game.winner || game.skipped || !isPending ? "bg-secondary-background/60" : "bg-secondary-background",
    isPending && "bg-secondary-background ring-2 ring-secondary-text",
    isWalkover && "border border-dashed border-secondary-text/40",
    showMenu && "hover:bg-secondary-background/70",
    isParamSelectedGame && "animate-wiggle",
  );

  // The card content. Rendered inside a MenuButton when the game has a menu (both players known),
  // otherwise inside a plain div so the CandidateHint deep-links stay clickable (a disabled button
  // would swallow their clicks)
  const cardBody = (
    <>
      <div
        className={classNames("flex", playerWrapperStyles[size], size === "lg" ? "items-center" : "items-start")}
      >
              {isWalkover ? (
                walkoverPlayer ? (
                  <ProfilePicture
                    playerId={walkoverPlayer}
                    border={playerPictureBorder[size]}
                    shape="circle"
                    size={playerPictureSize[size]}
                  />
                ) : (
                  <QuestionMark size={playerPictureSize[size] + playerPictureBorder[size]} />
                )
              ) : game.player1 ? (
                <ProfilePicture
                  playerId={game.player1}
                  border={playerPictureBorder[size]}
                  shape="circle"
                  size={playerPictureSize[size]}
                />
              ) : (
                <QuestionMark size={playerPictureSize[size] + playerPictureBorder[size]} />
              )}
              {(isWalkover ? !walkoverPlayer && walkoverCandidates : !game.player1 && player1Candidates) ? (
                <CandidateHint
                candidates={(isWalkover ? walkoverCandidates : player1Candidates)!}
                tournamentId={tournament.id}
                align="left"
              />
              ) : (
                <div
                  className={classNames(
                    "whitespace-nowrap",
                    playerTextStyles[size],
                    !isWalkover && p1IsWinner && "font-semibold",
                    !isWalkover && p1IsLoser && "line-through font-thin",
                  )}
                >
                  {isWalkover
                    ? walkoverPlayer && context.playerName(walkoverPlayer)
                    : game.player1 && context.playerName(game.player1)}{" "}
                  {!isWalkover && game.player1 && winStateEmoji(p1IsWinner, game.skipped)}
                </div>
              )}
            </div>
            {size !== "xxs" && (
              <div className="w-full text-center font-thin italic text-xs">{isWalkover ? "advances" : "vs"}</div>
            )}
            <div
              className={classNames("flex", playerWrapperStyles[size], size === "lg" ? "items-center" : "items-end")}
            >
              <div className="grow" />
              {!isWalkover && !game.player2 && player2Candidates ? (
                <CandidateHint candidates={player2Candidates} tournamentId={tournament.id} align="right" />
              ) : (
                <div
                  className={classNames(
                    "whitespace-nowrap",
                    playerTextStyles[size],
                    isWalkover && "italic opacity-60",
                    !isWalkover && p2IsWinner && "font-semibold",
                    !isWalkover && p2IsLoser && "line-through font-thin",
                  )}
                >
                  {!isWalkover && game.player2 && winStateEmoji(p2IsWinner, game.skipped)}{" "}
                  {isWalkover ? "bye" : game.player2 && context.playerName(game.player2)}
                </div>
              )}
              {isWalkover ? (
                <ByeAvatar size={playerPictureSize[size] + playerPictureBorder[size]} />
              ) : game.player2 ? (
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
    </>
  );

  return (
    <div className="w-fit space-y-2">
      {section === "winners" && visualDepth < 3 ? (
        <h2 className="font-light text-sm text-center text-primary-text">
          {bracketLayerIndexToTournamentRound(layerIndex, tournament.bracket.doubleElimination)}
        </h2>
      ) : (
        <div className="h-0" />
      )}
      {showMenu ? (
        <Menu key={gameKey} ref={(el) => (itemRefs.current[gameKey] = el)}>
          <div className="w-full flex">
            <MenuButton className={cardClassName}>{cardBody}</MenuButton>
            <GameMenuItems
              player1={game.player1}
              player2={game.player2}
              showCompare={states.showCompareOption}
              showRegisterResult={states.showRegisterResultOption}
              showSkipGame={{ show: states.showSkipGameOption, tournamentId: tournament.id }}
              showUndoSkip={{
                show: states.showUndoSkipOption,
                skipId: game.skipped?.skipId || "",
                tournamentId: tournament.id,
              }}
            />
          </div>
        </Menu>
      ) : (
        <div ref={(el) => (itemRefs.current[gameKey] = el)} className="w-full flex">
          <div className={cardClassName}>{cardBody}</div>
        </div>
      )}

      {section === "winners" && layerIndex < layers.length && (
        <div className="flex gap-2">
          <GameTriangle
            tournament={tournament}
            layerIndex={layerIndex + 1}
            gameIndex={gameIndex * 2}
            itemRefs={itemRefs}
          />
          <GameTriangle
            tournament={tournament}
            layerIndex={layerIndex + 1}
            gameIndex={gameIndex * 2 + 1}
            itemRefs={itemRefs}
          />
        </div>
      )}
    </div>
  );
};

export function getGameStates(tournament: Tournament, game: Partial<TournamentGame>) {
  const isPending = !!game.player1 && !!game.player2 && !game.winner && !game.skipped;

  const p1IsWinner = !!game.winner && game.winner === game.player1;
  const p2IsWinner = !!game.winner && game.winner === game.player2;

  const p1IsLoser = !!game.winner && game.winner === game.player2;
  const p2IsLoser = !!game.winner && game.winner === game.player1;

  const showCompareOption = !!game.player1 && !!game.player2;
  const showRegisterResultOption =
    !!game.player1 && !!game.player2 && game.winner === undefined && game.skipped === undefined;
  const showSkipGameOption =
    !!game.player1 && !!game.player2 && game.winner === undefined && game.skipped === undefined;
  // A skip can only be undone while none of the games downstream of this one have been completed.
  // Walkover slots auto-complete the moment their lone player arrives but are not real games, so
  // look through them to the first real downstream game.
  const bracket = tournament.bracket;
  const resolveDownstream = (target?: TournamentGame["advanceTo"]) => {
    let downstream = target ? bracket?.getGame(target) : undefined;
    while (downstream?.walkover && downstream.advanceTo) {
      downstream = bracket?.getGame(downstream.advanceTo);
    }
    return downstream;
  };
  const advanceToGame = resolveDownstream(game.advanceTo);
  const loserAdvanceToGame = resolveDownstream(game.loserAdvanceTo);
  const grandFinalFollowUpGame = game.section === "grandFinal" ? bracket?.bracketReset : undefined;
  const downstreamGameCompleted = [advanceToGame, loserAdvanceToGame, grandFinalFollowUpGame].some(
    (downstream) => downstream !== undefined && (downstream.winner !== undefined || downstream.skipped !== undefined),
  );
  const showUndoSkipOption = !!game.skipped && downstreamGameCompleted === false;

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

export function winStateEmoji(winner?: boolean, skipped?: any) {
  if (winner) {
    return !!skipped ? "🆓" : "🏆";
  }
}

type GameMenuItemsProps = {
  player1?: string;
  player2?: string;
  showCompare: boolean;
  showRegisterResult: boolean;
  showSkipGame: { show: boolean; tournamentId: string };
  showUndoSkip: { show: boolean; tournamentId: string; skipId: string };
};
export const GameMenuItems: React.FC<GameMenuItemsProps> = (props) => {
  return (
    <MenuItems
      anchor="bottom"
      className="flex flex-col gap-0 rounded-lg bg-secondary-background ring-2 ring-secondary-text shadow-xl text-secondary-text"
    >
      {props.showRegisterResult && (
        <MenuItem>
          <Link
            to={`/add-game/?player1=${props.player1 || ""}&player2=${props.player2 || ""}`}
            className="w-full px-4 py-2 text-left data-[focus]:bg-secondary-text/30"
            onClick={() => console.log("Clicked link to add game")}
          >
            🏓 Add or track game
          </Link>
        </MenuItem>
      )}
      {props.showSkipGame.show && (
        <MenuItem>
          <Link
            to={`/tournament/skip-game/?player1=${props.player1 || ""}&player2=${props.player2 || ""}&tournament=${props.showSkipGame.tournamentId || ""
              }`}
            className="w-full px-4 py-2 text-left data-[focus]:bg-secondary-text/30"
          >
            🆓 Skip game
          </Link>
        </MenuItem>
      )}
      {props.showUndoSkip.show && (
        <MenuItem>
          <Link
            to={`/tournament/undo-skip/?player1=${props.player1 || ""}&player2=${props.player2 || ""}&skipId=${props.showUndoSkip.skipId || ""
              }&tournament=${props.showUndoSkip.tournamentId || ""}`}
            className="w-full px-4 py-2 text-left data-[focus]:bg-secondary-text/30"
          >
            ⏮️ Undo skip
          </Link>
        </MenuItem>
      )}
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

/**
 * Two-line hint naming who could still fill a "?" slot once the game that decides it is set:
 * line 1 is player A, line 2 is "or player B". Small and muted so it reads as a hint, not a result.
 * Clicking it deep-links to the deciding game (that pending A-vs-B match).
 */
export const CandidateHint: React.FC<{ candidates: [string, string]; tournamentId: string; align?: "left" | "right" }> = ({
  candidates,
  tournamentId,
  align = "left",
}) => {
  const context = useEventDbContext();
  const a = context.playerName(candidates[0]);
  const b = context.playerName(candidates[1]);
  return (
    <Link
      to={`?tournament=${tournamentId}&player1=${candidates[0]}&player2=${candidates[1]}`}
      onClick={(e) => e.stopPropagation()}
      title={`Go to ${a} vs ${b}`}
      className={classNames(
        "flex flex-col min-w-0 max-w-full italic font-light opacity-60 hover:opacity-100 hover:underline text-[0.65rem] leading-none gap-y-px",
        align === "right" ? "items-end text-right" : "items-start text-left",
      )}
    >
      <span className="truncate max-w-full">{a} or</span>
      <span className="truncate max-w-full">{b}</span>
    </Link>
  );
};

/** Placeholder shown in a walkover's empty opponent slot: a muted, dashed "no opponent" circle */
export const ByeAvatar: React.FC<{ size: number }> = ({ size }) => {
  size = size * 0.95;
  return (
    <div
      className="shrink-0 rounded-full border border-dashed border-secondary-text/40 bg-primary-background/40"
      style={{ height: size, width: size }}
    />
  );
};
