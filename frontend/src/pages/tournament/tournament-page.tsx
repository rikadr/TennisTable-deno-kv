import { useEventDbContext } from "../../wrappers/event-db-context";
import { classNames } from "../../common/class-names";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTennisParams } from "../../hooks/use-tennis-params";
import { TournamentSignup } from "./tournament-signup";
import { TournamentGroupPlayComponent } from "./tournament-group-play";
import { TournamentInfo } from "./tournament-into";
import { TournamentPredictions } from "./tournament-predictions";
import { TournamentBracket } from "./tournament-bracket";
import { TournamentLosersBracket } from "./tournament-losers-bracket";
import { TournamentGrandFinal } from "./tournament-grand-final";
import { TournamentAvailablePlayers } from "./tournament-available-players";
import { session } from "../../services/auth/session";

type TabType = "grand-final" | "finals" | "losers" | "group-play" | "signup" | "info" | "predictions" | "available";

export const TournamentPage: React.FC = () => {
  const { tournament: tournamentId, player1, player2 } = useTennisParams();
  const context = useEventDbContext();
  const tournament = context.tournaments.getTournament(tournamentId);
  const isAdmin = session.sessionData?.role === "admin";
  const isDoubleElimination = tournament?.tournamentConfig.doubleElimination === true;

  const tabs: { id: TabType; label: string }[] = [
    ...(isDoubleElimination
      ? ([
          { id: "grand-final", label: "Grand Final" },
          { id: "finals", label: "Winners bracket" },
          { id: "losers", label: "Losers bracket" },
        ] as { id: TabType; label: string }[])
      : [{ id: "finals" as TabType, label: "Finals" }]),
    { id: "group-play", label: "Group play" },
    { id: "signup", label: "Signup" },
    { id: "info", label: "Info" },
    { id: "predictions", label: "Predictions" },
    { id: "available", label: "Available today" },
  ];

  const defaultTab = (): TabType => {
    if (!tournament) return "info";
    if (tournament.inSignupPeriod) return "signup";
    if (tournament.groupPlay && tournament.groupPlay.groupPlayEnded === undefined)
      return "group-play";
    if (tournament.bracket !== undefined) {
      if (isDoubleElimination) {
        // When arriving via a pending game link, open the tab the game is in
        if (player1 && player2) {
          const pendingGame = tournament.findPendingGame(player1, player2);
          if (pendingGame?.bracketSection === "losers") return "losers";
          if (pendingGame?.bracketSection === "grandFinal" || pendingGame?.bracketSection === "bracketReset") {
            return "grand-final";
          }
          return "finals";
        }
        const grandFinalReady =
          (tournament.bracket.grandFinalGames?.pending.length ?? 0) > 0 || tournament.winner !== undefined;
        return grandFinalReady ? "grand-final" : "finals";
      }
      return "finals";
    }
    return "info";
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
              case "finals":
              case "losers":
              case "grand-final":
                return tournament.bracket !== undefined;
              case "group-play":
                return tournament.groupPlay !== undefined;
              case "signup":
                return tournament.inSignupPeriod;
              case "predictions":
                return tournament.startDate < Date.now();
              case "available":
                return isAdmin && tournament.hasPendingGames;
              default:
                return true;
            }
          })
          .map((tab) => {
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={classNames(
                  "flex items-center py-2 px-4 border-b-4 font-medium text-sm transition-colors",
                  activeTab === tab.id
                    ? "text-primary-text border-primary-text"
                    : "text-primary-text/80 border-transparent hover:text-primary-text hover:border-primary-text border-dotted",
                )}
              >
                {tab.label}
              </button>
            );
          })}
      </div>
      {activeTab === "grand-final" && <TournamentGrandFinal tournament={tournament} itemRefs={itemRefs} />}
      {activeTab === "finals" && <TournamentBracket tournament={tournament} itemRefs={itemRefs} />}
      {activeTab === "losers" && <TournamentLosersBracket tournament={tournament} itemRefs={itemRefs} />}
      {activeTab === "group-play" && <TournamentGroupPlayComponent tournament={tournament} itemRefs={itemRefs} />}
      {activeTab === "info" && <TournamentInfo tournament={tournament} />}
      {activeTab === "signup" && <TournamentSignup tournament={tournament} />}
      {activeTab === "predictions" && <TournamentPredictions tournament={tournament} />}
      {activeTab === "available" && <TournamentAvailablePlayers tournament={tournament} />}
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
