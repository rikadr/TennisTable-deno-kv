import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./common/query-client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AddPlayerPage } from "./pages/add-player-page";
import { ComparePlayersPage } from "./pages/compare-players-page";
import { MyPage } from "./pages/my-page";
import { LoginPage } from "./pages/login";
import { AdminPage } from "./pages/admin/admin-page";
import { Analytics } from "@vercel/analytics/react";
import { session } from "./services/auth";
import { SignupPage } from "./pages/sign-up";
import { WebSocketRefetcher } from "./wrappers/web-socket-refetcher";
import { NavMenu } from "./wrappers/nav-menu";
import { ZoomWrapper } from "./wrappers/zoom-wrapper";
import { PvPPage } from "./pages/pvp-page";
import { CameraPage } from "./pages/camera/camera-page";
import { LeaderBoard } from "./pages/leaderboard/leader-board";
import { SimulationsPage } from "./pages/simulations/simulations-page";
import { WinLoss } from "./pages/simulations/win-loss";
import { ExpectedScore } from "./pages/simulations/expected-score";
import { TournamentsListPage } from "./pages/tournament/tournaments-list-page";
import { TournamentPage } from "./pages/tournament/tournament-page";
import { getClientConfig } from "./client/client-config/get-client-config";
import Snowfall from "react-snowfall";
import { HelmetSetter } from "./wrappers/helmet";
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
    <QueryClientProvider client={client}>
      <Analytics />
      <ImageKitContext>
        <ThemeProvider>
          {clientConfig.snow && <Snowfall radius={[0.2, 1]} speed={[0.1, 0.3]} wind={[0, 1]} />}
          <div className="min-h-screen w-full overflow-auto">
            <HelmetSetter />
            <ZoomWrapper>
              <WebSocketRefetcher>
                <EventDbWrapper>
                  <BrowserRouter>
                    <Routes>
                      <Route path="/" element={<NavMenu />}>
                        <Route index element={<Navigate to="/leader-board" />} />
                        <Route path="/tennis-table" element={<Navigate to="/leader-board" />} />
                        <Route path="/leader-board" element={<LeaderBoard />} />
                        <Route path="/player/:name" element={<PlayerPage />} />
                        <Route path="/1v1" element={<PvPPage />} />
                        <Route path="/compare-players" element={<ComparePlayersPage />} />
                        <Route path="/tournament">
                          <Route index element={<TournamentPage />} />
                          <Route path="list" element={<TournamentsListPage />} />
                        </Route>
                        <Route path="/simulations">
                          <Route index element={<SimulationsPage />} />
                          <Route path="win-loss" element={<WinLoss />} />
                          <Route path="expected-score" element={<ExpectedScore />} />
                          <Route path="expected-leaderboard" element={<SimulatedLeaderboard />} />
                          <Route path="individual-points" element={<IndividualPointsOverview />} />
                          <Route path="individual-points/player" element={<IndividualPointsPlayer />} />
                        </Route>
                        <Route path="/add-player" element={<AddPlayerPage />} />
                        <Route path="/add-game" element={<AddGamePageV2 />} />
                        <Route path="/game/edit/score" element={<EditGameSore />} />
                        <Route path="/camera" element={<CameraPage />} />
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
                      </Route>
                    </Routes>
                  </BrowserRouter>
                </EventDbWrapper>
              </WebSocketRefetcher>
            </ZoomWrapper>
          </div>
        </ThemeProvider>
      </ImageKitContext>
    </QueryClientProvider>
  );
}

export default App;
