import { QueryClientProvider } from "@tanstack/react-query";
import { TablePage } from "./components/table-page";
import { queryClient } from "./common/query-client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { PlayerPage } from "./components/player-page";

function App() {
  const queryClienta = queryClient;
  return (
    <QueryClientProvider client={queryClienta}>
      <div className="bg-slate-800 min-h-screen w-full overflow-auto">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/tennis-table" />} />
            <Route path="/tennis-table" element={<TablePage />} />
            <Route path="/player/:name" element={<PlayerPage />} />
          </Routes>
        </BrowserRouter>
      </div>
    </QueryClientProvider>
  );
}

export default App;
