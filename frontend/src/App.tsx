import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./common/query-client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { PlayerPage } from "./pages/player/player-page";
import { AddPlayerPage } from "./pages/add-player-page";
import { AddGamePage } from "./pages/add-game-page";
import { ComparePlayersPage } from "./pages/compare-players-page";
import { MyPage } from "./pages/my-page";
import { LoginPage } from "./pages/login";
import { AdminPage } from "./pages/admin-page";
import { session } from "./services/auth";
import { SignupPage } from "./pages/sign-up";
import { WebSocketRefetcher } from "./wrappers/web-socket-refetcher";
import { ClientDbWrapper } from "./wrappers/client-db-context";
import { NavMenu } from "./wrappers/nav-menu";
import { ZoomWrapper } from "./wrappers/zoom-wrapper";
import { PvPPage } from "./pages/pvp-page";
import { CameraPage } from "./pages/camera/camera-page";
import { LeaderBoard } from "./pages/leaderboard/leader-board";
import { SimulationsPage } from "./pages/simulations/simulations-page";
import { MonteCarlo } from "./pages/simulations/monte-carlo/monte-carlo-page";
import { WinLoss } from "./pages/simulations/win-loss";
import { ExpectedScore } from "./pages/simulations/expected-score";
import { TournamentsListPage } from "./pages/tournament/tournaments-list-page";
import { TournamentPage } from "./pages/tournament/tournament-page";

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (!session.isAuthenticated) {
    session.token = undefined;
    return <Navigate to="/log-in" />;
  }

  return children;
};

function App() {
  const client = queryClient;
  return (
    <QueryClientProvider client={client}>
      <div className="bg-primary-background min-h-screen w-full overflow-auto">
        <ZoomWrapper>
          <WebSocketRefetcher>
            <ClientDbWrapper>
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
                      <Route path="monte-carlo" element={<MonteCarlo />} />
                      <Route path="win-loss" element={<WinLoss />} />
                      <Route path="expected-score" element={<ExpectedScore />} />
                    </Route>
                    <Route path="/add-player" element={<AddPlayerPage />} />
                    <Route path="/add-game" element={<AddGamePage />} />
                    <Route path="/camera" element={<CameraPage />} />
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
            </ClientDbWrapper>
          </WebSocketRefetcher>
        </ZoomWrapper>
      </div>
    </QueryClientProvider>
  );
}

export default App;
