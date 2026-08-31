import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./common/query-client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AddPlayerPage } from "./pages/add-player/add-player-page";
import { ComparePlayersPage } from "./pages/compare-players-page";
import { MyPage } from "./pages/my-page";
import { LoginPage } from "./pages/login";
import { AdminPage } from "./pages/admin/admin-page";
import { Analytics } from "@vercel/analytics/react";
import { session } from "./services/auth";
import { SignupPage } from "./pages/sign-up";
import { WebSocketRefetcher } from "./wrappers/web-socket-refetcher";
import { NavMenu } from "./wrappers/nav-menu";
import { PvPPage } from "./pages/pvp-page";
import { CameraPage } from "./pages/camera/camera-page";
import { LeaderBoard } from "./pages/leaderboard/leader-board";
import { SimulationsPage } from "./pages/simulations/simulations-page";
import { WinLoss } from "./pages/simulations/win-loss";
import { TournamentsListPage } from "./pages/tournament/tournaments-list-page";
import { TournamentPage } from "./pages/tournament/tournament-page";
import { getClientConfig } from "./client/client-config/get-client-config";
import Snowfall from "react-snowfall";
import { HelmetSetter } from "./wrappers/helmet";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "./wrappers/theme-provider";
import { SettingsPage } from "./pages/settings-page";
import { EventDbWrapper } from "./wrappers/event-db-context";
import { ImageKitContext } from "./wrappers/image-kit-context";
import { AddGamePageV2 } from "./pages/add-game/add-game-page";
import { EditGameSore } from "./pages/edit-game-score";
import { IndividualPointsOverview } from "./pages/simulations/individual-points/individual-points-overview";
import { IndividualPointsPlayer } from "./pages/simulations/individual-points/individual-points-player";
import { PlayerPage } from "./pages/player/player-page";
import { SimulatedLeaderboard } from "./pages/simulations/expected-leaderboard/expected-leaderboard-page";
import { SkillRatingPage } from "./pages/simulations/skill-rating/skill-rating-page";
import { OptioPongPage } from "./pages/simulations/optio-pong";
import { PlayerNetwork } from "./pages/player-network/player-network";
import { TrackGamePage } from "./pages/add-game/track-game";
import { ChooseAddOrTrack } from "./pages/add-game/choose-add-or-track";
import { AchievementsPage } from "./pages/achievements/achievements-page";
import { TournamentSkipGamePage } from "./pages/tournament/tournament-skip-game";
import { TournamentUndoSkipPage } from "./pages/tournament/tournament-undo-skip";
import { NewTournamentPage } from "./pages/tournament/new-tournament-page";
import { EditTournamentPage } from "./pages/tournament/edit-tournament-page";
import { SeasonsListPage } from "./pages/seasons/seasons-list-page";
import { SeasonPage } from "./pages/seasons/season-page";
import { SeasonPlayerPage } from "./pages/seasons/season-player-page";
import { RecentGamesPage } from "./pages/recent-games/recent-games-page";
import { HallOfFamePage } from "./pages/hall-of-fame/hall-of-fame-page";
import { HallOfFamePlayerPage } from "./pages/hall-of-fame/hall-of-fame-player-page";
import { HallOfFameLeaderboardPage } from "./pages/hall-of-fame/hall-of-fame-leaderboard-page";
import { LiveGamePage } from "./pages/live-game/live-game-page";
import { LiveGameAdminPage } from "./pages/live-game/live-game-admin-page";
import { LiveGameOverlay } from "./pages/live-game/live-game-overlay";
import { ChangelogPage } from "./pages/changelog/changelog-page";
import { ChangelogPostPage } from "./pages/changelog/changelog-post-page";
import { ComparePage } from "./pages/compare/compare-page";
import { OtherPage } from "./pages/other/other-page";
import { StatisticsPage } from "./pages/statistics/statistics-page";
import { WhatChangedPage } from "./pages/other/what-changed-page";
import { GameDetailsPage } from "./pages/game/game-details-page";
import { PerformancePage } from "./pages/performance/performance-page";
import { NotFoundPage } from "./pages/not-found-page";
import { NewVersionChecker } from "./wrappers/new-version-checker";
import { ToastProvider } from "./wrappers/toast-provider";

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (!session.isAuthenticated) {
    session.token = undefined;
    return <Navigate to="/log-in" />;
  }

  return children;
};

function App() {
  const clientConfig = getClientConfig();
  const client = queryClient;
  return (
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <Analytics />
        <ImageKitContext>
          <ThemeProvider>
            <ToastProvider>
              {clientConfig.snow && <Snowfall radius={[0.2, 1]} speed={[0.1, 0.3]} wind={[0, 1]} />}
              {/* flow-root keeps descendant bottom margins (the page wrapper's
              mb-24 in NavMenu) inside this div, so the themed background
              reaches the bottom of the document. Do not use overflow-auto
              for that: it would make this div the scroll container for
              position:sticky descendants (section headers on the player's
              achievement Progress tab) while the document does the
              scrolling, so they would never stick. */}
              <div className="flow-root min-h-screen w-full">
                <HelmetSetter />
                <NewVersionChecker />
                <EventDbWrapper>
                  <WebSocketRefetcher>
                    <BrowserRouter>
                      <Routes>
                        <Route path="/live-game/overlay" element={<LiveGameOverlay />} />
                        <Route path="/" element={<NavMenu />}>
                          <Route index element={<Navigate to="/leader-board" />} />
                          <Route path="/tennis-table" element={<Navigate to="/leader-board" />} />
                          <Route path="/leader-board" element={<LeaderBoard />} />
                          <Route path="/player/:name" element={<PlayerPage />} />
                          <Route path="/compare" element={<ComparePage />} />
                          <Route path="/1v1" element={<PvPPage />} />
                          <Route path="/compare-players" element={<ComparePlayersPage />} />
                          <Route path="/player-network" element={<PlayerNetwork />} />
                          <Route path="/tournament">
                            <Route index element={<TournamentPage />} />
                            <Route path="list" element={<TournamentsListPage />} />
                            <Route path="new" element={<NewTournamentPage />} />
                            <Route path="edit" element={<EditTournamentPage />} />
                            <Route path="skip-game" element={<TournamentSkipGamePage />} />
                            <Route path="undo-skip" element={<TournamentUndoSkipPage />} />
                          </Route>
                          <Route path="/season">
                            <Route index element={<SeasonPage />} />
                            <Route path="list" element={<SeasonsListPage />} />
                            <Route path="player" element={<SeasonPlayerPage />} />
                          </Route>
                          <Route path="/live-game" element={<LiveGamePage />} />
                          <Route
                            path="/live-game/admin"
                            element={
                              <RequireAuth>
                                <LiveGameAdminPage />
                              </RequireAuth>
                            }
                          />
                          <Route path="/recent-games" element={<RecentGamesPage />} />
                          <Route path="/achievements" element={<AchievementsPage />} />
                          <Route path="/changelog">
                            <Route index element={<ChangelogPage />} />
                            <Route path=":slug" element={<ChangelogPostPage />} />
                          </Route>
                          <Route path="/hall-of-fame">
                            <Route index element={<HallOfFamePage />} />
                            <Route path="leaderboard" element={<HallOfFameLeaderboardPage />} />
                            <Route path=":playerId" element={<HallOfFamePlayerPage />} />
                          </Route>
                          <Route path="/simulations">
                            <Route index element={<SimulationsPage />} />
                            <Route path="win-loss" element={<WinLoss />} />
                            <Route path="expected-leaderboard" element={<SimulatedLeaderboard />} />
                            <Route path="skill-rating" element={<SkillRatingPage />} />
                            <Route path="individual-points" element={<IndividualPointsOverview />} />
                            <Route path="individual-points/player" element={<IndividualPointsPlayer />} />
                            <Route path="optio-pong" element={<OptioPongPage />} />
                          </Route>
                          <Route path="/add-player" element={<AddPlayerPage />} />
                          <Route path="/add-game" element={<ChooseAddOrTrack />} />
                          <Route path="/add-game-add" element={<AddGamePageV2 />} />
                          <Route path="/add-game-track" element={<TrackGamePage />} />
                          <Route path="/game" element={<GameDetailsPage />} />
                          <Route path="/game/edit/score" element={<EditGameSore />} />
                          <Route path="/camera" element={<CameraPage />} />
                          <Route path="/other" element={<OtherPage />} />
                          <Route path="/what-changed" element={<WhatChangedPage />} />
                          <Route path="/statistics" element={<StatisticsPage />} />
                          <Route path="/performance" element={<PerformancePage />} />
                          <Route path="/settings" element={<SettingsPage />} />
                          <Route path="/log-in" element={<LoginPage />} />
                          <Route path="/sign-up" element={<SignupPage />} />
                          <Route
                            path="/admin"
                            element={
                              <RequireAuth>
                                <AdminPage />
                              </RequireAuth>
                            }
                          />
                          <Route
                            path="/me"
                            element={
                              <RequireAuth>
                                <MyPage />
                              </RequireAuth>
                            }
                          />
                          <Route path="*" element={<NotFoundPage />} />
                        </Route>
                      </Routes>
                    </BrowserRouter>
                  </WebSocketRefetcher>
                </EventDbWrapper>
              </div>
            </ToastProvider>
          </ThemeProvider>
        </ImageKitContext>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
