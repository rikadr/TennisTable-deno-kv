import { useEffect, useState } from "react";

function App() {
  const [data, setData] = useState<unknown>();
  useEffect(() => {
    fetch("https://rikarddotzl-tennistable-34.deno.dev/elo", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then(async (response) => response.json())
      .then((data) => setData(data));
  }, []);
  return (
    <div className="bg-slate-800 h-screen w-screen">
      <h1>Tennis Table</h1>
      <p>Hallo there :)</p>

      <p>{JSON.stringify(data as string)}</p>
    </div>
  );
}

export default App;
