import { QueryClientProvider } from "@tanstack/react-query";
import { TablePage } from "./components/table-page";
import { queryClient } from "./common/query-client";

function App() {
  const queryClienta = queryClient;
  return (
    <QueryClientProvider client={queryClienta}>
      <div className="bg-slate-800 min-h-screen w-full overflow-auto">
        <TablePage />
      </div>
    </QueryClientProvider>
  );
}

export default App;
