import React, { useEffect, useState } from "react";

export const TablePage: React.FC = () => {
  const [data, setData] = useState<unknown>();
  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_BASE_URL}/elo`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then(async (response) => response.json())
      .then((data) => setData(data));
  }, []);
  return (
    <div>
      <h1>Tennis Table</h1>
      <p>Hallo there :)</p>

      <p>ENV base url: {process.env.REACT_APP_API_BASE_URL}</p>
      <p>{JSON.stringify(data as string)}</p>
    </div>
  );
};
