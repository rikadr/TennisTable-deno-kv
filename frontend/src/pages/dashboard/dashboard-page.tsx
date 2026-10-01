import React from "react";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { classNames } from "../../common/class-names";
import { getClientConfig, Theme, themeOrOverrideTheme } from "../../client/client-config/get-client-config";
import easterBunny from "../../img/easter/easter-bunny-realistic.png";
import { useLocalStorage } from "../../hooks/use-local-storage";
import { useMediaQuery } from "../../hooks/use-media-query";
import { useLiveGameQuery } from "../live-game/use-live-game";
import { LiveGameCard } from "./live-game-card";
import { LiveDrawBanners } from "./live-draw-banner";
import { RecentHallOfFame } from "./recent-hall-of-fame";
import { TournamentHighlightsAndPendingGames } from "./tournament-pending-games";
import { LeaderboardCard } from "./leaderboard-card";
import { UnrankedPlayersCard } from "./unranked-players-card";
import { RecentGames } from "./recent-games";
import { RecentLeaderBoardChanges } from "./recent-leaderboard-changes";
import { RecentAchievements } from "./recent-achievements";
import { dashboardSeasonState, LeaderboardView } from "./dashboard-season";

const LIVE_GAME_CARD_POLL_MS = 10_000;

type Widget = "now" | "leaderboard" | "unranked" | "games" | "changes" | "achievements";

/**
 * The widgets of each column, per number of columns. The leaderboard keeps the
 * first column at every width, so it does not move when other widgets show or hide.
 */
const LAYOUTS: Record<1 | 2 | 3 | 4, Widget[][]> = {
  1: [["now", "leaderboard", "games", "changes", "achievements", "unranked"]],
  2: [
    ["leaderboard", "unranked"],
    ["now", "games", "changes", "achievements"],
  ],
  3: [["leaderboard"], ["now", "games", "achievements"], ["changes", "unranked"]],
  // A column with no content hides, so the "now" column shows only when something happens
  4: [["leaderboard"], ["now"], ["games", "changes"], ["achievements", "unranked"]],
};

function useColumnCount(): 1 | 2 | 3 | 4 {
  const md = useMediaQuery("(min-width: 768px)");
  const xl = useMediaQuery("(min-width: 1280px)");
  const wide = useMediaQuery("(min-width: 1720px)");
  if (wide) return 4;
  if (xl) return 3;
  if (md) return 2;
  return 1;
}

export const DashboardPage: React.FC = () => {
  const context = useEventDbContext();
  // The card shows the score of a game in progress. A slow fallback poll keeps
  // it current if the WebSocket broadcast does not arrive.
  const liveGameQuery = useLiveGameQuery({ refetchIntervalMs: LIVE_GAME_CARD_POLL_MS });
  const [viewString, setViewString] = useLocalStorage("leaderboard_view", "overall");
  const view: LeaderboardView = viewString === "season" ? "season" : "overall";
  const season = dashboardSeasonState(context, Date.now());
  // The game and change lists show season data only while a season has games
  const activityView: LeaderboardView = view === "season" && season.currentSeason ? "season" : "overall";

  const columnCount = useColumnCount();
  const theme = themeOrOverrideTheme(getClientConfig().theme);

  const renderWidget = (widget: Widget) => {
    switch (widget) {
      case "now":
        // A fragment, not a wrapper: each card renders nothing when it has nothing to show,
        // and a column of only these cards must stay empty for `empty:hidden`
        return (
          <React.Fragment key={widget}>
            <LiveGameCard liveGameQuery={liveGameQuery} />
            <LiveDrawBanners />
            <RecentHallOfFame />
            <TournamentHighlightsAndPendingGames />
          </React.Fragment>
        );
      case "leaderboard":
        return (
          <React.Fragment key={widget}>
            <LeaderboardCard view={view} setView={setViewString} season={season} />
            {theme === Theme.EASTER && <img src={easterBunny} alt="Easter bunny chick" />}
          </React.Fragment>
        );
      case "unranked":
        return <UnrankedPlayersCard key={widget} view={view} season={season} />;
      case "games":
        return <RecentGames key={widget} view={activityView} count={columnCount === 1 ? 6 : 8} />;
      case "changes":
        return <RecentLeaderBoardChanges key={widget} view={activityView} />;
      case "achievements":
        return <RecentAchievements key={widget} count={columnCount === 1 ? 5 : 8} />;
    }
  };

  return (
    <div className="w-full px-3 xs:px-4 lg:px-6 flex justify-center items-start gap-4 xl:gap-5">
      {LAYOUTS[columnCount].map((widgets, index) => (
        <div
          key={index}
          className={classNames(
            "flex flex-col gap-4 xl:gap-5 empty:hidden",
            columnCount === 1 ? "w-full max-w-xl" : "flex-1 min-w-0 max-w-[540px]",
          )}
        >
          {widgets.map(renderWidget)}
        </div>
      ))}
    </div>
  );
};
