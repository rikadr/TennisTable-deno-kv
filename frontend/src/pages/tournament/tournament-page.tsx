import { classNames } from "../../common/class-names";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { MenuItem, MenuItems } from "@headlessui/react";
import { Link } from "react-router-dom";
import { useRerender } from "../../hooks/use-rerender";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTennisParams } from "../../hooks/use-tennis-params";
import { TournamentSignup } from "./tournament-signup";
import { TournamentGroupPlayComponent } from "./tournament-group-play";
import { TournamentInfo } from "./tournament-into";
import { TournamentPredictions } from "./tournament-predictions";
import { TournamentBracket } from "./tournament-bracket";

type TabType = "finals" | "group-play" | "signup" | "info" | "predictions";
const tabs: { id: TabType; label: string }[] = [
  { id: "finals", label: "Finals" },
  { id: "group-play", label: "Group play" },
  { id: "signup", label: "Signup" },
  { id: "info", label: "Info" },
  { id: "predictions", label: "Predictions" },
];

export const TournamentPage: React.FC = () => {
  const { tournament: tournamentId, player1, player2 } = useTennisParams();
  const rerender = useRerender();
  const context = useEventDbContext();
  const tournament = context.tournaments.getTournament(tournamentId);
  const defaultTab = (): TabType => {
    if (!tournament) return "info";
    if (tournament.inSignupPeriod) return "signup";
    if (tournament.tournamentDb.groupPlay && tournament.groupPlay && tournament.groupPlay.groupPlayEnded === undefined)
      return "group-play";
    return "finals";
  };
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);

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
  }, [scrollToGame]);

  if (!tournament) return <div>No tournament selected</div>;

  return (
    <div className="space-y-4 mx-1 sm:mx-2 md:mx-6">
      <div className="flex space-x-2 overflow-auto">
        {tabs
          .filter((t) => {
            switch (t.id) {
              case "group-play":
                return tournament.tournamentDb.groupPlay;
              case "signup":
                return tournament.inSignupPeriod;
              case "predictions":
                return tournament.startDate < Date.now();
              default:
                return true;
            }
          })
          .map((tab) => {
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                    flex items-center py-2 px-4 border-b-4 font-medium text-sm transition-colors
                    ${
                      activeTab === tab.id
                        ? "text-secondary-text border-secondary-text"
                        : "text-secondary-text/80 border-transparent hover:text-secondary-text hover:border-secondary-text border-dotted"
                    }
                  `}
              >
                {tab.label}
              </button>
            );
          })}
      </div>
      {activeTab === "finals" && <TournamentBracket tournament={tournament} itemRefs={itemRefs} />}
      {activeTab === "info" && <TournamentInfo tournament={tournament} />}
      {activeTab === "signup" && <TournamentSignup tournament={tournament} />}
      {activeTab === "predictions" && <TournamentPredictions tournament={tournament} />}
      {tournament.startDate < new Date().getTime() && (
        <>
          <TournamentGroupPlayComponent tournament={tournament} rerender={rerender} itemRefs={itemRefs} />
        </>
      )}
    </div>
  );
};

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
          >
            🏓 Add or track game
          </Link>
        </MenuItem>
      )}
      {props.showSkipGame.show && (
        <MenuItem>
          <Link
            to={`/tournament/skip-game/?player1=${props.player1 || ""}&player2=${props.player2 || ""}&tournament=${
              props.showSkipGame.tournamentId || ""
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
            to={`/tournament/undo-skip/?player1=${props.player1 || ""}&player2=${props.player2 || ""}&skipId=${
              props.showUndoSkip.skipId || ""
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

export function getGameKeyFromPlayers(
  player1: string | undefined | null,
  player2: string | undefined | null,
  where: "group" | "bracket",
) {
  return `P1:${player1 ?? ""}:P2:${player2 ?? ""}:${where}`;
}
