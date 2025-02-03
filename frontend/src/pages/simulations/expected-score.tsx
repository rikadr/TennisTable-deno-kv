import React from "react";
import { useClientDbContext } from "../../wrappers/client-db-context";

export const ExpectedScore: React.FC = () => {
  const { futureElo } = useClientDbContext();
  return (
    <div className="flex flex-col items-center">
      <h1 className="mb-6 text-2xl">Expected score</h1>
      <p className="w-96">
        Predicts future games based on players' history, then simulates that future. The result should be the expected
        score for every player if current trends contiune.
      </p>
      <button onClick={futureElo.simulate}>Simulate</button>
    </div>
  );
};
