import { useEventDbContext } from "../../wrappers/event-db-context";
import { classNames } from "../../common/class-names";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useTennisParams } from "../../hooks/use-tennis-params";
import { TournamentSignup } from "./tournament-signup";
import { TournamentGroupPlayComponent } from "./tournament-group-play";
import { TournamentInfo } from "./tournament-into";
import { TournamentPredictions } from "./tournament-predictions";
import { TournamentBracket } from "./tournament-bracket";
import { TournamentLosersBracket } from "./tournament-losers-bracket";
import { TournamentGrandFinal } from "./tournament-grand-final";
import { TournamentAvailablePlayers } from "./tournament-available-players";
import { TournamentStats } from "./stats/tournament-stats";
import { session } from "../../services/auth/session";

type TabType =
  | "grand-final"
  | "finals"
  | "losers"
  | "group-play"
  | "signup"
  | "info"
  | "predictions"
  | "available"
  | "stats";

export const TournamentPage: React.FC = () => {
  const { tournament: tournamentId, player1, player2 } = useTennisParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const context = useEventDbContext();
  const tournament = context.tournaments.getTournament(tournamentId);
  const isAdmin = session.sessionData?.role === "admin";
  const isDoubleElimination = tournament?.tournamentConfig.doubleElimination === true;

  // Single source of tab visibility, shared by the tab bar and the default-tab fallback
  const bracketVisible = tournament?.bracket !== undefined;
  const tabs: { id: TabType; label: string; visible: boolean }[] = [
    ...(isDoubleElimination
      ? ([
          { id: "grand-final", label: "Grand Final", visible: bracketVisible },
          { id: "finals", label: "Winners bracket", visible: bracketVisible },
          { id: "losers", label: "Losers bracket", visible: bracketVisible },
        ] as { id: TabType; label: string; visible: boolean }[])
      : [{ id: "finals" as TabType, label: "Finals", visible: bracketVisible }]),
    { id: "group-play", label: "Group play", visible: tournament?.groupPlay !== undefined },
    { id: "signup", label: "Signup", visible: tournament?.inSignupPeriod === true },
    { id: "info", label: "Info", visible: true },
    {
      id: "predictions",
      label: "Predictions",
      visible: tournament !== undefined && tournament.startDate < Date.now(),
    },
    { id: "available", label: "Available today", visible: isAdmin && tournament?.hasPendingGames === true },
    { id: "stats", label: "Stats", visible: isAdmin },
  ];
  const visibleTabs = tabs.filter((t) => t.visible);
  const isVisibleTab = (id: string | null | undefined): id is TabType => visibleTabs.some((t) => t.id === id);

  const defaultTab = (): TabType => {
    const candidate = ((): TabType => {
      if (!tournament) return "info";
      if (tournament.inSignupPeriod) return "signup";
      if (tournament.groupPlay && tournament.groupPlay.groupPlayEnded === undefined)
        return "group-play";
      if (tournament.bracket !== undefined) {
        if (isDoubleElimination) {
          // When arriving via a game link (pending, or just registered), open the tab the game is in
          if (player1 && player2) {
            const game = tournament.bracket.findGameByPlayers(player1, player2);
            if (game?.section === "losers") return "losers";
            if (game?.section === "grandFinal" || game?.section === "bracketReset") {
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
    })();
    return isVisibleTab(candidate) ? candidate : visibleTabs[0]?.id ?? "info";
  };
  // Resolve the fallback tab once per navigation target, not on every render — otherwise live
  // data updates (e.g. a game registered on another device) would switch the tab under the user
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialTab = useMemo(defaultTab, [tournamentId, player1, player2]);

  // The active tab lives in the url so it survives reloads and can be shared
  const tabParam = searchParams.get("tab");
  const activeTab: TabType = isVisibleTab(tabParam)
    ? tabParam
    : isVisibleTab(initialTab)
      ? initialTab
      : visibleTabs[0]?.id ?? "info";
  const setActiveTab = (tab: TabType) => {
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous);
        params.set("tab", tab);
        return params;
      },
      { replace: true },
    );
  };

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
        {visibleTabs.map((tab) => {
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
      {activeTab === "stats" && <TournamentStats tournament={tournament} />}
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
