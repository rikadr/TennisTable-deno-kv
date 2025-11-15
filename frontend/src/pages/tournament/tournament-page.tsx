import { useEventDbContext } from "../../wrappers/event-db-context";
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
      {activeTab === "group-play" && <TournamentGroupPlayComponent tournament={tournament} itemRefs={itemRefs} />}
      {activeTab === "info" && <TournamentInfo tournament={tournament} />}
      {activeTab === "signup" && <TournamentSignup tournament={tournament} />}
      {activeTab === "predictions" && <TournamentPredictions tournament={tournament} />}
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
