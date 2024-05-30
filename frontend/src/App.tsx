import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./common/query-client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { PlayerPage } from "./components/player-page";
import { AdminPageProtector } from "./components/admin-page-protector";
import { AddPlayerPage } from "./components/add-player-page";
import { LeaderBoardPage } from "./components/leader-board-page";
import { AddGamePage } from "./components/add-game-page";
import { ComparePlayersPage } from "./components/compare-players-page";
import { MyPage } from "./components/my-page";
import { LoginPage } from "./components/login";

function App() {
  const queryClienta = queryClient;
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
            <Route path="/admin" element={<AdminPageProtector />} />
            <Route path="/me" element={<MyPage />} />
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </BrowserRouter>
      </div>
    </QueryClientProvider>
  );
}

export default App;
