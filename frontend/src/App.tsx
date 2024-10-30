import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./common/query-client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { PlayerPage } from "./pages/player-page";
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
import { CameraPage } from "./pages/camera-page";
import { NavMenu } from "./wrappers/nav-menu";
import { ZoomWrapper } from "./wrappers/zoom-wrapper";
import { LeaderBoard } from "./pages/leader-board";
import { PvPPage } from "./pages/pvp-page";

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (!session.isAuthenticated) {
    session.token = undefined;
    return <Navigate to="/login" />;
  }

  return children;
};

function App() {
  const client = queryClient;
  return (
    <QueryClientProvider client={client}>
      <div className="bg-primary-background min-h-screen w-full overflow-auto">
        <WebSocketRefetcher>
          <ClientDbWrapper>
            <ZoomWrapper>
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<NavMenu />}>
                    <Route index element={<Navigate to="/leader-board" />} />
                    <Route path="/tennis-table" element={<Navigate to="/leader-board" />} />
                    <Route path="/leader-board" element={<LeaderBoard />} />
                    <Route path="/compare-players" element={<ComparePlayersPage />} />
                    <Route path="/player/:name" element={<PlayerPage />} />
                    <Route path="/1v1" element={<PvPPage />} />
                    <Route path="/add-player" element={<AddPlayerPage />} />
                    <Route path="/camera" element={<CameraPage />} />
                    <Route path="/add-game" element={<AddGamePage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/sign-up" element={<SignupPage />} />
                  </Route>
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
                </Routes>
              </BrowserRouter>
            </ZoomWrapper>
          </ClientDbWrapper>
        </WebSocketRefetcher>
      </div>
    </QueryClientProvider>
  );
}

export default App;
