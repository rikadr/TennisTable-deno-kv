import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./common/query-client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { PlayerPage } from "./components/player-page";
import { AddPlayerPage } from "./components/add-player-page";
import { LeaderBoardPage } from "./components/leader-board-page";
import { AddGamePage } from "./components/add-game-page";
import { ComparePlayersPage } from "./components/compare-players-page";
import { MyPage } from "./components/my-page";
import { LoginPage } from "./components/login";
import { AdminPage } from "./components/admin-page";
import { session } from "./services/auth";
import { SignupPage } from "./components/sign-up";
import { useWebSocket, WS_BROADCAST } from "./services/web-socket/use-web-socket";

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (!session.isAuthenticated) {
    session.token = undefined;
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
};

function App() {
  const queryClienta = queryClient;

  const { latestMessage } = useWebSocket(process.env.REACT_APP_API_BASE_URL + "/ws-updates");
  if (latestMessage === WS_BROADCAST.RELOAD) {
    // Server has new data and client should refetch.
    window.location.reload(); // TODO: Invalidate query cache instead of refreshing page.
  }

  return (
    <QueryClientProvider client={queryClienta}>
      <div className="bg-slate-800 min-h-screen w-full overflow-auto">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/leader-board" />} />
            <Route path="/tennis-table" element={<Navigate to="/leader-board" />} />
            <Route path="/leader-board" element={<LeaderBoardPage />} />
            <Route path="/compare-players" element={<ComparePlayersPage />} />
            <Route path="/player/:name" element={<PlayerPage />} />
            <Route path="/add-player" element={<AddPlayerPage />} />
            <Route path="/add-game" element={<AddGamePage />} />
            <Route path="/login" element={<LoginPage />} />
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
          </Routes>
        </BrowserRouter>
      </div>
    </QueryClientProvider>
  );
}

export default App;
